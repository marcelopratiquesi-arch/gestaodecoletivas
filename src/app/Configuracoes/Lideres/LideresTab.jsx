// Aba "Líderes": quem responde por cada unidade. A unidade é só um cadastro (nome, endereço...);
// quem entra no sistema é o LÍDER, com login pessoal. Regra: 1 líder por unidade.
// O líder ganha acesso de dois jeitos:
//   1) entra com o Google, pede acesso e é aprovado aqui (bloco "Pedidos de acesso", no topo);
//   2) o admin/mentor cadastra na mão (nome, e-mail, telefone e senha inicial);
//   3) entra com o login antigo da unidade e é obrigado a atualizar o cadastro e conectar o Google
//      (pages/AtualizarCadastro): assume como líder na hora e fica "a conferir" até o admin/mentor confirmar.
// Admin vê todas as unidades; mentor só as dele (as regras do banco também garantem isso).
import { useMemo, useState } from "react";
import { doc, getDoc, writeBatch, serverTimestamp, addDoc, collection, deleteField, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import { useTranslation } from "react-i18next";
import {
  UserCheck, UserPlus, UserX, Search, Loader2, Building2, Mail, Phone, Edit2, X, Check, KeyRound, AlertTriangle, BadgeCheck, UserCog,
} from "lucide-react";
import { db, auth } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { liderMantemAcesso } from "../../../permissions";
import { PendenciasTab } from "../Pendencias/PendenciasTab";
import { usePedidosPendentes } from "../Pendencias/usePedidosPendentes";

const SENHA_MINIMA = 6;
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Como o líder entra no sistema (só para mostrar na tela).
function tipoDeAcesso(u) {
  if (u.liderUid) return u.liderTipo === "senha" ? "senha" : "google";
  if (u.uidLogin && !u.loginAntigoDesligado) return "antigo";
  return null;
}

export function LideresTab() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs, loadingCatalogs } = useCatalogs();
  const { pedidos } = usePedidosPendentes();

  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "Admin";
  const podeAcessar = role === "admin" || role === "mentor";

  const [busca, setBusca] = useState("");
  const [soSemLider, setSoSemLider] = useState(false);
  const [processando, setProcessando] = useState(null);

  // Modal de cadastro manual / edição de contato
  const [modal, setModal] = useState(null); // { modo: 'novo' | 'editar', unidade }
  const [form, setForm] = useState({ unidadeId: "", nome: "", email: "", telefone: "", senha: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const mentores = useMemo(() => catalogs?.mentores || [], [catalogs?.mentores]);

  const minhasUnidades = useMemo(() => {
    const todas = catalogs?.unidades || [];
    return role === "admin" ? todas : todas.filter((u) => u.mentorId === userId);
  }, [catalogs?.unidades, role, userId]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return minhasUnidades
      .filter((u) => !soSemLider || !u.liderUid)
      .filter((u) => !termo || [u.nome, u.estado, u.liderNome, u.liderEmail, u.liderTelefone]
        .some((v) => String(v || "").toLowerCase().includes(termo)))
      // Líder novo "a conferir" aparece primeiro.
      .sort((a, b) => Number(b.liderAConferir === true) - Number(a.liderAConferir === true));
  }, [minhasUnidades, busca, soSemLider]);

  const kpis = useMemo(() => {
    const comLider = minhasUnidades.filter((u) => u.liderUid).length;
    const aConferir = minhasUnidades.filter((u) => u.liderUid && u.liderAConferir === true).length;
    return { total: minhasUnidades.length, comLider, semLider: minhasUnidades.length - comLider, aConferir };
  }, [minhasUnidades]);

  const registrarAuditoria = async (tipoAcao, descricao, unidadeNome, detalhes) => {
    try {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao, descricao, diffExtras: detalhes, modulo: "CONFIGURACOES",
        unidadeNome: unidadeNome || "-", usuarioAcaoNome: meuNome, usuarioAcaoId: userId, dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Falha ao gravar auditoria", e); }
  };

  // Tira o acesso do líder atual da unidade (apaga o crachá) dentro de um batch já aberto.
  // Se o líder também é admin ou mentor, ele só deixa de ser o líder da unidade: o acesso dele fica.
  async function tirarLiderAtual(batch, unidade, motivo) {
    const cracha = await getDoc(doc(db, "usuarios", unidade.liderUid));
    if (cracha.exists() && liderMantemAcesso(cracha.data().role)) return;
    if (cracha.exists()) batch.delete(cracha.ref);
    const pedido = await getDoc(doc(db, "solicitacoes_acesso", unidade.liderUid));
    if (pedido.exists() && pedido.data().status !== "recusado") {
      batch.update(pedido.ref, {
        status: "recusado", motivo, analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
      });
    }
  }

  function abrirNovo(unidade) {
    setErro("");
    setForm({ unidadeId: unidade?.id || "", nome: "", email: "", telefone: "", senha: "" });
    setModal({ modo: "novo", unidade: unidade || null });
  }

  function abrirEditar(unidade) {
    setErro("");
    setForm({ unidadeId: unidade.id, nome: unidade.liderNome || "", email: unidade.liderEmail || "", telefone: unidade.liderTelefone || "", senha: "" });
    setModal({ modo: "editar", unidade });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    const telefone = form.telefone.trim();
    const unidade = minhasUnidades.find((u) => u.id === form.unidadeId);

    if (!unidade) return setErro(t("leadersTab.errors.unit"));
    if (nome.length < 3) return setErro(t("leadersTab.errors.name"));
    if (telefone.length < 6) return setErro(t("leadersTab.errors.phone"));

    if (modal.modo === "editar") {
      setSalvando(true);
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, "usuarios", unidade.liderUid), { nome, telefone });
        batch.update(doc(db, "unidades", unidade.id), { liderNome: nome, liderTelefone: telefone });
        await batch.commit();
        await registrarAuditoria("ALTERADA", "Contato do líder atualizado.", unidade.nome,
          `${unidade.liderNome || "-"} ➔ ${nome} | ${unidade.liderTelefone || "-"} ➔ ${telefone}`);
        setModal(null);
      } catch (err) {
        console.error(err);
        setErro(t("leadersTab.errors.save") + " " + (err.message || ""));
      } finally { setSalvando(false); }
      return;
    }

    if (!emailValido(email)) return setErro(t("leadersTab.errors.email"));
    if (form.senha.length < SENHA_MINIMA) return setErro(t("leadersTab.errors.password", { min: SENHA_MINIMA }));

    const temOutroLider = !!unidade.liderUid;
    if (temOutroLider && !window.confirm(t("leadersTab.replaceConfirm", { unit: unidade.nome, current: unidade.liderNome || unidade.liderEmail, name: nome }))) return;

    setSalvando(true);
    let appSecundario = null;
    try {
      // Cria a conta de login num "app secundário", para o admin/mentor não ser deslogado.
      appSecundario = initializeApp(getApp().options, `CadastroLider_${Date.now()}`);
      const authSecundario = getAuth(appSecundario);
      const cred = await createUserWithEmailAndPassword(authSecundario, email, form.senha);
      const novoUid = cred.user.uid;
      await signOut(authSecundario);

      const batch = writeBatch(db);
      if (temOutroLider) await tirarLiderAtual(batch, unidade, t("leadersTab.replacedReason", { name: nome }));
      batch.set(doc(db, "usuarios", novoUid), {
        nome, email, telefone, role: "lider", unidadeId: unidade.id, status: "ativo",
        criadoPor: userId, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "unidades", unidade.id), {
        liderUid: novoUid, liderNome: nome, liderEmail: email, liderTelefone: telefone,
        liderTipo: "senha", liderDesde: serverTimestamp(), liderAConferir: deleteField(),
      });
      await batch.commit();

      await registrarAuditoria("NOVA", "Líder cadastrado manualmente (e-mail e senha).", unidade.nome,
        `${nome} (${email})${temOutroLider ? ` substituiu ${unidade.liderNome || unidade.liderEmail}` : ""}`);
      setModal(null);
      alert(t("leadersTab.createdManual", { name: nome, email }));
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setErro(t("leadersTab.errors.emailInUse"));
      else if (err.code === "auth/invalid-email") setErro(t("leadersTab.errors.email"));
      else if (err.code === "auth/weak-password") setErro(t("leadersTab.errors.password", { min: SENHA_MINIMA }));
      else setErro(t("leadersTab.errors.save") + " " + (err.message || ""));
    } finally {
      if (appSecundario) await deleteApp(appSecundario).catch(() => {});
      setSalvando(false);
    }
  }

  async function remover(unidade) {
    if (!window.confirm(t("leadersTab.removeConfirm", { name: unidade.liderNome || unidade.liderEmail, unit: unidade.nome }))) return;
    setProcessando(unidade.id);
    try {
      const batch = writeBatch(db);
      await tirarLiderAtual(batch, unidade, t("leadersTab.removedReason"));
      batch.update(doc(db, "unidades", unidade.id), {
        liderUid: deleteField(), liderNome: deleteField(), liderEmail: deleteField(),
        liderTelefone: deleteField(), liderTipo: deleteField(), liderDesde: deleteField(), liderAConferir: deleteField(),
      });
      await batch.commit();
      await registrarAuditoria("EXCLUIDA", "Líder removido da unidade (perdeu o acesso).", unidade.nome,
        `${unidade.liderNome || "-"} (${unidade.liderEmail || "-"})`);
    } catch (err) {
      console.error(err);
      alert(t("leadersTab.errors.remove") + " " + (err.message || ""));
    } finally { setProcessando(null); }
  }

  // Líder que assumiu sozinho (trocou o login antigo da unidade pelo Google): admin/mentor confirma que é a pessoa certa.
  async function confirmar(unidade) {
    if (!window.confirm(t("leadersTab.confirmQuestion", { name: unidade.liderNome || unidade.liderEmail, unit: unidade.nome }))) return;
    setProcessando(unidade.id);
    try {
      await updateDoc(doc(db, "unidades", unidade.id), { liderAConferir: deleteField(), liderConferidoPor: userId, liderConferidoEm: serverTimestamp() });
      await registrarAuditoria("ALTERADA", "Líder conferido e confirmado.", unidade.nome, `${unidade.liderNome || "-"} (${unidade.liderEmail || "-"})`);
    } catch (err) {
      console.error(err);
      alert(t("leadersTab.errors.confirm") + " " + (err.message || ""));
    } finally { setProcessando(null); }
  }

  // Admin ou mentor que também é o líder da unidade: marca a si mesmo como líder, sem criar outra conta.
  // O crachá dele não muda (continua admin/mentor); só a unidade passa a apontar para ele.
  async function assumir(unidade) {
    const temOutroLider = !!unidade.liderUid && unidade.liderUid !== userId;
    const pergunta = temOutroLider
      ? t("leadersTab.assumeReplaceQuestion", { unit: unidade.nome, current: unidade.liderNome || unidade.liderEmail })
      : t("leadersTab.assumeQuestion", { unit: unidade.nome });
    if (!window.confirm(pergunta)) return;
    setProcessando(unidade.id);
    try {
      const entraPeloGoogle = (auth.currentUser?.providerData || []).some((p) => p.providerId === "google.com");
      const batch = writeBatch(db);
      if (temOutroLider) await tirarLiderAtual(batch, unidade, t("leadersTab.replacedReason", { name: meuNome }));
      batch.update(doc(db, "unidades", unidade.id), {
        liderUid: userId, liderNome: meuNome, liderEmail: userData?.email || auth.currentUser?.email || "",
        liderTelefone: userData?.telefone || "", liderTipo: entraPeloGoogle ? "google" : "senha",
        liderDesde: serverTimestamp(), liderAConferir: deleteField(),
      });
      await batch.commit();
      await registrarAuditoria("NOVA", `${role === "admin" ? "Admin" : "Mentor"} marcou a si mesmo como líder da unidade.`, unidade.nome,
        `${meuNome}${temOutroLider ? ` substituiu ${unidade.liderNome || unidade.liderEmail}` : ""}`);
    } catch (err) {
      console.error(err);
      alert(t("leadersTab.errors.assume") + " " + (err.message || ""));
    } finally { setProcessando(null); }
  }

  if (!podeAcessar) return null;

  const rotuloAcesso = {
    google: { texto: t("leadersTab.access.google"), cor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
    senha: { texto: t("leadersTab.access.password"), cor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800" },
    antigo: { texto: t("leadersTab.access.legacy"), cor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" },
  };

  return (
    <div className="p-6 space-y-8">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-emerald-600 text-white rounded-lg"><UserCheck className="w-6 h-6" /></span>
            {t("leadersTab.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">{t("leadersTab.subtitle")}</p>
        </div>
        <button onClick={() => abrirNovo(null)} className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase flex items-center gap-2 shadow-sm self-start md:self-auto">
          <UserPlus className="w-4 h-4" /> {t("leadersTab.new")}
        </button>
      </div>

      {/* NÚMEROS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { rotulo: t("leadersTab.kpi.units"), valor: kpis.total, cor: "text-slate-800 dark:text-white" },
          { rotulo: t("leadersTab.kpi.withLeader"), valor: kpis.comLider, cor: "text-emerald-600" },
          { rotulo: t("leadersTab.kpi.withoutLeader"), valor: kpis.semLider, cor: "text-amber-600" },
          { rotulo: t("leadersTab.kpi.toCheck"), valor: kpis.aConferir, cor: "text-red-600" },
          { rotulo: t("leadersTab.kpi.requests"), valor: pedidos.length, cor: "text-red-600" },
        ].map((k) => (
          <div key={k.rotulo} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k.rotulo}</p>
            <p className={`text-2xl font-black mt-1 ${k.cor}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* PEDIDOS DE ACESSO (login pelo Google) */}
      {pedidos.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 -mx-2">
          <PendenciasTab />
        </div>
      )}

      {kpis.aConferir > 0 && (
        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {t("leadersTab.checkBanner", { count: kpis.aConferir })}
        </p>
      )}

      {/* LISTA DE UNIDADES E SEUS LÍDERES */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("leadersTab.search")}
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={soSemLider} onChange={(e) => setSoSemLider(e.target.checked)} className="accent-red-600" />
            {t("leadersTab.onlyWithout")}
          </label>
        </div>

        {loadingCatalogs ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
        ) : lista.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold text-sm">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" /> {t("leadersTab.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="p-4">{t("leadersTab.col.unit")}</th>
                  <th className="p-4">{t("leadersTab.col.leader")}</th>
                  <th className="p-4">{t("leadersTab.col.access")}</th>
                  {role === "admin" && <th className="p-4">{t("leadersTab.col.mentor")}</th>}
                  <th className="p-4 text-right">{t("leadersTab.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {lista.map((u) => {
                  const acesso = tipoDeAcesso(u);
                  const ocupado = processando === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                      <td className="p-4">
                        <p className="font-black text-slate-800 dark:text-slate-200 uppercase text-xs">{u.nome}</p>
                        <p className="text-[11px] text-slate-400 font-bold">{u.estado || "-"}{u.status && u.status !== "ativa" ? ` · ${u.status}` : ""}</p>
                      </td>
                      <td className="p-4">
                        {u.liderUid ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                              {u.liderNome || "-"}
                              {u.liderAConferir === true && (
                                <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">{t("leadersTab.toCheck")}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.liderEmail || "-"}</p>
                            {u.liderTelefone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.liderTelefone}</p>}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {t("leadersTab.noLeader")}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {acesso ? (
                          <span className={`inline-block px-2 py-1 rounded-md border text-[10px] font-black uppercase ${rotuloAcesso[acesso].cor}`}>{rotuloAcesso[acesso].texto}</span>
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      {role === "admin" && (
                        <td className="p-4 text-xs font-bold text-slate-500">{mentores.find((m) => m.id === u.mentorId)?.nome?.split(" ")[0] || "-"}</td>
                      )}
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {u.liderUid !== userId && (
                            <button onClick={() => assumir(u)} disabled={ocupado} title={t("leadersTab.assume")}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"><UserCog className="w-4 h-4" /></button>
                          )}
                          {u.liderUid ? (
                            <>
                              {u.liderAConferir === true && (
                                <button onClick={() => confirmar(u)} disabled={ocupado} title={t("leadersTab.confirm")}
                                  className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50">
                                  <BadgeCheck className="w-3.5 h-3.5" /> {t("leadersTab.confirm")}
                                </button>
                              )}
                              <button onClick={() => abrirEditar(u)} disabled={ocupado} title={t("leadersTab.edit")}
                                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => abrirNovo(u)} disabled={ocupado} title={t("leadersTab.replace")}
                                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"><UserPlus className="w-4 h-4" /></button>
                              <button onClick={() => remover(u)} disabled={ocupado} title={t("leadersTab.remove")}
                                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                              </button>
                            </>
                          ) : (
                            <button onClick={() => abrirNovo(u)} className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase flex items-center gap-1.5">
                              <UserPlus className="w-3.5 h-3.5" /> {t("leadersTab.register")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-slate-400 font-bold">{t("leadersTab.howTo")}</p>
      </div>

      {/* MODAL: CADASTRAR / EDITAR LÍDER */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && setModal(null)}>
          <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                {modal.modo === "editar" ? <Edit2 className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-emerald-600" />}
                {modal.modo === "editar" ? t("leadersTab.modal.editTitle") : t("leadersTab.modal.newTitle")}
              </h3>
              <button type="button" onClick={() => setModal(null)} disabled={salvando} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.unit")}</span>
              <select value={form.unidadeId} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })} disabled={!!modal.unidade || salvando}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-70">
                <option value="">{t("leadersTab.modal.chooseUnit")}</option>
                {minhasUnidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}{u.liderUid ? ` — ${t("leadersTab.modal.hasLeader", { name: u.liderNome || u.liderEmail })}` : ""}</option>
                ))}
              </select>
            </label>

            {(() => {
              const alvo = minhasUnidades.find((u) => u.id === form.unidadeId);
              return modal.modo === "novo" && alvo?.liderUid ? (
                <p className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">{t("leadersTab.modal.replaceWarning", { name: alvo.liderNome || alvo.liderEmail })}</p>
              ) : null;
            })()}

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.name")}</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} disabled={salvando} maxLength={80}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.email")}</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={salvando || modal.modo === "editar"}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-70" />
              {modal.modo === "editar" && <span className="text-[11px] text-slate-400">{t("leadersTab.modal.emailLocked")}</span>}
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.phone")}</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={salvando} maxLength={30} placeholder="+55 31 99999-9999"
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            </label>

            {modal.modo === "novo" && (
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><KeyRound className="w-3 h-3" /> {t("leadersTab.modal.password")}</span>
                <input type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} disabled={salvando} autoComplete="new-password"
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
                <span className="text-[11px] text-slate-400">{t("leadersTab.modal.passwordHint", { min: SENHA_MINIMA })}</span>
              </label>
            )}

            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("leadersTab.modal.cancel")}</button>
              <button type="submit" disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50">
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("leadersTab.modal.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

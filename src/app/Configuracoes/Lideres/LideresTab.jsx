// Aba "Líderes": quem responde por cada unidade. A unidade é só um cadastro (nome, endereço...);
// quem entra no sistema é o LÍDER, com login pessoal. Cada unidade tem até 2 líderes, e uma pessoa pode ser
// líder de várias unidades (ver saidaDoLider.js).
// O líder ganha acesso de dois jeitos:
//   1) entra com o Google, pede acesso e é aprovado aqui (bloco "Pedidos de acesso", no topo);
//   2) o admin/mentor cadastra na mão (nome, e-mail, telefone e senha inicial);
//   3) entra com o login antigo da unidade e é obrigado a atualizar o cadastro e conectar o Google
//      (pages/AtualizarCadastro): assume como líder na hora e fica "a conferir" até o admin/mentor confirmar.
// Admin vê todas as unidades; mentor só as dele (as regras do banco também garantem isso).
import { useMemo, useRef, useState } from "react";
import { doc, writeBatch, serverTimestamp, addDoc, collection, deleteField, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import { useTranslation } from "react-i18next";
import {
  IdCard, UserCheck, UserPlus, UserX, Search, Loader2, Building2, Mail, Phone, Edit2, X, Check, KeyRound, AlertTriangle, BadgeCheck, UserCog, ScanSearch,
} from "lucide-react";
import { db, auth } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { PendenciasTab } from "../Pendencias/PendenciasTab";
import { usePedidosPendentes } from "../Pendencias/usePedidosPendentes";
import { tirarLiderDaUnidade, camposAoLiberarVaga, textoDaSaida } from "./saidaDoLider";
import { TornarLiderModal } from "./TornarLiderModal";
import { BotaoDocumento, DocumentoModal, BuscaDocumento } from "../Documento/DocumentoModal";

const SENHA_MINIMA = 6;
// País da unidade em sigla (cadastros antigos guardam o nome por extenso; sem país = Brasil).
const NOME_PAIS = { Brasil: "BR", Argentina: "AR", "Estados Unidos": "US" };
const siglaPais = (u) => NOME_PAIS[u.pais] || u.pais || "BR";
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
  const { total: totalPendencias } = usePedidosPendentes();

  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "Admin";
  const podeAcessar = role === "admin" || role === "mentor";

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todas"); // todas | com | sem | conferir
  const [paisFiltro, setPaisFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [mentorFiltro, setMentorFiltro] = useState("");
  const [mostrarBuscaDoc, setMostrarBuscaDoc] = useState(false);
  const pedidosRef = useRef(null);
  const [processando, setProcessando] = useState(null);

  // Modal de cadastro manual / edição de contato
  const [modal, setModal] = useState(null); // { modo: 'novo' | 'editar', unidade }
  const [form, setForm] = useState({ unidadeId: "", nome: "", email: "", telefone: "", senha: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const mentores = useMemo(() => catalogs?.mentores || [], [catalogs?.mentores]);
  const professores = useMemo(() => catalogs?.professores || [], [catalogs?.professores]);
  const [tornarLider, setTornarLider] = useState(null); // { vaga: 1 | 2, unidade }
  const [docAlvo, setDocAlvo] = useState(null); // { id, nome, email }: documento (CPF/DNI/SSN) em edição

  const minhasUnidades = useMemo(() => {
    const todas = catalogs?.unidades || [];
    return role === "admin" ? todas : todas.filter((u) => u.mentorId === userId);
  }, [catalogs?.unidades, role, userId]);

  const paises = useMemo(() => [...new Set(minhasUnidades.map(siglaPais))].sort(), [minhasUnidades]);
  const estados = useMemo(() => [...new Set(minhasUnidades
    .filter((u) => !paisFiltro || siglaPais(u) === paisFiltro)
    .map((u) => String(u.estado || "").trim().toUpperCase()).filter(Boolean))].sort(), [minhasUnidades, paisFiltro]);
  // Mentores: só os que têm unidade no país/estado escolhido (o mentor é designado por região).
  const mentoresDasUnidades = useMemo(() => {
    const daRegiao = minhasUnidades
      .filter((u) => !paisFiltro || siglaPais(u) === paisFiltro)
      .filter((u) => !estadoFiltro || String(u.estado || "").trim().toUpperCase() === estadoFiltro);
    return mentores
      .filter((m) => daRegiao.some((u) => u.mentorId === m.id))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [mentores, minhasUnidades, paisFiltro, estadoFiltro]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return minhasUnidades
      .filter((u) => situacao === "todas"
        || (situacao === "com" && u.liderUid)
        || (situacao === "sem" && !u.liderUid)
        || (situacao === "conferir" && u.liderUid && u.liderAConferir === true))
      .filter((u) => !paisFiltro || siglaPais(u) === paisFiltro)
      .filter((u) => !estadoFiltro || String(u.estado || "").trim().toUpperCase() === estadoFiltro)
      .filter((u) => !mentorFiltro || (mentorFiltro === "-" ? !u.mentorId : u.mentorId === mentorFiltro))
      .filter((u) => !termo || [u.nome, u.estado, u.liderNome, u.liderEmail, u.liderTelefone, u.lider2Nome, u.lider2Email, u.lider2Telefone]
        .some((v) => String(v || "").toLowerCase().includes(termo)))
      // Líder novo "a conferir" aparece primeiro.
      .sort((a, b) => Number(b.liderAConferir === true) - Number(a.liderAConferir === true));
  }, [minhasUnidades, busca, situacao, paisFiltro, estadoFiltro, mentorFiltro]);

  const filtrosAtivos = situacao !== "todas" || paisFiltro || estadoFiltro || mentorFiltro || busca;
  const limparFiltros = () => { setSituacao("todas"); setPaisFiltro(""); setEstadoFiltro(""); setMentorFiltro(""); setBusca(""); };

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

  // Tira o líder atual da unidade dentro de um batch já aberto (ver saidaDoLider.js):
  // admin/mentor só sai da unidade; líder que também é professor volta a ser professor; os demais perdem o acesso.
  function tirarLiderAtual(batch, unidade, motivo, vaga = 1) {
    return tirarLiderDaUnidade(batch, {
      liderUid: vaga === 2 ? unidade.lider2Uid : unidade.liderUid, unidadeId: unidade.id, professores, motivo, quemId: userId, quemNome: meuNome,
    });
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
        nome, email, telefone, role: "lider", unidadeId: unidade.id, unidadeIds: [unidade.id], status: "ativo",
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

  // Tira o 1º (vaga 1) ou o 2º líder (vaga 2). Se sair o 1º e houver 2º, o 2º passa a ser o 1º.
  async function remover(unidade, vaga = 1) {
    const nome = vaga === 2 ? (unidade.lider2Nome || unidade.lider2Email) : (unidade.liderNome || unidade.liderEmail);
    const email = vaga === 2 ? unidade.lider2Email : unidade.liderEmail;
    if (!window.confirm(t("leadersTab.removeConfirm", { name: nome, unit: unidade.nome }))) return;
    setProcessando(unidade.id);
    try {
      const batch = writeBatch(db);
      const saida = await tirarLiderAtual(batch, unidade, t("leadersTab.removedReason"), vaga);
      batch.update(doc(db, "unidades", unidade.id), camposAoLiberarVaga(unidade, vaga));
      await batch.commit();
      await registrarAuditoria("EXCLUIDA",
        `${vaga === 2 ? "2º líder" : "Líder"} removido da unidade (${textoDaSaida(saida) || "saiu"}).`, unidade.nome,
        `${nome || "-"} (${email || "-"})${vaga === 1 && unidade.lider2Uid ? ` | ${unidade.lider2Nome || unidade.lider2Email} passou a ser o 1º líder` : ""}`);
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
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <button onClick={() => setTornarLider({ vaga: 1, unidade: null })} className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-amber-500 hover:text-amber-600 text-xs font-black uppercase flex items-center gap-2 transition-colors">
            <UserCog className="w-4 h-4" /> {t("leadersTab.promote.button")}
          </button>
          <button onClick={() => abrirNovo(null)} className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-colors">
            <UserPlus className="w-4 h-4" /> {t("leadersTab.new")}
          </button>
        </div>
      </div>

      {/* PEDIDOS DE ACESSO (login pelo Google) */}
      {totalPendencias > 0 && (
        <div ref={pedidosRef} className="scroll-mt-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 -mx-2">
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("leadersTab.search")}
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            {role === "admin" && (
              <button type="button" onClick={() => setMostrarBuscaDoc((v) => !v)} aria-expanded={mostrarBuscaDoc}
                className={`px-4 py-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${mostrarBuscaDoc
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600"}`}>
                <ScanSearch className="w-4 h-4" /> {t("document.search.title")}
              </button>
            )}
          </div>

          {role === "admin" && mostrarBuscaDoc && <BuscaDocumento />}

          {/* Situação: um seletor só, com a contagem de cada grupo */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 w-fit max-w-full">
            {[
              { id: "todas", rotulo: t("leadersTab.filter.all"), n: kpis.total },
              { id: "com", rotulo: t("leadersTab.filter.with"), n: kpis.comLider },
              { id: "sem", rotulo: t("leadersTab.filter.without"), n: kpis.semLider },
              { id: "conferir", rotulo: t("leadersTab.filter.toCheck"), n: kpis.aConferir },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setSituacao(f.id)} aria-pressed={situacao === f.id}
                className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-colors ${situacao === f.id
                  ? "bg-white dark:bg-slate-700 text-red-600 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                {f.rotulo}
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center ${situacao === f.id
                  ? "bg-red-600 text-white"
                  : f.id === "conferir" && f.n > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>{f.n}</span>
              </button>
            ))}
          </div>

          {/* Região: país → estado → mentor (cada um mostra só o que existe na escolha anterior) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("leadersTab.filter.country")}</span>
              <select value={paisFiltro} onChange={(e) => { setPaisFiltro(e.target.value); setEstadoFiltro(""); setMentorFiltro(""); }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-black uppercase text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{t("leadersTab.filter.allCountries")}</option>
                {paises.map((p) => <option key={p} value={p}>{t(`common.countries.${p}`, { defaultValue: p })}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("leadersTab.filter.state")}</span>
              <select value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setMentorFiltro(""); }} disabled={!paisFiltro}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-black uppercase text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{t("leadersTab.filter.allStates")}</option>
                {estados.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
            {role === "admin" && (
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("leadersTab.filter.mentor")}</span>
                <select value={mentorFiltro} onChange={(e) => setMentorFiltro(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-black uppercase text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">{t("leadersTab.filter.allMentors")}</option>
                  {mentoresDasUnidades.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  <option value="-">{t("leadersTab.filter.noMentor")}</option>
                </select>
              </label>
            )}
            {filtrosAtivos && (
              <button type="button" onClick={limparFiltros} className="px-3 py-2.5 rounded-xl text-xs font-black uppercase text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-1 lg:justify-start">
                <X className="w-3.5 h-3.5" /> {t("leadersTab.filter.clear")}
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] font-bold text-slate-400 text-right">{t("leadersTab.filter.showing", { count: lista.length, total: minhasUnidades.length })}</p>

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
                            {u.lider2Uid && (
                              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-0.5">
                                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                                  {u.lider2Nome || "-"}
                                  <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800">{t("leadersTab.second.badge")}</span>
                                  <button onClick={() => setDocAlvo({ id: u.lider2Uid, nome: u.lider2Nome, email: u.lider2Email })} title={t("document.modal.edit")}
                                    className="p-1 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600"><IdCard className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => remover(u, 2)} disabled={ocupado} title={t("leadersTab.second.remove")}
                                    className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><UserX className="w-3.5 h-3.5" /></button>
                                </p>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.lider2Email || "-"}</p>
                                {u.lider2Telefone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.lider2Telefone}</p>}
                              </div>
                            )}
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
                              {!u.lider2Uid && (
                                <button onClick={() => setTornarLider({ vaga: 2, unidade: u })} disabled={ocupado} title={t("leadersTab.second.addHint")}
                                  className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 text-[10px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                                  <UserPlus className="w-3.5 h-3.5" /> {t("leadersTab.second.add")}
                                </button>
                              )}
                              <BotaoDocumento onClick={() => setDocAlvo({ id: u.liderUid, nome: u.liderNome, email: u.liderEmail })} disabled={ocupado} />
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
                            <>
                              <button onClick={() => setTornarLider({ vaga: 1, unidade: u })} title={t("leadersTab.promote.title")}
                                className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-[10px] font-black uppercase flex items-center gap-1.5 whitespace-nowrap">
                                <UserCog className="w-3.5 h-3.5" /> {t("leadersTab.promote.pick")}
                              </button>
                              <button onClick={() => abrirNovo(u)} className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5" /> {t("leadersTab.register")}
                              </button>
                            </>
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

      {docAlvo && <DocumentoModal alvo={docAlvo} onClose={() => setDocAlvo(null)} />}

      {/* MODAL: ESCOLHER LÍDER JÁ CADASTRADO (1º ou 2º líder) */}
      {tornarLider && (
        <TornarLiderModal
          unidades={minhasUnidades} todasUnidades={catalogs?.unidades || []} professores={professores} mentores={mentores}
          vaga={tornarLider.vaga} unidadeInicial={tornarLider.unidade}
          quemId={userId} quemNome={meuNome} registrarAuditoria={registrarAuditoria}
          onClose={() => setTornarLider(null)}
        />
      )}

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

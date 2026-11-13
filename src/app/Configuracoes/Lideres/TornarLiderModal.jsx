// "Escolher líder já cadastrado": quem já entra no sistema passa a ser líder de uma unidade,
// como 1º líder (vaga 1) ou como 2º líder (vaga 2). Pode ser:
// - professor de coletiva com login: vira líder e continua professor (o vínculo fica no crachá, professorId);
//   se um dia deixar de ser líder, volta a ser só professor;
// - líder de outra unidade: passa a cuidar das duas (não sai da outra);
// - mentor ou admin: o acesso dele não muda; a unidade só passa a mostrar essa pessoa como líder.
import { useMemo, useState } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { X, Check, Loader2, Search, UserCog, AlertTriangle } from "lucide-react";
import { db } from "../../../services/firebase";
import { ehLider, liderMantemAcesso, unidadesDoLider } from "../../../permissions";
import { professorDoLogin, tirarLiderDaUnidade, crachaAoEntrar, dadosDaVaga, textoDaSaida } from "./saidaDoLider";

export function TornarLiderModal({ unidades, todasUnidades, professores, mentores = [], unidadeInicial, vaga = 1, quemId, quemNome, registrarAuditoria, onClose }) {
  const { t } = useTranslation();
  const [unidadeId, setUnidadeId] = useState(unidadeInicial?.id || "");
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState(null);      // candidato escolhido
  const [cracha, setCracha] = useState(null);      // { existe, dados }
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const nomeDaUnidade = (id) => (todasUnidades.find((u) => String(u.id) === String(id))?.nome || id);

  // Todo mundo que já entra no sistema e pode ser líder: professores com login, líderes das unidades e mentores.
  // (Uma pessoa aparece uma vez só, com as etiquetas do que ela é hoje.)
  const todosCandidatos = useMemo(() => {
    const porUid = new Map();
    const juntar = (uid, dados, etiqueta) => {
      if (!uid) return;
      const atual = porUid.get(uid) || { uid, nome: "", email: "", telefone: "", etiquetas: [] };
      porUid.set(uid, {
        ...atual,
        nome: atual.nome || dados.nome || "", email: atual.email || dados.email || "", telefone: atual.telefone || dados.telefone || "",
        professorId: atual.professorId || dados.professorId,
        etiquetas: atual.etiquetas.includes(etiqueta) ? atual.etiquetas : [...atual.etiquetas, etiqueta],
      });
    };
    professores.filter((p) => p.uidLogin).forEach((p) =>
      juntar(String(p.uidLogin), { nome: p.nome, email: p.email, telefone: p.telefone || p.whatsapp, professorId: String(p.id) }, "professor"));
    todasUnidades.forEach((u) => {
      if (u.liderUid) juntar(String(u.liderUid), { nome: u.liderNome, email: u.liderEmail, telefone: u.liderTelefone }, "lider");
      if (u.lider2Uid) juntar(String(u.lider2Uid), { nome: u.lider2Nome, email: u.lider2Email, telefone: u.lider2Telefone }, "lider");
    });
    mentores.forEach((m) => juntar(String(m.id), { nome: m.nome, email: m.email, telefone: m.telefone }, "mentor"));
    return [...porUid.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [professores, todasUnidades, mentores]);

  const candidatos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todosCandidatos
      .filter((c) => !termo || [c.nome, c.email].some((v) => String(v || "").toLowerCase().includes(termo)))
      .slice(0, 60);
  }, [todosCandidatos, busca]);

  const unidade = unidades.find((u) => u.id === unidadeId);

  async function escolher(c) {
    setErro("");
    setPessoa(c);
    setCracha(null);
    setLendo(true);
    try {
      const snap = await getDoc(doc(db, "usuarios", c.uid));
      setCracha({ existe: snap.exists(), dados: snap.exists() ? snap.data() : null });
    } catch (e) {
      console.error(e);
      setErro(t("leadersTab.promote.errors.read"));
    } finally { setLendo(false); }
  }

  // Situação atual da pessoa, para mostrar antes de confirmar.
  const situacao = useMemo(() => {
    if (!cracha || !pessoa) return null;
    if (!cracha.existe) return { bloqueia: t("leadersTab.promote.errors.noLogin") };
    if (unidade && (unidade.liderUid === pessoa.uid || unidade.lider2Uid === pessoa.uid)) {
      return { bloqueia: t("leadersTab.promote.now.sameUnit") };
    }
    const papel = String(cracha.dados.role || "").trim().toLowerCase();
    if (liderMantemAcesso(papel)) return { texto: t("leadersTab.promote.now.manager") };
    if (papel === "bloqueado") return { bloqueia: t("leadersTab.promote.errors.blocked") };
    if (ehLider(papel)) {
      const lista = unidadesDoLider(cracha.dados);
      if (lista.length === 0) return { texto: t("leadersTab.promote.now.leaderNoUnit"), aviso: true };
      return { texto: t("leadersTab.promote.now.leaderOf", { unit: lista.map(nomeDaUnidade).join(", ") }) };
    }
    if (papel === "professor") return { texto: t("leadersTab.promote.now.teacher") };
    return { bloqueia: t("leadersTab.promote.errors.otherRole", { role: papel || "-" }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cracha, pessoa, unidade, t]);

  const atualDaVaga = unidade ? (vaga === 2 ? unidade.lider2Uid : unidade.liderUid) : null;
  const nomeAtualDaVaga = unidade ? (vaga === 2 ? (unidade.lider2Nome || unidade.lider2Email) : (unidade.liderNome || unidade.liderEmail)) : "";

  async function confirmar() {
    setErro("");
    if (!unidade) return setErro(t("leadersTab.errors.unit"));
    if (!pessoa || !cracha || situacao?.bloqueia) return;

    const uid = pessoa.uid;
    const dados = cracha.dados;
    const papel = String(dados.role || "").trim().toLowerCase();
    const professorId = papel === "professor" ? (professorDoLogin(uid, dados, professores) || pessoa.professorId || null) : null;
    if (papel === "professor" && !professorId) return setErro(t("leadersTab.promote.errors.noTeacherLink"));
    const nome = dados.nome || pessoa.nome || "";
    const substitui = atualDaVaga && atualDaVaga !== uid;

    const linhas = [t(vaga === 2 ? "leadersTab.promote.confirmSecond" : "leadersTab.promote.confirm", { name: nome, unit: unidade.nome })];
    if (substitui) linhas.push(t("leadersTab.promote.confirmReplaces", { current: nomeAtualDaVaga }));
    if (!window.confirm(linhas.join("\n\n"))) return;

    setSalvando(true);
    try {
      const batch = writeBatch(db);
      let saidaDoAnterior = "nada";
      if (substitui) {
        saidaDoAnterior = await tirarLiderDaUnidade(batch, {
          liderUid: atualDaVaga, unidadeId: unidade.id, professores,
          motivo: t("leadersTab.replacedReason", { name: nome }), quemId, quemNome,
        });
      }
      const novoCracha = crachaAoEntrar(dados, unidade.id, professorId);
      if (novoCracha) batch.update(doc(db, "usuarios", uid), novoCracha);
      batch.update(doc(db, "unidades", String(unidade.id)), dadosDaVaga(vaga, {
        uid, nome, email: dados.email || pessoa.email, telefone: dados.telefone || pessoa.telefone,
        tipo: dados.loginGoogle === true ? "google" : "senha",
      }));
      await batch.commit();

      const extras = [`${nome} (${dados.email || pessoa.email || "-"}) — era ${papel || "-"}`];
      if (novoCracha && novoCracha.unidadeIds.length > 1) extras.push(`Agora lidera: ${novoCracha.unidadeIds.map(nomeDaUnidade).join(", ")}`);
      if (substitui) extras.push(`Substituiu ${nomeAtualDaVaga} (${textoDaSaida(saidaDoAnterior)})`);
      await registrarAuditoria(vaga === 2 ? "NOVA" : "ALTERADA",
        vaga === 2 ? "2º líder colocado na unidade." : "Líder escolhido entre quem já tem acesso.", unidade.nome, extras.join("\n"));
      alert(t(vaga === 2 ? "leadersTab.promote.doneSecond" : "leadersTab.promote.done", { name: nome, unit: unidade.nome }));
      onClose();
    } catch (e) {
      console.error(e);
      setErro(t("leadersTab.promote.errors.save") + " " + (e.message || ""));
    } finally { setSalvando(false); }
  }

  const rotuloEtiqueta = { professor: t("leadersTab.promote.tag.teacher"), lider: t("leadersTab.promote.tag.leader"), mentor: t("leadersTab.promote.tag.mentor") };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-600" /> {t(vaga === 2 ? "leadersTab.promote.titleSecond" : "leadersTab.promote.title")}
          </h3>
          <button type="button" onClick={onClose} disabled={salvando} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t(vaga === 2 ? "leadersTab.promote.helpSecond" : "leadersTab.promote.help")}</p>

        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.modal.unit")}</span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} disabled={!!unidadeInicial || salvando}
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-70">
            <option value="">{t("leadersTab.modal.chooseUnit")}</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}{u.liderUid ? ` — ${t("leadersTab.modal.hasLeader", { name: u.liderNome || u.liderEmail })}` : ""}</option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("leadersTab.promote.person")}</span>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} disabled={salvando} placeholder={t("leadersTab.promote.search")}
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
            {candidatos.length === 0 ? (
              <p className="p-3 text-xs text-slate-400 font-bold">{t("leadersTab.promote.noPeople")}</p>
            ) : candidatos.map((c) => (
              <button type="button" key={c.uid} onClick={() => escolher(c)} disabled={salvando}
                className={`w-full text-left p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30 ${pessoa?.uid === c.uid ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
                <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                  {c.nome || "-"}
                  {c.etiquetas.map((e) => (
                    <span key={e} className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{rotuloEtiqueta[e]}</span>
                  ))}
                </span>
                <span className="block text-[11px] text-slate-500">{c.email || "-"}</span>
              </button>
            ))}
          </div>
        </div>

        {lendo && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("leadersTab.promote.reading")}</p>}
        {pessoa && situacao && !lendo && (
          <div className={`text-xs font-bold p-3 rounded-xl ${situacao.bloqueia ? "text-red-600 bg-red-50 dark:bg-red-900/20" : situacao.aviso ? "text-amber-700 bg-amber-50 dark:bg-amber-900/20" : "text-slate-600 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300"}`}>
            <p className="flex items-start gap-2">{(situacao.bloqueia || situacao.aviso) && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />} {pessoa.nome}: {situacao.bloqueia || situacao.texto}</p>
          </div>
        )}
        {atualDaVaga && pessoa && atualDaVaga !== pessoa.uid && (
          <p className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">{t("leadersTab.promote.replaceWarning", { name: nomeAtualDaVaga })}</p>
        )}

        {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{erro}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("leadersTab.modal.cancel")}</button>
          <button type="button" onClick={confirmar} disabled={salvando || lendo || !unidade || !pessoa || !situacao || !!situacao.bloqueia}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50">
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("leadersTab.promote.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

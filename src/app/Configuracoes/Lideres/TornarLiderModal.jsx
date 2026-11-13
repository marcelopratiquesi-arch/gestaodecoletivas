// "Tornar líder quem já tem acesso": um professor de coletiva (ou alguém que ficou como "líder sem
// unidade" por ter sido trocado em Controle de Acessos) passa a ser o LÍDER de uma unidade.
// O líder pode ser professor: o vínculo com o cadastro de professor é mantido no crachá (professorId),
// então ele continua vendo as aulas e os pagamentos dele. Se um dia deixar de ser líder, volta a ser professor.
import { useMemo, useState } from "react";
import { doc, getDoc, writeBatch, serverTimestamp, deleteField } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { X, Check, Loader2, Search, UserCog, AlertTriangle } from "lucide-react";
import { db } from "../../../services/firebase";
import { ehLider, liderMantemAcesso } from "../../../permissions";
import { professorDoLogin, tirarLiderDaUnidade } from "./saidaDoLider";

export function TornarLiderModal({ unidades, todasUnidades, professores, unidadeInicial, quemId, quemNome, registrarAuditoria, onClose }) {
  const { t } = useTranslation();
  const [unidadeId, setUnidadeId] = useState(unidadeInicial?.id || "");
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState(null);      // professor escolhido
  const [cracha, setCracha] = useState(null);      // { existe, dados }
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Só professores que já têm login (o crachá é o do login dele).
  const candidatos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return professores
      .filter((p) => p.uidLogin)
      .filter((p) => !termo || [p.nome, p.email].some((v) => String(v || "").toLowerCase().includes(termo)))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
      .slice(0, 50);
  }, [professores, busca]);

  const unidade = unidades.find((u) => u.id === unidadeId);
  const nomeDaUnidade = (id) => (todasUnidades.find((u) => String(u.id) === String(id))?.nome || id);

  async function escolher(p) {
    setErro("");
    setPessoa(p);
    setCracha(null);
    setLendo(true);
    try {
      const snap = await getDoc(doc(db, "usuarios", String(p.uidLogin)));
      setCracha({ existe: snap.exists(), dados: snap.exists() ? snap.data() : null });
    } catch (e) {
      console.error(e);
      setErro(t("leadersTab.promote.errors.read"));
    } finally { setLendo(false); }
  }

  // Situação atual da pessoa, para mostrar antes de confirmar.
  const situacao = useMemo(() => {
    if (!cracha) return null;
    if (!cracha.existe) return { bloqueia: t("leadersTab.promote.errors.noLogin") };
    const papel = String(cracha.dados.role || "").trim().toLowerCase();
    if (liderMantemAcesso(papel)) return { bloqueia: t("leadersTab.promote.errors.isManager") };
    if (papel === "bloqueado") return { bloqueia: t("leadersTab.promote.errors.blocked") };
    if (ehLider(papel)) {
      const atual = cracha.dados.unidadeId;
      if (!atual) return { texto: t("leadersTab.promote.now.leaderNoUnit"), aviso: true };
      if (String(atual) === String(unidadeId)) return { texto: t("leadersTab.promote.now.sameUnit") };
      return { texto: t("leadersTab.promote.now.leaderOf", { unit: nomeDaUnidade(atual) }), sai: atual };
    }
    if (papel === "professor") return { texto: t("leadersTab.promote.now.teacher") };
    return { bloqueia: t("leadersTab.promote.errors.otherRole", { role: papel || "-" }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cracha, unidadeId, t]);

  async function confirmar() {
    setErro("");
    if (!unidade) return setErro(t("leadersTab.errors.unit"));
    if (!pessoa || !cracha || situacao?.bloqueia) return;

    const uid = String(pessoa.uidLogin);
    const dados = cracha.dados;
    const professorId = professorDoLogin(uid, dados, professores) || String(pessoa.id);
    const nome = dados.nome || pessoa.nome || "";
    const temOutroLider = unidade.liderUid && unidade.liderUid !== uid;

    const linhas = [t("leadersTab.promote.confirm", { name: nome, unit: unidade.nome })];
    if (situacao?.sai) linhas.push(t("leadersTab.promote.confirmLeaves", { unit: nomeDaUnidade(situacao.sai) }));
    if (temOutroLider) linhas.push(t("leadersTab.promote.confirmReplaces", { current: unidade.liderNome || unidade.liderEmail }));
    if (!window.confirm(linhas.join("\n\n"))) return;

    setSalvando(true);
    try {
      const batch = writeBatch(db);
      let saidaDoAnterior = "nada";
      if (temOutroLider) {
        saidaDoAnterior = await tirarLiderDaUnidade(batch, {
          liderUid: unidade.liderUid, professores, motivo: t("leadersTab.replacedReason", { name: nome }), quemId, quemNome,
        });
      }

      // Se era líder de outra unidade, aquela unidade fica sem líder.
      if (situacao?.sai) {
        const antiga = todasUnidades.find((u) => String(u.id) === String(situacao.sai));
        if (antiga && antiga.liderUid === uid) {
          batch.update(doc(db, "unidades", String(antiga.id)), {
            liderUid: deleteField(), liderNome: deleteField(), liderEmail: deleteField(), liderTelefone: deleteField(),
            liderTipo: deleteField(), liderDesde: deleteField(), liderAConferir: deleteField(),
          });
        }
      }

      batch.update(doc(db, "usuarios", uid), { role: "lider", unidadeId: String(unidade.id), professorId });
      batch.update(doc(db, "unidades", String(unidade.id)), {
        liderUid: uid, liderNome: nome, liderEmail: dados.email || pessoa.email || "",
        liderTelefone: dados.telefone || pessoa.telefone || "", liderTipo: dados.loginGoogle === true ? "google" : "senha",
        liderDesde: serverTimestamp(), liderAConferir: deleteField(),
      });
      await batch.commit();

      const extras = [`${nome} (${dados.email || pessoa.email || "-"}) — continua professor`];
      if (situacao?.sai) extras.push(`Deixou de ser líder de ${nomeDaUnidade(situacao.sai)}`);
      if (temOutroLider) extras.push(`Substituiu ${unidade.liderNome || unidade.liderEmail} (${saidaDoAnterior === "professor" ? "voltou a ser professor" : saidaDoAnterior === "mantem" ? "manteve o acesso" : "perdeu o acesso"})`);
      await registrarAuditoria("ALTERADA", "Professor passou a ser líder da unidade.", unidade.nome, extras.join("\n"));
      alert(t("leadersTab.promote.done", { name: nome, unit: unidade.nome }));
      onClose();
    } catch (e) {
      console.error(e);
      setErro(t("leadersTab.promote.errors.save") + " " + (e.message || ""));
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !salvando && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-600" /> {t("leadersTab.promote.title")}
          </h3>
          <button type="button" onClick={onClose} disabled={salvando} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("leadersTab.promote.help")}</p>

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
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
            {candidatos.length === 0 ? (
              <p className="p-3 text-xs text-slate-400 font-bold">{t("leadersTab.promote.noTeachers")}</p>
            ) : candidatos.map((p) => (
              <button type="button" key={p.id} onClick={() => escolher(p)} disabled={salvando}
                className={`w-full text-left p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30 ${pessoa?.id === p.id ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
                <span className="font-bold text-slate-800 dark:text-slate-100">{p.nome}</span>
                <span className="block text-[11px] text-slate-500">{p.email || "-"}</span>
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
        {unidade?.liderUid && pessoa && unidade.liderUid !== String(pessoa.uidLogin) && (
          <p className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">{t("leadersTab.modal.replaceWarning", { name: unidade.liderNome || unidade.liderEmail })}</p>
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

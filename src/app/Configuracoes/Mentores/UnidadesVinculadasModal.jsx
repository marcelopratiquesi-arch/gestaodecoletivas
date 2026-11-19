import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Loader2, Plus, Search, ArrowRightLeft } from "lucide-react";
import { db } from "../../../services/firebase";
import { publicarUnidade } from "../../../services/vitrinePublica";
import PopupFlutuante from "../../../components/PopupFlutuante";

// Vínculo mentor <-> unidades, visto pelo lado do mentor.
// A verdade continua sendo UM campo só: unidades/{id}.mentorId (o mesmo que a aba Unidades edita).
// Por isso trocar aqui ou lá vale igual. Cada clique grava UMA unidade, avisa a vitrine pública
// e deixa registro na auditoria no mesmo formato da aba Unidades.
export function UnidadesVinculadasModal({ mentor, mentores, unidades, quem, onClose }) {
  const { t } = useTranslation();
  const [busca, setBusca] = useState("");
  const [trabalhando, setTrabalhando] = useState(null); // id da unidade em gravação
  const [tirando, setTirando] = useState(null); // unidade que está escolhendo o novo mentor
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState("");

  const nomeMentor = (id) => mentores.find((m) => m.id === id)?.nome || t("mentorsTab.linked.noMentor");

  const dele = useMemo(
    () => unidades.filter((u) => u.mentorId === mentor.id).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
    [unidades, mentor.id]
  );

  const outras = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return unidades
      .filter((u) => u.mentorId !== mentor.id)
      .filter((u) => !termo || (u.nome || "").toLowerCase().includes(termo) || (u.estado || "").toLowerCase().includes(termo))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .slice(0, 40);
  }, [unidades, mentor.id, busca]);

  const destinos = useMemo(
    () => mentores.filter((m) => m.id !== mentor.id && m.status === "ativo" && !m.mentorPrincipalId).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
    [mentores, mentor.id]
  );

  async function mover(unidade, novoMentorId) {
    setErro("");
    setTrabalhando(unidade.id);
    try {
      const antigoNome = nomeMentor(unidade.mentorId);
      const novoNome = nomeMentor(novoMentorId);
      await updateDoc(doc(db, "unidades", unidade.id), { mentorId: novoMentorId, atualizadoEm: serverTimestamp() });
      await publicarUnidade(unidade.id, { ...unidade, mentorId: novoMentorId, mentorNome: novoNome });
      try {
        await addDoc(collection(db, "auditoria_cronograma"), {
          tipoAcao: "ALTERADA", descricao: "Mentor da unidade alterado (aba Mentores).",
          diffExtras: `Mentor: ${antigoNome} ➔ ${novoNome}`, modulo: "CONFIGURACOES",
          unidadeNome: unidade.nome || "-", professorNome: "-", modalidadeNome: "-",
          usuarioAcaoNome: quem?.nome || quem?.email || "Administrador do Sistema",
          usuarioAcaoId: quem?.id || quem?.uid || "", dataAcao: serverTimestamp(),
        });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
      setTirando(null); setDestino("");
    } catch (e) {
      setErro(t("mentorsTab.linked.saveError") + " " + (e.message || ""));
    } finally {
      setTrabalhando(null);
    }
  }

  function adicionar(u) {
    if (u.mentorId && !window.confirm(t("mentorsTab.linked.confirmTake", { unit: u.nome, from: nomeMentor(u.mentorId), to: mentor.nome }))) return;
    mover(u, mentor.id);
  }

  return (
    <PopupFlutuante
      titulo={t("mentorsTab.linked.title", { name: mentor.nome })}
      onFechar={onClose}
      rotuloFechar={t("mentorsTab.modal.cancel")}
      chaveMemoria="mentores.popupUnidades"
      largura={560}
      altura={640}
    >
      <div className="p-5 space-y-6">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{t("mentorsTab.linked.help")}</p>
          {erro && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{erro}</div>}

          <section>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{t("mentorsTab.linked.current", { count: dele.length })}</p>
            {dele.length === 0 ? (
              <p className="text-sm text-slate-400 py-3">{t("mentorsTab.linked.none")}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl">
                {dele.map((u) => (
                  <li key={u.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{u.nome} <span className="text-xs font-medium text-slate-400">{u.estado}</span></span>
                      {tirando?.id === u.id ? (
                        <button onClick={() => { setTirando(null); setDestino(""); }} className="text-xs font-bold text-slate-500 hover:text-slate-700">{t("mentorsTab.modal.cancel")}</button>
                      ) : (
                        <button onClick={() => { setTirando(u); setDestino(""); }} disabled={!!trabalhando} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1 disabled:opacity-50">
                          <ArrowRightLeft className="w-3 h-3" /> {t("mentorsTab.linked.remove")}
                        </button>
                      )}
                    </div>
                    {tirando?.id === u.id && (
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <select value={destino} onChange={(e) => setDestino(e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold dark:text-white">
                          <option value="">{t("mentorsTab.linked.chooseNew")}</option>
                          {destinos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                        <button onClick={() => mover(u, destino)} disabled={!destino || !!trabalhando} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1">
                          {trabalhando === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t("mentorsTab.linked.confirmMove")}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{t("mentorsTab.linked.add")}</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("mentorsTab.linked.search")} className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold dark:text-white outline-none focus:border-red-500" />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl">
              {outras.map((u) => (
                <li key={u.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">
                    <span className="font-bold">{u.nome}</span> <span className="text-xs text-slate-400">{u.estado} · {u.mentorId ? t("mentorsTab.linked.ofMentor", { name: nomeMentor(u.mentorId) }) : t("mentorsTab.linked.noMentor")}</span>
                  </span>
                  <button onClick={() => adicionar(u)} disabled={!!trabalhando} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1 shrink-0 disabled:opacity-50">
                    {trabalhando === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {t("mentorsTab.linked.addButton")}
                  </button>
                </li>
              ))}
              {outras.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 text-center">{t("mentorsTab.linked.noResults")}</li>}
            </ul>
          </section>
        </div>
    </PopupFlutuante>
  );
}

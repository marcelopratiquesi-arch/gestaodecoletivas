import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDoc, arrayRemove, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { dataLocalStr } from "../../../utils/agendaAulas";
import {
  contarAulasPorModalidade, idsHabilitados, podeDesativar, unidadeTemVinculo,
} from "../../../utils/modalidadesPorUnidade";
import { AlertTriangle, Dumbbell, Loader2, Search, X } from "lucide-react";

// Gerenciar as modalidades habilitadas de UMA unidade (campo "modalidadesIds" no documento da unidade).
// Cada clique grava na hora (arrayUnion/arrayRemove: nunca duplica nem apaga as outras).
// Só o admin altera (as regras do banco também exigem); mentor só vê.
export function ModalidadesDaUnidadeModal({ unidade, modalidades, aulas, basicasIds, podeEditar, usuario, onClose }) {
  const { t } = useTranslation();
  const [busca, setBusca] = useState("");
  const [gravando, setGravando] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null); // { id, texto } da modalidade que não pôde ser desativada

  const hoje = dataLocalStr();
  const contagens = useMemo(() => contarAulasPorModalidade(aulas, unidade.id, hoje), [aulas, unidade.id, hoje]);
  const configurada = unidadeTemVinculo(unidade);
  const habilitadas = useMemo(() => new Set(idsHabilitados(unidade)), [unidade]);
  const basicas = useMemo(() => new Set((basicasIds || []).map(String)), [basicasIds]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return [...(modalidades || [])]
      // Inativa no catálogo só aparece se a unidade já a tem habilitada (para poder desabilitar).
      .filter((m) => m.status !== "inativa" || habilitadas.has(String(m.id)))
      .filter((m) => !termo || String(m.nome || "").toLowerCase().includes(termo))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [modalidades, busca, habilitadas]);

  const grupoBasicas = lista.filter((m) => basicas.has(String(m.id)));
  const grupoExtras = lista.filter((m) => !basicas.has(String(m.id)));
  const totalHab = configurada ? habilitadas.size : null;

  const registrarLog = async (descricao, nomeModalidade) => {
    try {
      await addDoc(collection(db, "auditoria_cronograma"), {
        tipoAcao: "ALTERADA", descricao, diffExtras: "", modulo: "CONFIGURACOES",
        unidadeNome: unidade.nome || "-", professorNome: "-", modalidadeNome: nomeModalidade || "-",
        usuarioAcaoNome: usuario?.nome || "Administrador do Sistema", usuarioAcaoId: usuario?.id || null,
        dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  const marcas = () => ({ modalidadesAtualizadoEm: serverTimestamp(), modalidadesAtualizadoPor: usuario?.id || null });

  async function alternar(m) {
    if (!podeEditar || !configurada || gravando) return;
    const id = String(m.id);
    const ligada = habilitadas.has(id);
    setErro(""); setAviso(null);
    if (ligada && !podeDesativar(contagens, id)) {
      setAviso({ id, texto: t("unitsTab.modalities.blocked") });
      return;
    }
    setGravando(id);
    try {
      await updateDoc(doc(db, "unidades", unidade.id), {
        modalidadesIds: ligada ? arrayRemove(id) : arrayUnion(id), ...marcas(),
      });
      await registrarLog(ligada ? "Modalidade desabilitada na unidade." : "Modalidade habilitada na unidade.", m.nome);
    } catch (e) {
      console.error(e);
      setErro(t("unitsTab.modalities.saveError"));
    } finally { setGravando(""); }
  }

  // Unidade ainda sem o campo: o admin começa pelas modalidades que já têm aula ativa ou futura.
  async function configurarPelasAulas() {
    if (!podeEditar || gravando) return;
    setErro(""); setAviso(null); setGravando("*");
    try {
      const ids = Object.keys(contagens);
      await updateDoc(doc(db, "unidades", unidade.id), { modalidadesIds: ids, ...marcas() });
      await registrarLog(`Modalidades da unidade configuradas a partir do Cronograma (${ids.length}).`, "-");
    } catch (e) {
      console.error(e);
      setErro(t("unitsTab.modalities.saveError"));
    } finally { setGravando(""); }
  }

  const linha = (m) => {
    const id = String(m.id);
    const ligada = configurada ? habilitadas.has(id) : true;
    const c = contagens[id];
    return (
      <div key={id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3" style={{ borderLeft: `5px solid ${m.cor || "#EC1C24"}` }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{m.nome}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {c ? [c.ativas ? t("unitsTab.modalities.activeClasses", { count: c.ativas }) : null, c.futuras ? t("unitsTab.modalities.futureClasses", { count: c.futuras }) : null].filter(Boolean).join(" · ") : t("unitsTab.modalities.noClasses")}
              {m.status === "inativa" && <span className="ml-2 text-amber-600">{t("unitsTab.modalities.inactiveInCatalog")}</span>}
            </div>
          </div>
          <button
            type="button" disabled={!podeEditar || !configurada || !!gravando} onClick={() => alternar(m)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors flex items-center gap-1.5 ${ligada ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"} ${podeEditar && configurada ? "hover:opacity-80 cursor-pointer" : "cursor-default opacity-80"}`}
          >
            {gravando === id && <Loader2 className="w-3 h-3 animate-spin" />}
            {ligada ? t("unitsTab.modalities.enabled") : t("unitsTab.modalities.disabled")}
          </button>
        </div>
        {aviso?.id === id && (
          <div className="mt-2 flex items-start gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 normal-case">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {aviso.texto}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden uppercase" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
          <div className="min-w-0">
            <h3 className="text-xs font-black tracking-widest flex items-center gap-2 text-slate-800 dark:text-white"><Dumbbell className="w-4 h-4" /> {t("unitsTab.modalities.title")}</h3>
            <p className="text-[11px] font-bold text-slate-400 truncate">{unidade.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label={t("unitsTab.modalities.close")}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {configurada ? (
            <div className="flex gap-3 text-[11px] font-black">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{t("unitsTab.modalities.countEnabled", { count: totalHab })}</span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">{t("unitsTab.modalities.countDisabled", { count: Math.max(0, (modalidades || []).filter((m) => m.status !== "inativa").length - totalHab) })}</span>
            </div>
          ) : (
            <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 normal-case space-y-2">
              <p>{t("unitsTab.modalities.notConfiguredNote")}</p>
              {podeEditar && (
                <button type="button" onClick={configurarPelasAulas} disabled={!!gravando} className="px-3 py-2 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 flex items-center gap-2">
                  {gravando === "*" && <Loader2 className="w-3 h-3 animate-spin" />} {t("unitsTab.modalities.startFromClasses")}
                </button>
              )}
            </div>
          )}

          {!podeEditar && <p className="text-[11px] font-bold text-slate-400 normal-case">{t("unitsTab.modalities.readOnly")}</p>}
          {erro && <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 normal-case">{erro}</div>}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("unitsTab.modalities.search")}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500" />
          </div>

          {grupoBasicas.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 tracking-widest">{t("unitsTab.modalities.basicGroup")}</div>
              {grupoBasicas.map(linha)}
            </div>
          )}
          {grupoExtras.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 tracking-widest">{t("unitsTab.modalities.extraGroup")}</div>
              {grupoExtras.map(linha)}
            </div>
          )}
          {lista.length === 0 && <p className="text-center text-[11px] font-bold text-slate-400 py-6">{t("unitsTab.modalities.none")}</p>}
        </div>
      </div>
    </div>
  );
}

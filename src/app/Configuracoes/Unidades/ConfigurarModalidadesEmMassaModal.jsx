import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDoc, arrayUnion, collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { dataLocalStr } from "../../../utils/agendaAulas";
import { planejarConfiguracaoEmMassa } from "../../../utils/modalidadesPorUnidade";
import { CheckCircle2, Dumbbell, Loader2, X } from "lucide-react";

// Configura, de uma vez, as modalidades das unidades que ainda não foram configuradas.
// Mostra o plano ANTES (nada é gravado até o admin confirmar). Unidades já configuradas não mudam,
// então dá para repetir sem duplicar nada (arrayUnion).
export function ConfigurarModalidadesEmMassaModal({ unidades, modalidades, aulas, basicasIds, usuario, onClose }) {
  const { t } = useTranslation();
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState(null); // quantidade de unidades gravadas
  const [erro, setErro] = useState("");

  const plano = useMemo(
    () => planejarConfiguracaoEmMassa({ unidades, aulas, modalidades, basicasIds, hoje: dataLocalStr() }),
    [unidades, aulas, modalidades, basicasIds],
  );
  const nomeMod = useMemo(() => Object.fromEntries((modalidades || []).map((m) => [String(m.id), m.nome])), [modalidades]);
  const porAulas = plano.itens.filter((i) => i.origem === "aulas").length;
  const porBasicas = plano.itens.length - porAulas;

  async function aplicar() {
    if (gravando || plano.itens.length === 0) return;
    setGravando(true); setErro("");
    try {
      const marcas = { modalidadesAtualizadoEm: serverTimestamp(), modalidadesAtualizadoPor: usuario?.id || null };
      let gravadas = 0;
      for (let i = 0; i < plano.itens.length; i += 400) {
        const lote = writeBatch(db);
        plano.itens.slice(i, i + 400).forEach(({ unidade, ids }) => {
          lote.update(doc(db, "unidades", unidade.id), { modalidadesIds: arrayUnion(...ids), ...marcas });
        });
        await lote.commit();
        gravadas += Math.min(400, plano.itens.length - i);
      }
      try {
        await addDoc(collection(db, "auditoria_cronograma"), {
          tipoAcao: "ALTERADA", descricao: `Modalidades configuradas em massa em ${gravadas} unidades (${porAulas} pelo Cronograma, ${porBasicas} pelas básicas).`,
          diffExtras: "", modulo: "CONFIGURACOES", unidadeNome: "Várias unidades", professorNome: "-", modalidadeNome: "-",
          usuarioAcaoNome: usuario?.nome || "Administrador do Sistema", usuarioAcaoId: usuario?.id || null, dataAcao: serverTimestamp(),
        });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
      setFeito(gravadas);
    } catch (e) {
      console.error(e);
      setErro(t("unitsTab.modalities.bulk.error"));
    } finally { setGravando(false); }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" onClick={gravando ? undefined : onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
          <h3 className="text-xs font-black tracking-widest flex items-center gap-2 text-slate-800 dark:text-white uppercase"><Dumbbell className="w-4 h-4" /> {t("unitsTab.modalities.bulk.title")}</h3>
          <button onClick={onClose} disabled={gravando} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label={t("unitsTab.modalities.close")}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
          {feito !== null ? (
            <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-4 font-bold">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> {t("unitsTab.modalities.bulk.done", { count: feito })}
            </div>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 font-medium">{t("unitsTab.modalities.bulk.intro")}</p>
              <ul className="space-y-1 font-bold text-slate-700 dark:text-slate-200">
                <li>• {t("unitsTab.modalities.bulk.toConfigure", { count: plano.itens.length })} ({t("unitsTab.modalities.bulk.fromClasses", { count: porAulas })}; {t("unitsTab.modalities.bulk.fromBasics", { count: porBasicas })})</li>
                <li>• {t("unitsTab.modalities.bulk.alreadyDone", { count: plano.jaConfiguradas.length })}</li>
                {plano.semBasicas.length > 0 && <li className="text-amber-700">• {t("unitsTab.modalities.bulk.noBasics", { count: plano.semBasicas.length })}</li>}
                {plano.divergencias.length > 0 && <li className="text-amber-700">• {t("unitsTab.modalities.bulk.mismatch", { count: plano.divergencias.length })}</li>}
              </ul>

              {plano.itens.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {plano.itens.map(({ unidade, ids, origem }) => (
                    <div key={unidade.id} className="px-3 py-2">
                      <div className="text-xs font-black text-slate-800 dark:text-white uppercase">{unidade.nome} <span className="font-bold text-slate-400">· {t(`unitsTab.modalities.bulk.origin.${origem}`)}</span></div>
                      <div className="text-[11px] font-bold text-slate-500">{ids.map((id) => nomeMod[String(id)] || id).join(", ")}</div>
                    </div>
                  ))}
                </div>
              )}
              {erro && <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</div>}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3 justify-end">
          <button onClick={onClose} disabled={gravando} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-xs uppercase tracking-widest">
            {feito !== null ? t("unitsTab.modalities.close") : t("common.actions.cancel")}
          </button>
          {feito === null && (
            <button onClick={aplicar} disabled={gravando || plano.itens.length === 0}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              {gravando && <Loader2 className="w-3 h-3 animate-spin" />} {t("unitsTab.modalities.bulk.apply", { count: plano.itens.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

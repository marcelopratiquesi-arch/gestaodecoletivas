// Valor sugerido pela tabela de preços, mostrado debaixo do valor da aula no Cronograma.
// Só sugere e compara: o valor continua digitado à mão (o botão "Usar" só copia para o campo se a pessoa clicar).
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { LIMITE_MANHA_NOITE } from "./limites";

const reais = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** @param {{ sugestao: object|null, carregando: boolean, valorDigitado: string, onUsar: (valor: number) => void, frequencia: {manha:number, noite:number} }} props */
export default function SugestaoDeValor({ sugestao, carregando, valorDigitado, onUsar, frequencia }) {
  const { t } = useTranslation();
  if (carregando) return <p className="text-[11px] text-slate-400 mt-2">{t("priceTable.suggest.loading")}</p>;
  if (!sugestao) return <p className="text-[11px] text-slate-400 mt-2">{t("priceTable.suggest.none")}</p>;

  const digitado = parseFloat(valorDigitado);
  const unico = sugestao.valores.length === 1 ? sugestao.valores[0] : null;
  const dif = unico !== null && Number.isFinite(digitado) && digitado > 0 ? digitado - unico : null;
  const nivel = t(`priceTable.levels.${sugestao.nivel}`);

  return (
    <div className="mt-2 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-1.5 text-xs">
      <p className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wide text-[10px]"><Lightbulb className="w-3.5 h-3.5" /> {t("priceTable.suggest.title")}</p>
      {unico !== null ? (
        <p className="font-black text-slate-800 dark:text-white text-sm">R$ {reais(unico)}</p>
      ) : (
        <ul className="font-black text-slate-800 dark:text-white space-y-0.5">
          {sugestao.porDia.map((d) => (
            <li key={d.dia ?? "x"}>
              {t(`priceTable.suggest.days.${d.dia}`)}: R$ {reais(d.valor)}
              {d.seguida && <span className="font-semibold text-slate-500"> · {t("priceTable.suggest.followingTag")}</span>}
              {d.saver && <span className="font-semibold text-slate-500"> · {t("priceTable.suggest.saverTag")}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-slate-600 dark:text-slate-300">
        {nivel} · {sugestao.nivel === "cinza" ? t("priceTable.suggest.whyNone") : t("priceTable.suggest.why", { count: sugestao.quantidade })}
        {sugestao.soAcademico && ` · ${t("priceTable.suggest.saver")}`}
        {sugestao.temSeguida && unico !== null && ` · ${t("priceTable.suggest.followingNow")}`}
      </p>
      {sugestao.seguidas !== null && !sugestao.temSeguida && <p className="text-slate-600 dark:text-slate-300">{t("priceTable.suggest.seguidas", { valor: reais(sugestao.seguidas) })}</p>}
      {sugestao.candidataPreta && sugestao.extraPreta > 0 && (
        <p className="text-slate-600 dark:text-slate-300">{t("priceTable.suggest.preta", { extra: reais(sugestao.extraPreta), manha: frequencia?.manha ?? LIMITE_MANHA_NOITE.manha, noite: frequencia?.noite ?? LIMITE_MANHA_NOITE.noite })}</p>
      )}
      {dif !== null && (
        <p className={`font-bold ${Math.abs(dif) < 0.005 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {Math.abs(dif) < 0.005 ? t("priceTable.suggest.equal") : t(dif > 0 ? "priceTable.suggest.higher" : "priceTable.suggest.lower", { dif: reais(Math.abs(dif)) })}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{t("priceTable.suggest.note")}</span>
        {unico !== null && (
          <button type="button" onClick={() => onUsar(unico)} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px]">{t("priceTable.suggest.use")}</button>
        )}
      </div>
    </div>
  );
}

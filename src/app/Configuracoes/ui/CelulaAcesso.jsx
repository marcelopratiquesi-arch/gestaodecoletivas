// Coluna "Acesso" padrão das tabelas: data e hora do último acesso + "hoje / há X dias" colorido
// (verde até 7 dias, âmbar até 30, vermelho acima). Sem registro: "Nunca entrou" em cinza.
// `como` (opcional) mostra, pequeno, por onde a pessoa entra: google | senha | antigo.
import { KeyRound, Building2, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";

// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
const COR = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};
const COMO = { google: Globe, senha: KeyRound, antigo: Building2 };

/** @param {{quando:any, como?:"google"|"senha"|"antigo", rotulo?:string, carregando?:boolean}} props */
export function CelulaAcesso({ quando, como, rotulo, carregando }) {
  const { t, i18n } = useTranslation();
  const ac = resumoDoAcesso(quando, i18n.language);
  const IconeComo = como && COMO[como];
  return (
    <div className="text-xs whitespace-nowrap leading-tight">
      {rotulo && <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-0.5">{rotulo}</div>}
      {ac ? (
        <>
          <div className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{ac.dia} · {ac.hora}</div>
          <div className={`text-[11px] font-black ${COR[ac.cor]}`}>{ac.relativo}</div>
        </>
      ) : carregando ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
      ) : (
        <div className="text-[11px] font-bold text-slate-400">{t("tabela.access.never")}</div>
      )}
      {IconeComo && (
        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-400" title={t(`tabela.access.via.${como}`)}>
          <IconeComo className="w-3 h-3" /> {t(`tabela.access.via.${como}`)}
        </div>
      )}
    </div>
  );
}

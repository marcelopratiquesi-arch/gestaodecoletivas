// Título de coluna que ordena (A→Z / Z→A). Usa o retorno de useOrdenacao. A seta da coluna ativa fica na cor da aba.
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";

// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
const SETA_ATIVA = "text-red-600 dark:text-red-400";

export const CLASSE_TITULO = "px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap";

/** @param {{campo:string, rotulo:string, ordenacao:{campo:string|null,direcao:string,ordenarPor:(c:string)=>void}, className?:string}} props */
export function ColunaOrdenavel({ campo, rotulo, ordenacao, className = "" }) {
  const { t } = useTranslation();
  const ativa = ordenacao.campo === campo;
  const Seta = !ativa ? ChevronsUpDown : ordenacao.direcao === "asc" ? ChevronUp : ChevronDown;
  return (
    <th className={`${CLASSE_TITULO} ${className}`} aria-sort={!ativa ? "none" : ordenacao.direcao === "asc" ? "ascending" : "descending"}>
      <button type="button" onClick={() => ordenacao.ordenarPor(campo)}
        title={ativa && ordenacao.direcao === "asc" ? t("tabela.sortDesc") : t("tabela.sortAsc")}
        className={`inline-flex items-center gap-1.5 uppercase tracking-widest hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${ativa ? "text-slate-800 dark:text-slate-100" : ""}`}>
        {rotulo}
        <Seta className={`w-3.5 h-3.5 ${ativa ? SETA_ATIVA : "opacity-40"}`} />
      </button>
    </th>
  );
}

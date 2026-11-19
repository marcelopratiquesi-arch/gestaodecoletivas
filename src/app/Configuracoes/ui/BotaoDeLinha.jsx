// Botão de ação de cada linha das tabelas (editar, ativar/desativar, excluir...). Mesmo formato em todas as abas.
// tipo: "editar" = cor da aba;  "ativar" = verde;  "desativar" = âmbar;  "perigo" = vermelho (excluir/remover).
// ATENÇÃO: as classes abaixo são escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
import { temaDaAba } from "./temas";

const POR_COR = {
  emerald: "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white",
  red: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white",
  amber: "bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-600 dark:hover:text-white",
  slate: "bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-500 dark:hover:text-white",
};

// Discreto (padrão novo das tabelas, 360 de 2026-11-19): cinza parado, a cor só aparece ao passar o mouse.
const DISCRETO = {
  emerald: "bg-slate-100 text-slate-500 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-emerald-600 dark:hover:text-white",
  red: "bg-slate-100 text-slate-500 hover:bg-red-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-600 dark:hover:text-white",
  amber: "bg-slate-100 text-slate-500 hover:bg-amber-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-amber-600 dark:hover:text-white",
  slate: "bg-slate-100 text-slate-500 hover:bg-slate-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-500 dark:hover:text-white",
};

/**
 * @param {{abaId:string, tipo?:"editar"|"ativar"|"desativar"|"perigo", icone:React.ElementType,
 *          compacto?:boolean, girar?:boolean, discreto?:boolean, className?:string}} props
 * Demais props (onClick, title, disabled...) vão direto para o <button>.
 */
export function BotaoDeLinha({ abaId, tipo = "editar", icone, compacto, girar, discreto, className = "", ...resto }) {
  const Icone = icone;
  const cor = tipo === "perigo" ? "red" : tipo === "desativar" ? "amber" : tipo === "ativar" ? "emerald" : temaDaAba(abaId).cor;
  const mapa = discreto ? DISCRETO : POR_COR;
  return (
    <button type="button" aria-label={resto.title} {...resto}
      className={`${compacto ? "p-1.5 rounded-md" : "p-2 rounded-lg"} transition-colors disabled:opacity-50 ${mapa[cor] || mapa.slate} ${className}`}>
      <Icone className={`${compacto ? "w-3.5 h-3.5" : "w-4 h-4"} ${girar ? "animate-spin" : ""}`} />
    </button>
  );
}

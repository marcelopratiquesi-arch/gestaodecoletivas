// Botão de ação de cada linha das tabelas (editar, ativar/desativar, excluir...). Mesmo formato em todas as abas.
// tipo: "editar" = cor da aba;  "ativar" = verde;  "desativar" = laranja;  "perigo" = vermelho (excluir/remover).
// ATENÇÃO: as classes abaixo são escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
import { temaDaAba } from "./temas";

const POR_COR = {
  blue: "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white",
  teal: "bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-600 dark:hover:text-white",
  green: "bg-green-50 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white",
  red: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white",
  orange: "bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-600 dark:hover:text-white",
  pink: "bg-pink-50 text-pink-600 hover:bg-pink-600 hover:text-white dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-600 dark:hover:text-white",
  purple: "bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-600 dark:hover:text-white",
  slate: "bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-500 dark:hover:text-white",
};

// Discreto (padrão novo das tabelas, 360 de 2026-11-19): cinza parado, a cor só aparece ao passar o mouse.
const DISCRETO = {
  blue: "bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-600 dark:hover:text-white",
  teal: "bg-slate-100 text-slate-500 hover:bg-teal-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-teal-600 dark:hover:text-white",
  green: "bg-slate-100 text-slate-500 hover:bg-green-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-green-600 dark:hover:text-white",
  red: "bg-slate-100 text-slate-500 hover:bg-red-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-600 dark:hover:text-white",
  orange: "bg-slate-100 text-slate-500 hover:bg-orange-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-orange-600 dark:hover:text-white",
  pink: "bg-slate-100 text-slate-500 hover:bg-pink-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-pink-600 dark:hover:text-white",
  purple: "bg-slate-100 text-slate-500 hover:bg-purple-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-purple-600 dark:hover:text-white",
  slate: "bg-slate-100 text-slate-500 hover:bg-slate-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-500 dark:hover:text-white",
};

/**
 * @param {{abaId:string, tipo?:"editar"|"ativar"|"desativar"|"perigo", icone:React.ElementType,
 *          compacto?:boolean, girar?:boolean, discreto?:boolean, className?:string}} props
 * Demais props (onClick, title, disabled...) vão direto para o <button>.
 */
export function BotaoDeLinha({ abaId, tipo = "editar", icone, compacto, girar, discreto, className = "", ...resto }) {
  const Icone = icone;
  const cor = tipo === "perigo" ? "red" : tipo === "desativar" ? "orange" : tipo === "ativar" ? "green" : temaDaAba(abaId).cor;
  const mapa = discreto ? DISCRETO : POR_COR;
  return (
    <button type="button" aria-label={resto.title} {...resto}
      className={`${compacto ? "p-1.5 rounded-md" : "p-2 rounded-lg"} transition-colors disabled:opacity-50 ${mapa[cor] || mapa.slate} ${className}`}>
      <Icone className={`${compacto ? "w-3.5 h-3.5" : "w-4 h-4"} ${girar ? "animate-spin" : ""}`} />
    </button>
  );
}

// Etiqueta pequena padrão embaixo/ao lado do nome nas tabelas (A CONFERIR, 2º LÍDER, TEMPORÁRIO...). Mesmo formato em todas as abas.
// tipo: "aviso" = âmbar (precisa de atenção) · "info" = cinza (informação) · "tema" = cor da aba · "perigo" = vermelho.
// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
import { temaDaAba } from "./temas";

const POR_TIPO = {
  aviso: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  info: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  turquesa: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800", // etiqueta de temporário em Mentores (cor fixa, não segue o tema de Líderes)
  perigo: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
};

/** @param {{tipo?:"aviso"|"info"|"tema"|"perigo"|"turquesa", abaId?:string, icone?:React.ElementType, children:React.ReactNode, title?:string}} props */
export function Selo({ tipo = "info", abaId, icone, children, title }) {
  const Icone = icone;
  const cor = tipo === "tema" ? temaDaAba(abaId).suave : POR_TIPO[tipo] || POR_TIPO.info;
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wide whitespace-nowrap align-middle ${cor}`}>
      {Icone && <Icone className="w-3 h-3" />} {children}
    </span>
  );
}

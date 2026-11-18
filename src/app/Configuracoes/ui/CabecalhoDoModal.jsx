// Cabeçalho padrão dos modais das Configurações: faixa cinza + ícone na cor da aba + título + (subtítulo) + botão fechar.
// Fica fixo no alto quando o modal rola (use `shrink-0` no pai em coluna ou deixe o pai com overflow-y-auto).
import { X } from "lucide-react";
import { temaDaAba } from "./temas";

/**
 * @param {{abaId:string, icone:React.ElementType, titulo:React.ReactNode, subtitulo?:string,
 *          onFechar:()=>void, desabilitado?:boolean}} props
 */
export function CabecalhoDoModal({ abaId, icone, titulo, subtitulo, onFechar, desabilitado }) {
  const Icone = icone;
  const tema = temaDaAba(abaId);
  return (
    <div className="shrink-0 px-5 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 flex justify-between items-start gap-3">
      <div className="min-w-0">
        <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
          <span className={`p-1.5 rounded-lg shrink-0 ${tema.iconeTitulo}`}><Icone className="w-4 h-4" /></span>
          <span className="min-w-0 break-words">{titulo}</span>
        </h3>
        {subtitulo && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{subtitulo}</p>}
      </div>
      <button type="button" onClick={onFechar} disabled={desabilitado}
        className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

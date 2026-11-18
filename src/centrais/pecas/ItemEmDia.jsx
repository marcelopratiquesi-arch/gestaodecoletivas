import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

// Um item do quadro "Está tudo em dia?": ✓ verde quando está certo; ⚠ amarelo (atenção) ou
// vermelho (erro) quando falta algo, com a frase do que falta e o botão que leva ao lugar de resolver.
export default function ItemEmDia({ ok, nivel = 'atencao', titulo, frase, textoAcao, onAcao }) {
  const tom = ok
    ? { borda: 'border-slate-200/80 dark:border-slate-800', icone: 'text-emerald-500', frase: 'text-slate-500 dark:text-slate-400' }
    : nivel === 'erro'
      ? { borda: 'border-rose-300 dark:border-rose-500/40', icone: 'text-rose-500', frase: 'text-rose-600 dark:text-rose-400' }
      : { borda: 'border-amber-300 dark:border-amber-500/40', icone: 'text-amber-500', frase: 'text-amber-600 dark:text-amber-400' };
  const Icone = ok ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3 flex items-start gap-3 ${tom.borda}`}>
      <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${tom.icone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-slate-800 dark:text-white leading-snug">{titulo}</p>
        <p className={`text-[11px] font-semibold leading-snug ${tom.frase}`}>{frase}</p>
        {!ok && onAcao && (
          <button
            type="button"
            onClick={onAcao}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            {textoAcao}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

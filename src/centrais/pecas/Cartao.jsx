import { cor as corDe } from './cores';

// Cartão da fila de 5: ícone redondo colorido, título pequeno, valor e uma frase curta.
// Com `alerta`, a borda e a frase ficam amarelas. `extra` aparece ao lado do valor (ex.: ▲ 12%).
export default function Cartao({ icone: Icone, cor = 'blue', titulo, valor, frase, alerta = false, extra = null, onClick }) {
  const Envelope = onClick ? 'button' : 'div';
  return (
    <Envelope
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`text-left bg-white dark:bg-slate-900 rounded-xl border p-3.5 flex items-start gap-3 min-w-0 ${
        alerta ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200/80 dark:border-slate-800'
      } ${onClick ? 'hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors' : ''}`}
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${corDe(alerta ? 'amber' : cor).icone}`}>
        {Icone && <Icone className="w-4 h-4" />}
      </span>
      <span className="min-w-0 flex-1 block">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{titulo}</span>
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[15px] font-extrabold text-slate-800 dark:text-white truncate">{valor}</span>
          {extra}
        </span>
        {frase && (
          <span className={`block text-[11px] font-semibold leading-snug ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {frase}
          </span>
        )}
      </span>
    </Envelope>
  );
}

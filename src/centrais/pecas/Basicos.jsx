// Pecinhas usadas dentro dos quadros das 4 Centrais.
import { AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ROTULO, VALOR } from './cores';
import { formatPeriod } from '../../utils/formatters';

// Frase discreta de "nada por aqui".
export function Vazio({ texto }) {
  return <p className="text-[12px] font-semibold text-slate-400 dark:text-slate-500 py-2">{texto}</p>;
}

// Rótulo pequeno em maiúsculas + valor. `falta` deixa o valor em vermelho.
export function Campo({ rotulo, children, falta = false }) {
  return (
    <div className="min-w-0">
      <p className={ROTULO}>{rotulo}</p>
      <div className={falta ? 'text-[13px] font-bold text-rose-600 dark:text-rose-400' : VALOR}>{children}</div>
    </div>
  );
}

// Número de um quadro de resumo. `extra` = ▲▼; `alerta` = borda amarela; `frase` = linha miúda embaixo.
export function Numero({ rotulo, valor, extra = null, alerta = false, frase = null }) {
  return (
    <div className={`rounded-xl border p-3 ${alerta ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200/80 dark:border-slate-800'} bg-slate-50 dark:bg-slate-800/60`}>
      <p className={ROTULO}>{rotulo}</p>
      <p className="flex items-baseline flex-wrap gap-x-1.5">
        <span className="text-[15px] font-extrabold text-slate-800 dark:text-white">{valor}</span>
        {extra}
      </p>
      {frase && <p className={`text-[10px] font-semibold leading-snug ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>{frase}</p>}
    </div>
  );
}

// "Carregando..." ou "Não carregou" no lugar dos números que vêm do banco.
// Melhor dizer que não carregou do que mostrar um número falso.
export function EstadoCarga({ erro }) {
  const { t } = useTranslation();
  return erro ? (
    <p className="flex items-center gap-2 text-[12px] font-bold text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-4 h-4" /> {t('centrais.naoCarregou')}
    </p>
  ) : (
    <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" /> {t('centrais.carregando')}
    </p>
  );
}

// Período: o mesmo campo de mês do Financeiro e do Relatório, abrindo no mês atual.
export function SeletorDeMes({ mes, mesMaximo, onTrocar, periodo }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <span className={ROTULO}>
        {t('centrais.periodo')}: {formatPeriod(periodo.inicio, periodo.fim, 'dayMonth')}
      </span>
      <label className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 h-9 rounded-xl border border-slate-200 dark:border-slate-800">
        <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-300" />
        <input
          type="month"
          value={mes}
          max={mesMaximo}
          onChange={(e) => { if (e.target.value && e.target.value <= mesMaximo) onTrocar(e.target.value); }}
          aria-label={t('centrais.periodo')}
          className="bg-transparent border-none outline-none text-[12px] font-bold text-slate-700 dark:text-white uppercase cursor-pointer min-w-[175px] dark:[color-scheme:dark]"
        />
      </label>
    </div>
  );
}

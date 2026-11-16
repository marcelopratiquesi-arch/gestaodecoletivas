// Gráficos simples das Centrais (sem biblioteca: só barras desenhadas com a própria tela).
import { useTranslation } from 'react-i18next';
import Variacao from './Variacao';
import { ROTULO } from './cores';
import { formatDate } from '../../utils/formatters';

// Ranking em barras, um debaixo do outro (o maior no topo).
//   linhas: [{ chave, rotulo (texto ou peça), valor (número que define o tamanho), valorTexto, detalhe? }]
// A barra de cada linha é proporcional à maior da lista.
export function GraficoBarras({ linhas, cor = 'bg-blue-500' }) {
  const maior = Math.max(...linhas.map((l) => Number(l.valor) || 0), 0);
  return (
    <ul className="space-y-3">
      {linhas.map((linha, i) => {
        const largura = maior > 0 ? Math.max(((Number(linha.valor) || 0) / maior) * 100, linha.valor > 0 ? 2 : 0) : 0;
        return (
          <li key={linha.chave}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 flex items-baseline gap-2 font-bold text-slate-700 dark:text-slate-200">
                <span className="text-[10px] font-extrabold text-slate-400 tabular-nums w-4 shrink-0">{i + 1}</span>
                <span className="min-w-0 break-words">{linha.rotulo}</span>
              </span>
              <span className="font-extrabold text-slate-800 dark:text-white whitespace-nowrap">{linha.valorTexto}</span>
            </div>
            <div className="mt-1 ml-6 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
            </div>
            {linha.detalhe && <p className="mt-1 ml-6 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{linha.detalhe}</p>}
          </li>
        );
      })}
    </ul>
  );
}

// Evolução mês a mês (trimestre): um bloco por mês, com o valor, uma barra e ▲▼ contra o mês anterior.
//   meses: [{ mes: 'AAAA-MM', valor (número para a barra e para o ▲▼) | null, valorTexto, detalhe?, emAndamento? }]
// valor = null -> mês sem informação (mostra "—", nunca um número inventado).
// O mês em andamento não ganha ▲▼ (mês pela metade contra mês cheio enganaria).
export function EvolucaoMeses({ meses }) {
  const { t } = useTranslation();
  const maior = Math.max(...meses.map((m) => Number(m.valor) || 0), 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {meses.map((m, i) => {
        const anterior = i > 0 ? meses[i - 1].valor : null;
        const largura = maior > 0 && m.valor ? Math.max((m.valor / maior) * 100, 2) : 0;
        return (
          <div key={m.mes} className={`rounded-xl border p-3 bg-slate-50 dark:bg-slate-800/60 ${m.emAndamento ? 'border-blue-200 dark:border-blue-500/30' : 'border-slate-200/80 dark:border-slate-800'}`}>
            <p className={`${ROTULO} flex items-center justify-between gap-2`}>
              <span>{formatDate(`${m.mes}-01`, 'monthYear')}</span>
              {m.emAndamento && <span className="text-blue-600 dark:text-blue-400">{t('centrais.valores.ateHoje')}</span>}
            </p>
            <p className="flex items-baseline flex-wrap gap-x-1.5">
              <span className="text-[15px] font-extrabold text-slate-800 dark:text-white">{m.valor === null ? '—' : m.valorTexto}</span>
              {!m.emAndamento && m.valor !== null && anterior ? <Variacao atual={m.valor} anterior={anterior} /> : null}
            </p>
            <div className="mt-1.5 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${m.emAndamento ? 'bg-blue-400' : 'bg-blue-600'}`} style={{ width: `${largura}%` }} />
            </div>
            {m.detalhe && <p className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{m.detalhe}</p>}
          </div>
        );
      })}
    </div>
  );
}

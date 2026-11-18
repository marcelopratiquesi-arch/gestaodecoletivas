// Aba "Ganhos por professor" dos Relatórios: um bloco por professor, com o detalhe por unidade e modalidade.
// Os dados vêm das mesmas linhas do Relatório (mesmo período, mesmos filtros e mesmas permissões da tela),
// então os totais batem com o "Resumo da Folha". Dinheiro de países diferentes nunca é somado.
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { formatarMoeda, juntarTotais, moedasEmOrdem } from '../../utils/moedas';

const POR_PAGINA = 30;

export default function GanhosPorProfessor({ extrato, t }) {
  const [aberto, setAberto] = useState(null);
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

  const totalGeral = useMemo(() => extrato.reduce((acc, p) => juntarTotais(acc, p.totais), {}), [extrato]);
  const mostrados = extrato.slice(0, visiveis);

  const dinheiro = (totais) => {
    const moedas = moedasEmOrdem(totais);
    return moedas.length === 0 ? '—' : moedas.map((m) => formatarMoeda(totais[m], m)).join(' · ');
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <Users className="w-5 h-5 text-slate-500" />
        <div className="mr-auto">
          <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">{t('reports.earnings.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('reports.earnings.hint')}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase">{t('reports.earnings.grandTotal')}</p>
          <p className="font-black text-emerald-600 dark:text-emerald-400">{dinheiro(totalGeral)}</p>
        </div>
      </div>

      {extrato.length === 0 ? (
        <p className="p-8 text-center text-slate-400 text-sm uppercase">{t('reports.table.noData')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">{t('reports.table.teacher')}</th>
                <th className="px-4 py-3 text-right">{t('reports.table.completed')}</th>
                <th className="px-4 py-3 text-right">{t('reports.table.canceled')}</th>
                <th className="px-4 py-3 text-right">{t('reports.earnings.substitutions')}</th>
                <th className="px-4 py-3 text-right">{t('reports.table.toReceive')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {mostrados.map((p) => {
                const id = String(p.professorId ?? p.professorNome);
                const expandido = aberto === id;
                return (
                  <React.Fragment key={id}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => setAberto(expandido ? null : id)}>
                      <td className="px-4 py-3 text-slate-400">{expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{p.professorNome}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.realizadas}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-500">{p.canceladas}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                        {p.substituicoesFeitas > 0 && <span className="block">{t('reports.earnings.didSub', { count: p.substituicoesFeitas })}</span>}
                        {p.substituidoEmAulas > 0 && <span className="block">{t('reports.earnings.wasSubbed', { count: p.substituidoEmAulas })}</span>}
                        {p.substituicoesFeitas === 0 && p.substituidoEmAulas === 0 && '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-green-600">{dinheiro(p.totais)}</td>
                    </tr>
                    {expandido && (
                      <tr>
                        <td />
                        <td colSpan={5} className="px-4 pb-4">
                          <div className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-400">
                                <tr>
                                  <th className="px-3 py-2 text-left">{t('reports.earnings.unit')}</th>
                                  <th className="px-3 py-2 text-left">{t('reports.table.modality')}</th>
                                  <th className="px-3 py-2 text-right">{t('reports.table.completed')}</th>
                                  <th className="px-3 py-2 text-right">{t('reports.table.canceled')}</th>
                                  <th className="px-3 py-2 text-right">{t('reports.table.toReceive')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {p.detalhes.map((d) => (
                                  <tr key={d.chave}>
                                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{d.unidadeNome}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{d.modalidadeNome}</td>
                                    <td className="px-3 py-2 text-right font-mono">{d.realizadas}</td>
                                    <td className="px-3 py-2 text-right font-mono text-red-500">{d.canceladas}</td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-green-600">{formatarMoeda(d.valor, d.moeda)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {extrato.length > visiveis && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <button type="button" onClick={() => setVisiveis((v) => v + POR_PAGINA)} className="px-5 py-2 text-xs font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            {t('reports.earnings.loadMore', { shown: mostrados.length, total: extrato.length })}
          </button>
        </div>
      )}
    </div>
  );
}

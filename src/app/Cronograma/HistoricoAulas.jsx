// Aba "Histórico" do Cronograma: aulas que já terminaram, fase a fase, com o que mudou na continuação.
// Só admin, mentor e líder chegam aqui (a página esconde a aba do professor). Leve de propósito: nomes
// calculados uma vez, lista em páginas de 40 e nenhuma varredura dupla.
import React, { useMemo, useState } from 'react';
import { History, Trash2, ArrowRight, Edit2 } from 'lucide-react';
import { formatWeekday, formatCurrency } from '../../utils/formatters';
import { continuidadeDasAulas, filtrarHistorico } from '../../utils/historicoAulas';

const POR_PAGINA = 40;
const fmt = (d) => (d ? String(d).split('-').reverse().join('/') : '—');
const sel = 'h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-red-500';

export default function HistoricoAulas({ linhas, aulasTodas, catalogs, mostrarUnidade, onEdit, t }) {
  const [filtros, setFiltros] = useState({ professorId: '', modalidadeId: '', de: '', ate: '' });
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

  const nomes = useMemo(() => ({
    mod: new Map(catalogs.modalidades.map((m) => [String(m.id), m])),
    prof: new Map(catalogs.professores.map((p) => [String(p.id), p])),
    uni: new Map(catalogs.unidades.map((u) => [String(u.id), u])),
  }), [catalogs]);

  const continuidade = useMemo(() => continuidadeDasAulas(aulasTodas), [aulasTodas]);

  // Só oferece nos filtros o que existe no histórico desta visão.
  const opcoes = useMemo(() => {
    const ids = (campo) => [...new Set(linhas.map((a) => String(a[campo])).filter(Boolean))];
    const ordenar = (mapa, lista) => lista.map((id) => ({ id, nome: mapa.get(id)?.nome || '—' })).sort((a, b) => a.nome.localeCompare(b.nome));
    return { professores: ordenar(nomes.prof, ids('professorId')), modalidades: ordenar(nomes.mod, ids('modalidadeId')) };
  }, [linhas, nomes]);

  const filtradas = useMemo(() => filtrarHistorico(linhas, filtros), [linhas, filtros]);
  const mostradas = filtradas.slice(0, visiveis);
  const mudar = (campo) => (e) => { setFiltros((f) => ({ ...f, [campo]: e.target.value })); setVisiveis(POR_PAGINA); };

  const rotuloMudanca = (m) => t(`schedulePage.history.changed.${m}`);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <History className="w-5 h-5 text-slate-500" />
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">{t('schedulePage.history.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('schedulePage.history.count', { count: filtradas.length })}</p>
          </div>
        </div>
        <select className={sel} value={filtros.professorId} onChange={mudar('professorId')} aria-label={t('schedulePage.history.teacher')}>
          <option value="">{t('schedulePage.history.allTeachers')}</option>
          {opcoes.professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className={sel} value={filtros.modalidadeId} onChange={mudar('modalidadeId')} aria-label={t('schedulePage.history.modality')}>
          <option value="">{t('schedulePage.history.allModalities')}</option>
          {opcoes.modalidades.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <label className="text-[10px] font-bold text-slate-400 uppercase flex flex-col gap-1">{t('schedulePage.history.endedFrom')}
          <input type="date" className={sel} value={filtros.de} onChange={mudar('de')} />
        </label>
        <label className="text-[10px] font-bold text-slate-400 uppercase flex flex-col gap-1">{t('schedulePage.history.endedUntil')}
          <input type="date" className={sel} value={filtros.ate} onChange={mudar('ate')} />
        </label>
      </div>

      {filtradas.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-slate-400 dark:text-slate-500">
          <History className="w-12 h-12 mb-3 opacity-20" />
          <p>{t('schedulePage.history.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                {mostrarUnidade && <th className="text-left px-4 py-3">{t('schedulePage.filters.unit')}</th>}
                <th className="text-left px-4 py-3">{t('schedulePage.history.modality')}</th>
                <th className="text-left px-4 py-3">{t('schedulePage.history.daysTime')}</th>
                <th className="text-left px-4 py-3">{t('schedulePage.history.teacher')}</th>
                <th className="text-left px-4 py-3">{t('schedulePage.history.value')}</th>
                <th className="text-left px-4 py-3">{t('schedulePage.history.period')}</th>
                <th className="text-left px-4 py-3">{t('schedulePage.history.outcome')}</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {mostradas.map((a) => {
                const mod = nomes.mod.get(String(a.modalidadeId));
                const prof = nomes.prof.get(String(a.professorId));
                const uni = nomes.uni.get(String(a.unidadeId));
                const cont = continuidade.get(a.id);
                const profNovo = cont ? nomes.prof.get(String(cont.continuadaPor.professorId)) : null;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    {mostrarUnidade && <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{uni?.nome || '—'}</td>}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mod?.cor || '#9ca3af' }} />
                        {mod?.nome || t('schedulePage.unknownModality')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-mono font-bold">{a.hora}</div>
                      <div className="text-xs text-slate-400">{(a.dias || []).map((d) => formatWeekday(d)).join(', ')}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{prof?.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{a.valor ? formatCurrency(Number(a.valor), uni?.pais) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmt(a.dataInicio)} <ArrowRight className="inline w-3 h-3 mx-0.5" /> {fmt(a.dataFim)}</td>
                    <td className="px-4 py-3">
                      {a.excluido === true ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200"><Trash2 className="w-3 h-3" /> {t('schedulePage.history.deleted')}</span>
                      ) : cont ? (
                        <div className="text-xs">
                          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200">{t('schedulePage.history.newPhase')}</span>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            {t('schedulePage.history.continuedBy', { professor: profNovo?.nome || '—', data: fmt(cont.continuadaPor.dataInicio) })}
                            {cont.mudou.length > 0 && <> · {t('schedulePage.history.changedLabel')}: {cont.mudou.map(rotuloMudanca).join(', ')}</>}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('schedulePage.history.endedNoNext')}</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {a.excluido !== true && (
                        <button type="button" onClick={() => onEdit(a)} title={t('schedulePage.history.open')} className="p-2 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtradas.length > visiveis && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <button type="button" onClick={() => setVisiveis((v) => v + POR_PAGINA)} className="px-5 py-2 text-xs font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            {t('schedulePage.history.loadMore', { shown: mostradas.length, total: filtradas.length })}
          </button>
        </div>
      )}
    </div>
  );
}

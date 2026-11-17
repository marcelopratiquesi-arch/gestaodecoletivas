// Janela "Juntar fichas": o admin escolhe quais fichas da grade são a mesma pessoa e qual fica.
// Duas etapas, sem alert do navegador: "Conferir" (só lê e mostra o que vai mudar) e "Juntar agora" (grava).
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Merge, TriangleAlert, CircleCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCatalogs } from '../../../contexts/CatalogContext';
import { prepararJuncao, executarJuncao } from '../../../services/juntarFichasService';
import { gravacoesDoPlano } from '../../../utils/juntarFichas';

export default function JuntarFichasModal({ fichas, aoJuntar, aoFechar }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const { catalogs } = useCatalogs();
  const [incluidas, setIncluidas] = useState(() => new Set(fichas.map(f => f.id)));
  // Sugere ficar a ficha que já tem documento (é a mais nova e certa); senão a ativa.
  const sugerida = fichas.find(f => f.documentoOk) || fichas.find(f => f.status === 'ativo') || fichas[0];
  const [principalId, setPrincipalId] = useState(sugerida.id);
  // Nome, e-mail e telefone que ficam: escolhidos entre os das fichas (padrão: os da ficha que fica).
  const [manter, setManter] = useState({ nome: sugerida.nome || '', email: sugerida.email || '', telefone: sugerida.telefone || '' });
  const [etapa, setEtapa] = useState('escolher'); // escolher | conferindo | conferido | gravando | feito
  const [erro, setErro] = useState('');
  const [preparo, setPreparo] = useState(null);
  const [progresso, setProgresso] = useState(0);

  const unidadesPorFicha = useMemo(() => {
    const nomes = new Map((catalogs?.unidades || []).map(u => [String(u.id), u.nome]));
    const mapa = {};
    (catalogs?.vinculos || []).forEach(v => {
      (mapa[String(v.professorId)] ||= []).push(nomes.get(String(v.unidadeId)) || v.unidadeId);
    });
    return mapa;
  }, [catalogs?.unidades, catalogs?.vinculos]);

  const principal = fichas.find(f => f.id === principalId);
  const outras = fichas.filter(f => incluidas.has(f.id) && f.id !== principalId);
  const ocupado = etapa === 'conferindo' || etapa === 'gravando';

  const mudarEscolha = (fn) => { fn(); setPreparo(null); setErro(''); if (etapa !== 'feito') setEtapa('escolher'); };
  const alternar = (id) => mudarEscolha(() => setIncluidas(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  }));

  const conferir = async () => {
    setEtapa('conferindo'); setErro('');
    try {
      setPreparo(await prepararJuncao(principal, outras, manter));
      setEtapa('conferido');
    } catch (e) {
      console.error('Conferir junção:', e);
      setErro(t('backupTab.merge.readError')); setEtapa('escolher');
    }
  };

  const juntar = async () => {
    setEtapa('gravando'); setErro(''); setProgresso(0);
    try {
      await executarJuncao({
        plano: preparo.plano, principal, outras,
        quem: { id: user?.uid, nome: userData?.nome, email: userData?.email },
        aoAvancar: (feitas, total) => setProgresso(Math.round((feitas / total) * 100)),
      });
      setEtapa('feito');
      aoJuntar?.(preparo.plano.idPrincipal, preparo.plano.idsApagar);
    } catch (e) {
      console.error('Juntar fichas:', e);
      setErro(t('backupTab.merge.writeError')); setEtapa('conferido');
    }
  };

  const p = preparo?.plano;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-amber-600" /> {t('backupTab.merge.title')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{t('backupTab.merge.desc')}</p>
          </div>
          <button onClick={aoFechar} disabled={ocupado} className="p-1 text-slate-400 hover:text-red-600 rounded" title={t('common.actions.cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
          {fichas.map(f => {
            const fica = f.id === principalId;
            const unidades = unidadesPorFicha[String(f.id)] || [];
            return (
              <li key={f.id} className={`px-3 py-2 flex gap-3 items-start ${fica ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                <input type="checkbox" className="mt-1" checked={incluidas.has(f.id)} disabled={ocupado || etapa === 'feito' || fica}
                  onChange={() => alternar(f.id)} title={t('backupTab.merge.include')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{f.nome || '—'} <span className="text-xs font-normal text-slate-400">· {f.status || '-'}</span></p>
                  <p className="text-xs text-slate-500 break-all">{[f.email, f.telefone].filter(Boolean).join(' · ') || '—'}</p>
                  <p className="text-xs text-slate-400">
                    {unidades.length ? t('backupTab.merge.units', { list: unidades.join(', ') }) : t('backupTab.merge.noUnits')}
                    {f.uidLogin ? ` · ${t('backupTab.merge.hasLogin')}` : ''}
                  </p>
                </div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0 cursor-pointer">
                  <input type="radio" name="fichaQueFica" checked={fica} disabled={ocupado || etapa === 'feito' || !incluidas.has(f.id)}
                    onChange={() => mudarEscolha(() => { setPrincipalId(f.id); setManter({ nome: f.nome || '', email: f.email || '', telefone: f.telefone || '' }); })} />
                  {t('backupTab.merge.keep')}
                </label>
              </li>
            );
          })}
        </ul>

        {erro && (
          <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {erro}
          </p>
        )}

        {etapa !== 'feito' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {['nome', 'email', 'telefone'].map(campo => {
              const opcoes = [...new Set(fichas.filter(f => incluidas.has(f.id)).map(f => f[campo]).filter(Boolean))];
              return (
                <label key={campo} className="text-xs font-bold text-slate-500 space-y-1">
                  <span className="block uppercase">{t(`backupTab.merge.keepField.${campo}`)}</span>
                  <select value={manter[campo]} disabled={ocupado}
                    onChange={e => { const v = e.target.value; mudarEscolha(() => setManter(m => ({ ...m, [campo]: v }))); }}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold">
                    {opcoes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        )}

        {p && etapa !== 'feito' && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 text-sm text-slate-700 dark:text-slate-200 space-y-1">
            <p className="font-bold">{t('backupTab.merge.summaryTitle', { name: manter.nome || principal?.nome })}</p>
            <p className="text-xs">{t('backupTab.merge.keeps', { name: manter.nome || '-', email: manter.email || '-', phone: manter.telefone || '-' })}</p>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              <li>{t('backupTab.merge.sumClasses', { count: p.aulas.length })}</li>
              <li>{t('backupTab.merge.sumUnits', { moved: p.vinculosMover.length, dup: p.vinculosApagar.length })}</li>
              <li>{t('backupTab.merge.sumValidations', { count: p.validacoes.length })}</li>
              <li>{t('backupTab.merge.sumBadges', { count: p.crachas.length })}</li>
              {p.mesesResumo.length > 0 && <li>{t('backupTab.merge.sumSummaries', { list: p.mesesResumo.join(', ') })}</li>}
              {Object.keys(p.completar).length > 0 && <li>{t('backupTab.merge.sumFill', { list: Object.keys(p.completar).join(', ') })}</li>}
              {p.documento && <li>{t('backupTab.merge.sumDocument')}</li>}
              <li className="font-bold text-red-700 dark:text-red-400">{t('backupTab.merge.sumDelete', { count: p.idsApagar.length })}</li>
            </ul>
            <p className="text-[11px] text-slate-500">{t('backupTab.merge.cost', { reads: preparo.leituras, writes: gravacoesDoPlano(p) })}</p>
          </div>
        )}

        {p?.conflitoDocumento && etapa !== 'feito' && (
          <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {t('backupTab.merge.documentConflict')}
          </p>
        )}

        {etapa === 'feito' && (
          <p className="p-3 rounded-lg bg-green-100 text-green-700 text-sm font-bold flex items-center gap-2">
            <CircleCheck className="w-4 h-4 shrink-0" /> {t('backupTab.merge.done', { name: principal?.nome })}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {etapa === 'feito' ? (
            <button onClick={aoFechar} className="py-2 px-4 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-bold">{t('backupTab.merge.close')}</button>
          ) : (
            <>
              <button onClick={aoFechar} disabled={ocupado} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">
                {t('common.actions.cancel')}
              </button>
              {etapa !== 'conferido' && etapa !== 'gravando' ? (
                <button onClick={conferir} disabled={ocupado || outras.length === 0} className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                  {etapa === 'conferindo' && <Loader2 className="w-4 h-4 animate-spin" />} {t('backupTab.merge.check')}
                </button>
              ) : (
                <button onClick={juntar} disabled={etapa === 'gravando' || p?.conflitoDocumento}className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                  {etapa === 'gravando' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {etapa === 'gravando' ? `${progresso}%` : t('backupTab.merge.confirm')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

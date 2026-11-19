// Janela "Ligar ficha ao crachá": a mesma pessoa tem ficha na grade e crachá de acesso (ex.: líder que dá aula)
// sem estarem ligados. O admin escolhe a ficha e o crachá; o sistema liga os dois (sem alert do navegador).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Link2, TriangleAlert, CircleCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { ligarFichaAoCracha } from '../../../services/juntarFichasService';

function Opcao({ nome, checked, onChange, titulo, linha, disabled }) {
  return (
    <label className={`px-3 py-2 flex gap-3 items-start cursor-pointer ${checked ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
      <input type="radio" name={nome} className="mt-1" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</span>
        <span className="block text-xs text-slate-500 break-all">{linha}</span>
      </span>
    </label>
  );
}

export default function LigarCrachaModal({ fichas, crachas, aoLigar, aoFechar }) {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [fichaId, setFichaId] = useState(fichas[0]?.id);
  const [crachaId, setCrachaId] = useState(crachas[0]?.id);
  const [etapa, setEtapa] = useState('escolher'); // escolher | gravando | feito
  const [erro, setErro] = useState('');
  const [copiou, setCopiou] = useState(false);
  const [manter, setManter] = useState({}); // o que a pessoa escolheu manter; o que faltar fica com os dados da ficha

  const ficha = fichas.find(f => f.id === fichaId);
  const cracha = crachas.find(c => c.id === crachaId);
  // Crachá já ligado a OUTRA ficha: é caso de juntar as fichas antes.
  const crachaEmOutraFicha = cracha?.professorId && cracha.professorId !== fichaId;
  const fichaComOutroLogin = ficha?.uidLogin && ficha.uidLogin !== crachaId;

  const ligar = async () => {
    setEtapa('gravando'); setErro('');
    try {
      const escolhido = Object.fromEntries(['nome', 'email', 'telefone'].map(c => [c, manter[c] ?? ficha?.[c] ?? '']));
      const r = await ligarFichaAoCracha({ ficha, cracha, manter: escolhido, quem: { id: user?.uid, nome: userData?.nome, email: userData?.email } });
      setCopiou(!!r?.copiouDocumento);
      setEtapa('feito');
      aoLigar?.(cracha.id, ficha.id);
    } catch (e) {
      console.error('Ligar ficha ao crachá:', e);
      setErro(t(e?.message === 'DOCUMENTOS_DIFERENTES' ? 'backupTab.link.documentConflict' : 'backupTab.link.error')); setEtapa('escolher');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-amber-600" /> {t('backupTab.link.title')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{t('backupTab.link.desc')}</p>
          </div>
          <button onClick={aoFechar} disabled={etapa === 'gravando'} className="p-1 text-slate-400 hover:text-red-600 rounded" title={t('common.actions.cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('backupTab.link.teacherRecord')}</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
              {fichas.map(f => (
                <Opcao key={f.id} nome="ficha" checked={f.id === fichaId} onChange={() => { setFichaId(f.id); setManter({}); }} disabled={etapa !== 'escolher'}
                  titulo={`${f.nome || '—'} · ${f.status || '-'}`} linha={[f.email, f.telefone].filter(Boolean).join(' · ') || '—'} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('backupTab.link.badge')}</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
              {crachas.map(c => (
                <Opcao key={c.id} nome="cracha" checked={c.id === crachaId} onChange={() => setCrachaId(c.id)} disabled={etapa !== 'escolher'}
                  titulo={`${c.nome || '—'} · ${c.detalhe || '-'}`} linha={[c.unidade, c.email].filter(Boolean).join(' · ') || '—'} />
              ))}
            </div>
          </div>
        </div>

        {etapa !== 'feito' && ficha && cracha && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {['nome', 'email', 'telefone'].map(campo => {
              const opcoes = [...new Set([ficha[campo], cracha[campo]].filter(Boolean))];
              return (
                <label key={campo} className="text-xs font-bold text-slate-500 space-y-1">
                  <span className="block uppercase">{t(`backupTab.link.keepField.${campo}`)}</span>
                  <select value={manter[campo] ?? ficha[campo] ?? ''} disabled={etapa !== 'escolher'}
                    onChange={e => setManter(m => ({ ...m, [campo]: e.target.value }))}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold">
                    {opcoes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        )}
        {crachaEmOutraFicha && etapa !== 'feito' && (
          <p className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {t('backupTab.link.badgeHasOther')}
          </p>
        )}
        {fichaComOutroLogin && !crachaEmOutraFicha && etapa !== 'feito' && (
          <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {t('backupTab.link.recordHasOther')}
          </p>
        )}
        {erro && (
          <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {erro}
          </p>
        )}
        {etapa === 'feito' && (
          <p className="p-3 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-2">
            <CircleCheck className="w-4 h-4 shrink-0" /> {t('backupTab.link.done', { name: ficha?.nome })}
            {copiou && ` ${t('backupTab.link.copiedDocument')}`}
          </p>
        )}
        {['lider', 'unidade', 'mentor'].includes(cracha?.papel) && etapa !== 'feito' && (
          <p className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-xs font-bold">
            {t('backupTab.link.leaderEffect')}
          </p>
        )}
        {etapa !== 'feito' && <p className="text-[11px] text-slate-500">{t('backupTab.link.whatHappens')}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {etapa === 'feito' ? (
            <button onClick={aoFechar} className="py-2 px-4 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-bold">{t('backupTab.merge.close')}</button>
          ) : (
            <>
              <button onClick={aoFechar} disabled={etapa === 'gravando'} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">
                {t('common.actions.cancel')}
              </button>
              <button onClick={ligar} disabled={etapa === 'gravando' || !ficha || !cracha || crachaEmOutraFicha}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                {etapa === 'gravando' && <Loader2 className="w-4 h-4 animate-spin" />} {t('backupTab.link.confirm')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

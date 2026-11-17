// Selo "possível repetido" nas linhas das abas Professores, Líderes e Mentores.
//  🔴 outra: mesmo telefone de OUTRA pessoa (nome e e-mail diferentes) — só confere.
//  🟡 mesma: a mesma pessoa em várias fichas — sugere juntar (só quando `onJuntar` vem; admin, só professor).
// Homônimo (só o nome igual) não aparece aqui: fica numa lista discreta no Backup.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, Merge } from 'lucide-react';
import { chaveRegistro } from '../../../utils/repetidos';

export default function SeloRepetido({ selo, onJuntar, detalheDe }) {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  if (!selo) return null;
  const mostrarMesma = !!onJuntar && selo.mesma.length > 0;
  if (!selo.outra.length && !mostrarMesma) return null;
  const outros = mostrarMesma ? selo.mesma : selo.outra;
  const forte = selo.outra.length > 0;
  const cor = forte
    ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
    : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400';
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setAberto(v => !v)}
        className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded border ${cor}`}>
        <TriangleAlert className="w-3 h-3" />
        {forte ? t('backupTab.dupBadge.other', { count: selo.outra.length }) : t('backupTab.dupBadge.same', { count: selo.mesma.length + 1 })}
      </button>
      {aberto && (
        <div className="mt-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
          <p className="font-bold">{forte ? t('backupTab.dupBadge.otherHint') : t('backupTab.dupBadge.sameHint')}</p>
          {outros.map(o => (
            <p key={chaveRegistro(o)}>• {o.nome || '—'}{detalheDe ? ` · ${detalheDe(o)}` : ''}</p>
          ))}
          {mostrarMesma && !forte && (
            <button type="button" onClick={onJuntar}
              className="mt-1 py-1 px-2 border border-amber-300 dark:border-amber-700 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 inline-flex items-center gap-1">
              <Merge className="w-3.5 h-3.5" /> {t('backupTab.dupBadge.merge')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

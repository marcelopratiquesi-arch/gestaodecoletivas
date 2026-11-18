import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Lugar reservado para uma informação que o sistema ainda não tem. Nunca mostra número inventado.
export default function EmBreve({ texto }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      <Hourglass className="w-3 h-3" />
      {texto || t('centrais.emBreve')}
    </span>
  );
}

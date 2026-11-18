import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BotaoCopiar from './BotaoCopiar';
import { linkWhatsApp } from '../contato';

// Um dado de contato (telefone, e-mail, nome...) com o botão de copiar e, se for telefone, o de WhatsApp.
export default function Contato({ icone: Icone, classeIcone = 'text-slate-400', texto, copiar = false, whatsapp = false, pais, falta = false }) {
  const { t } = useTranslation();
  const link = whatsapp && !falta ? linkWhatsApp(texto, pais) : null;
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 text-[12px] font-semibold ${falta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
      {Icone && <Icone className={`w-3.5 h-3.5 shrink-0 ${falta ? 'text-rose-500' : classeIcone}`} />}
      <span className="truncate">{texto}</span>
      {copiar && !falta && <BotaoCopiar valor={texto} />}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          title={t('centrais.whatsapp')}
          aria-label={t('centrais.whatsapp')}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors shrink-0"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      )}
    </span>
  );
}

// PADRÃO DO SISTEMA: todo telefone nas abas de Configurações vem com copiar + WhatsApp (se tem número, tem o botão).
// Uso: <AcoesDoContato telefone={x.telefone} pais={x.pais} />  (e <AcoesDoContato valor={email} /> para só copiar).
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import BotaoCopiar from "../../../centrais/pecas/BotaoCopiar";
import { linkWhatsApp } from "../../../centrais/contato";

export function AcoesDoContato({ telefone, pais = "BR", valor }) {
  const { t } = useTranslation();
  const texto = valor ?? telefone;
  if (!texto) return null;
  const link = telefone ? linkWhatsApp(telefone, pais) : null;
  return (
    <span className="inline-flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
      <BotaoCopiar valor={texto} />
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" title={t("centrais.whatsapp")} aria-label={t("centrais.whatsapp")}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors shrink-0">
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      )}
    </span>
  );
}

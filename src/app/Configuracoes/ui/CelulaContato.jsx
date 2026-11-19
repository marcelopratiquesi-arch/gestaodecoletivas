// Contato padrão das tabelas de Configurações: e-mail numa linha, telefone na outra.
// O número NUNCA quebra de linha e o copiar/WhatsApp ficam sempre colados nele.
// `aoEditarTelefone` (opcional) mostra um lápis pequeno para editar o número ali mesmo.
import { Mail, Phone, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AcoesDoContato } from "./AcoesDoContato";
import { FlagIcon } from "./Bandeira";
import { telefoneParaExibir } from "./telefone";

/** @param {{email?:string, telefone?:string, pais?:string, semTelefone?:React.ReactNode, aoEditarTelefone?:()=>void}} props */
export function CelulaContato({ email, telefone, pais = "BR", semTelefone, aoEditarTelefone }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 min-w-0 normal-case">
      {email && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
          <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="truncate" title={email}>{email}</span>
          <AcoesDoContato valor={email} />
        </div>
      )}
      {telefone ? (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
          <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <FlagIcon pais={pais} />
          <span className="font-mono tabular-nums">{telefoneParaExibir(telefone, pais)}</span>
          <AcoesDoContato telefone={telefone} pais={pais} />
          {aoEditarTelefone && (
            <button type="button" onClick={aoEditarTelefone} title={t("tabela.editPhone")} aria-label={t("tabela.editPhone")}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors shrink-0">
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : semTelefone || null}
    </div>
  );
}

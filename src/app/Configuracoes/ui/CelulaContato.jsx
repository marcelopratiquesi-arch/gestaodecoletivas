// Contato padrão das tabelas de Configurações: e-mail numa linha, telefone na outra.
// O número NUNCA quebra de linha e o copiar/WhatsApp ficam sempre colados nele.
import { Mail, Phone } from "lucide-react";
import { AcoesDoContato } from "./AcoesDoContato";
import { FlagIcon } from "./Bandeira";
import { telefoneParaExibir } from "./telefone";

/** @param {{email?:string, telefone?:string, pais?:string, semTelefone?:React.ReactNode}} props */
export function CelulaContato({ email, telefone, pais = "BR", semTelefone }) {
  return (
    <div className="space-y-1 min-w-0">
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
        </div>
      ) : semTelefone || null}
    </div>
  );
}

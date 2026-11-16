// Campo do documento de identificação (CPF / DNI / SSN) nas telas escuras de acesso:
// escolha do tipo + número com pontuação automática. A conferência dos dígitos é feita por quem usa
// (validarDocumento). Estilo claro/escuro do sistema: passe `claro` para usar nas telas internas.
import { useTranslation } from "react-i18next";
import { IdCard } from "lucide-react";
import { TIPOS_DOCUMENTO, formatarDocumento, limparDocumento } from "../../utils/documento";
import { classeRotulo } from "./AcessoUI";

export default function CampoDocumento({ tipo, onTipo, valor, onValor, desabilitado, claro = false, id = "documento" }) {
  const { t } = useTranslation();
  const campo = claro
    ? "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-blue-500 outline-none"
    : "w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-11 pr-4 py-3 rounded-xl focus:border-red-600 outline-none placeholder:text-zinc-600 placeholder:font-normal";
  const rotulo = claro ? "text-[10px] font-bold text-slate-500 uppercase ml-1" : classeRotulo;
  const botao = (ativo) => (claro
    ? `py-2 px-2 rounded-xl border text-xs font-black ${ativo ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-white" : "border-slate-300 dark:border-slate-700 text-slate-500"}`
    : `py-2 px-2 rounded-xl border text-xs font-black ${ativo ? "border-red-600 bg-red-600/10 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`);

  return (
    <div className="space-y-2">
      <span className={rotulo}>{t("document.typeLabel")}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {TIPOS_DOCUMENTO.map((tp) => (
          <button
            key={tp} type="button" disabled={desabilitado} aria-pressed={tipo === tp}
            onClick={() => { onTipo(tp); onValor(formatarDocumento(tp, limparDocumento(valor))); }}
            className={botao(tipo === tp)} title={t(`document.types.${tp}`)}
          >
            {t(`document.short.${tp}`)}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor={id} className={rotulo}>{t("document.label")} — {t(`document.types.${tipo}`)}</label>
        <div className="relative">
          <IdCard className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
          <input
            id={id} value={valor} disabled={desabilitado} inputMode="numeric" autoComplete="off" maxLength={14}
            onChange={(e) => onValor(formatarDocumento(tipo, e.target.value))}
            className={campo} placeholder={t(`document.placeholder.${tipo}`)}
          />
        </div>
      </div>
    </div>
  );
}

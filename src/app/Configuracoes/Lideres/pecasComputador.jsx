// Peças pequenas da aba Líderes no COMPUTADOR (lista em tabela + ficha lateral). Só cores do sistema:
// vermelho, preto, cinza e branco (o botão do WhatsApp é preto). O celular não usa nada daqui.
import { useTranslation } from "react-i18next";
import { Copy, Globe, KeyRound, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { iniciais, linkWhatsApp } from "../../../centrais/contato";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";
import { telefoneParaExibir } from "../ui/telefone";
import { FlagIcon } from "../ui/Bandeira";

// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
export const ICONE_PEQ = "inline-flex items-center justify-center w-7 h-7 rounded-[7px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shrink-0";
export const ICONE_ZAP = "inline-flex items-center justify-center w-7 h-7 rounded-[7px] border border-slate-900 bg-slate-900 text-white hover:bg-slate-700 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 shrink-0";
export const ACAO = "inline-flex items-center justify-center w-9 h-9 rounded-[9px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 shrink-0 disabled:opacity-50";
export const ACAO_OK = "inline-flex items-center justify-center w-9 h-9 rounded-[9px] border border-red-600 bg-white text-red-600 hover:bg-red-50 dark:bg-slate-800 shrink-0 disabled:opacity-50";
export const ACAO_ABRIR = "inline-flex items-center justify-center w-9 h-9 rounded-[9px] border border-slate-900 bg-slate-900 text-white hover:bg-slate-700 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 shrink-0";
export const BTN = "inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] border border-slate-300 bg-white text-[13px] font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 disabled:opacity-50";
export const BTN_PRI = "inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] border border-red-600 bg-red-600 text-[13px] font-extrabold text-white hover:bg-red-700 whitespace-nowrap disabled:opacity-60";
export const BTN_PERIGO = "inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] border border-red-200 bg-white text-[13px] font-bold text-red-700 hover:bg-red-50 whitespace-nowrap dark:bg-slate-800 dark:border-red-800 dark:text-red-400 disabled:opacity-50";
export const ROTULO = "text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400";

// Bolinha com as iniciais: preta (líder principal) ou cinza (2º líder).
export function Avatar({ nome, claro = false, grande = false }) {
  const tam = grande ? "w-11 h-11 text-sm" : "w-[34px] h-[34px] text-xs";
  const cor = claro ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";
  return <span aria-hidden="true" className={`inline-flex items-center justify-center rounded-full font-extrabold shrink-0 ${tam} ${cor}`}>{iniciais(nome)}</span>;
}

export function LinhaEmail({ email, copiar }) {
  const { t } = useTranslation();
  if (!email) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-w-0">
      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      <span className="truncate" title={email}>{email}</span>
      <button type="button" className={ICONE_PEQ} onClick={() => copiar(email)} aria-label={t("leadersTab.listB.copyEmail")} title={t("leadersTab.listB.copyEmail")}><Copy className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// Bandeira + telefone, com copiar / ligar / WhatsApp (cada um pode ser ligado ou não).
export function LinhaTelefone({ telefone, pais, copiar, comCopiar = true, comLigar = false, rotuloZap }) {
  const { t } = useTranslation();
  if (!telefone) return null;
  const exibido = telefoneParaExibir(telefone, pais);
  const zap = linkWhatsApp(telefone, pais);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <FlagIcon pais={pais} />
      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">{exibido}</span>
      {comCopiar && <button type="button" className={ICONE_PEQ} onClick={() => copiar(exibido)} aria-label={t("leadersTab.listB.copyPhone")} title={t("leadersTab.listB.copyPhone")}><Copy className="w-3.5 h-3.5" /></button>}
      {comLigar && <a href={`tel:${String(exibido).replace(/[^\d+]/g, "")}`} className={ICONE_PEQ} aria-label={t("leadersTab.listB.call")} title={t("leadersTab.listB.call")}><Phone className="w-3.5 h-3.5" /></a>}
      {zap && <a href={zap} target="_blank" rel="noopener noreferrer" className={ICONE_ZAP} aria-label={rotuloZap || t("centrais.whatsapp")} title={rotuloZap || t("centrais.whatsapp")}><MessageCircle className="w-3.5 h-3.5" /></a>}
    </div>
  );
}

// Último acesso: "19/11/2026 · 18:26" em negrito, "hoje / ontem / há X dias" e a forma de entrada.
// Quem nunca entrou: "Nunca entrou" em vermelho.
export function AcessoCompleto({ quando, como, carregando }) {
  const { t, i18n } = useTranslation();
  const ac = resumoDoAcesso(quando, i18n.language);
  if (!ac && carregando) return <Loader2 className="w-4 h-4 animate-spin text-slate-300" />;
  const Icone = como === "google" ? Globe : KeyRound;
  return (
    <div>
      {ac ? (
        <>
          <div className="text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{ac.dia} · {ac.hora}</div>
          <div className={`text-xs font-bold ${ac.dias > 30 ? "text-red-700 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}>{ac.relativo}</div>
        </>
      ) : <div className="text-xs font-extrabold text-red-700 dark:text-red-400 whitespace-nowrap">{t("leadersTab.desk.neverLogged")}</div>}
      {como && <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-slate-500"><Icone className="w-3 h-3" aria-hidden="true" />{t(`tabela.access.via.${como}`)}</div>}
    </div>
  );
}

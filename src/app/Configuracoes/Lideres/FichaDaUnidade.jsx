// Painel de detalhes da unidade (aba Líderes, Opção B): no computador fica ao lado da lista; no celular
// (< 1024 px) abre em tela cheia por cima da lista — a lista continua montada embaixo, então filtro, busca
// e rolagem ficam como estavam ao voltar. Só mostra e chama ações que já existem.
import { useTranslation } from "react-i18next";
import { ChevronLeft, Copy, Loader2, Mail, MessageCircle, Phone, X } from "lucide-react";
import { linkWhatsApp } from "../../../centrais/contato";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";
import { diaDoFim, diasRestantes, fimDoTemporario } from "../../../utils/temporario";
import { telefoneParaExibir } from "../ui/telefone";
import { FlagIcon } from "../ui/Bandeira";
import { SELO_CONFERIR, SELO_NEUTRO } from "./estiloLideres";
import { useAvisoCopiado } from "./useAvisoCopiado";
import { AvisoCopiado } from "./avisoCopiado";

const ROT = "text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400";
const BLOCO = "flex flex-col gap-2 p-3.5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700";
const ICONE = "inline-flex items-center justify-center w-9 h-9 lg:w-[30px] lg:h-[30px] rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shrink-0";
const BT = "min-h-[46px] lg:min-h-[38px] px-3 rounded-xl border border-slate-200 bg-white text-left text-[13px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50";
const BT_PERIGO = "min-h-[46px] lg:min-h-[38px] px-3 rounded-xl border border-red-200 bg-white text-left text-[13px] font-bold text-red-700 hover:bg-red-50 dark:bg-slate-900 dark:border-red-800 dark:text-red-400 disabled:opacity-50";
const BT_DESTAQUE = "min-h-[46px] lg:min-h-[40px] px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2";

function UltimoAcesso({ quando, como, carregando }) {
  const { t, i18n } = useTranslation();
  const ac = resumoDoAcesso(quando, i18n.language);
  if (carregando && !ac) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  const cor = !ac ? "text-slate-500" : ac.dias > 30 ? "text-red-600" : "text-slate-700 dark:text-slate-200";
  return (
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className={ROT}>{t("leadersTab.listB.lastAccess")}</div>
      {ac ? (
        <>
          <div className="text-[13px] font-extrabold text-slate-900 dark:text-white">{ac.dataHora}</div>
          <div className={`text-xs font-extrabold ${cor}`}>{ac.relativo}{como ? ` · ${t(`tabela.access.via.${como}`)}` : ""}</div>
        </>
      ) : <div className="text-xs font-bold text-slate-500">{t("tabela.access.never")}</div>}
    </div>
  );
}

// Bloco de uma pessoa (líder ou 2º líder): nome, e-mail (copiar), telefone (copiar + WhatsApp) e último acesso.
function BlocoPessoa({ rotulo, selo, nome, email, telefone, pais, quando, como, carregando, copiar, repetido }) {
  const { t } = useTranslation();
  const zap = linkWhatsApp(telefone, pais);
  return (
    <div className={BLOCO}>
      <div className="flex justify-between items-center gap-2"><span className={ROT}>{rotulo}</span>{selo}</div>
      <div className="text-[15px] font-black uppercase text-slate-900 dark:text-white break-words">{nome || "-"} {repetido}</div>
      {email && (
        <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300 min-w-0">
          <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{email}</span>
          <button type="button" className={`${ICONE} ml-auto`} onClick={() => copiar(email)} aria-label={t("leadersTab.listB.copyEmail")} title={t("leadersTab.listB.copyEmail")}><Copy className="w-4 h-4" /></button>
        </div>
      )}
      {telefone && (
        <div className="flex items-center gap-2 min-w-0">
          <FlagIcon pais={pais} />
          <span className="font-mono text-[13px] font-bold text-slate-900 dark:text-white whitespace-nowrap">{telefoneParaExibir(telefone, pais)}</span>
          <span className="ml-auto inline-flex gap-1.5">
            <a href={`tel:${String(telefoneParaExibir(telefone, pais)).replace(/[^\d+]/g, "")}`} className={`${ICONE} lg:hidden`} aria-label={t("leadersTab.listB.call")} title={t("leadersTab.listB.call")}><Phone className="w-4 h-4" /></a>
            <button type="button" className={ICONE} onClick={() => copiar(telefoneParaExibir(telefone, pais))} aria-label={t("leadersTab.listB.copyPhone")} title={t("leadersTab.listB.copyPhone")}><Copy className="w-4 h-4" /></button>
            {zap && <a href={zap} target="_blank" rel="noopener noreferrer" className={`${ICONE} !text-emerald-600`} aria-label={t("centrais.whatsapp")} title={t("centrais.whatsapp")}><MessageCircle className="w-4 h-4" /></a>}
          </span>
        </div>
      )}
      <UltimoAcesso quando={quando} como={como} carregando={carregando} />
    </div>
  );
}

/**
 * @param {{u:object, nomeMentor:string, pais:string, ocupado:boolean, acessoDe:(uid:string)=>any, carregandoAcessos:boolean,
 *   temps:{temporarios:object[], convites:object[]}|undefined, tempOcupado:string|null, acoes:Record<string,Function>,
 *   onFechar:()=>void, seloPrincipal?:React.ReactNode, seloSegundo?:React.ReactNode}} props
 */
export function FichaDaUnidade({ u, nomeMentor, pais, ocupado, acessoDe, carregandoAcessos, temps, tempOcupado, acoes, onFechar, seloPrincipal, seloSegundo }) {
  const { t, i18n } = useTranslation();
  const { visivel, copiar } = useAvisoCopiado();
  const temLider = !!u.liderUid;
  const temporarios = temps?.temporarios || [];
  const convites = temps?.convites || [];
  const loginAntigo = !!(u.uidLogin && !u.loginAntigoDesligado);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-100 dark:bg-slate-950 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent">
      {/* Celular: voltar para a lista */}
      <div className="sticky top-0 z-10 flex items-center gap-2.5 px-3.5 py-2.5 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 lg:hidden">
        <button type="button" onClick={onFechar} aria-label={t("leadersTab.listB.back")}
          className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <div className="text-base font-black uppercase text-slate-900 dark:text-white truncate">{u.nome}</div>
          <div className="text-xs font-semibold text-slate-500 truncate">{u.estado || "-"}{nomeMentor ? ` · ${t("leadersTab.col.mentor")} ${nomeMentor.toUpperCase()}` : ""}</div>
        </div>
      </div>

      <aside aria-label={t("leadersTab.listB.details")} className="flex flex-col gap-3 p-3.5 lg:p-[18px] lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-slate-50 dark:lg:bg-slate-800/60 dark:lg:border-slate-700 lg:sticky lg:top-4">
        {/* Computador: cabeçalho com fechar */}
        <div className="hidden lg:flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className={ROT}>{t("leadersTab.col.unit")}</div>
            <div className="text-lg font-black uppercase text-slate-900 dark:text-white leading-tight break-words">{u.nome}</div>
            <div className="text-xs font-semibold text-slate-500">{u.estado || "-"}{nomeMentor ? ` · ${t("leadersTab.col.mentor")} ${nomeMentor.toUpperCase()}` : ""}</div>
          </div>
          <button type="button" onClick={onFechar} aria-label={t("leadersTab.listB.close")} title={t("leadersTab.listB.close")}
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* LÍDER */}
        {temLider ? (
          <BlocoPessoa rotulo={t("leadersTab.col.leader")} selo={u.liderAConferir === true ? <span className={SELO_CONFERIR}>{t("leadersTab.toCheck")}</span> : null}
            nome={u.liderNome} email={u.liderEmail} telefone={u.liderTelefone} pais={pais} repetido={seloPrincipal}
            quando={acessoDe(u.liderUid)} como={u.liderTipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} copiar={copiar} />
        ) : (
          <div className={BLOCO}>
            <div className="flex justify-between items-center gap-2"><span className={ROT}>{t("leadersTab.col.leader")}</span><span className={SELO_CONFERIR}>{t("leadersTab.noLeader")}</span></div>
            <p className="m-0 text-[13px] text-slate-600 dark:text-slate-300">{t("leadersTab.listB.noLeaderHelp")}</p>
            {loginAntigo && <UltimoAcesso quando={acessoDe(u.uidLogin)} como="antigo" carregando={carregandoAcessos} />}
          </div>
        )}

        {/* 2º LÍDER (só quando existe) */}
        {temLider && u.lider2Uid && (
          <BlocoPessoa rotulo={t("leadersTab.second.badge")} nome={u.lider2Nome} email={u.lider2Email} telefone={u.lider2Telefone} pais={pais} repetido={seloSegundo}
            quando={acessoDe(u.lider2Uid)} como={u.lider2Tipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} copiar={copiar} />
        )}

        {/* LÍDER TEMPORÁRIO */}
        {temporarios.length === 0 && convites.length === 0 ? (
          <div className={`${BLOCO} !border-dashed`}>
            <div className={ROT}>{t("leadersTab.listB.temporary")}</div>
            <div className="text-[13px] text-slate-500">{t("leadersTab.listB.noTemporary")}</div>
          </div>
        ) : (
          <>
            {temporarios.map((c) => {
              const fim = fimDoTemporario(c);
              const dias = diasRestantes(fim);
              const vencido = dias !== null && dias < 0;
              return (
                <div key={c.id} className={BLOCO}>
                  <div className="flex justify-between items-center gap-2"><span className={ROT}>{t("leadersTab.listB.temporary")}</span>
                    <span className={vencido || (dias !== null && dias <= 7) ? SELO_CONFERIR : SELO_NEUTRO}>
                      {vencido ? t("tempLeader.status.expired") : dias === 0 ? t("tempLeader.status.today") : t("tempLeader.status.days", { count: dias })}
                    </span>
                  </div>
                  <div className="text-sm font-black uppercase text-slate-900 dark:text-white">{c.nome || "-"}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 break-all">{c.email}{c.telefone ? ` · ${telefoneParaExibir(c.telefone, c.pais || pais)}` : ""}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("tempLeader.until", { date: diaDoFim(fim, i18n.language) })}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" className={BT} onClick={() => acoes.prorrogar(c)} disabled={tempOcupado === c.id}>{vencido ? t("tempLeader.reactivate") : t("tempLeader.extend")}</button>
                    <button type="button" className={BT} onClick={() => acoes.efetivar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.listB.makePermanent")}</button>
                    {!vencido && <button type="button" className={BT_PERIGO} onClick={() => acoes.encerrar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.listB.end")}</button>}
                  </div>
                </div>
              );
            })}
            {convites.map((c) => (
              <div key={c.id} className={`${BLOCO} !border-dashed`}>
                <div className="flex justify-between items-center gap-2"><span className={ROT}>{t("leadersTab.listB.temporary")}</span><span className={SELO_NEUTRO}>{t("tempLeader.status.waiting")}</span></div>
                <div className="text-sm font-black uppercase text-slate-900 dark:text-white">{c.nome || "-"}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 break-all">{c.email} · {t("tempLeader.inviteUntil", { date: diaDoFim(c.temporarioAte, i18n.language) })}</div>
                <button type="button" className={BT_PERIGO} onClick={() => acoes.cancelarConvite(c)} disabled={tempOcupado === c.id}>{t("tempLeader.cancelInvite")}</button>
              </div>
            ))}
          </>
        )}

        {/* AÇÕES (botões com nome; remover por último, em vermelho, com confirmação) */}
        <div>
          <div className={`${ROT} mb-2`}>{t("leadersTab.col.actions")}</div>
          {temLider ? (
            <div className="grid grid-cols-2 gap-2">
              {u.liderAConferir === true && (
                <button type="button" className={`${BT_DESTAQUE} col-span-2`} onClick={acoes.confirmar} disabled={ocupado}>
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} ✓ {t("leadersTab.menu.confirmShort")}
                </button>
              )}
              <button type="button" className={BT} onClick={acoes.editar} disabled={ocupado}>{t("leadersTab.edit")}</button>
              <button type="button" className={BT} onClick={acoes.documento} disabled={ocupado}>{t("leadersTab.listB.document")}</button>
              {u.lider2Uid ? (
                <>
                  <button type="button" className={BT} onClick={acoes.documentoSegundo} disabled={ocupado}>{t("leadersTab.menu.docSecond")}</button>
                  <button type="button" className={BT} onClick={acoes.definirTemporario} disabled={ocupado}>{t("leadersTab.listB.temporary")}</button>
                </>
              ) : (
                <>
                  <button type="button" className={BT} onClick={acoes.adicionarSegundo} disabled={ocupado}>+ {t("leadersTab.menu.addSecond")}</button>
                  <button type="button" className={BT} onClick={acoes.definirTemporario} disabled={ocupado}>{t("leadersTab.listB.temporary")}</button>
                </>
              )}
              <button type="button" className={BT} onClick={acoes.trocar} disabled={ocupado}>{t("leadersTab.replace")}</button>
              {u.lider2Uid && <button type="button" className={BT_PERIGO} onClick={acoes.tirarSegundo} disabled={ocupado}>{t("leadersTab.second.remove")}</button>}
              <button type="button" className={BT_PERIGO} onClick={acoes.remover} disabled={ocupado}>{t("leadersTab.remove")}</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`${BT_DESTAQUE} col-span-2`} onClick={acoes.escolher}>{t("leadersTab.menu.pick")}</button>
              <button type="button" className={BT} onClick={acoes.cadastrar}>{t("leadersTab.menu.register")}</button>
              <button type="button" className={BT} onClick={acoes.definirTemporario}>{t("leadersTab.listB.temporary")}</button>
            </div>
          )}
        </div>
      </aside>

      <AvisoCopiado visivel={visivel} />
    </div>
  );
}

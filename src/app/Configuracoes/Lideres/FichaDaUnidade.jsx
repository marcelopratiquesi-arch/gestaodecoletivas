// Ficha da unidade (aba Líderes): no computador é o painel à direita da lista; no celular (< 1024 px) abre
// por cima da lista, em tela cheia — a lista continua montada embaixo, então filtro, busca e rolagem ficam
// como estavam ao voltar. Só mostra e chama ações que já existem (confirmar, 2º líder, temporário, trocar...).
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Copy, Loader2, Mail, MessageCircle, MoreHorizontal, Phone, X,
} from "lucide-react";
import { iniciais, linkWhatsApp } from "../../../centrais/contato";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";
import { diaDoFim, diasRestantes, fimDoTemporario } from "../../../utils/temporario";
import { telefoneParaExibir } from "../ui/telefone";
import { FlagIcon } from "../ui/Bandeira";
import { fraseLonga, rotuloDoPasso, whatsAppComMensagem } from "./frasesDaSituacao";

const ROT = "text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 dark:text-neutral-400";
const CARTAO = "flex flex-col gap-2.5 p-3.5 rounded-2xl border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-700";
const ICONE = "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 shrink-0";
const BOTAO_ACAO = "h-10 px-3 rounded-xl border border-neutral-200 bg-white text-left text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 disabled:opacity-50";

// "Copiado" rápido no rodapé da tela.
function useAvisoCopiado() {
  const [visivel, setVisivel] = useState(false);
  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(String(texto)); setVisivel(true); setTimeout(() => setVisivel(false), 1500); }
    catch (e) { console.error("Não foi possível copiar:", e); }
  };
  return { visivel, copiar };
}

function UltimoAcesso({ quando, como, carregando }) {
  const { t, i18n } = useTranslation();
  const ac = resumoDoAcesso(quando, i18n.language);
  const via = como ? t(`tabela.access.via.${como}`) : "";
  if (carregando && !ac) return <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />;
  return (
    <div className="flex items-start justify-between gap-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
      <span className={ROT}>{t("leadersTab.central.lastAccess")}</span>
      <span className="text-right text-xs font-extrabold text-neutral-900 dark:text-neutral-100">
        {ac ? <>{ac.relativo} · {ac.hora}{via ? ` · ${via}` : ""}<span className="block font-semibold text-neutral-500">{ac.dataHora}</span></> : t("tabela.access.never")}
      </span>
    </div>
  );
}

// Cartão de uma pessoa (líder principal ou 2º líder): iniciais, nome, contato e último acesso.
function CartaoPessoa({ rotulo, nome, email, telefone, pais, quando, como, carregando, copiar, grande, selo }) {
  const { t } = useTranslation();
  const zap = linkWhatsApp(telefone, pais);
  return (
    <div className={CARTAO}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center justify-center rounded-full bg-neutral-900 text-white font-extrabold shrink-0 dark:bg-neutral-100 dark:text-neutral-900 ${grande ? "w-11 h-11 text-[15px]" : "w-10 h-10 text-sm"}`}>{iniciais(nome)}</span>
        <div className="min-w-0"><div className={ROT}>{rotulo}</div><div className="text-[15px] font-extrabold uppercase text-neutral-900 dark:text-neutral-100 break-words">{nome || "-"} {selo}</div></div>
      </div>
      {email && (
        <div className="flex items-center gap-2 text-[13px] text-neutral-700 dark:text-neutral-300 min-w-0">
          <Mail className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />
          <span className="truncate">{email}</span>
          <button type="button" className={`${ICONE} ml-auto hidden lg:inline-flex`} onClick={() => copiar(email)} aria-label={t("leadersTab.central.copyEmail")} title={t("leadersTab.central.copyEmail")}><Copy className="w-4 h-4" /></button>
        </div>
      )}
      {telefone && (
        <div className="flex items-center gap-2 min-w-0">
          <FlagIcon pais={pais} />
          <span className="font-mono text-[13px] font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">{telefoneParaExibir(telefone, pais)}</span>
          <span className="ml-auto hidden lg:inline-flex gap-1.5">
            <button type="button" className={ICONE} onClick={() => copiar(telefoneParaExibir(telefone, pais))} aria-label={t("leadersTab.central.copyPhone")} title={t("leadersTab.central.copyPhone")}><Copy className="w-4 h-4" /></button>
            {zap && <a href={zap} target="_blank" rel="noopener noreferrer" className={`${ICONE} !bg-neutral-900 !border-neutral-900 !text-white`} aria-label={t("centrais.whatsapp")} title={t("centrais.whatsapp")}><MessageCircle className="w-4 h-4" /></a>}
          </span>
        </div>
      )}
      {/* Celular: 3 botões grandes */}
      {(telefone || email) && (
        <div className="grid grid-cols-3 gap-2 lg:hidden">
          {zap ? <a href={zap} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-neutral-900 text-white text-[11px] font-bold"><MessageCircle className="w-[18px] h-[18px]" />WhatsApp</a>
            : <span className="h-16 rounded-xl border border-dashed border-neutral-200" />}
          {telefone ? <a href={`tel:${String(telefoneParaExibir(telefone, pais)).replace(/[^\d+]/g, "")}`} className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-neutral-200 bg-white text-neutral-800 text-[11px] font-bold dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"><Phone className="w-[18px] h-[18px]" />{t("leadersTab.central.call")}</a>
            : <span className="h-16 rounded-xl border border-dashed border-neutral-200" />}
          {email ? <button type="button" onClick={() => copiar(email)} className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-neutral-200 bg-white text-neutral-800 text-[11px] font-bold dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"><Copy className="w-[18px] h-[18px]" />{t("leadersTab.central.copyEmail")}</button>
            : <span className="h-16 rounded-xl border border-dashed border-neutral-200" />}
        </div>
      )}
      <UltimoAcesso quando={quando} como={como} carregando={carregando} />
    </div>
  );
}

// Espaço do 2º líder / temporário: tracejado quando vazio.
function EspacoVazio({ rotulo, acao, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col gap-1 items-start p-3 rounded-xl border-[1.5px] border-dashed border-neutral-300 bg-white text-left min-h-[44px] hover:border-red-300 dark:bg-neutral-900 dark:border-neutral-600">
      <span className={ROT}>{rotulo}</span><span className="text-[13px] font-extrabold text-red-700 dark:text-red-400">{acao}</span>
    </button>
  );
}

/**
 * @param {{u:object, sit:object, nomeMentor:string, pais:string, ehAdmin:boolean, ocupado:boolean,
 *   acessoDe:(uid:string)=>any, carregandoAcessos:boolean, temps:{temporarios:object[], convites:object[]}, tempOcupado:string|null,
 *   acoes:Record<string,Function>, onFechar:()=>void}} props
 */
export function FichaDaUnidade({ u, sit, nomeMentor, pais, ocupado, acessoDe, carregandoAcessos, temps, tempOcupado, acoes, onFechar, seloPrincipal, seloSegundo }) {
  const { t, i18n } = useTranslation();
  const { visivel, copiar } = useAvisoCopiado();
  const outrasRef = useRef(null);
  const temLider = !!u.liderUid;
  const frase = fraseLonga(sit, u, t, i18n.language);
  const zapDoPasso = whatsAppComMensagem(sit, u, t, pais);

  // Botão principal do aviso "O que falta".
  const passo = () => {
    if (sit.id === "semLider") return acoes.escolher();
    if (sit.id === "conferir") return acoes.confirmar();
    if (sit.id === "temporario") return acoes.prorrogar(sit.temporario);
    return undefined;
  };
  // Todos os temporários da unidade (o vencido aparece com "Reativar", como antes).
  const temporariosAtivos = temps?.temporarios || [];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-neutral-100 dark:bg-neutral-950 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent">
      {/* Celular: barra de voltar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2 bg-white border-b border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 lg:hidden">
        <button type="button" onClick={onFechar} className="h-11 px-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-red-700 dark:text-red-400">
          <ChevronLeft className="w-5 h-5" /> {t("leadersTab.title")}
        </button>
        <button type="button" onClick={() => outrasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label={t("leadersTab.central.moreOptions")}
          className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"><MoreHorizontal className="w-5 h-5" /></button>
      </div>

      <aside aria-label={t("leadersTab.central.sheet")} className="flex flex-col gap-3 p-3.5 lg:p-4 lg:rounded-2xl lg:border lg:border-neutral-200 lg:bg-neutral-50 dark:lg:bg-neutral-900/60 dark:lg:border-neutral-800 lg:sticky lg:top-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className={ROT}>{t("leadersTab.col.unit")}</div>
            <div className="text-[22px] lg:text-xl font-black uppercase text-neutral-900 dark:text-neutral-100 leading-tight break-words">{u.nome}</div>
            <div className="text-xs font-semibold text-neutral-500">{u.estado || "-"}{nomeMentor ? ` · ${t("leadersTab.col.mentor")} ${nomeMentor.toUpperCase()}` : ""}</div>
          </div>
          <span className={`mt-4 lg:hidden shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wide ${sit.id === "ok" ? "bg-neutral-100 border-neutral-200 text-neutral-600" : "bg-red-50 border-red-200 text-red-700"}`}>{t(`leadersTab.central.situation.${sit.id}`)}</span>
          <button type="button" onClick={onFechar} aria-label={t("leadersTab.central.close")} className="hidden lg:inline-flex w-9 h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* O QUE FALTA (some quando está tudo certo) */}
        {sit.id !== "ok" && (
          <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900">
            <div className="flex items-center gap-2"><AlertTriangle className="w-[18px] h-[18px] text-red-600" aria-hidden="true" /><span className="text-[13px] font-black uppercase tracking-wide text-red-700 dark:text-red-400">{t("leadersTab.central.whatsMissing")}</span></div>
            <p className="m-0 text-sm text-neutral-800 dark:text-neutral-200">{frase}</p>
            {sit.id === "semAcesso" ? (
              zapDoPasso
                ? <a href={zapDoPasso} target="_blank" rel="noopener noreferrer" className="h-11 lg:h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold"><MessageCircle className="w-4 h-4" /> {t("leadersTab.central.step.whatsapp")}</a>
                : <p className="m-0 text-xs font-bold text-red-700">{t("leadersTab.central.noPhone")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={passo} disabled={ocupado} className="h-12 lg:h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold disabled:opacity-60">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} {rotuloDoPasso(sit, u, t, { naFicha: true })}
                </button>
                {sit.id === "semLider" && (
                  <button type="button" onClick={acoes.cadastrar} className="h-11 rounded-xl border border-red-200 bg-white text-sm font-extrabold text-red-700 hover:bg-red-50 dark:bg-neutral-900">{t("leadersTab.central.step.register")}</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* LÍDER PRINCIPAL */}
        {temLider && (
          <CartaoPessoa grande rotulo={t("leadersTab.central.mainLeader")} nome={u.liderNome} email={u.liderEmail} telefone={u.liderTelefone} pais={pais}
            quando={acessoDe(u.liderUid)} como={u.liderTipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} copiar={copiar} selo={seloPrincipal} />
        )}
        {!temLider && sit.loginAntigo && (
          <div className={CARTAO}>
            <div className={ROT}>{t("tabela.access.unitLogin")}</div>
            <UltimoAcesso quando={acessoDe(u.uidLogin)} como="antigo" carregando={carregandoAcessos} />
          </div>
        )}

        {/* 2º LÍDER e TEMPORÁRIO */}
        <div className={`grid gap-2.5 ${u.lider2Uid || temporariosAtivos.length || temps?.convites?.length ? "grid-cols-1" : "grid-cols-2"}`}>
          {temLider && (u.lider2Uid ? (
            <div className="flex flex-col gap-2">
              <CartaoPessoa rotulo={t("leadersTab.second.badge")} nome={u.lider2Nome} email={u.lider2Email} telefone={u.lider2Telefone} pais={pais}
                quando={acessoDe(u.lider2Uid)} como={u.lider2Tipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} copiar={copiar} selo={seloSegundo} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={BOTAO_ACAO} onClick={acoes.documentoSegundo}>{t("leadersTab.central.document")}</button>
                <button type="button" className={`${BOTAO_ACAO} !text-red-700 !border-red-200`} onClick={acoes.tirarSegundo} disabled={ocupado}>{t("leadersTab.second.remove")}</button>
              </div>
            </div>
          ) : (
            <EspacoVazio rotulo={t("leadersTab.second.badge")} acao={t("leadersTab.central.add")} onClick={acoes.adicionarSegundo} />
          ))}

          {temporariosAtivos.map((c) => {
            const fim = fimDoTemporario(c);
            const dias = diasRestantes(fim);
            const vencido = dias !== null && dias < 0;
            return (
              <div key={c.id} className="flex flex-col gap-2 p-3.5 rounded-2xl border border-neutral-900 bg-white dark:bg-neutral-900 dark:border-neutral-300">
                <div className="flex items-center justify-between gap-2"><span className={ROT}>{t("leadersTab.central.temporary")}</span>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-extrabold uppercase dark:bg-neutral-100 dark:text-neutral-900">
                    {vencido ? t("tempLeader.status.expired") : dias === 0 ? t("tempLeader.status.today") : t("tempLeader.status.days", { count: dias })}
                  </span>
                </div>
                <div className="text-sm font-extrabold uppercase text-neutral-900 dark:text-neutral-100">{c.nome || "-"}</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400 break-all">{c.email}{c.telefone ? ` · ${telefoneParaExibir(c.telefone, c.pais || pais)}` : ""}</div>
                <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{t("tempLeader.until", { date: diaDoFim(fim, i18n.language) })}</div>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className={BOTAO_ACAO} onClick={() => acoes.prorrogar(c)} disabled={tempOcupado === c.id}>{vencido ? t("tempLeader.reactivate") : t("tempLeader.extend")}</button>
                  <button type="button" className={BOTAO_ACAO} onClick={() => acoes.efetivar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.central.makePermanent")}</button>
                  {!vencido && <button type="button" className={`${BOTAO_ACAO} !text-red-700 !border-red-200`} onClick={() => acoes.encerrar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.central.end")}</button>}
                </div>
              </div>
            );
          })}
          {(temps?.convites || []).map((c) => (
            <div key={c.id} className="flex flex-col gap-2 p-3.5 rounded-2xl border border-dashed border-neutral-400 bg-white dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-2"><span className={ROT}>{t("leadersTab.central.temporary")}</span><span className="text-[10px] font-extrabold uppercase text-neutral-500">{t("tempLeader.status.waiting")}</span></div>
              <div className="text-sm font-extrabold uppercase text-neutral-900 dark:text-neutral-100">{c.nome || "-"}</div>
              <div className="text-xs text-neutral-600 break-all">{c.email} · {t("tempLeader.inviteUntil", { date: diaDoFim(c.temporarioAte, i18n.language) })}</div>
              <button type="button" className={`${BOTAO_ACAO} !text-red-700 !border-red-200`} onClick={() => acoes.cancelarConvite(c)} disabled={tempOcupado === c.id}>{t("tempLeader.cancelInvite")}</button>
            </div>
          ))}
          {temporariosAtivos.length === 0 && !(temps?.convites || []).length && (
            <EspacoVazio rotulo={t("leadersTab.central.temporary")} acao={t("leadersTab.central.define")} onClick={acoes.definirTemporario} />
          )}
        </div>

        {/* OUTRAS AÇÕES (remover pede confirmação) */}
        {temLider && (
          <div ref={outrasRef} className="scroll-mt-20">
            <div className={`${ROT} mb-2`}>{t("leadersTab.central.otherActions")}</div>
            {/* computador: grade de botões */}
            <div className="hidden lg:grid grid-cols-2 gap-2">
              <button type="button" className={BOTAO_ACAO} onClick={acoes.editar} disabled={ocupado}>{t("leadersTab.edit")}</button>
              <button type="button" className={BOTAO_ACAO} onClick={acoes.documento} disabled={ocupado}>{t("leadersTab.central.document")}</button>
              <button type="button" className={BOTAO_ACAO} onClick={acoes.trocar} disabled={ocupado}>{t("leadersTab.replace")}</button>
              <button type="button" className={`${BOTAO_ACAO} !text-red-700 !border-red-200`} onClick={acoes.remover} disabled={ocupado}>{t("leadersTab.remove")}</button>
            </div>
            {/* celular: lista */}
            <div className="lg:hidden rounded-2xl border border-neutral-200 overflow-hidden bg-white dark:bg-neutral-900 dark:border-neutral-700">
              {[
                ["editar", t("leadersTab.edit")], ["documento", t("leadersTab.central.document")], ["trocar", t("leadersTab.replace")], ["remover", t("leadersTab.remove")],
              ].map(([id, rotulo]) => (
                <button key={id} type="button" onClick={acoes[id]} disabled={ocupado}
                  className={`w-full h-12 px-3.5 flex items-center justify-between border-b last:border-b-0 border-neutral-100 dark:border-neutral-800 text-sm font-bold text-left ${id === "remover" ? "text-red-700" : "text-neutral-800 dark:text-neutral-200"}`}>
                  {rotulo}<ChevronRight className={`w-4 h-4 ${id === "remover" ? "text-red-300" : "text-neutral-400"}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {visivel && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-bold shadow-lg">{t("centrais.copiado")}</div>
      )}
    </div>
  );
}

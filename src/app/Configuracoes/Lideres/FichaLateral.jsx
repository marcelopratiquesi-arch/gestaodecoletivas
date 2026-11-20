// Ficha da unidade no COMPUTADOR: abre por cima da lista, pela direita (~560 px, fundo escurecido atrás).
// Fecha no ×, clicando fora ou com Esc. A lista continua montada embaixo, então filtros, busca e rolagem
// ficam como estavam. Só mostra e chama ações que já existem (o celular usa o FichaDaUnidade).
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Plus, X } from "lucide-react";
import { paraData } from "../../../utils/ultimoAcesso";
import { diaDoFim, diasRestantes, fimDoTemporario } from "../../../utils/temporario";
import { telefoneParaExibir } from "../ui/telefone";
import { SELO_CONFERIR, SELO_NEUTRO } from "./estiloLideres";
import { useAvisoCopiado } from "./useAvisoCopiado";
import { AvisoCopiado } from "./avisoCopiado";
import { AcessoCompleto, Avatar, BTN, BTN_PERIGO, BTN_PRI, LinhaEmail, LinhaTelefone, ROTULO } from "./pecasComputador";

const CARTAO = "flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800";
const VAZIO = "w-full flex flex-col items-start gap-1 p-4 rounded-2xl border-[1.5px] border-dashed border-neutral-300 bg-white text-left hover:border-neutral-500 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 disabled:opacity-50";
const CAMPO_INFO = "flex flex-col gap-0.5 p-3 rounded-xl bg-neutral-50 border border-neutral-100 min-w-0 dark:bg-neutral-950/40 dark:border-neutral-800";

const comoEntra = (tipo) => (tipo === "senha" ? "senha" : "google");

/**
 * @param {{u:object, pais:string, nomePais:string, nomeMentor:string, ocupado:boolean, acessoDe:(uid:string)=>any,
 *   crachaDe:(uid:string)=>({documentoOk:boolean,criadoEm:any}|null), carregandoAcessos:boolean, outrasUnidades:(uid:string)=>object[],
 *   temps:{temporarios:object[], convites:object[]}|undefined, tempOcupado:string|null, acoes:Record<string,Function>,
 *   onFechar:()=>void, pausarEsc?:boolean, seloPrincipal?:React.ReactNode, seloSegundo?:React.ReactNode}} props
 */
export function FichaLateral({ u, pais, nomePais, nomeMentor, ocupado, acessoDe, crachaDe, carregandoAcessos, outrasUnidades,
  temps, tempOcupado, acoes, onFechar, pausarEsc = false, seloPrincipal, seloSegundo }) {
  const { t, i18n } = useTranslation();
  const { visivel, copiar } = useAvisoCopiado();
  const painelRef = useRef(null);
  const temLider = !!u.liderUid;
  const aConferir = temLider && u.liderAConferir === true;
  const temporarios = temps?.temporarios || [];
  const convites = temps?.convites || [];
  const loginAntigo = !!(u.uidLogin && !u.loginAntigoDesligado);

  // Esc fecha (menos quando há uma janela aberta por cima); o foco vai para o painel ao abrir.
  useEffect(() => { painelRef.current?.focus(); }, []);
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape" && !pausarEsc) onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar, pausarEsc]);

  const dataCurta = (carimbo) => paraData(carimbo)?.toLocaleDateString(i18n.language) || null;
  const cracha = crachaDe(u.liderUid);
  const cadastro = dataCurta(u.liderDesde) || dataCurta(cracha?.criadoEm);
  const outras = temLider ? outrasUnidades(u.liderUid) : [];
  const local = [u.estado, nomePais, nomeMentor ? `${t("leadersTab.col.mentor")} ${nomeMentor}` : ""].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onFechar} aria-hidden="true" />
      <aside ref={painelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("leadersTab.listB.details")}
        className="relative w-[560px] max-w-full h-full overflow-y-auto bg-neutral-100 shadow-2xl outline-none dark:bg-neutral-950 animate-in slide-in-from-right duration-200">

        {/* topo */}
        <div className="sticky top-0 z-10 flex justify-between items-start gap-3 px-6 py-5 bg-white border-b border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
          <div className="min-w-0">
            <div className={ROTULO}>{t("leadersTab.col.unit")}</div>
            <h2 className="m-0 text-2xl font-black uppercase leading-tight text-neutral-900 dark:text-white break-words">{u.nome}</h2>
            <div className="text-[13px] font-semibold text-neutral-500 mt-0.5">{local || "-"}</div>
          </div>
          <button type="button" onClick={onFechar} aria-label={t("leadersTab.listB.close")} title={t("leadersTab.listB.close")}
            className="w-10 h-10 inline-flex items-center justify-center rounded-[10px] border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 shrink-0 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* aviso "a conferir" */}
          {aConferir && (
            <div className="flex flex-col gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
              <div className="flex items-center gap-2"><span className={SELO_CONFERIR}>{t("leadersTab.toCheck")}</span></div>
              <p className="m-0 text-[13px] text-neutral-800 dark:text-neutral-200">{t("leadersTab.desk.checkText", { name: u.liderNome || u.liderEmail })}</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={BTN_PRI} onClick={acoes.confirmar} disabled={ocupado}>
                  {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.6} />} {t("leadersTab.confirm")}
                </button>
                <button type="button" className={BTN} onClick={acoes.remover} disabled={ocupado}>{t("leadersTab.desk.notThisPerson")}</button>
              </div>
            </div>
          )}

          {/* líder principal */}
          {temLider ? (
            <div className={CARTAO}>
              <div className={ROTULO}>{t("leadersTab.desk.mainLeader")}</div>
              <div className="flex gap-3 items-center">
                <Avatar nome={u.liderNome || u.liderEmail} grande />
                <div className="min-w-0 text-[17px] font-black uppercase text-neutral-900 dark:text-white break-words">{u.liderNome || u.liderEmail || "-"} {seloPrincipal}</div>
              </div>
              <div className="flex flex-col gap-2">
                <LinhaEmail email={u.liderEmail} copiar={copiar} />
                <LinhaTelefone telefone={u.liderTelefone} pais={pais} copiar={copiar} comLigar />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={CAMPO_INFO}>
                  <span className={ROTULO}>{t("leadersTab.listB.lastAccess")}</span>
                  <AcessoCompleto quando={acessoDe(u.liderUid)} como={comoEntra(u.liderTipo)} carregando={carregandoAcessos} />
                </div>
                <div className={CAMPO_INFO}>
                  <span className={ROTULO}>{t("leadersTab.desk.registered")}</span>
                  <span className="text-xs font-extrabold text-neutral-900 dark:text-white">{cadastro || "—"}</span>
                  <span className="text-[11px] font-semibold text-neutral-500">{t(`tabela.access.via.${comoEntra(u.liderTipo)}`)}</span>
                </div>
                <div className={CAMPO_INFO}>
                  <span className={ROTULO}>{t("leadersTab.listB.document")}</span>
                  {carregandoAcessos && !cracha ? <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
                    : cracha?.documentoOk
                      ? <span className="text-xs font-extrabold text-neutral-900 dark:text-white">{t("leadersTab.desk.docSent")}</span>
                      : <span className="text-xs font-extrabold text-red-700 dark:text-red-400">{t("leadersTab.desk.docMissing")}</span>}
                  <button type="button" onClick={acoes.documento} className="self-start text-[11px] font-bold text-red-700 hover:underline dark:text-red-400">{t("leadersTab.desk.seeDocument")}</button>
                </div>
                <div className={CAMPO_INFO}>
                  <span className={ROTULO}>{t("leadersTab.desk.alsoLeads")}</span>
                  {outras.length
                    ? <span className="text-xs font-extrabold uppercase text-neutral-900 dark:text-white break-words">{outras.map((o) => o.nome).join(", ")}</span>
                    : <span className="text-xs font-semibold text-neutral-500">{t("leadersTab.desk.noOther")}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${CARTAO} !border-red-200 !bg-red-50 dark:!bg-red-950/30 dark:!border-red-900`}>
              <div className="flex justify-between items-center gap-2"><span className={ROTULO}>{t("leadersTab.desk.mainLeader")}</span><span className={SELO_CONFERIR}>{t("leadersTab.noLeader")}</span></div>
              <p className="m-0 text-[13px] text-neutral-700 dark:text-neutral-300">{t("leadersTab.listB.noLeaderHelp")}</p>
              {loginAntigo && (
                <div className={CAMPO_INFO}>
                  <span className={ROTULO}>{t("leadersTab.listB.lastAccess")}</span>
                  <AcessoCompleto quando={acessoDe(u.uidLogin)} como="antigo" carregando={carregandoAcessos} />
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={BTN} onClick={acoes.escolher}>{t("leadersTab.promote.button")}</button>
                <button type="button" className={BTN_PRI} onClick={acoes.cadastrar}><Plus className="w-4 h-4" /> {t("leadersTab.new")}</button>
              </div>
            </div>
          )}

          {/* 2º líder */}
          {temLider && (u.lider2Uid ? (
            <div className={CARTAO}>
              <div className="flex justify-between items-center gap-2"><span className={ROTULO}>{t("leadersTab.second.badge")}</span></div>
              <div className="flex gap-3 items-center">
                <Avatar nome={u.lider2Nome || u.lider2Email} claro grande />
                <div className="min-w-0 text-[15px] font-black uppercase text-neutral-900 dark:text-white break-words">{u.lider2Nome || u.lider2Email || "-"} {seloSegundo}</div>
              </div>
              <div className="flex flex-col gap-2">
                <LinhaEmail email={u.lider2Email} copiar={copiar} />
                <LinhaTelefone telefone={u.lider2Telefone} pais={pais} copiar={copiar} comLigar />
              </div>
              <div className={CAMPO_INFO}>
                <span className={ROTULO}>{t("leadersTab.listB.lastAccess")}</span>
                <AcessoCompleto quando={acessoDe(u.lider2Uid)} como={comoEntra(u.lider2Tipo)} carregando={carregandoAcessos} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={BTN} onClick={acoes.documentoSegundo} disabled={ocupado}>{t("leadersTab.menu.docSecond")}</button>
                <button type="button" className={BTN_PERIGO} onClick={acoes.tirarSegundo} disabled={ocupado}>{t("leadersTab.second.remove")}</button>
              </div>
            </div>
          ) : (
            <button type="button" className={VAZIO} onClick={acoes.adicionarSegundo} disabled={ocupado}>
              <span className={ROTULO}>{t("leadersTab.second.badge")}</span>
              <span className="text-sm font-extrabold text-neutral-900 dark:text-white">+ {t("leadersTab.menu.addSecond")}</span>
            </button>
          ))}

          {/* líder temporário */}
          {temporarios.length === 0 && convites.length === 0 ? (
            <button type="button" className={VAZIO} onClick={acoes.definirTemporario}>
              <span className={ROTULO}>{t("leadersTab.listB.temporary")}</span>
              <span className="text-sm font-extrabold text-neutral-900 dark:text-white">+ {t("leadersTab.desk.invite")}</span>
            </button>
          ) : (
            <>
              {temporarios.map((c) => {
                const fim = fimDoTemporario(c);
                const dias = diasRestantes(fim);
                const vencido = dias !== null && dias < 0;
                return (
                  <div key={c.id} className={CARTAO}>
                    <div className="flex justify-between items-center gap-2"><span className={ROTULO}>{t("leadersTab.listB.temporary")}</span>
                      <span className={vencido || (dias !== null && dias <= 7) ? SELO_CONFERIR : SELO_NEUTRO}>
                        {vencido ? t("tempLeader.status.expired") : dias === 0 ? t("tempLeader.status.today") : t("tempLeader.status.days", { count: dias })}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <Avatar nome={c.nome || c.email} claro />
                      <div className="min-w-0">
                        <div className="text-sm font-black uppercase text-neutral-900 dark:text-white">{c.nome || "-"}</div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 break-all">{c.email}{c.telefone ? ` · ${telefoneParaExibir(c.telefone, c.pais || pais)}` : ""}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{t("tempLeader.until", { date: diaDoFim(fim, i18n.language) })}</div>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" className={BTN} onClick={() => acoes.prorrogar(c)} disabled={tempOcupado === c.id}>{vencido ? t("tempLeader.reactivate") : t("tempLeader.extend")}</button>
                      <button type="button" className={BTN} onClick={() => acoes.efetivar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.listB.makePermanent")}</button>
                      {!vencido && <button type="button" className={BTN_PERIGO} onClick={() => acoes.encerrar(c)} disabled={tempOcupado === c.id}>{t("leadersTab.listB.end")}</button>}
                    </div>
                  </div>
                );
              })}
              {convites.map((c) => (
                <div key={c.id} className={`${CARTAO} !border-dashed`}>
                  <div className="flex justify-between items-center gap-2"><span className={ROTULO}>{t("leadersTab.listB.temporary")}</span><span className={SELO_NEUTRO}>{t("tempLeader.status.waiting")}</span></div>
                  <div className="text-sm font-black uppercase text-neutral-900 dark:text-white">{c.nome || "-"}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 break-all">{c.email} · {t("tempLeader.inviteUntil", { date: diaDoFim(c.temporarioAte, i18n.language) })}</div>
                  <div><button type="button" className={BTN_PERIGO} onClick={() => acoes.cancelarConvite(c)} disabled={tempOcupado === c.id}>{t("tempLeader.cancelInvite")}</button></div>
                </div>
              ))}
            </>
          )}

          {/* ações (remover pede confirmação) */}
          {temLider && (
            <div className="flex flex-col gap-2">
              <div className={ROTULO}>{t("leadersTab.col.actions")}</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={BTN} onClick={acoes.editar} disabled={ocupado}>{t("leadersTab.edit")}</button>
                <button type="button" className={BTN} onClick={acoes.documento} disabled={ocupado}>{t("leadersTab.listB.document")}</button>
                <button type="button" className={BTN} onClick={acoes.trocar} disabled={ocupado}>{t("leadersTab.replace")}</button>
                <button type="button" className={BTN_PERIGO} onClick={acoes.remover} disabled={ocupado}>{ocupado && <Loader2 className="w-4 h-4 animate-spin" />}{t("leadersTab.remove")}</button>
              </div>
            </div>
          )}
        </div>
      </aside>
      <AvisoCopiado visivel={visivel} />
    </div>
  );
}

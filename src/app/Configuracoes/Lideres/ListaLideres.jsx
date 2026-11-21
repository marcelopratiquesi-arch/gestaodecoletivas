// Aba Líderes — Opção B (aprovada pelo usuário): lista enxuta à esquerda (unidade, líder, acesso, mentor) e,
// ao clicar, a ficha da unidade abre ao lado (computador) ou em tela cheia (celular).
// Só desenho: dados, filtros e ações vêm do LideresTab.
import { useTranslation } from "react-i18next";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";
import { ColunaOrdenavel } from "../ui/ColunaOrdenavel";
import { SELO_CONFERIR, SELO_NEUTRO } from "./estiloLideres";

const CAMPO = "h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/40";

// Ponto + "hoje" / "há 14 dias" / "nunca entrou" (até 7 dias escuro, até 30 cinza, mais que isso vermelho).
function PontoDeAcesso({ quando, carregando, semLider, curto }) {
  const { t, i18n } = useTranslation();
  if (semLider) return <span className="text-xs text-slate-400">—</span>;
  const ac = resumoDoAcesso(quando, i18n.language);
  if (!ac) {
    if (carregando) return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />;
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full border-[1.5px] border-slate-400" />{curto ? t("leadersTab.listB.neverShort") : t("tabela.access.never")}</span>;
  }
  const cor = ac.dias > 30 ? "text-red-600" : ac.dias > 7 ? "text-slate-500" : "text-slate-800 dark:text-slate-100";
  return <span className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${cor}`}><span className="w-2 h-2 rounded-full bg-current" />{ac.relativo}</span>;
}

// Etiqueta ao lado do nome do líder: A conferir / Temporário / +1 (2º líder).
function SeloDoLider({ l }) {
  const { t } = useTranslation();
  if (l.u.liderAConferir === true) return <span className={SELO_CONFERIR}>{t("leadersTab.toCheck")}</span>;
  if (l.temTemporario) return <span className={SELO_NEUTRO}>{t("leadersTab.listB.tempShort")}</span>;
  if (l.incompleto) return <span className={SELO_NEUTRO}>{t("profileUpdate.incomplete.badgeShort")}</span>;
  if (l.u.lider2Uid) return <span className={SELO_NEUTRO}>+1</span>;
  return null;
}

/**
 * @param {{linhas:object[], total:number, chips:{id:string,rotulo:string,n:number}[], situacao:string, setSituacao:(s:string)=>void,
 *   filtro:object, mostrarMentor:boolean, ordenacao:object, nomeMentor:(id:string)=>string|undefined, carregando:boolean,
 *   carregandoAcessos:boolean, selecionadaId:string|null, onSelecionar:(u:object)=>void, onCadastrar:()=>void,
 *   acaoExtra?:React.ReactNode, abaixoDosFiltros?:React.ReactNode}} props
 */
export function ListaLideres({ linhas, total, chips, situacao, setSituacao, filtro, mostrarMentor, ordenacao, nomeMentor,
  carregando, carregandoAcessos, selecionadaId, onSelecionar, onCadastrar, acaoExtra, abaixoDosFiltros }) {
  const { t } = useTranslation();

  const nomeDoLider = (u) => u.liderNome || u.liderEmail || "-";
  const primeiro = (nome) => String(nome || "").split(" ")[0];

  return (
    <section className="flex flex-col gap-3.5 p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-red-600 dark:bg-slate-800 dark:border-slate-700 min-w-0">
      {/* título + cadastrar */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="m-0 text-xl lg:text-[22px] font-black text-slate-900 dark:text-white">
          {t("leadersTab.title")} <span className="text-sm font-semibold text-slate-500">· {t("leadersTab.listB.unitsCount", { count: total })}</span>
        </h2>
        <button type="button" onClick={onCadastrar} className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-extrabold inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {t("leadersTab.new")}
        </button>
      </div>

      {/* busca + filtros */}
      <div className="flex flex-wrap gap-2.5">
        <label className="relative flex-[1_1_260px] min-w-0">
          <span className="sr-only">{t("leadersTab.search")}</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input value={filtro.valores.busca} onChange={(e) => filtro.mudar.busca(e.target.value)} placeholder={t("leadersTab.search")} className={`${CAMPO} w-full pl-9 h-11 lg:h-10`} />
        </label>
        <select aria-label={t("filtroPadrao.country")} value={filtro.valores.pais} onChange={(e) => filtro.mudar.pais(e.target.value)} className={`${CAMPO} flex-1 sm:flex-none`}>
          <option value="">{t("filtroPadrao.allCountries")}</option>
          {filtro.opcoes.paises.map((p) => <option key={p} value={p}>{t(`common.countries.${p}`, p)}</option>)}
        </select>
        <select aria-label={t("filtroPadrao.state")} value={filtro.valores.estado} onChange={(e) => filtro.mudar.estado(e.target.value)} className={`${CAMPO} flex-1 sm:flex-none`}>
          <option value="">{t("filtroPadrao.allStates")}</option>
          {filtro.opcoes.estados.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        {mostrarMentor && (
          <select aria-label={t("filtroPadrao.mentor")} value={filtro.valores.mentor} onChange={(e) => filtro.mudar.mentor(e.target.value)} className={`${CAMPO} flex-1 sm:flex-none`}>
            <option value="">{t("filtroPadrao.allMentors")}</option>
            {filtro.opcoes.mentores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
        {acaoExtra}
      </div>
      {abaixoDosFiltros}

      {/* botões arredondados de situação, com a contagem */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap pb-0.5">
        {chips.map((c) => (
          <button key={c.id} type="button" onClick={() => setSituacao(c.id)} aria-pressed={situacao === c.id}
            className={`shrink-0 h-9 px-3.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${situacao === c.id
              ? "bg-red-600 border-red-600 text-white"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"}`}>
            {c.rotulo} {c.n}
          </button>
        ))}
      </div>

      {/* celular: contagem + ordenar */}
      <div className="lg:hidden flex justify-between items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>{t("leadersTab.listB.unitsCount", { count: linhas.length })}</span>
        <label className="inline-flex items-center gap-1.5">{t("leadersTab.listB.sort")}
          <select value={`${ordenacao.campo || "unidade"}:${ordenacao.direcao}`} onChange={(e) => { const [c, d] = e.target.value.split(":"); ordenacao.ordenarPor(c, d); }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
            <option value="unidade:asc">{t("leadersTab.listB.sortUnitAz")}</option>
            <option value="unidade:desc">{t("leadersTab.listB.sortUnitZa")}</option>
            <option value="lider:asc">{t("leadersTab.listB.sortLeaderAz")}</option>
            <option value="acesso:asc">{t("leadersTab.listB.sortAccess")}</option>
          </select>
        </label>
      </div>

      {carregando ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
      ) : linhas.length === 0 ? (
        <p className="py-14 text-center text-sm font-bold text-slate-400">{t("leadersTab.empty")}</p>
      ) : (
        <>
          {/* computador: tabela enxuta */}
          <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-xl dark:border-slate-700">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <ColunaOrdenavel campo="unidade" rotulo={t("leadersTab.col.unit")} ordenacao={ordenacao} />
                  <ColunaOrdenavel campo="lider" rotulo={t("leadersTab.col.leader")} ordenacao={ordenacao} />
                  <ColunaOrdenavel campo="acesso" rotulo={t("tabela.access.column")} ordenacao={ordenacao} />
                  {mostrarMentor && <ColunaOrdenavel campo="mentor" rotulo={t("leadersTab.col.mentor")} ordenacao={ordenacao} />}
                  <th className="w-16" aria-label={t("leadersTab.listB.open")} />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const { u } = l;
                  const sel = selecionadaId === u.id;
                  return (
                    <tr key={u.id} onClick={() => onSelecionar(u)}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-700/60 ${sel ? "bg-red-50/60 dark:bg-red-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                      <td className={`px-3.5 py-3 ${sel ? "shadow-[inset_3px_0_0_#dc2626]" : ""}`}>
                        <div className="text-[13px] font-black uppercase text-slate-900 dark:text-white">{u.nome}</div>
                        <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{u.estado || "-"}</div>
                      </td>
                      <td className="px-3.5 py-3">
                        {u.liderUid ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-extrabold uppercase text-slate-900 dark:text-white">{nomeDoLider(u)}</span>
                            <SeloDoLider l={l} />
                          </div>
                        ) : <span className={SELO_CONFERIR}>{t("leadersTab.noLeader")}</span>}
                      </td>
                      <td className="px-3.5 py-3"><PontoDeAcesso quando={l.ultimo} carregando={carregandoAcessos} semLider={!u.liderUid && !l.loginAntigo} /></td>
                      {mostrarMentor && <td className="px-3.5 py-3 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">{primeiro(nomeMentor(u.mentorId)) || "—"}</td>}
                      <td className="px-3.5 py-3 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onSelecionar(u); }} aria-pressed={sel}
                          className="text-xs font-bold text-red-700 hover:text-red-800 whitespace-nowrap dark:text-red-400">{t("leadersTab.listB.open")} ›</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* celular: lista de toque */}
          <div className="lg:hidden -mx-4 border-t border-slate-200 dark:border-slate-700">
            {linhas.map((l) => {
              const { u } = l;
              return (
                <button key={u.id} type="button" onClick={() => onSelecionar(u)}
                  className={`w-full flex items-center gap-2.5 px-4 py-3 min-h-[64px] text-left border-b border-slate-100 dark:border-slate-700/60 ${selecionadaId === u.id ? "bg-red-50/60 dark:bg-red-900/10" : "bg-white dark:bg-slate-800"}`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-black uppercase text-slate-900 dark:text-white truncate">{u.nome}</span>
                    <span className="mt-1 flex items-center gap-1.5 min-w-0">
                      {u.liderUid
                        ? <><span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 truncate">{nomeDoLider(u)}</span><SeloDoLider l={l} /></>
                        : <span className={SELO_CONFERIR}>{t("leadersTab.noLeader")}</span>}
                    </span>
                  </span>
                  <PontoDeAcesso quando={l.ultimo} carregando={carregandoAcessos} semLider={!u.liderUid && !l.loginAntigo} curto />
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

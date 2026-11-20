// Aba Líderes no COMPUTADOR (>= 1024 px): a central de cadastro. Tabela com TODOS os líderes, tudo à vista
// (unidade, líder e 2º líder, contato, último acesso, mentor e ações). A ficha abre por cima, pela direita.
// Só desenho: dados, filtros e ações vêm do LideresTab. O celular continua com o ListaLideres.
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, IdCard, Loader2, Pencil, Search } from "lucide-react";
import { ColunaOrdenavel, CLASSE_TITULO } from "../ui/ColunaOrdenavel";
import { SELO_CONFERIR, SELO_NEUTRO } from "./estiloLideres";
import { useAvisoCopiado } from "./useAvisoCopiado";
import { AvisoCopiado } from "./avisoCopiado";
import { ACAO, ACAO_ABRIR, ACAO_OK, AcessoCompleto, Avatar, BTN, BTN_PRI, LinhaEmail, LinhaTelefone } from "./pecasComputador";

const CAMPO = "h-[42px] rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/40";
const TD = "px-3.5 py-3.5 align-top border-b border-slate-100 dark:border-slate-800";

/**
 * @param {{linhas:object[], total:number, chips:{id:string,rotulo:string,n:number}[], situacao:string, setSituacao:(s:string)=>void,
 *   filtro:object, mostrarMentor:boolean, ordenacao:object, nomeMentor:(id:string)=>string|undefined, carregando:boolean,
 *   carregandoAcessos:boolean, acessoDe:(uid:string)=>any, pais:(u:object)=>string, processando:string|null,
 *   onAbrir:(u:object)=>void, acoes:{confirmar:Function, editar:Function, documento:Function, escolher:Function, cadastrar:Function}}} props
 */
export function ListaLideresComputador({ linhas, total, chips, situacao, setSituacao, filtro, mostrarMentor, ordenacao, nomeMentor,
  carregando, carregandoAcessos, acessoDe, pais, processando, onAbrir, acoes }) {
  const { t } = useTranslation();
  const { visivel, copiar } = useAvisoCopiado();
  const primeiro = (nome) => String(nome || "").split(" ")[0];
  const limpar = () => { filtro.limpar(); setSituacao("todas"); };

  return (
    <section aria-label={t("leadersTab.desk.listLabel")} className="bg-white border border-slate-200 rounded-2xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <div className="px-4 pt-4 flex flex-col gap-2.5">
        {/* busca + filtros */}
        <div className="flex flex-wrap gap-2.5">
          <label className="relative flex-[1_1_320px] min-w-0 flex">
            <span className="sr-only">{t("leadersTab.search")}</span>
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input value={filtro.valores.busca} onChange={(e) => filtro.mudar.busca(e.target.value)} placeholder={t("leadersTab.search")} className={`${CAMPO} flex-1 pl-9`} />
          </label>
          <select aria-label={t("filtroPadrao.country")} value={filtro.valores.pais} onChange={(e) => filtro.mudar.pais(e.target.value)} className={CAMPO}>
            <option value="">{t("filtroPadrao.allCountries")}</option>
            {filtro.opcoes.paises.map((p) => <option key={p} value={p}>{t(`common.countries.${p}`, p)}</option>)}
          </select>
          <select aria-label={t("filtroPadrao.state")} value={filtro.valores.estado} onChange={(e) => filtro.mudar.estado(e.target.value)} className={CAMPO}>
            <option value="">{t("filtroPadrao.allStates")}</option>
            {filtro.opcoes.estados.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          {mostrarMentor && (
            <select aria-label={t("filtroPadrao.mentor")} value={filtro.valores.mentor} onChange={(e) => filtro.mudar.mentor(e.target.value)} className={CAMPO}>
              <option value="">{t("filtroPadrao.allMentors")}</option>
              {filtro.opcoes.mentores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          )}
          <button type="button" onClick={limpar} className={BTN}>{t("leadersTab.desk.clear")}</button>
        </div>

        {/* abas de filtro com contagem + "Mostrando X de Y" + ordenar */}
        <div className="flex justify-between items-center gap-3 flex-wrap border-b border-slate-200 dark:border-slate-800">
          <div role="tablist" aria-label={t("leadersTab.desk.filterTabs")} className="flex gap-[22px] overflow-x-auto">
            {chips.map((c) => {
              const ativa = situacao === c.id;
              const alerta = (c.id === "sem" || c.id === "conferir") && c.n > 0;
              return (
                <button key={c.id} type="button" role="tab" aria-selected={ativa} onClick={() => setSituacao(c.id)}
                  className={`inline-flex items-center gap-2 h-11 px-1 border-b-[3px] text-sm font-bold whitespace-nowrap ${ativa
                    ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                    : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
                  {c.rotulo}
                  <b className={`text-[11px] font-black px-[7px] py-px rounded-full ${ativa && !alerta
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : alerta ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{c.n}</b>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 pb-1.5">
            <span className="text-xs font-bold text-slate-500">{t("leadersTab.filter.showing", { count: linhas.length, total })}</span>
            <select aria-label={t("leadersTab.listB.sort")} value={`${ordenacao.campo || "unidade"}:${ordenacao.direcao}`}
              onChange={(e) => { const [c, d] = e.target.value.split(":"); ordenacao.ordenarPor(c, d); }} className={`${CAMPO} !h-9`}>
              <option value="unidade:asc">{t("leadersTab.listB.sortUnitAz")}</option>
              <option value="unidade:desc">{t("leadersTab.listB.sortUnitZa")}</option>
              <option value="lider:asc">{t("leadersTab.listB.sortLeaderAz")}</option>
              <option value="acesso:asc">{t("leadersTab.listB.sortAccess")}</option>
            </select>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
      ) : linhas.length === 0 ? (
        <p className="py-14 text-center text-sm font-bold text-slate-400">{t("leadersTab.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-950/40 dark:border-slate-800">
              <tr>
                <ColunaOrdenavel campo="unidade" rotulo={t("leadersTab.col.unit")} ordenacao={ordenacao} cor="red" className="w-[15%]" />
                <ColunaOrdenavel campo="lider" rotulo={t("leadersTab.col.leader")} ordenacao={ordenacao} cor="red" className="w-[24%]" />
                <th className={`${CLASSE_TITULO} w-[26%]`}>{t("leadersTab.desk.contact")}</th>
                <ColunaOrdenavel campo="acesso" rotulo={t("leadersTab.listB.lastAccess")} ordenacao={ordenacao} cor="red" className="w-[13%]" />
                {mostrarMentor && <ColunaOrdenavel campo="mentor" rotulo={t("leadersTab.col.mentor")} ordenacao={ordenacao} cor="red" className="w-[9%]" />}
                <th className={`${CLASSE_TITULO} text-right`}>{t("leadersTab.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const { u } = l;
                const p = pais(u);
                const ocupado = processando === u.id;
                const mentor = primeiro(nomeMentor(u.mentorId));

                // Unidade sem líder: fundo vermelho bem claro, "SEM LÍDER" e os botões Escolher / Cadastrar.
                if (!u.liderUid) {
                  const td = `${TD} bg-red-50 dark:bg-red-950/20`;
                  return (
                    <tr key={u.id}>
                      <td className={td}><NomeUnidade u={u} onAbrir={onAbrir} /></td>
                      <td className={td}>
                        <button type="button" onClick={() => onAbrir(u)} className="flex gap-2.5 items-start text-left">
                          <span aria-hidden="true" className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full bg-white border-[1.5px] border-dashed border-red-300 text-red-700 text-xs font-extrabold shrink-0 dark:bg-slate-900">?</span>
                          <span>
                            <span className="block text-sm font-extrabold uppercase text-red-700 dark:text-red-400">{t("leadersTab.noLeader")}</span>
                            <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">{t("leadersTab.desk.nobody")}</span>
                          </span>
                        </button>
                      </td>
                      <td className={td}><span className="text-xs text-slate-500">—</span></td>
                      <td className={td}>{l.loginAntigo ? <AcessoCompleto quando={l.ultimo} como="antigo" carregando={carregandoAcessos} /> : <span className="text-xs text-slate-500">—</span>}</td>
                      {mostrarMentor && <td className={td}><SeloMentor nome={mentor} /></td>}
                      <td className={td}>
                        <div className="flex gap-1.5 justify-end">
                          <button type="button" onClick={() => acoes.escolher(u)} className={`${BTN} !h-9 !px-3`}>{t("leadersTab.desk.pick")}</button>
                          <button type="button" onClick={() => acoes.cadastrar(u)} className={`${BTN_PRI} !h-9 !px-3`}>{t("leadersTab.register")}</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const aConferir = u.liderAConferir === true;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={TD}><NomeUnidade u={u} onAbrir={onAbrir} /></td>
                    <td className={TD}>
                      <div className="flex flex-col gap-2.5">
                        <button type="button" onClick={() => onAbrir(u)} className="flex gap-2.5 items-start text-left">
                          <Avatar nome={u.liderNome || u.liderEmail} />
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold uppercase text-slate-900 dark:text-white hover:underline">{u.liderNome || u.liderEmail || "-"}</span>
                            <span className="flex gap-1.5 flex-wrap mt-1">
                              {aConferir
                                ? <span className={SELO_CONFERIR}>{t("leadersTab.toCheck")}</span>
                                : <span className="text-[11px] font-semibold text-slate-500">{t("leadersTab.desk.confirmed")}</span>}
                              {l.temTemporario && <span className={SELO_NEUTRO}>{t("leadersTab.listB.tempShort")}</span>}
                            </span>
                          </span>
                        </button>
                        {u.lider2Uid && (
                          <button type="button" onClick={() => onAbrir(u)} className="flex gap-2.5 items-start text-left">
                            <Avatar nome={u.lider2Nome || u.lider2Email} claro />
                            <span className="min-w-0">
                              <span className="block text-[13px] font-extrabold uppercase text-slate-900 dark:text-white hover:underline">{u.lider2Nome || u.lider2Email || "-"}</span>
                              <span className={`${SELO_NEUTRO} mt-1`}>{t("leadersTab.second.badge")}</span>
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <LinhaEmail email={u.liderEmail} copiar={copiar} />
                        <LinhaTelefone telefone={u.liderTelefone} pais={p} copiar={copiar} />
                        {u.lider2Uid && u.lider2Telefone && (
                          <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <LinhaTelefone telefone={u.lider2Telefone} pais={p} copiar={copiar} comCopiar={false} rotuloZap={t("leadersTab.desk.whatsSecond")} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={TD}><AcessoCompleto quando={acessoDe(u.liderUid)} como={u.liderTipo === "senha" ? "senha" : "google"} carregando={carregandoAcessos} /></td>
                    {mostrarMentor && <td className={TD}><SeloMentor nome={mentor} /></td>}
                    <td className={TD}>
                      <div className="flex gap-1.5 justify-end">
                        {aConferir && (
                          <button type="button" onClick={() => acoes.confirmar(u)} disabled={ocupado} className={ACAO_OK} aria-label={t("leadersTab.confirm")} title={t("leadersTab.confirm")}>
                            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.6} />}
                          </button>
                        )}
                        <button type="button" onClick={() => acoes.editar(u)} disabled={ocupado} className={ACAO} aria-label={t("leadersTab.edit")} title={t("leadersTab.edit")}><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => acoes.documento(u)} disabled={ocupado} className={ACAO} aria-label={t("leadersTab.listB.document")} title={t("leadersTab.listB.document")}><IdCard className="w-4 h-4" /></button>
                        <button type="button" onClick={() => onAbrir(u)} className={ACAO_ABRIR} aria-label={t("leadersTab.desk.openSheet")} title={t("leadersTab.desk.openSheet")}><ChevronRight className="w-4 h-4" strokeWidth={2.4} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <AvisoCopiado visivel={visivel} />
    </section>
  );
}

function NomeUnidade({ u, onAbrir }) {
  return (
    <button type="button" onClick={() => onAbrir(u)} className="text-left">
      <span className="block text-[13px] font-black uppercase text-slate-900 dark:text-white hover:underline">{u.nome}</span>
      <span className="block text-xs font-semibold text-slate-500 mt-0.5">{u.estado || "-"}</span>
    </button>
  );
}

function SeloMentor({ nome }) {
  if (!nome) return <span className="text-xs text-slate-500">—</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">{nome}</span>;
}

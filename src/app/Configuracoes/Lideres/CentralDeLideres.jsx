// Aba Líderes como "central de pendências": resumo (barra de proporção + 5 blocos / botões arredondados no
// celular), busca e filtros, e a lista de unidades agrupada (mais urgente primeiro). Clicar numa unidade
// seleciona e abre a ficha (FichaDaUnidade). Só desenho: os dados e as ações vêm do LideresTab.
import { useTranslation } from "react-i18next";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { resumoDoAcesso } from "../../../utils/ultimoAcesso";
import { COR_SITUACAO, ORDEM_SITUACOES } from "./situacoes";
import { fraseCurta, rotuloDoPasso } from "./frasesDaSituacao";

const CAMPO = "h-10 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] font-semibold text-neutral-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-red-500/40";

// Ponto + "hoje" / "há 14 dias" / "nunca entrou".
function PontoDeAcesso({ quando, sit, carregando, curto }) {
  const { t, i18n } = useTranslation();
  if (sit.id === "semLider") return <span className="text-xs text-neutral-400">—</span>;
  const ac = resumoDoAcesso(quando, i18n.language);
  if (!ac) {
    if (carregando) return <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-300" />;
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full border-[1.5px] border-neutral-400" />{curto ? t("leadersTab.central.neverShort") : t("tabela.access.never")}</span>;
  }
  const cor = ac.dias >= 30 ? "text-red-600" : ac.dias >= 7 ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-900 dark:text-neutral-100";
  return <span className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${cor}`}><span className="w-2 h-2 rounded-full bg-current" />{ac.relativo}</span>;
}

function BarraDeProporcao({ contagens, alta = false }) {
  const total = ORDEM_SITUACOES.reduce((s, id) => s + contagens[id], 0) || 1;
  return (
    <div aria-hidden="true" className={`flex gap-0.5 rounded-full overflow-hidden ${alta ? "h-2.5" : "h-2"}`}>
      {ORDEM_SITUACOES.map((id) => contagens[id] > 0 && <div key={id} className={COR_SITUACAO[id].barra} style={{ flex: contagens[id] / total }} />)}
    </div>
  );
}

/**
 * @param {{contagens:Record<string,number>, situacao:string, setSituacao:(s:string)=>void, onCadastrar:()=>void,
 *   filtro:object, mostrarMentor:boolean, ordem:string, setOrdem:(o:string)=>void, linhas:object[], carregando:boolean,
 *   carregandoAcessos:boolean, selecionadaId:string|null, onSelecionar:(u:object)=>void, onPasso:(linha:object)=>void,
 *   acaoExtra?:React.ReactNode, abaixoDosFiltros?:React.ReactNode, nomeMentor:(id:string)=>string|undefined}} props
 */
export function CentralDeLideres({ contagens, situacao, setSituacao, onCadastrar, filtro, mostrarMentor, ordem, setOrdem,
  linhas, carregando, carregandoAcessos, selecionadaId, onSelecionar, onPasso, acaoExtra, abaixoDosFiltros, nomeMentor }) {
  const { t } = useTranslation();
  const alternar = (id) => setSituacao(situacao === id ? "" : id);
  const pendentes = contagens.semLider + contagens.conferir + contagens.temporario + contagens.semAcesso;
  const precisa = linhas.filter((l) => l.sit.id !== "ok");
  const tudoCerto = linhas.filter((l) => l.sit.id === "ok");

  const blocos = ORDEM_SITUACOES.map((id) => ({
    id, n: contagens[id],
    rotulo: t(`leadersTab.central.tile.${id}`),
    dica: id === "temporario" && contagens.tempVencendo > 0 ? t("leadersTab.central.tileHint.tempSoon", { count: contagens.tempVencendo }) : t(`leadersTab.central.tileHint.${id}`),
  }));

  // ---------- Linha da lista (computador) ----------
  const linhaComputador = (l) => {
    const { u, sit } = l;
    const cor = COR_SITUACAO[sit.id];
    const sel = selecionadaId === u.id;
    return (
      <div key={u.id} onClick={() => onSelecionar(u)}
        className={`grid items-center gap-3.5 py-3 pr-3.5 border-b border-neutral-100 dark:border-neutral-800 cursor-pointer ${sel ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"} ${mostrarMentor ? "grid-cols-[6px_minmax(0,1.3fr)_minmax(0,1.4fr)_120px_96px_168px]" : "grid-cols-[6px_minmax(0,1.3fr)_minmax(0,1.5fr)_120px_168px]"}`}>
        <div className={`self-stretch rounded-r ${cor.barra}`} />
        <button type="button" onClick={(e) => { e.stopPropagation(); onSelecionar(u); }} aria-pressed={sel} className="text-left min-w-0">
          <div className="text-[13px] font-black uppercase text-neutral-900 dark:text-neutral-100 truncate">{u.nome}</div>
          <div className="text-[11px] font-semibold text-neutral-500 mt-0.5">{u.estado || "-"}</div>
        </button>
        <div className="min-w-0">
          {u.liderUid ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-extrabold uppercase text-neutral-900 dark:text-neutral-100 truncate">{u.liderNome || u.liderEmail || "-"}</span>
              {u.lider2Uid && <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-neutral-300 bg-neutral-100 text-neutral-700 text-[10px] font-extrabold uppercase dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-300">+ {String(u.lider2Nome || "").split(" ")[0]}</span>}
            </div>
          ) : <span className="inline-flex px-1.5 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-[10px] font-extrabold uppercase">{t("leadersTab.central.tile.semLider")}</span>}
          <div className={`text-xs font-semibold mt-0.5 truncate ${cor.texto}`}>{fraseCurta(sit, u, t)}</div>
        </div>
        <PontoDeAcesso quando={l.ultimo} sit={sit} carregando={carregandoAcessos} />
        {mostrarMentor && <span className="justify-self-start max-w-full truncate px-2 py-1 rounded-lg bg-neutral-100 text-[11px] font-extrabold uppercase text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{(nomeMentor(u.mentorId) || "—").split(" ")[0]}</span>}
        <button type="button" onClick={(e) => { e.stopPropagation(); onPasso(l); }}
          className={`h-[34px] px-2.5 rounded-lg border text-xs font-extrabold whitespace-nowrap truncate ${cor.botao}`}>
          {rotuloDoPasso(sit, u, t)}{sit.id === "ok" ? " ›" : ""}
        </button>
      </div>
    );
  };

  // ---------- Linha da lista (celular) ----------
  const linhaCelular = (l) => {
    const { u, sit } = l;
    const cor = COR_SITUACAO[sit.id];
    const mentor = mostrarMentor ? (nomeMentor(u.mentorId) || "").split(" ")[0] : "";
    return (
      <button key={u.id} type="button" onClick={() => onSelecionar(u)}
        className={`w-full flex items-center gap-3 py-3 pr-4 min-h-[44px] text-left border-b border-neutral-100 dark:border-neutral-800 ${selecionadaId === u.id ? "bg-neutral-100 dark:bg-neutral-800" : "bg-white dark:bg-neutral-900"}`}>
        <span className={`w-[5px] self-stretch rounded-r shrink-0 ${cor.barra}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-black uppercase text-neutral-900 dark:text-neutral-100 truncate">{u.nome}</span>
          <span className={`block text-xs font-semibold mt-0.5 truncate ${cor.texto}`}>{fraseCurta(sit, u, t)}{mentor ? ` · ${mentor}` : ""}</span>
        </span>
        <PontoDeAcesso quando={l.ultimo} sit={sit} carregando={carregandoAcessos} curto />
        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
      </button>
    );
  };

  const grupo = (titulo, cor, extra) => (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[11px] font-extrabold uppercase tracking-wider text-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200">
      <span className={`w-2 h-2 rounded-full ${cor}`} />{titulo}{extra && <span className="ml-auto normal-case tracking-normal font-bold text-neutral-500">{extra}</span>}
    </div>
  );

  const vazio = !carregando && linhas.length === 0;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* ===== RESUMO — computador ===== */}
      <section aria-label={t("leadersTab.central.summary")} className="hidden lg:flex flex-col gap-3.5 p-4 rounded-2xl bg-white border border-neutral-200 border-t-4 border-t-red-600 dark:bg-neutral-900 dark:border-neutral-800">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="m-0 text-[22px] font-black text-neutral-900 dark:text-neutral-100">{t("leadersTab.central.title")}</h2>
            <p className="mt-1 mb-0 text-[13px] text-neutral-600 dark:text-neutral-400">{t("leadersTab.central.subtitle", { count: pendentes, total: contagens.total })}</p>
          </div>
          <button type="button" onClick={onCadastrar} className="h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-extrabold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />{t("leadersTab.new")}</button>
        </div>
        <BarraDeProporcao contagens={contagens} alta />
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {blocos.map((b) => (
            <button key={b.id} type="button" onClick={() => alternar(b.id)} aria-pressed={situacao === b.id}
              className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border bg-white text-left min-w-0 dark:bg-neutral-900 ${situacao === b.id ? "border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700"}`}>
              <b className={`text-[28px] font-black leading-none ${COR_SITUACAO[b.id].numero}`}>{b.n}</b>
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-neutral-900 dark:text-neutral-100"><i className={`w-[9px] h-[9px] rounded-full ${COR_SITUACAO[b.id].barra}`} />{b.rotulo}</span>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{b.dica}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== RESUMO — celular ===== */}
      <section aria-label={t("leadersTab.central.summary")} className="lg:hidden flex flex-col gap-3 p-4 -mx-3 sm:mx-0 sm:rounded-2xl bg-white border-b border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
        <div className="flex justify-between items-center">
          <div><div className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">{t("leadersTab.central.breadcrumb")}</div>
            <div className="text-xl font-black text-neutral-900 dark:text-neutral-100">{t("leadersTab.central.pendingCount", { count: pendentes })}</div></div>
          <button type="button" onClick={onCadastrar} aria-label={t("leadersTab.new")} className="w-11 h-11 rounded-xl bg-red-600 text-white inline-flex items-center justify-center"><Plus className="w-6 h-6" /></button>
        </div>
        <BarraDeProporcao contagens={contagens} />
        <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400"><span>{t("leadersTab.central.unitsCount", { count: contagens.total })}</span><span>{t("leadersTab.central.okCount", { count: contagens.ok })}</span></div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {[{ id: "pendentes", rotulo: t("leadersTab.central.chip.pending"), n: pendentes }, ...blocos.map((b) => ({ id: b.id, rotulo: t(`leadersTab.central.chip.${b.id}`), n: b.n }))].map((c) => (
            <button key={c.id} type="button" onClick={() => alternar(c.id)} aria-pressed={situacao === c.id}
              className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-full border text-[13px] font-bold whitespace-nowrap ${situacao === c.id ? "bg-neutral-900 border-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"}`}>
              {c.id !== "pendentes" && <i className={`w-2 h-2 rounded-full ${COR_SITUACAO[c.id].barra}`} />}{c.rotulo} <b className="font-black">{c.n}</b>
            </button>
          ))}
        </div>
      </section>

      {/* ===== BUSCA E FILTROS + LISTA ===== */}
      <section aria-label={t("leadersTab.central.units")} className="rounded-2xl bg-white border border-neutral-200 overflow-hidden dark:bg-neutral-900 dark:border-neutral-800">
        <div className="flex flex-wrap gap-2.5 p-3.5">
          <label className="relative flex-[1_1_260px] min-w-0">
            <span className="sr-only">{t("leadersTab.search")}</span>
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input value={filtro.valores.busca} onChange={(e) => filtro.mudar.busca(e.target.value)} placeholder={t("leadersTab.search")} className={`${CAMPO} w-full pl-9 h-11 lg:h-10`} />
          </label>
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
          <select aria-label={t("leadersTab.central.sort.label")} value={ordem} onChange={(e) => setOrdem(e.target.value)} className={`${CAMPO} flex-1 sm:flex-none`}>
            <option value="situacao">{t("leadersTab.central.sort.situation")}</option>
            <option value="az">{t("leadersTab.central.sort.az")}</option>
            <option value="za">{t("leadersTab.central.sort.za")}</option>
            <option value="acesso">{t("leadersTab.central.sort.access")}</option>
          </select>
          {acaoExtra}
        </div>
        {abaixoDosFiltros && <div className="px-3.5 pb-3.5">{abaixoDosFiltros}</div>}

        {carregando ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
        ) : vazio ? (
          <p className="py-14 text-center text-sm font-bold text-neutral-500">{t("leadersTab.empty")}</p>
        ) : (
          <>
            {/* computador: "Precisa de ação" e "Tudo certo" */}
            <div className="hidden lg:block overflow-x-auto border-t border-neutral-200 dark:border-neutral-800">
              <div className="min-w-[780px]">
                {precisa.length > 0 && grupo(t("leadersTab.central.groupAction", { count: precisa.length }), "bg-red-600", ordem === "situacao" ? t("leadersTab.central.urgentFirst") : null)}
                {precisa.map((l) => linhaComputador(l))}
                {tudoCerto.length > 0 && grupo(t("leadersTab.central.groupOk", { count: tudoCerto.length }), "bg-neutral-300")}
                {tudoCerto.map((l) => linhaComputador(l))}
              </div>
            </div>
            {/* celular: um grupo por situação */}
            <div className="lg:hidden border-t border-neutral-200 dark:border-neutral-800">
              {ORDEM_SITUACOES.map((id) => {
                const doGrupo = linhas.filter((l) => l.sit.id === id);
                if (!doGrupo.length) return null;
                return (
                  <div key={id}>
                    {grupo(`${t(`leadersTab.central.tile.${id}`)} · ${doGrupo.length}`, COR_SITUACAO[id].barra)}
                    {doGrupo.map((l) => linhaCelular(l))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

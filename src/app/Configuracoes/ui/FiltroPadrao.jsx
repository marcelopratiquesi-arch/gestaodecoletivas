// Barra de filtros padrão das Configurações (busca + País → Estado → Mentor → Líder + limpar + contagem).
// Fica na cor da aba (temas.js). Use junto com useFiltroCascata.
import { Search, X, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { temaDaAba } from "./temas";
import { SEM_MENTOR } from "./useFiltroCascata";

const CLASSE_SELECT = "w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-black uppercase text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * @param {{abaId:string, filtro:ReturnType<import("./useFiltroCascata").useFiltroCascata>,
 *   mostrar?:("pais"|"estado"|"mentor"|"lider"|"unidade")[], placeholder?:string,
 *   acoes?:React.ReactNode, children?:React.ReactNode, ativoExtra?:boolean, aoLimpar?:()=>void}} props
 * `ativoExtra`/`aoLimpar` = filtro próprio da aba (ex.: situação) que também conta como "filtro ativo" e é zerado no "limpar".
 * `acoes` = botões ao lado da busca (ex.: botão do CPF);  `children` = coisas extras abaixo (ex.: busca por CPF aberta).
 */
export function FiltroPadrao({ abaId, filtro, mostrar = ["pais", "estado"], placeholder, acoes, children, ativoExtra, aoLimpar }) {
  const { t } = useTranslation();
  const tema = temaDaAba(abaId);
  const { valores, mudar, opcoes, resultado, total, ativo, limpar } = filtro;

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className={`w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${tema.lupa}`} />
            <input value={valores.busca} onChange={(e) => mudar.busca(e.target.value)} placeholder={placeholder || t("filtroPadrao.search")}
              className={`w-full pl-9 pr-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 ${tema.foco}`} />
          </div>
          {acoes}
        </div>
        {children}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {mostrar.includes("pais") && (
            <Seletor rotulo={t("filtroPadrao.country")} tema={tema} valor={valores.pais} onChange={mudar.pais}
              todos={t("filtroPadrao.allCountries")}
              opcoes={opcoes.paises.map((p) => ({ id: p, nome: t(`common.countries.${p}`, { defaultValue: p }) }))} />
          )}
          {mostrar.includes("estado") && (
            <Seletor rotulo={t("filtroPadrao.state")} tema={tema} valor={valores.estado} onChange={mudar.estado}
              todos={t("filtroPadrao.allStates")} desabilitado={!valores.pais}
              opcoes={opcoes.estados.map((e) => ({ id: e, nome: e }))} />
          )}
          {mostrar.includes("mentor") && (
            <Seletor rotulo={t("filtroPadrao.mentor")} tema={tema} valor={valores.mentor} onChange={mudar.mentor}
              todos={t("filtroPadrao.allMentors")}
              opcoes={opcoes.temSemMentor ? [...opcoes.mentores, { id: SEM_MENTOR, nome: t("filtroPadrao.noMentor") }] : opcoes.mentores} />
          )}
          {mostrar.includes("lider") && (
            <Seletor rotulo={t("filtroPadrao.leader")} tema={tema} valor={valores.lider} onChange={mudar.lider}
              todos={t("filtroPadrao.allLeaders")} opcoes={opcoes.lideres} />
          )}
          {mostrar.includes("unidade") && (
            <Seletor rotulo={t("filtroPadrao.unit")} tema={tema} valor={valores.unidade} onChange={mudar.unidade}
              todos={t("filtroPadrao.allUnits")} opcoes={opcoes.unidades} />
          )}
          {(ativo || ativoExtra) && (
            <button type="button" onClick={() => { limpar(); aoLimpar?.(); }}
              className="px-3 py-2.5 rounded-xl text-xs font-black uppercase text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-1 lg:justify-start">
              <X className="w-3.5 h-3.5" /> {t("filtroPadrao.clear")}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] font-bold text-slate-400 text-right">{t("filtroPadrao.showing", { count: resultado.length, total })}</p>
    </div>
  );
}

function Seletor({ rotulo, tema, valor, onChange, todos, opcoes, desabilitado }) {
  return (
    <label className="space-y-1 block">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rotulo}</span>
      <div className="relative">
        <select value={valor} onChange={(e) => onChange(e.target.value)} disabled={desabilitado} className={`${CLASSE_SELECT} ${tema.foco}`}>
          <option value="">{todos}</option>
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </label>
  );
}

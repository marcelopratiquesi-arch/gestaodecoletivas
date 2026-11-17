// Cabeçalho padrão de toda aba das Configurações: ícone colorido + título + subtítulo + (números) + (botões).
// Troca os cabeçalhos copiados e colados de cada aba (as abas passam a usar isto na etapa 4 do plano).
import { temaDaAba, BOTAO_FERRAMENTA } from "./temas";

/**
 * @param {{abaId:string, icone:React.ElementType, titulo:string, subtitulo?:string,
 *          numeros?:React.ReactNode, children?:React.ReactNode}} props
 * `numeros` = <CaixaDeNumeros/>;  `children` = botões (principal por último).
 */
export function CabecalhoDaAba({ abaId, icone, titulo, subtitulo, numeros, children }) {
  const Icone = icone;
  const tema = temaDaAba(abaId);
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className={`p-2 rounded-lg ${tema.iconeTitulo}`}><Icone className="w-6 h-6" /></span>
          {titulo}
        </h2>
        {subtitulo && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">{subtitulo}</p>}
      </div>
      {(numeros || children) && (
        <div className="flex flex-wrap gap-3 w-full md:w-auto md:justify-end items-stretch">
          {numeros}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Caixinha com os números do topo (Total / Ativos / Inativos...). Se o item tiver `onClick`, vira filtro clicável.
 * @param {{itens: {id:string, rotulo:string, valor:number|string, cor?:string, onClick?:()=>void, ativo?:boolean}[], abaId:string}} props
 * `cor` = classe de texto do número (ex.: "text-green-600"); sem `cor`, usa o cinza padrão.
 */
export function CaixaDeNumeros({ itens, abaId }) {
  const tema = temaDaAba(abaId);
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {itens.map((it, i) => {
        const conteudo = (
          <>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{it.rotulo}</p>
            <p className={`text-lg font-black leading-none ${it.cor || "text-slate-700 dark:text-white"}`}>{it.valor}</p>
          </>
        );
        return (
          <div key={it.id} className="flex items-center gap-2">
            {i > 0 && <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />}
            {it.onClick ? (
              <button type="button" onClick={it.onClick} aria-pressed={!!it.ativo}
                className={`text-center rounded-lg px-2 py-1 transition-colors ${it.ativo ? tema.marcado : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                {conteudo}
              </button>
            ) : (
              <div className="text-center px-2 py-1">{conteudo}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Botão extra do cabeçalho ("Importar CSV", "Corrigir E-mails", "Tornar líder"...). Mesmo formato em todas as abas. */
export function BotaoSecundario({ icone, girar, children, ...resto }) {
  const Icone = icone;
  return (
    <button type="button" {...resto}
      className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap disabled:opacity-50 ${BOTAO_FERRAMENTA}`}>
      {Icone && <Icone className={`w-4 h-4 ${girar ? "animate-spin" : ""}`} />} {children}
    </button>
  );
}

/** Botão principal da aba ("Novo Mentor", "Nova Unidade"...). Usa a cor da aba. */
export function BotaoPrincipal({ abaId, icone, children, ...resto }) {
  const Icone = icone;
  const tema = temaDaAba(abaId);
  return (
    <button type="button" {...resto}
      className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap disabled:opacity-50 ${tema.botao}`}>
      {Icone && <Icone className="w-4 h-4" />} {children}
    </button>
  );
}

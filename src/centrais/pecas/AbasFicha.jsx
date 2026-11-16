// Barra de abas num quadro branco arredondado. A aba escolhida fica azul clarinho.
// No celular a barra rola para o lado. `contador` mostra o número de pendências em vermelho.
//   abas: [{ id, nome, icone, contador? }]
export default function AbasFicha({ abas, ativa, onTrocar }) {
  return (
    <div role="tablist" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-1.5 flex gap-1 overflow-x-auto">
      {abas.map(({ id, nome, icone: Icone, contador }) => {
        const escolhida = id === ativa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={escolhida}
            onClick={() => onTrocar(id)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              escolhida
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {Icone && <Icone className="w-4 h-4" />}
            {nome}
            {contador > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

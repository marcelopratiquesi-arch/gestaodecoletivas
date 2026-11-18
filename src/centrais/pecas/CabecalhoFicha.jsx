import { cor } from './cores';

// Cabeçalho da ficha: bolinha com iniciais (pontinho verde = ativo, cinza = desligado), nome em
// maiúsculas, selos, linha de informações e botões de ação à direita.
//   selos: [{ texto, cor }]
//   infos: peças prontas (use <Contato />), separadas por um risquinho
export default function CabecalhoFicha({ iniciais, ativo = true, nome, selos = [], infos = [], acoes = null }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4 pt-4 pb-5 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[18px] font-extrabold">
            {iniciais}
          </div>
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#F8FAFC] dark:border-slate-950 ${ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-extrabold uppercase leading-tight text-slate-800 dark:text-white break-words">{nome}</h2>
            {selos.map((selo) => (
              <span key={selo.texto} className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${cor(selo.cor).selo}`}>
                {selo.texto}
              </span>
            ))}
          </div>
          {infos.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {infos.map((info, i) => (
                <span key={i} className="inline-flex items-center gap-2 min-w-0 max-w-full">
                  {i > 0 && <span className="text-slate-300 dark:text-slate-700 select-none">|</span>}
                  {info}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {acoes && <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">{acoes}</div>}
    </div>
  );
}

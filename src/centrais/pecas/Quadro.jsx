import { ExternalLink } from 'lucide-react';

// Quadro branco do conteúdo das abas. `acao` = { texto, onClick } vira o link "Abrir a tela completa".
export default function Quadro({ titulo, icone: Icone, acao = null, children, className = '' }) {
  return (
    <section className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 ${className}`}>
      {(titulo || acao) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
            {Icone && <Icone className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            {titulo}
          </h3>
          {acao && (
            <button
              type="button"
              onClick={acao.onClick}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
            >
              {acao.texto}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

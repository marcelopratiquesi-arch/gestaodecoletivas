import { ArrowLeft } from 'lucide-react';
import { FONTE_CENTRAL } from './cores';

// Janela grande no meio da tela (nunca painel lateral: ele cortava o topo com a tela em zoom).
// O fundo escurecido tem rolagem própria; clicar fora fecha. O Esc é tratado por quem empilha as
// janelas (CentraisHost), para fechar só a de cima.
export default function JanelaFicha({ z = 200, onFechar, textoVoltar, rotulo, children }) {
  const fecharSeFora = (e) => {
    // Só o clique direto no fundo fecha; arrastar a barra de rolagem não.
    if (e.target === e.currentTarget && e.clientX < e.currentTarget.clientWidth) onFechar();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex items-start justify-center p-3 md:p-8"
      style={{ zIndex: z, fontFamily: FONTE_CENTRAL }}
      onMouseDown={fecharSeFora}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        className="w-full max-w-6xl my-auto rounded-[20px] p-5 md:p-6 shadow-2xl bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-white"
      >
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {textoVoltar}
        </button>
        {children}
      </div>
    </div>
  );
}

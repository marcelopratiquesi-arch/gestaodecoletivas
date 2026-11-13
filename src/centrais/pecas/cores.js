// Cores das Centrais. As classes ficam escritas por extenso para o Tailwind encontrá-las.
// azul = principal · verde (emerald) = em dia · amarelo (amber) = atenção · vermelho (rose) = erro/falta.
export const CORES = {
  blue: {
    icone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    texto: 'text-blue-600 dark:text-blue-400',
    selo: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  },
  emerald: {
    icone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    texto: 'text-emerald-600 dark:text-emerald-400',
    selo: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  },
  amber: {
    icone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    texto: 'text-amber-600 dark:text-amber-400',
    selo: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  },
  rose: {
    icone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    texto: 'text-rose-600 dark:text-rose-400',
    selo: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
  },
  violet: {
    icone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
    texto: 'text-violet-600 dark:text-violet-400',
    selo: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
  },
  slate: {
    icone: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
    texto: 'text-slate-500 dark:text-slate-400',
    selo: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  },
};

export const cor = (nome) => CORES[nome] || CORES.slate;

// A fonte Inter vale só dentro das Centrais (o resto do sistema continua com a fonte de sempre).
export const FONTE_CENTRAL = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

// Botões do cabeçalho e dos quadros.
export const BOTAO_PRINCIPAL = 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold uppercase tracking-wider transition-colors';
export const BOTAO_BRANCO = 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-bold uppercase tracking-wider transition-colors';

// Textos pequenos e tabelas simples (títulos de coluna em maiúsculas, linhas finas).
export const ROTULO = 'text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500';
export const VALOR = 'text-[13px] font-bold text-slate-800 dark:text-white break-words';
export const TH = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap';
export const TD = 'px-3 py-2.5 align-middle';
export const SELO_ATIVO = 'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
export const SELO_INATIVO = 'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400';

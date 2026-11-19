// Tema das abas das Configurações. REGRA DO SISTEMA (CLAUDE.md): o sistema é vermelho/preto/cinza/branco, então TODAS as abas
// usam o vermelho. Não volte a dar uma cor diferente para cada aba.
// ATENÇÃO: as classes abaixo são escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).

export const TEMAS = {
  "mentores": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "lideres": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "professores": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "unidades": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "modalidades": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "feriados": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "pratique-play": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "workshops": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
  "backup": {
    cor: "red",
    // menu de abas
    menuAtivo: "border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/10",
    menuIconeAtivo: "text-red-600 dark:text-red-400",
    menuContador: "bg-red-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-red-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-red-600 text-white shadow-md shadow-red-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500",
    lupa: "group-focus-within:text-red-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
    marcado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    contagem: "bg-red-600 text-white",
  },
};

// Segurança: aba desconhecida cai no tema do Backup, nunca quebra a tela.
export const temaDaAba = (id) => TEMAS[id] || TEMAS.backup;

// Botão de EXCLUIR: contorno (não preenchido), para não se confundir com o botão principal vermelho de Unidades.
export const BOTAO_PERIGO =
  "bg-white dark:bg-slate-800 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors";

// Botão de ferramenta/manutenção (Importar CSV, Atualizar página pública...): neutro, nunca disputa com o "Novo".
export const BOTAO_FERRAMENTA =
  "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm";

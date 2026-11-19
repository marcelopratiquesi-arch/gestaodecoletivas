// Cor de cada aba das Configurações. Uma cor por aba, para a pessoa saber onde está só de bater o olho.
// ATENÇÃO: as classes abaixo são escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
// Para trocar uma cor, troque o nome da cor (ex.: "teal" -> "cyan") em todas as linhas daquela aba.

export const TEMAS = {
  "mentores": {
    cor: "blue",
    // menu de abas
    menuAtivo: "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10",
    menuIconeAtivo: "text-blue-600 dark:text-blue-400",
    menuContador: "bg-blue-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-blue-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-blue-600 text-white shadow-md shadow-blue-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
    lupa: "group-focus-within:text-blue-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
    marcado: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    contagem: "bg-blue-600 text-white",
  },
  "lideres": {
    cor: "teal",
    // menu de abas
    menuAtivo: "border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-900/10",
    menuIconeAtivo: "text-teal-600 dark:text-teal-400",
    menuContador: "bg-teal-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-teal-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-teal-600 text-white shadow-md shadow-teal-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500",
    lupa: "group-focus-within:text-teal-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800",
    marcado: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    contagem: "bg-teal-600 text-white",
  },
  "professores": {
    cor: "green",
    // menu de abas
    menuAtivo: "border-green-600 text-green-600 dark:text-green-400 dark:border-green-400 bg-green-50/50 dark:bg-green-900/10",
    menuIconeAtivo: "text-green-600 dark:text-green-400",
    menuContador: "bg-green-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-green-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-green-600 text-white shadow-md shadow-green-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500",
    lupa: "group-focus-within:text-green-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
    marcado: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    contagem: "bg-green-600 text-white",
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
    cor: "orange",
    // menu de abas
    menuAtivo: "border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400 bg-orange-50/50 dark:bg-orange-900/10",
    menuIconeAtivo: "text-orange-600 dark:text-orange-400",
    menuContador: "bg-orange-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-orange-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-orange-600 text-white shadow-md shadow-orange-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
    lupa: "group-focus-within:text-orange-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
    marcado: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    contagem: "bg-orange-600 text-white",
  },
  "feriados": {
    cor: "pink",
    // menu de abas
    menuAtivo: "border-pink-600 text-pink-600 dark:text-pink-400 dark:border-pink-400 bg-pink-50/50 dark:bg-pink-900/10",
    menuIconeAtivo: "text-pink-600 dark:text-pink-400",
    menuContador: "bg-pink-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-pink-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-pink-600 text-white shadow-md shadow-pink-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
    lupa: "group-focus-within:text-pink-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800",
    marcado: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
    contagem: "bg-pink-600 text-white",
  },
  "pratique-play": {
    cor: "purple",
    // menu de abas
    menuAtivo: "border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/10",
    menuIconeAtivo: "text-purple-600 dark:text-purple-400",
    menuContador: "bg-purple-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-purple-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-purple-600 text-white shadow-md shadow-purple-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500",
    lupa: "group-focus-within:text-purple-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
    marcado: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    contagem: "bg-purple-600 text-white",
  },
  "workshops": {
    cor: "rose",
    // menu de abas
    menuAtivo: "border-rose-600 text-rose-600 dark:text-rose-400 dark:border-rose-400 bg-rose-50/50 dark:bg-rose-900/10",
    menuIconeAtivo: "text-rose-600 dark:text-rose-400",
    menuContador: "bg-rose-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-rose-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-rose-600 text-white shadow-md shadow-rose-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500",
    lupa: "group-focus-within:text-rose-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800",
    marcado: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
    contagem: "bg-rose-600 text-white",
  },
  "backup": {
    cor: "slate",
    // menu de abas
    menuAtivo: "border-slate-600 text-slate-600 dark:text-slate-400 dark:border-slate-400 bg-slate-50/50 dark:bg-slate-900/10",
    menuIconeAtivo: "text-slate-600 dark:text-slate-400",
    menuContador: "bg-slate-600 text-white",
    // faixa colorida no alto da área de conteúdo
    faixa: "border-t-4 border-t-slate-500",
    // quadradinho do ícone no título
    iconeTitulo: "bg-slate-600 text-white shadow-md shadow-slate-500/20",
    // botão principal (ex.: Novo Mentor)
    botao: "bg-slate-600 hover:bg-slate-700 text-white shadow-lg shadow-slate-500/20",
    // campo de busca / seletores em foco
    foco: "focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500",
    lupa: "group-focus-within:text-slate-500",
    // selo/etiqueta suave e botão de filtro marcado
    suave: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800",
    marcado: "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300",
    contagem: "bg-slate-600 text-white",
  },
};

// Segurança: aba desconhecida cai na cor do Backup (cinza), nunca quebra a tela.
export const temaDaAba = (id) => TEMAS[id] || TEMAS.backup;

// Botão de EXCLUIR: contorno (não preenchido), para não se confundir com o botão principal vermelho de Unidades.
export const BOTAO_PERIGO =
  "bg-white dark:bg-slate-800 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors";

// Botão de ferramenta/manutenção (Importar CSV, Atualizar página pública...): neutro, nunca disputa com o "Novo".
export const BOTAO_FERRAMENTA =
  "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm";

// src/permissions.js

const PAGE_RULES = {
  // Todos acessam o início
  inicio: ["admin", "mentor", "unidade", "professor"],
  
  relatorio_gerencial: ["admin", "mentor", "unidade", "professor"],
  
  cronograma: ["admin", "mentor", "unidade", "professor"], 
  
  validacao_diaria: ["admin", "mentor", "unidade", "professor"],
  
  // Apenas Admin e Mentor acessam.
  validacao_coletiva: ["admin", "mentor"], 
  
  // 🟢 NOVA REGRA: Performance Financeira (Essencial para a nova aba funcionar)
  performance_financeira: ["admin", "mentor"],
  
  configuracoes: ["admin", "mentor", "unidade"], 
};

export function canAccessPage(userData, pageKey) {
  // Garante que role seja string e minúsculo para evitar erros de comparação
  const role = (userData?.role || "").toString().trim().toLowerCase();
  
  const allowed = PAGE_RULES[pageKey];

  // Se a página não está listada nas regras, bloqueia por segurança
  if (!allowed) return false;

  return allowed.includes(role);
}
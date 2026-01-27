// src/permissions.js

const PAGE_RULES = {
  // Todos acessam o início
  inicio: ["admin", "mentor", "unidade", "professor"],
  
  relatorio_gerencial: ["admin", "mentor", "unidade", "professor"],
  
  cronograma: ["admin", "mentor", "unidade", "professor"], 
  
  validacao_diaria: ["admin", "mentor", "unidade", "professor"],
  
  // 🔴 CORREÇÃO: Removido "unidade". Apenas Admin e Mentor acessam.
  validacao_coletiva: ["admin", "mentor"], 
  
  configuracoes: ["admin", "mentor", "unidade"], 
};

export function canAccessPage(userData, pageKey) {
  const role = (userData?.role || "").toString().trim().toLowerCase();
  
  const allowed = PAGE_RULES[pageKey];

  if (!allowed) return false;

  return allowed.includes(role);
}

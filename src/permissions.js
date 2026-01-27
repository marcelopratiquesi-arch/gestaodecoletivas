// src/permissions.js

const PAGE_RULES = {
  // Todos acessam o início
  inicio: ["admin", "mentor", "unidade", "professor"],
  
  // 🟢 CORREÇÃO 1: Adicionado "professor" aqui para ele ver o financeiro
  relatorio_gerencial: ["admin", "mentor", "unidade", "professor"],
  
  // 🟢 CORREÇÃO 2: Adicionado "professor" aqui para ele ver a agenda
  cronograma: ["admin", "mentor", "unidade", "professor"], 
  
  // Professor já tinha acesso aqui
  validacao_diaria: ["admin", "mentor", "unidade", "professor"],
  
  // Estas páginas continuam restritas (Professor NÃO entra)
  validacao_coletiva: ["admin", "mentor", "unidade"], 
  configuracoes: ["admin", "mentor", "unidade"], 
};

export function canAccessPage(userData, pageKey) {
  // Garante que o role seja string e minúsculo para evitar erros de comparação
  const role = (userData?.role || "").toString().trim().toLowerCase();
  
  const allowed = PAGE_RULES[pageKey];

  // Se a página não foi definida nas regras, bloqueia por segurança
  if (!allowed) return false;

  return allowed.includes(role);
}
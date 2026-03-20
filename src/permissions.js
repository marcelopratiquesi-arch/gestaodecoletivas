// src/permissions.js
const PAGE_RULES = {
  inicio: ["admin", "mentor", "unidade", "professor"],
  relatorio_gerencial: ["admin", "mentor", "unidade", "professor"],
  cronograma: ["admin", "mentor", "unidade", "professor"], 
  validacao_diaria: ["admin", "mentor", "unidade", "professor"],
  validacao_coletiva: ["admin", "mentor"], 
  financeiro: ["admin", "mentor"],
  configuracoes: ["admin", "mentor", "unidade"], 
  // 🟢 REGRA NOVA: Todo mundo pode ouvir música!
  pratique_play: ["admin", "mentor", "unidade", "professor"],
  // 🟢 REGRA NOVA: Acesso à Loja e Workshops (Gestão Financeira e Stock)
  workshops: ["admin", "mentor"] 
};

export function canAccessPage(userData, pageKey) {
  const role = (userData?.role || "").toString().trim().toLowerCase();
  const allowed = PAGE_RULES[pageKey];
  if (!allowed) return false;
  return allowed.includes(role);
}
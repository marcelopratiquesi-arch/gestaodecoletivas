// src/permissions.js
// Professor de coletiva: só Cronograma (das unidades em que está vinculado),
// Validação Diária (das aulas dele) e o Link do Aluno (/horarios, público). Mais nada.
const PAGE_RULES = {
  inicio: ["admin", "mentor", "lider", "unidade"],
  relatorio_gerencial: ["admin", "mentor", "lider", "unidade"],
  cronograma: ["admin", "mentor", "lider", "unidade", "professor"],
  validacao_diaria: ["admin", "mentor", "lider", "unidade", "professor"],
  validacao_coletiva: ["admin", "mentor"],
  financeiro: ["admin", "mentor"],
  configuracoes: ["admin", "mentor", "lider", "unidade"],
  pratique_play: ["admin", "mentor", "lider", "unidade"],
  // Acesso à Loja e Workshops (Gestão Financeira e Stock)
  workshops: ["admin", "mentor"]
};

// Líder: perfil novo que substitui o antigo "unidade". Durante a transição os dois valem igual.
// Quando todos os logins tiverem virado "lider", é só tirar "unidade" daqui, do PAGE_RULES
// e do firestore.rules (função souLider / PAPEIS_LIDER).
export const PAPEIS_LIDER = ["lider", "unidade"];
export function ehLider(role) {
  return PAPEIS_LIDER.includes(String(role || "").trim().toLowerCase());
}

function getRole(userData) {
  return (userData?.role || "").toString().trim().toLowerCase();
}

export function canAccessPage(userData, pageKey) {
  const allowed = PAGE_RULES[pageKey];
  if (!allowed) return false;
  return allowed.includes(getRole(userData));
}

// Página "de casa" de cada perfil (para onde vai ao entrar ou quando cai numa página proibida).
export function getHomePath(userData) {
  return canAccessPage(userData, "inicio") ? "/app" : "/app/validacao-diaria";
}

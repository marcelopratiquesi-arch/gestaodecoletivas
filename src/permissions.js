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

// Unidades que o líder comanda (pode ser mais de uma). O crachá guarda a principal em "unidadeId"
// e todas em "unidadeIds"; crachás antigos só têm "unidadeId". Sempre devolve ids em texto, sem repetir.
export function unidadesDoLider(cracha) {
  const lista = Array.isArray(cracha?.unidadeIds) ? cracha.unidadeIds : [];
  const todas = [cracha?.unidadeId, ...lista].filter(Boolean).map(String);
  return [...new Set(todas)];
}

// Admin ou mentor que também é líder de uma unidade: ao ser trocado ou removido como líder,
// sai só da unidade. O crachá (acesso de admin/mentor) NUNCA é apagado por esse caminho.
export function liderMantemAcesso(role) {
  return ["admin", "mentor"].includes(String(role || "").trim().toLowerCase());
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

// Mesma regra de logado() no firestore.rules: papel "bloqueado" ou mentor com status "inativo" = sem acesso.
export function crachaSemAcesso(cracha) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  return papel === "bloqueado" || (papel === "mentor" && cracha?.status === "inativo");
}
// Recado para a tela de entrada mostrar "seu acesso está desativado" depois que o sistema desconecta.
export const AVISO_SEM_ACESSO = "pratique_aviso_sem_acesso";

import { temporarioVencido } from "./utils/temporario";
// src/permissions.js
// Professor de coletiva: só Cronograma (das unidades em que está vinculado),
// Validação Diária (das aulas dele) e o Link do Aluno (/horarios, público). Mais nada.
const PAGE_RULES = {
  inicio: ["admin", "mentor", "lider", "unidade"],
  relatorio_gerencial: ["admin", "mentor", "lider", "unidade"],
  cronograma: ["admin", "mentor", "lider", "unidade", "professor"],
  validacao_diaria: ["admin", "mentor", "lider", "unidade", "professor"],
  // Certificados de workshop (o professor envia; quem confere usa a aba Professores das Configurações)
  certificados: ["professor"],
  // Meu cadastro (o professor pede a mudança de CLT/Saver; líder, mentor ou admin conferem na aba Professores)
  meu_cadastro: ["professor"],
  validacao_coletiva: ["admin", "mentor"],
  financeiro: ["admin", "mentor"],
  configuracoes: ["admin", "mentor", "lider", "unidade"],
  pratique_play: ["admin", "mentor", "lider", "unidade"],
  // Loja & Eventos (Resumo, Estoque e Eventos: tem dinheiro) fica no Cofre. O cadastro de Workshops é uma aba de Configurações.
  workshops: ["admin", "mentor"],
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
  // Líder temporário com o prazo vencido também fica sem acesso (o banco recusa igual: crachaAtivo()).
  return papel === "bloqueado" || (papel === "mentor" && cracha?.status === "inativo") || temporarioVencido(cracha);
}
// Recado para a tela de entrada mostrar "seu acesso está desativado" depois que o sistema desconecta.
export const AVISO_SEM_ACESSO = "pratique_aviso_sem_acesso";

// Professor só tem acesso depois de PEDIR e ser aprovado (login pelo Google). Crachá de professor sem
// "loginGoogle: true" é o login antigo (e-mail e senha criado no cadastro): não vale mais, a pessoa precisa
// pedir acesso. Mesma regra de crachaAtivo() no firestore.rules.
export function professorDeLoginAntigo(cracha) {
  return String(cracha?.role || "").trim().toLowerCase() === "professor" && cracha?.loginGoogle !== true;
}
// Recado para a tela de entrada explicar que o professor agora entra pelo Google e pede acesso.
export const AVISO_PROFESSOR_LOGIN_ANTIGO = "pratique_aviso_professor_login_antigo";

// 2º mentor: crachá de mentor com "mentorPrincipalId" = id do 1º mentor. Ele enxerga e faz o mesmo que o 1º
// nas unidades dele (unidades.mentorId continua sendo o do 1º). Toda tela que filtra "minhas unidades" compara
// unidades.mentorId com ESTE id (para o 1º mentor e para todo o resto, é o próprio id).
export function escopoMentor(userData) {
  return userData?.mentorPrincipalId || userData?.id || userData?.uid;
}
// COBERTURA (mentor temporário): acesso EXTRA, com data de fim, às unidades de OUTRO mentor. O crachá guarda
// coberturaMentorId + coberturaAte e o papel de verdade NÃO muda: enquanto vale, a pessoa age como mentor (papel
// efetivo, ver AuthContext e meuPapel() no firestore.rules); passou o prazo, volta sozinha ao que era (líder
// continua líder, mentor fica só com as unidades dele).
export function coberturaAtiva(cracha, agora = Date.now()) {
  const id = cracha?.coberturaMentorId;
  const fim = cracha?.coberturaAte;
  const ms = typeof fim?.toMillis === "function" ? fim.toMillis() : typeof fim?.seconds === "number" ? fim.seconds * 1000 : fim ? new Date(fim).getTime() : 0;
  return id && ms > agora ? String(id) : null;
}
// Todos os ids de mentor cujas unidades esta pessoa enxerga como mentor: o dela (ou do 1º mentor, se é 2º) + o da cobertura.
export function escoposMentor(userData, agora = Date.now()) {
  const proprio = escopoMentor(userData);
  const cobertura = coberturaAtiva(userData, agora);
  return [...new Set([proprio, cobertura].filter(Boolean).map(String))];
}
// A unidade é de um dos mentores que esta pessoa enxerga? (substitui "unidade.mentorId === meu id")
export function ehDoMeuEscopo(userData, mentorId) {
  return !!mentorId && escoposMentor(userData).includes(String(mentorId));
}
// Papel que vale agora: com cobertura ativa, "mentor" (exceto admin); senão, o papel do crachá.
export function papelEfetivo(cracha, agora = Date.now()) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  return coberturaAtiva(cracha, agora) && !["admin", "administrador", "master"].includes(papel) ? "mentor" : papel;
}
export function ehSegundoMentor(cracha) {
  return String(cracha?.role || "").trim().toLowerCase() === "mentor" && !!cracha?.mentorPrincipalId;
}

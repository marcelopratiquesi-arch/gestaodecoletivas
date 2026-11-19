// 2º mentor: crachá de mentor com "mentorPrincipalId" (id do 1º mentor). Só o admin mexe (aba Mentores).
// As unidades continuam com mentorId = 1º mentor; o 2º enxerga e faz o mesmo nelas (ver escopoMentor em permissions.js
// e meuMentorId() no firestore.rules). Contas puras, com teste.
import { deleteField, serverTimestamp, Timestamp } from "firebase/firestore";

const texto = (v) => String(v ?? "").trim();
const papelDe = (c) => texto(c?.role).toLowerCase();

// Quem é o 2º mentor de um mentor (só 1 por mentor).
export function segundoDe(mentores = [], principalId) {
  if (!principalId) return null;
  return mentores.find((m) => m.mentorPrincipalId === principalId) || null;
}
export function principalDe(mentores = [], segundo) {
  return segundo?.mentorPrincipalId ? mentores.find((m) => m.id === segundo.mentorPrincipalId) || null : null;
}

// Convite pendente de 2º mentor (pessoa nova, ainda sem o 1º acesso).
export function conviteDe(convites = [], principalId) {
  return convites.find((c) => c.mentorPrincipalId === principalId && c.status === "pendente") || null;
}

// Quem pode ser 2º mentor FIXO: líder, professor ou mentor SEM unidades próprias (o 2º mentor passa a enxergar só as
// unidades do titular, então quem já tem unidades perderia as dele: esse entra pelo Mentor temporário/cobertura).
// Líder CONTINUA líder (unidade e nome ficam como estão): só o papel muda para mentor.
export function motivoQueBloqueia(cracha, { temUnidades = false } = {}) {
  if (!cracha) return "noLogin";
  const papel = papelDe(cracha);
  if (papel === "bloqueado" || !papel) return "blocked";
  if (papel === "admin" || papel === "administrador" || papel === "master") return "admin";
  if (papel === "mentor") {
    if (cracha.mentorPrincipalId) return "alreadySecond";
    return temUnidades ? "mentorWithUnits" : null;
  }
  return null;
}

// ---------- Cobertura (mentor temporário) ----------
// Acesso EXTRA às unidades de outro mentor, até uma data. O papel da pessoa não muda; só o admin concede.
// Quem for mentor com unidades próprias continua com elas. Vencido o prazo, volta ao que era (sozinho).
export function motivoQueBloqueiaCobertura(cracha, principalId) {
  if (!cracha) return "noLogin";
  const papel = papelDe(cracha);
  if (papel === "bloqueado" || !papel) return "blocked";
  if (papel === "admin" || papel === "administrador" || papel === "master") return "admin";
  if (cracha.id && cracha.id === principalId) return "self";
  return null;
}
export function camposDaCobertura(principalId, fim) {
  return { coberturaMentorId: principalId, coberturaAte: Timestamp.fromDate(fim), coberturaDesde: serverTimestamp() };
}
export function camposSemCobertura() {
  return { coberturaMentorId: deleteField(), coberturaAte: deleteField(), coberturaDesde: deleteField() };
}
// Pessoas com cobertura de um mentor (ativas e vencidas que ainda não foram encerradas).
export function coberturasDe(pessoas = [], principalId) {
  return pessoas.filter((p) => p.coberturaMentorId && p.coberturaMentorId === principalId);
}

// Campos gravados no crachá ao virar 2º mentor. Guarda o papel de antes para voltar a ele ao sair.
export function camposAoEntrar(cracha, principalId) {
  return {
    role: "mentor",
    status: "ativo",
    mentorPrincipalId: principalId,
    papelAntesSegundoMentor: papelDe(cracha),
    segundoMentorDesde: serverTimestamp(),
  };
}

// Sai de 2º mentor: volta ao papel de antes (líder / professor, com unidade e vínculo intactos).
// Quem entrou direto como 2º mentor (sem papel de antes) fica sem acesso (mentor inativo).
export function camposAoSair(cracha) {
  const antes = papelDe({ role: cracha?.papelAntesSegundoMentor });
  // Mentor sem unidades que foi 2º mentor continua mentor; líder/professor volta ao papel; quem veio só para ser 2º fica inativo.
  const volta = ["lider", "unidade", "professor"].includes(antes) ? { role: antes } : antes === "mentor" ? {} : { status: "inativo" };
  return {
    ...volta,
    mentorPrincipalId: deleteField(),
    papelAntesSegundoMentor: deleteField(),
    segundoMentorDesde: deleteField(),
  };
}

// Vira o 1º mentor de verdade (as unidades passam para ele). Continua mentor; o papel de antes não vale mais.
export function camposAoPromover() {
  return {
    mentorPrincipalId: deleteField(),
    papelAntesSegundoMentor: deleteField(),
    segundoMentorDesde: deleteField(),
  };
}

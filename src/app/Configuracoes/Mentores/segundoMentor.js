// 2º mentor: crachá de mentor com "mentorPrincipalId" (id do 1º mentor). Só o admin mexe (aba Mentores).
// As unidades continuam com mentorId = 1º mentor; o 2º enxerga e faz o mesmo nelas (ver escopoMentor em permissions.js
// e meuMentorId() no firestore.rules). Contas puras, com teste.
import { deleteField, serverTimestamp, Timestamp } from "firebase/firestore";

const texto = (v) => String(v ?? "").trim();
const papelDe = (c) => texto(c?.role).toLowerCase();

// Mentor TEMPORÁRIO = cobertura de um mentor por prazo: mesmo crachá do 2º mentor (mentorPrincipalId) + "temporarioAte".
// Só o admin cria; pode haver vários por mentor e eles não ocupam a vaga do 2º mentor.
const comPrazo = (c) => !!c?.temporarioAte;

// Quem é o 2º mentor de um mentor (só 1 por mentor; os temporários não contam).
export function segundoDe(mentores = [], principalId) {
  if (!principalId) return null;
  return mentores.find((m) => m.mentorPrincipalId === principalId && !comPrazo(m)) || null;
}
// Mentores temporários que cobrem um mentor (ativos, vencidos e ainda não encerrados).
export function temporariosDe(mentores = [], principalId) {
  if (!principalId) return [];
  return mentores.filter((m) => m.mentorPrincipalId === principalId && comPrazo(m));
}
export function principalDe(mentores = [], segundo) {
  return segundo?.mentorPrincipalId ? mentores.find((m) => m.id === segundo.mentorPrincipalId) || null : null;
}

// Convite pendente de 2º mentor (pessoa nova, ainda sem o 1º acesso).
export function conviteDe(convites = [], principalId) {
  return convites.find((c) => c.mentorPrincipalId === principalId && c.status === "pendente" && !comPrazo(c)) || null;
}
export function convitesTemporariosDe(convites = [], principalId) {
  return convites.filter((c) => c.mentorPrincipalId === principalId && c.status === "pendente" && comPrazo(c));
}

// Quem pode ser 2º mentor: qualquer pessoa com acesso que ainda não é mentor nem admin
// (líder, professor...). Líder CONTINUA líder (unidade e nome ficam como estão): só o papel muda para mentor.
export function motivoQueBloqueia(cracha) {
  if (!cracha) return "noLogin";
  const papel = papelDe(cracha);
  if (papel === "bloqueado" || !papel) return "blocked";
  if (papel === "admin" || papel === "administrador" || papel === "master") return "admin";
  if (papel === "mentor") return "alreadyMentor";
  return null;
}

// Campos gravados no crachá ao virar 2º mentor. Guarda o papel de antes para voltar a ele ao sair.
// Com "fim" (Date) vira mentor temporário: o banco corta o acesso sozinho depois do prazo.
export function camposAoEntrar(cracha, principalId, fim = null) {
  return {
    role: "mentor",
    status: "ativo",
    mentorPrincipalId: principalId,
    papelAntesSegundoMentor: papelDe(cracha),
    segundoMentorDesde: serverTimestamp(),
    ...(fim ? { temporarioAte: Timestamp.fromDate(fim), temporarioDesde: serverTimestamp() } : {}),
  };
}

// Sai de 2º mentor: volta ao papel de antes (líder / professor, com unidade e vínculo intactos).
// Quem entrou direto como 2º mentor (sem papel de antes) fica sem acesso (mentor inativo).
export function camposAoSair(cracha) {
  const antes = papelDe({ role: cracha?.papelAntesSegundoMentor });
  const volta = ["lider", "unidade", "professor"].includes(antes) ? { role: antes } : { status: "inativo" };
  return {
    ...volta,
    mentorPrincipalId: deleteField(),
    papelAntesSegundoMentor: deleteField(),
    segundoMentorDesde: deleteField(),
    temporarioAte: deleteField(),
    temporarioDesde: deleteField(),
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

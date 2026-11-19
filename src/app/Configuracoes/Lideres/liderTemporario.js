// Líder temporário: convite pelo e-mail do Google, prazo, prorrogar, encerrar e efetivar.
// O convite fica em convites_acesso/{e-mail} (papel "lider", com unidades e prazo); no 1º login a própria pessoa cria o
// crachá (regra liderTemporarioAceitaConvite). Depois do prazo o banco recusa o crachá sozinho (crachaAtivo).
import { collection, deleteField, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { dadosDaVaga } from "./saidaDoLider";
import { fimDoTemporario } from "../../../utils/temporario";

export const MAX_UNIDADES_TEMPORARIO = 5;

// Quem pode convidar para estas unidades: o admin, ou o mentor de TODAS elas (o banco confere igual).
// escopos = ids de mentor cujas unidades a pessoa enxerga (o dela e, se tem cobertura, o do mentor coberto).
export function unidadesQueEuPosso({ role, escopos = [], unidades }) {
  return role === "admin" ? unidades : unidades.filter((u) => escopos.includes(String(u.mentorId)));
}

export function validarConvite({ email, nome, telefone, unidadeIds, fim, agora = Date.now() }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) return "email";
  if (String(nome || "").trim().length < 3) return "name";
  if (String(telefone || "").trim().length < 6) return "phone";
  if (!unidadeIds?.length) return "unit";
  if (unidadeIds.length > MAX_UNIDADES_TEMPORARIO) return "tooMany";
  if (!fim || fim.getTime() <= agora) return "past";
  return null;
}

// Cria (ou refaz) o convite. mentorId = quem "enxerga" o convite na aba: o mentor da 1ª unidade (ou o escopo do mentor logado).
export async function convidarTemporario({ email, nome, telefone, pais, unidadeIds, fim, mentorId, quem }) {
  const emailGoogle = email.trim().toLowerCase();
  await setDoc(doc(db, "convites_acesso", emailGoogle), {
    papel: "lider", status: "pendente", email: emailGoogle, nome: nome.trim(), telefone: telefone.trim(), pais: pais || "BR",
    unidadeId: unidadeIds[0], unidadeIds, temporarioAte: Timestamp.fromDate(fim), mentorId: mentorId || "",
    criadoPor: quem?.id || quem?.uid, criadoPorNome: quem?.nome || quem?.email || "-", criadoEm: serverTimestamp(),
  });
  return emailGoogle;
}

export function cancelarConvite(email) {
  return updateDoc(doc(db, "convites_acesso", email), { status: "cancelado" });
}

// Convites de líder temporário ainda pendentes (admin vê todos; mentor, os dele — a consulta repete os filtros que o banco exige).
export async function lerConvitesPendentes({ role, escopos = [] }) {
  const base = collection(db, "convites_acesso");
  const consultas = role === "admin"
    ? [query(base, where("papel", "==", "lider"))]
    : escopos.map((id) => query(base, where("mentorId", "==", id), where("papel", "==", "lider")));
  const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
  return snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))).filter((c) => c.status === "pendente");
}

// Líderes temporários que já entraram (crachás com prazo). O mentor só enxerga os das unidades dele.
export async function lerTemporarios({ role, escopos = [], unidades }) {
  const snap = await getDocs(query(collection(db, "usuarios"), where("temporarioAte", ">", Timestamp.fromMillis(0))));
  const minhas = new Set(unidades.filter((u) => role === "admin" || escopos.includes(String(u.mentorId))).map((u) => String(u.id)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => role === "admin" || (c.unidadeIds || [c.unidadeId]).every((id) => minhas.has(String(id))));
}

// Prorrogar (ou reativar um vencido): novo último dia.
export function prorrogar(uid, fim) {
  return updateDoc(doc(db, "usuarios", uid), { temporarioAte: Timestamp.fromDate(fim) });
}

// Encerrar agora: o prazo passa a ser "um segundo atrás".
export function encerrar(uid) {
  return updateDoc(doc(db, "usuarios", uid), { temporarioAte: Timestamp.fromMillis(Date.now() - 1000) });
}

// Efetivar: vira líder de verdade (sem prazo) e ocupa a vaga de líder de cada unidade dele (1º ou 2º líder).
// Se alguma unidade já tem os 2 líderes, não faz nada e devolve o nome dela (o mentor libera uma vaga antes).
export async function efetivar({ cracha, unidades }) {
  const ids = (cracha.unidadeIds?.length ? cracha.unidadeIds : [cracha.unidadeId]).map(String);
  const doCracha = ids.map((id) => unidades.find((u) => String(u.id) === id)).filter(Boolean);
  const semVaga = doCracha.find((u) => u.liderUid !== cracha.id && u.lider2Uid !== cracha.id && u.liderUid && u.lider2Uid);
  if (semVaga) return { ok: false, unidade: semVaga.nome };
  const batch = writeBatch(db);
  batch.update(doc(db, "usuarios", cracha.id), { temporarioAte: deleteField(), temporarioDesde: deleteField() });
  for (const u of doCracha) {
    if (u.liderUid === cracha.id || u.lider2Uid === cracha.id) continue;
    const vaga = u.liderUid ? 2 : 1;
    batch.update(doc(db, "unidades", String(u.id)), dadosDaVaga(vaga, { uid: cracha.id, nome: cracha.nome, email: cracha.email, telefone: cracha.telefone, tipo: "google" }));
  }
  await batch.commit();
  return { ok: true };
}

// Texto curto do prazo de um crachá/convite (para listas): último dia em Date.
export const fimDe = (registro) => fimDoTemporario(registro);

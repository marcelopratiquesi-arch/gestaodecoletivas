// Certificados de workshop do professor (coleção certificados_professor; ver regras no firestore.rules).
// Um documento por certificado, id = login + "_" + código curto. A foto (JPEG base64) fica só nesse documento.
// Quem verifica: o líder da unidade, o mentor dela ou o admin.
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { registrarAuditoriaAcesso } from "./auditoriaAcessos";

const colecao = () => collection(db, "certificados_professor");
const codigoCurto = () => Math.random().toString(36).slice(2, 10).padEnd(8, "x");
const porDataDesc = (a, b) => String(b.dataFeito || "").localeCompare(String(a.dataFeito || ""));

/** Certificados do próprio professor (a foto vem junto no documento; são poucos por pessoa). */
export async function listarMeusCertificados(uid) {
  const snap = await getDocs(query(colecao(), where("uid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(porDataDesc);
}

/** Envia um certificado novo (ou reenvia um recusado: passe `id`). */
export async function enviarCertificado({ uid, id, unidadeId, nome, workshop, dataFeito, foto }) {
  const cid = id || `${uid}_${codigoCurto()}`;
  await setDoc(doc(db, "certificados_professor", cid), {
    uid, unidadeId: String(unidadeId), nome, workshop: workshop.trim(), dataFeito, foto, status: "pendente", criadoEm: serverTimestamp(),
  });
  return cid;
}

export const apagarCertificado = (id) => deleteDoc(doc(db, "certificados_professor", id));

/**
 * Certificados pendentes que esta pessoa pode verificar.
 * Admin: todos. Mentor/líder: das unidades dele (consulta em grupos de 10, como o banco exige para provar o acesso).
 */
export async function listarPendentes({ admin, unidadeIds }) {
  const base = [where("status", "==", "pendente")];
  const consultas = admin
    ? [query(colecao(), ...base)]
    : Array.from({ length: Math.ceil(unidadeIds.length / 10) }, (_, i) =>
      query(colecao(), where("unidadeId", "in", unidadeIds.slice(i * 10, i * 10 + 10)), ...base));
  const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).sort(porDataDesc);
}

/**
 * Todos os certificados de um professor do cadastro (qualquer status), para o gestor ver na aba Professores:
 * os que o gestor adicionou (professorId) e os que o próprio professor enviou pelo login (uid).
 * Mentor/líder: só das unidades dele (o banco exige a unidade na consulta). Admin: sem limite de unidade.
 */
export async function listarDoProfessor({ professorId, uidLogin, admin, unidadeIds }) {
  const filtroUnidade = admin ? [] : [where("unidadeId", "in", unidadeIds.slice(0, 10))];
  const consultas = [query(colecao(), where("professorId", "==", professorId), ...filtroUnidade)];
  if (uidLogin) consultas.push(query(colecao(), where("uid", "==", uidLogin), ...filtroUnidade));
  const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
  const porId = new Map();
  snaps.forEach((s) => s.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() })));
  return [...porId.values()].sort(porDataDesc);
}

/** Gestor (líder, mentor ou admin) adiciona um certificado para um professor do cadastro: já entra verificado. */
export async function adicionarCertificadoDoProfessor({ professor, unidadeId, workshop, dataFeito, foto, quem }) {
  const cid = `prof_${professor.id}_${codigoCurto()}`;
  await setDoc(doc(db, "certificados_professor", cid), {
    uid: String(professor.uidLogin || ""), professorId: String(professor.id), unidadeId: String(unidadeId || ""),
    nome: String(professor.nome || "-").slice(0, 80), workshop: workshop.trim(), dataFeito, foto,
    status: "verificado", criadoEm: serverTimestamp(),
    analisadoPor: quem.id, analisadoPorNome: String(quem.nome || "-").slice(0, 80), analisadoEm: serverTimestamp(),
  });
  try {
    await registrarAuditoriaAcesso({
      tipoAcao: "NOVA", descricao: "Certificado de workshop adicionado pelo gestor.", unidadeNome: "-", quem: quem.cracha,
      detalhes: `Workshop: ${workshop.trim()} (${dataFeito})`, alvo: { id: professor.id, nome: professor.nome },
    });
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
  return cid;
}

async function analisar(certificado, status, motivo, quem) {
  await updateDoc(doc(db, "certificados_professor", certificado.id), {
    status, motivo: String(motivo || "").trim(),
    analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  try {
    await registrarAuditoriaAcesso({
      tipoAcao: "ALTERADA",
      descricao: status === "verificado" ? "Certificado de workshop verificado." : "Certificado de workshop recusado.",
      detalhes: [`Workshop: ${certificado.workshop} (${certificado.dataFeito})`, motivo ? `Motivo: ${String(motivo).trim()}` : ""].filter(Boolean).join(" | "),
      unidadeNome: "-", quem: quem.cracha, alvo: { id: certificado.uid, nome: certificado.nome },
    });
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
}

export const verificarCertificado = (certificado, quem) => analisar(certificado, "verificado", "", quem);
export const recusarCertificado = (certificado, motivo, quem) => analisar(certificado, "recusado", motivo, quem);

// Certificados de workshop do professor (coleção certificados_professor; ver regras no firestore.rules).
// Um documento por certificado, id = login + "_" + código curto. A foto (JPEG base64) fica só nesse documento.
// Quem verifica: o líder da unidade, o mentor dela ou o admin.
import { arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
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
export async function enviarCertificado({ uid, id, unidadeId, vinculoId, nome, workshop, dataFeito, foto }) {
  const cid = id || `${uid}_${codigoCurto()}`;
  await setDoc(doc(db, "certificados_professor", cid), {
    uid, unidadeId: String(unidadeId), ...(vinculoId ? { vinculoId: String(vinculoId) } : {}), nome, workshop: workshop.trim(), dataFeito, foto, status: "pendente", criadoEm: serverTimestamp(),
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
 * Workshops do PROFESSOR (valem para todas as unidades dele): ficam num campo do próprio cadastro,
 * professores/{id}.workshops = [{ id, nome, data, por, em }]. Sem foto (economia de dados) e sem leituras
 * extras: o cadastro já chega ao vivo pelo CatalogContext. O gestor (líder, mentor ou admin) adiciona; o que
 * o professor envia com foto e o gestor verifica (certificados_professor) também entra aqui ao verificar.
 */
export async function adicionarWorkshopAoProfessor({ professorId, nome, data, por, id }) {
  const item = { id: id || codigoCurto(), nome: String(nome).trim(), data, por: String(por || "-").slice(0, 80), em: new Date().toISOString() };
  await updateDoc(doc(db, "professores", String(professorId)), { workshops: arrayUnion(item) });
  return item;
}

export async function removerWorkshopDoProfessor({ professorId, atuais, id }) {
  await updateDoc(doc(db, "professores", String(professorId)), { workshops: (atuais || []).filter((w) => w.id !== id) });
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

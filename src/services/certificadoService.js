// Certificados de workshop do professor (coleção certificados_professor; ver regras no firestore.rules).
// Um documento por certificado, id = login + "_" + código curto. A foto (JPEG base64) fica só nesse documento.
// Quem verifica: o líder da unidade, o mentor dela ou o admin.
import { arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
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

/**
 * Workshops cadastrados que o professor pode escolher (nome, data, modalidade). Lê UMA vez ao abrir a tela.
 * Fora os cancelados e os que ainda não aconteceram.
 */
export async function listarWorkshopsEscolhiveis(hoje) {
  const snap = await getDocs(collection(db, "workshops_cadastro"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((w) => w.status !== "cancelado" && w.data && w.data <= hoje)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** Envia um certificado do workshop escolhido. O id é fixo (login + workshop): reenviar o mesmo workshop reaproveita o documento. */
export async function enviarCertificado({ uid, unidadeId, vinculoId, nome, workshopId, modalidade, workshop, dataFeito, foto }) {
  const cid = `${uid}_${workshopId}`;
  await setDoc(doc(db, "certificados_professor", cid), {
    uid, unidadeId: String(unidadeId), ...(vinculoId ? { vinculoId: String(vinculoId) } : {}), workshopId, ...(modalidade ? { modalidade } : {}), nome, workshop, dataFeito, foto, status: "pendente", criadoEm: serverTimestamp(),
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
export async function adicionarWorkshopAoProfessor({ professorId, nome, data, por, id, modalidade }) {
  const item = { id: id || codigoCurto(), ...(modalidade ? { modalidade } : {}), nome: String(nome).trim(), data, por: String(por || "-").slice(0, 80), em: new Date().toISOString() };
  await updateDoc(doc(db, "professores", String(professorId)), { workshops: arrayUnion(item) });
  return item;
}

/**
 * Certificado verificado de um workshop do cadastro: entra em professores/{id}.workshops com o id "wk_{workshopId}",
 * o mesmo formato da importação (não repete). Vale para todas as fichas ligadas a esse login. `fichas` vem do catálogo.
 */
export async function registrarWorkshopVerificado({ fichas, workshopId, modalidade, nome, data, por }) {
  const idItem = `wk_${workshopId}`;
  await Promise.all(fichas.map((f) => {
    const sem = (f.workshops || []).filter((w) => w.id !== idItem);
    const item = { id: idItem, workshopId, ...(modalidade ? { modalidade } : {}), nome, data, por: String(por || "-").slice(0, 80), em: new Date().toISOString() };
    return updateDoc(doc(db, "professores", String(f.id)), { workshops: [...sem, item] });
  }));
}

/** Grava as fichas com a modalidade completada (ver utils/completarModalidade.js), em lotes pequenos. */
export async function gravarWorkshopsCompletados(gravar) {
  for (let i = 0; i < gravar.length; i += 10) {
    const batch = writeBatch(db);
    gravar.slice(i, i + 10).forEach(({ professorId, workshops }) => batch.update(doc(db, "professores", professorId), { workshops }));
    await batch.commit();
  }
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

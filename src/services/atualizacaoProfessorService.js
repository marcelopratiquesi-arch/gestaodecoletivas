// "Atualizar cadastro" do professor, dentro do app: ele pede a mudança do CONTRATO (CLT ou Saver, unidades e horários) e
// o líder da unidade, o mentor dela ou o admin conferem. Só depois de aprovado a mudança entra na ficha, que é a que
// vale para o valor da aula (a ficha só o gestor altera). Coleção atualizacoes_professor/{login}: um pedido por professor.
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { registrarAuditoriaAcesso } from "./auditoriaAcessos";
import { resumoContrato } from "../utils/contrato";

const colecao = () => collection(db, "atualizacoes_professor");

/** O pedido do próprio professor (1 leitura, ao abrir a página). null = nunca pediu. */
export async function lerMinhaAtualizacao(uid) {
  const snap = await getDoc(doc(db, "atualizacoes_professor", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Envia (ou reenvia) o pedido. `vinculoId` só quando a unidade vem de um vínculo (crachá antigo sem unidade). */
export async function enviarAtualizacao({ uid, nome, unidadeId, vinculoId, contrato }) {
  await setDoc(doc(db, "atualizacoes_professor", uid), {
    uid, nome, unidadeId: String(unidadeId), ...(vinculoId ? { vinculoId: String(vinculoId) } : {}),
    tipoContrato: contrato.tipoContrato, saverLocais: contrato.saverLocais, status: "pendente", criadoEm: serverTimestamp(),
  });
}

export const desistirDaAtualizacao = (uid) => deleteDoc(doc(db, "atualizacoes_professor", uid));

/** Pedidos pendentes que esta pessoa pode conferir (admin: todos; mentor/líder: das unidades dele, em grupos de 10). */
export async function listarAtualizacoesPendentes({ admin, unidadeIds }) {
  const base = [where("status", "==", "pendente")];
  const consultas = admin
    ? [query(colecao(), ...base)]
    : Array.from({ length: Math.ceil(unidadeIds.length / 10) }, (_, i) => query(colecao(), where("unidadeId", "in", unidadeIds.slice(i * 10, i * 10 + 10)), ...base));
  const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** Aprova: grava o contrato em TODAS as fichas ligadas a esse login e fecha o pedido (tudo junto ou nada). */
export async function aprovarAtualizacao({ pedido, fichas, quem, nomeDaUnidade }) {
  if (!fichas.length) throw new Error("SEM_FICHA");
  const batch = writeBatch(db);
  fichas.forEach((f) => batch.update(doc(db, "professores", String(f.id)), {
    tipoContrato: pedido.tipoContrato, saverLocais: pedido.saverLocais || [], updatedAt: serverTimestamp(),
  }));
  batch.update(doc(db, "atualizacoes_professor", pedido.id), {
    status: "aprovado", analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  await batch.commit();
  await auditar("Atualização de contrato do professor aprovada.", pedido, quem,
    `Contrato: ${resumoContrato(fichas[0], nomeDaUnidade)} ➔ ${resumoContrato(pedido, nomeDaUnidade)}`);
}

export async function recusarAtualizacao({ pedido, motivo, quem }) {
  await setDoc(doc(db, "atualizacoes_professor", pedido.id), {
    status: "recusado", motivo: String(motivo || "").trim().slice(0, 300),
    analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  }, { merge: true });
  await auditar("Atualização de contrato do professor recusada.", pedido, quem, motivo ? `Motivo: ${String(motivo).trim()}` : "");
}

async function auditar(descricao, pedido, quem, detalhes) {
  try {
    await registrarAuditoriaAcesso({ tipoAcao: "ALTERADA", descricao, detalhes, unidadeNome: "-", quem: quem.cracha, alvo: { id: pedido.uid, nome: pedido.nome } });
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
}

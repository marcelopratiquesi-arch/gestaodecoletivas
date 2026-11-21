// Pedido de UNIDADE NOVA do professor (Meu cadastro). Coleção pedidos_unidade_professor/{login}_{unidade}: um por unidade pedida.
// Quem confere: o admin, o mentor da unidade pedida e o líder dela. Aprovado = cria o vínculo (professor x unidade) na grade,
// que é o que faz a unidade aparecer para o professor (Cronograma, Validação Diária). O contrato (CLT/SAVER) continua à parte.
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { registrarAuditoriaAcesso } from "./auditoriaAcessos";

const colecao = () => collection(db, "pedidos_unidade_professor");
export const MAX_PEDIDOS_UNIDADE_PROFESSOR = 3;
export const idDoPedidoUnidadeProfessor = (uid, unidadeId) => `${uid}_${unidadeId}`;

/** Os pedidos do próprio professor que ainda interessam (aguardando ou recusados). */
export async function listarMeusPedidosDeUnidade(uid) {
  const snap = await getDocs(query(colecao(), where("uid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== "aprovado");
}

/** Pede (ou pede de novo, depois de recusado) uma unidade. `professorId` = a ficha dele na grade. */
export async function pedirUnidadeNova({ uid, nome, professorId, unidade }) {
  const batch = writeBatch(db);
  batch.set(doc(db, "pedidos_unidade_professor", idDoPedidoUnidadeProfessor(uid, unidade.id)), {
    uid, nome, professorId: String(professorId), unidadeId: String(unidade.id), unidadeNome: String(unidade.nome || "").slice(0, 120),
    status: "pendente", criadoEm: serverTimestamp(),
  });
  await batch.commit();
}

export const desistirDoPedidoDeUnidade = (uid, unidadeId) => deleteDoc(doc(db, "pedidos_unidade_professor", idDoPedidoUnidadeProfessor(uid, unidadeId)));

/** Pedidos pendentes que esta pessoa pode conferir (admin: todos; mentor/líder: das unidades dele, em grupos de 10). */
export async function listarPedidosDeUnidadePendentes({ admin, unidadeIds }) {
  const base = [where("status", "==", "pendente")];
  const consultas = admin
    ? [query(colecao(), ...base)]
    : Array.from({ length: Math.ceil(unidadeIds.length / 10) }, (_, i) => query(colecao(), where("unidadeId", "in", unidadeIds.slice(i * 10, i * 10 + 10)), ...base));
  const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** Aprova: cria o vínculo (se ainda não existe) e fecha o pedido, tudo junto ou nada. `jaVinculado` vem do catálogo de vínculos. */
export async function aprovarPedidoDeUnidade({ pedido, jaVinculado, quem }) {
  const batch = writeBatch(db);
  if (!jaVinculado) {
    batch.set(doc(collection(db, "vinculos")), { professorId: String(pedido.professorId), unidadeId: String(pedido.unidadeId), status: "ativo", createdAt: serverTimestamp() });
  }
  batch.update(doc(db, "pedidos_unidade_professor", pedido.id), { status: "aprovado", analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp() });
  await batch.commit();
  await auditar("Unidade nova do professor aprovada.", pedido, quem, "");
}

export async function recusarPedidoDeUnidade({ pedido, motivo, quem }) {
  const batch = writeBatch(db);
  batch.update(doc(db, "pedidos_unidade_professor", pedido.id), {
    status: "recusado", motivo: String(motivo || "").trim().slice(0, 300),
    analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  await batch.commit();
  await auditar("Unidade nova do professor recusada.", pedido, quem, motivo ? `Motivo: ${String(motivo).trim()}` : "");
}

async function auditar(descricao, pedido, quem, detalhes) {
  try {
    await registrarAuditoriaAcesso({ tipoAcao: "ALTERADA", descricao, detalhes, unidadeNome: pedido.unidadeNome || "-", quem: quem.cracha, alvo: { id: pedido.uid, nome: pedido.nome } });
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
}

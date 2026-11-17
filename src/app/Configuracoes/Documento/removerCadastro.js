// Excluir o cadastro de quem JÁ foi aprovado como líder (achado pela busca por documento):
// tira a pessoa das unidades, apaga o crachá (ela perde o acesso), dá o pedido dela como recusado e libera o
// documento. Ela pode pedir acesso de novo na hora. Só serve para líder "puro": admin, mentor e quem também é
// professor NÃO são apagados por aqui (cada um tem a sua aba, para não perder o acesso errado).
//
// Admin: tudo numa gravação só. Mentor: o banco só deixa mexer em UMA unidade dele por vez no crachá, então a
// exclusão vai unidade por unidade (sem limite de unidades) e a última também apaga o crachá e libera o documento.
// O mentor só exclui se TODAS as unidades do líder forem dele (senão sobraria líder de outro mentor sem acesso).
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { ehLider, liderMantemAcesso } from "../../../permissions";
import { camposAoLiberarVaga, listaDoCracha, professorDoLogin } from "../Lideres/saidaDoLider";
import { apagarDocumentoNoLote } from "../../../services/documentoService";

/**
 * { pode: true } ou { pode: false, motivo: "staff" | "professor" | "liderEProfessor" | "outroMentor" | "outro" }
 * @param {{souAdmin?: boolean, minhasUnidades?: string[]}} [quem] minhasUnidades = ids das unidades do mentor
 */
export function avaliarRemocao(cracha, uid, professores = [], { souAdmin = false, minhasUnidades = [] } = {}) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  if (liderMantemAcesso(papel)) return { pode: false, motivo: "staff" };
  if (papel === "professor") return { pode: false, motivo: "professor" };
  if (!ehLider(papel)) return { pode: false, motivo: "outro" };
  if (professorDoLogin(uid, cracha, professores)) return { pode: false, motivo: "liderEProfessor" };
  if (!souAdmin) {
    const minhas = new Set(minhasUnidades.map(String));
    if (!listaDoCracha(cracha).every((id) => minhas.has(String(id)))) return { pode: false, motivo: "outroMentor" };
  }
  return { pode: true };
}

export async function removerLiderELiberarDocumento({ uid, cracha, documento, unidades, souAdmin, motivo, quemId, quemNome }) {
  const lista = listaDoCracha(cracha);
  const unidadeDe = (id) => unidades.find((u) => String(u.id) === String(id));
  const limparVaga = (batch, id) => {
    const u = unidadeDe(id);
    if (!u) return;
    const vaga = u.liderUid === uid ? 1 : u.lider2Uid === uid ? 2 : 0;
    if (vaga) batch.update(doc(db, "unidades", String(u.id)), camposAoLiberarVaga(u, vaga));
  };
  // Unidades onde a pessoa ainda consta como líder mas que (por cadastro antigo) não estão na lista do crachá.
  const soNaUnidade = unidades.filter((u) => (u.liderUid === uid || u.lider2Uid === uid) && !lista.includes(String(u.id))).map((u) => String(u.id));
  const todas = [...lista, ...soNaUnidade];

  // Mentor: uma unidade por vez, até sobrar a última.
  if (!souAdmin) {
    const restante = [...lista];
    for (const id of lista.slice(0, -1)) {
      restante.splice(restante.indexOf(id), 1);
      const passo = writeBatch(db);
      passo.update(doc(db, "usuarios", uid), { unidadeId: restante[0], unidadeIds: [...restante], unidadeAlterada: String(id) });
      limparVaga(passo, id);
      await passo.commit();
    }
  }

  const batch = writeBatch(db);
  for (const id of souAdmin ? todas : [lista[lista.length - 1], ...soNaUnidade].filter(Boolean)) limparVaga(batch, id);
  batch.delete(doc(db, "usuarios", uid));
  const pedido = await getDoc(doc(db, "solicitacoes_acesso", uid));
  if (pedido.exists() && pedido.data().status !== "recusado") {
    batch.update(pedido.ref, { status: "recusado", motivo, analisadoPor: quemId, analisadoPorNome: quemNome, analisadoEm: serverTimestamp() });
  }
  apagarDocumentoNoLote(batch, uid, documento);
  await batch.commit();
  return todas.map((id) => unidadeDe(id)?.nome).filter(Boolean);
}

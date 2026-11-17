// Excluir o cadastro de quem JÁ foi aprovado como líder (achado pela busca por documento):
// tira a pessoa das unidades, apaga o crachá (ela perde o acesso), dá o pedido dela como recusado e libera o
// documento. Ela pode pedir acesso de novo na hora. Só serve para líder "puro": admin, mentor e quem também é
// professor NÃO são apagados por aqui (cada um tem a sua aba, para não perder o acesso errado).
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { ehLider, liderMantemAcesso } from "../../../permissions";
import { camposAoLiberarVaga, professorDoLogin } from "../Lideres/saidaDoLider";
import { apagarDocumentoNoLote } from "../../../services/documentoService";

/** { pode: true } ou { pode: false, motivo: "staff" | "professor" | "liderEProfessor" | "outro" } */
export function avaliarRemocao(cracha, uid, professores = []) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  if (liderMantemAcesso(papel)) return { pode: false, motivo: "staff" };
  if (papel === "professor") return { pode: false, motivo: "professor" };
  if (!ehLider(papel)) return { pode: false, motivo: "outro" };
  if (professorDoLogin(uid, cracha, professores)) return { pode: false, motivo: "liderEProfessor" };
  return { pode: true };
}

export async function removerLiderELiberarDocumento({ uid, documento, unidades, motivo, quemId, quemNome }) {
  const batch = writeBatch(db);
  const dele = unidades.filter((u) => u.liderUid === uid || u.lider2Uid === uid);
  for (const u of dele) {
    batch.update(doc(db, "unidades", String(u.id)), camposAoLiberarVaga(u, u.liderUid === uid ? 1 : 2));
  }
  batch.delete(doc(db, "usuarios", uid));
  const pedido = await getDoc(doc(db, "solicitacoes_acesso", uid));
  if (pedido.exists() && pedido.data().status !== "recusado") {
    batch.update(pedido.ref, { status: "recusado", motivo, analisadoPor: quemId, analisadoPorNome: quemNome, analisadoEm: serverTimestamp() });
  }
  apagarDocumentoNoLote(batch, uid, documento);
  await batch.commit();
  return dele.map((u) => u.nome);
}

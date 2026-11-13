// Documento de identificação (CPF / DNI / SSN) de líder, mentor e admin. Regras de onde fica cada coisa:
//  - o NÚMERO fica na gaveta privada documentos_privados/{uid} (só a pessoa, o admin e o mentor dos
//    líderes dele leem). No crachá aberto vai apenas "documentoOk: true" (para o sistema saber quem já preencheu);
//  - documentos_unicos/{tipo_numero} reserva o documento para uma única pessoa (repetido é recusado pelo banco);
//  - no pedido de acesso (ainda sem crachá) o número fica em documentos_do_pedido/{uid} e a
//    reserva já é feita; depois de aprovada, a pessoa copia para a gaveta do crachá (tela "Informar documento").
// O número NUNCA vai para auditoria, vitrine pública nem listas.
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { idDocumentoUnico, limparDocumento } from "../utils/documento";

export const ERRO_DOCUMENTO_EM_USO = "DOCUMENTO_EM_USO";

const refGaveta = (uid) => doc(db, "documentos_privados", uid);
const refGavetaPedido = (uid) => doc(db, "documentos_do_pedido", uid);
const refReserva = (tipo, numero) => doc(db, "documentos_unicos", idDocumentoUnico(tipo, numero));

const lerGaveta = async (ref) => {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? { tipo: snap.data().tipo, numero: snap.data().numero } : null;
  } catch (e) {
    if (e?.code === "permission-denied") return null; // sem permissão = não mostra
    throw e;
  }
};

/** Documento guardado na gaveta do crachá (null se ainda não tem ou se você não pode ver). */
export const lerDocumento = (uid) => lerGaveta(refGaveta(uid));
/** Documento informado no pedido de acesso (antes de ter crachá). */
export const lerDocumentoDoPedido = (uid) => lerGaveta(refGavetaPedido(uid));

/**
 * Coloca num batch a gravação do documento de `uid`: gaveta privada + reserva (apaga a reserva do número antigo).
 * @param {import("firebase/firestore").WriteBatch} batch
 * @param {{uid:string, tipo:string, numero:string, anterior?:{tipo:string,numero:string}|null, noPedido?:boolean, marcarCracha?:boolean}} p
 */
export function documentoNoLote(batch, { uid, tipo, numero, anterior = null, noPedido = false, marcarCracha = false }) {
  const n = limparDocumento(numero);
  batch.set(noPedido ? refGavetaPedido(uid) : refGaveta(uid), {
    tipo, numero: n, atualizadoEm: serverTimestamp(), atualizadoPor: auth.currentUser?.uid || uid,
  });
  if (anterior && idDocumentoUnico(anterior.tipo, anterior.numero) !== idDocumentoUnico(tipo, n)) {
    batch.delete(refReserva(anterior.tipo, anterior.numero));
  }
  batch.set(refReserva(tipo, n), { uid, tipo, numero: n });
  if (marcarCracha) batch.update(doc(db, "usuarios", uid), { documentoOk: true });
}

/** Faz o commit e troca o erro de permissão (documento já reservado por outra pessoa) por um erro claro. */
export async function gravarComAviso(batch) {
  try {
    await batch.commit();
  } catch (e) {
    if (e?.code === "permission-denied") {
      const erro = new Error(ERRO_DOCUMENTO_EM_USO);
      erro.cause = e;
      throw erro;
    }
    throw e;
  }
}

// Documento (CPF / DNI / SSN) da FICHA da grade (professores/{id}), para quem ainda não tem login.
//  - número: gaveta documentos_ficha/{professorId} (só admin e mentor leem);
//  - reserva: documentos_professor/{tipo_numero} = { professorId } — um documento, uma ficha (o banco recusa repetido);
//    líder, mentor e admin conferem um documento digitado (get), ninguém além do admin lista;
//  - na ficha (lida por todo logado) vai só "documentoOk: true".
// O número NUNCA vai para auditoria, vitrine pública nem listas.
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { idDocumentoUnico, limparDocumento } from '../utils/documento';

const refGavetaFicha = (professorId) => doc(db, 'documentos_ficha', String(professorId));
const refReservaFicha = (tipo, numero) => doc(db, 'documentos_professor', idDocumentoUnico(tipo, numero));

/** Ficha dona do documento digitado ({ professorId }) ou null. */
export async function acharFichaPorDocumento(tipo, numero) {
  const snap = await getDoc(refReservaFicha(tipo, numero));
  return snap.exists() ? { professorId: String(snap.data().professorId) } : null;
}

/** Número guardado da ficha (null se não tem ou se você não pode ver: só admin e mentor). */
export async function lerDocumentoDaFicha(professorId) {
  try {
    const snap = await getDoc(refGavetaFicha(professorId));
    return snap.exists() ? { tipo: snap.data().tipo, numero: snap.data().numero } : null;
  } catch (e) {
    if (e?.code === 'permission-denied') return null;
    throw e;
  }
}

/**
 * Coloca no batch: gaveta + reserva (+ apaga a reserva do número antigo) + "documentoOk" na ficha.
 * `marcarFicha: false` quando a própria ficha é criada no mesmo batch já com documentoOk.
 */
export function documentoDaFichaNoLote(batch, { professorId, tipo, numero, anterior = null, marcarFicha = true }) {
  const n = limparDocumento(numero);
  batch.set(refGavetaFicha(professorId), {
    tipo, numero: n, atualizadoEm: serverTimestamp(), atualizadoPor: auth.currentUser?.uid,
  });
  if (anterior && idDocumentoUnico(anterior.tipo, anterior.numero) !== idDocumentoUnico(tipo, n)) {
    batch.delete(refReservaFicha(anterior.tipo, anterior.numero));
  }
  batch.set(refReservaFicha(tipo, n), { professorId: String(professorId), tipo, numero: n });
  if (marcarFicha) batch.update(doc(db, 'professores', String(professorId)), { documentoOk: true });
}

/** Coloca no batch a remoção do documento da ficha (gaveta e reserva). Só admin e mentor. */
export function apagarDocumentoDaFichaNoLote(batch, professorId, { tipo, numero }) {
  batch.delete(refGavetaFicha(professorId));
  batch.delete(refReservaFicha(tipo, numero));
}

/** Coloca no batch a passagem do documento de uma ficha para outra (ao juntar fichas). Só admin. */
export function passarDocumentoNoLote(batch, { deId, paraId, tipo, numero }) {
  batch.set(refGavetaFicha(paraId), {
    tipo, numero, atualizadoEm: serverTimestamp(), atualizadoPor: auth.currentUser?.uid,
  });
  batch.set(refReservaFicha(tipo, numero), { professorId: String(paraId), tipo, numero });
  batch.delete(refGavetaFicha(deId));
}

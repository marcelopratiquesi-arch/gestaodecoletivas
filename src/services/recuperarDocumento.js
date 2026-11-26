// Antes de pedir o documento (CPF/DNI/SSN) de quem já tem acesso, procura se ele já foi informado em algum lugar e só COPIA:
//   1) a gaveta privada do próprio crachá (ex.: o admin ou o mentor já informou) → só marca "documentoOk";
//   2) o pedido de acesso aprovado (primeiro acesso) → copia para a gaveta do crachá;
//   3) o convite do mentor cadastrado pelo admin → copia para a gaveta do crachá.
// O número nunca vai para o crachá aberto. Usado pelo aviso obrigatório de cadastro (components/CadastroObrigatorio).
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { documentoValido, TIPOS_DOCUMENTO } from "../utils/documento";
import { documentoNoLote, gravarComAviso, lerDocumento, lerDocumentoDoPedido } from "./documentoService";

// Documento do convite de mentor (convites_acesso/{e-mail}.documento), se o admin informou.
async function lerDocumentoDoConvite(email) {
  if (!email) return null;
  try {
    const snap = await getDoc(doc(db, "convites_acesso", email.toLowerCase()));
    const d = snap.exists() ? snap.data().documento : null;
    return d && TIPOS_DOCUMENTO.includes(d.tipo) && documentoValido(d.tipo, d.numero) ? { tipo: d.tipo, numero: String(d.numero) } : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<boolean>} true = achou e já marcou "documentoOk" no crachá (recarregue o crachá); false = não achou, é preciso pedir.
 * Lança ERRO_DOCUMENTO_EM_USO se o documento encontrado já é de outra pessoa.
 */
export async function recuperarDocumentoJaInformado({ uid, email }) {
  const naGaveta = await lerDocumento(uid);
  if (naGaveta) {
    const batch = writeBatch(db);
    batch.update(doc(db, "usuarios", uid), { documentoOk: true });
    await gravarComAviso(batch, { uid, ...naGaveta });
    return true;
  }
  const origem = (await lerDocumentoDoPedido(uid)) || (await lerDocumentoDoConvite(email));
  if (origem && documentoValido(origem.tipo, origem.numero)) {
    const batch = writeBatch(db);
    documentoNoLote(batch, { uid, tipo: origem.tipo, numero: origem.numero, marcarCracha: true });
    await gravarComAviso(batch, { uid, ...origem });
    return true;
  }
  return false;
}

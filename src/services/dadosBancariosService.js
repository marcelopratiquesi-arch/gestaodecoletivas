// Banco Inter do professor (agência e conta): gaveta privada dados_bancarios/{login}. Quem lê: a própria pessoa, o admin, o
// mentor e o líder da unidade dela (o banco confere). O número NUNCA vai para a auditoria, nem para o crachá, nem para listas.
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { BANCO_INTER } from "../utils/dadosBancarios";

/** { agencia, conta } guardados ou null. Sem permissão ou sem registro = null. */
export async function lerDadosBancarios(uid) {
  try {
    const snap = await getDoc(doc(db, "dados_bancarios", uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { agencia: String(d.agencia || ""), conta: String(d.conta || "") };
  } catch (e) {
    if (e?.code === "permission-denied") return null;
    throw e;
  }
}

async function auditar(uid, nome, texto) {
  try {
    await addDoc(collection(db, "auditoria_configuracoes"), {
      tipoAcao: "ALTERADA", modulo: "CONFIGURACOES", descricao: "Professor atualizou os dados bancários (Meu cadastro).",
      diffExtras: texto, unidadeNome: "-", usuarioAcaoNome: nome || "-", usuarioAcaoId: uid, dataAcao: serverTimestamp(),
    });
  } catch (e) { console.error("Falha ao gravar auditoria", e); }
}

/** Grava (ou troca) o Banco Inter. `valor` = { agencia, conta } só com números (ver utils/dadosBancarios). */
export async function salvarDadosBancarios({ uid, nome, valor, tinhaAntes }) {
  await setDoc(doc(db, "dados_bancarios", uid), { banco: BANCO_INTER, agencia: valor.agencia, conta: valor.conta, atualizadoEm: serverTimestamp() });
  await auditar(uid, nome, tinhaAntes ? "Banco Inter alterado" : "Banco Inter informado");
}

export async function removerDadosBancarios({ uid, nome }) {
  await deleteDoc(doc(db, "dados_bancarios", uid));
  await auditar(uid, nome, "Banco Inter removido");
}

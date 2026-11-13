// O que acontece com quem deixa de ser o líder de uma unidade (trocado ou removido):
// - admin ou mentor que também era o líder: só sai da unidade; o crachá não muda;
// - líder que também é professor de coletiva: volta a ser PROFESSOR (continua entrando no sistema,
//   vendo as aulas e os pagamentos dele); só perde o acesso de líder;
// - os demais: perdem o acesso (o crachá é apagado) e o pedido de acesso dele fica como recusado.
import { doc, getDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { liderMantemAcesso } from "../../../permissions";

// Cadastro de professor ligado a este login: pelo crachá (professorId) ou pelo cadastro (uidLogin).
export function professorDoLogin(uid, cracha, professores = []) {
  if (cracha?.professorId) return String(cracha.professorId);
  const prof = professores.find((p) => p.uidLogin && String(p.uidLogin) === String(uid));
  return prof ? String(prof.id) : null;
}

// Coloca no batch o que for preciso e devolve o que aconteceu: "mantem" | "professor" | "removido" | "nada".
export async function tirarLiderDaUnidade(batch, { liderUid, professores, motivo, quemId, quemNome }) {
  if (!liderUid) return "nada";
  const cracha = await getDoc(doc(db, "usuarios", liderUid));
  if (cracha.exists() && liderMantemAcesso(cracha.data().role)) return "mantem";

  const professorId = cracha.exists() ? professorDoLogin(liderUid, cracha.data(), professores) : null;
  if (cracha.exists() && professorId) {
    batch.update(cracha.ref, { role: "professor", unidadeId: deleteField(), professorId });
    return "professor";
  }

  if (cracha.exists()) batch.delete(cracha.ref);
  const pedido = await getDoc(doc(db, "solicitacoes_acesso", liderUid));
  if (pedido.exists() && pedido.data().status !== "recusado") {
    batch.update(pedido.ref, {
      status: "recusado", motivo, analisadoPor: quemId, analisadoPorNome: quemNome, analisadoEm: serverTimestamp(),
    });
  }
  return "removido";
}

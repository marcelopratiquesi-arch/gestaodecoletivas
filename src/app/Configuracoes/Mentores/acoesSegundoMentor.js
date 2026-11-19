// Gravações do 2º mentor (só o admin chama; o banco já deixa o admin gravar crachás e unidades).
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { publicarUnidade } from "../../../services/vitrinePublica";
import { camposAoEntrar, camposAoPromover, camposAoSair } from "./segundoMentor";

// Pessoa que já tem login: vira 2º mentor (líder continua líder; o papel de antes fica guardado).
export async function entrarComoSegundo({ cracha, uid, principalId }) {
  await updateDoc(doc(db, "usuarios", uid), { ...camposAoEntrar(cracha, principalId), atualizadoEm: serverTimestamp() });
}

// Pessoa nova: convite pelo e-mail do Google, já marcado como 2º mentor do principal (o crachá nasce no 1º acesso).
export async function convidarSegundo({ email, nome, telefone, pais, principalId, quem }) {
  const emailGoogle = email.trim().toLowerCase();
  await setDoc(doc(db, "convites_acesso", emailGoogle), {
    papel: "mentor", status: "pendente", email: emailGoogle, nome: nome.trim(), pais, telefone: telefone.trim(),
    mentorPrincipalId: principalId,
    criadoPor: quem?.id || quem?.uid, criadoPorNome: quem?.nome || quem?.email || "Admin", criadoEm: serverTimestamp(),
  });
  return emailGoogle;
}

// Tira o 2º mentor: volta ao papel de antes (líder, professor) ou fica sem acesso.
export async function sairDeSegundo({ cracha }) {
  await updateDoc(doc(db, "usuarios", cracha.id), { ...camposAoSair(cracha), atualizadoEm: serverTimestamp() });
}

// O 2º mentor vira o 1º: recebe TODAS as unidades do mentor atual e o mentor atual fica sem unidades
// (para receber outras depois). Idempotente: se falhar no meio, é só repetir.
export async function promoverASegundo({ principal, segundo, unidades }) {
  const doPrincipal = unidades.filter((u) => u.mentorId === principal.id);
  for (let i = 0; i < doPrincipal.length; i += 400) {
    const batch = writeBatch(db);
    doPrincipal.slice(i, i + 400).forEach((u) => batch.update(doc(db, "unidades", String(u.id)), { mentorId: segundo.id, atualizadoEm: serverTimestamp() }));
    await batch.commit();
  }
  for (let i = 0; i < doPrincipal.length; i += 10) {
    await Promise.all(doPrincipal.slice(i, i + 10).map((u) =>
      publicarUnidade(u.id, { ...u, mentorId: segundo.id, mentorNome: segundo.nome }).catch((e) => console.error("Vitrine não atualizada:", u.id, e))));
  }
  await updateDoc(doc(db, "usuarios", segundo.id), { ...camposAoPromover(), atualizadoEm: serverTimestamp() });
  return doPrincipal.length;
}

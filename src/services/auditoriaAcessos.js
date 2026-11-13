// Auditoria ÚNICA de acessos (quem dá, muda ou tira o acesso de alguém).
// Tudo vai para "auditoria_configuracoes" (a tela de Auditoria já lê essa coleção) com o mesmo formato:
// quem fez (uid, nome, e-mail do login e e-mail do Google) e quem recebeu (uid, nome, e-mail, e-mail do Google).
// Se a gravação falhar, a ação principal NÃO é desfeita: só avisa no console.
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// E-mail do Google conectado ao login (null se a pessoa ainda entra só com e-mail e senha).
export const emailGoogleDe = (firebaseUser) =>
  (firebaseUser?.providerData || []).find((p) => p.providerId === "google.com")?.email || null;

// No crachá, o e-mail só é o do Google depois que a pessoa conectou o Google (loginGoogle: true).
const emailGoogleDoCracha = (cracha) => (cracha?.loginGoogle === true ? cracha.email || null : null);

/**
 * @param {object} p
 * @param {string} p.tipoAcao      NOVA | ALTERADA | EXCLUÍDA
 * @param {string} p.descricao     o que aconteceu, em português simples
 * @param {object} [p.quem]        crachá de quem fez (userData); uid e e-mails vêm do login atual
 * @param {object} [p.alvo]        { id, nome, email, emailGoogle?, loginGoogle? } de quem recebeu a ação
 * @param {string} [p.papelAnterior]
 * @param {string} [p.papelNovo]
 * @param {string} [p.detalhes]    texto extra (o que mudou)
 * @param {string} [p.unidadeNome]
 */
export async function registrarAuditoriaAcesso({ tipoAcao, descricao, quem, alvo, papelAnterior, papelNovo, detalhes, unidadeNome }) {
  try {
    const eu = auth.currentUser;
    const alvoEmailGoogle = alvo ? alvo.emailGoogle ?? emailGoogleDoCracha(alvo) : null;
    const alvoTexto = alvo
      ? `Alvo: ${alvo.nome || "-"} (${alvo.email || "sem e-mail"}${alvoEmailGoogle && alvoEmailGoogle !== alvo.email ? ` | Google: ${alvoEmailGoogle}` : ""})`
      : "";

    await addDoc(collection(db, "auditoria_configuracoes"), {
      tipoAcao,
      descricao,
      modulo: "CONFIGURACOES",
      categoria: "ACESSOS",
      diffExtras: [alvoTexto, detalhes].filter(Boolean).join(" | "),
      unidadeNome: unidadeNome || "-",
      estadoAnterior: papelAnterior ? { nivel_acesso: String(papelAnterior).toUpperCase(), usuario: alvo?.nome || "-" } : null,
      estadoNovo: papelNovo ? { nivel_acesso: String(papelNovo).toUpperCase(), usuario: alvo?.nome || "-" } : null,
      // Quem fez
      usuarioAcaoId: eu?.uid || quem?.id || null,
      usuarioAcaoNome: quem?.nome || eu?.email || "Administrador",
      usuarioAcaoEmail: eu?.email || quem?.email || null,
      usuarioAcaoEmailGoogle: emailGoogleDe(eu),
      // Quem recebeu
      alvoId: alvo?.id || null,
      alvoNome: alvo?.nome || null,
      alvoEmail: alvo?.email || null,
      alvoEmailGoogle,
      dataAcao: serverTimestamp(),
    });
  } catch (e) {
    console.error("Falha ao gravar auditoria de acesso", e);
  }
}

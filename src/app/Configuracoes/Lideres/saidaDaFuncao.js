// "Não sou mais da unidade" / "Não sou mais mentor": a PRÓPRIA pessoa se desliga do acesso, na hora.
// - O crachá NÃO é apagado: guarda de onde a pessoa saiu (papelAntes, unidadeIdsAntes, saidaEm) para dar para desfazer.
// - Líder: vira "bloqueado" (ou volta a "professor", se também é professor) e sai de TODAS as unidades dele;
//   as unidades ficam "sem líder" (o 2º líder, se houver, assume).
// - Mentor: fica com status "inativo" (as unidades continuam apontando para ele; o admin redistribui).
// - O aviso fica em saidas_acesso (aparece em Pendências para o mentor da unidade e para o admin).
// Quem desfaz (mentor da unidade ou admin): desfazerSaida(). Quem só dá ciência: darCienciaDaSaida().
import { collection, deleteField, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { camposAoLiberarVaga, dadosDaVaga, listaDoCracha } from "./saidaDoLider";

// Cadastro de professor ligado a este login (o banco só aceita o vínculo verdadeiro: professores/{id}.uidLogin).
export function professorLigadoAoLogin(uid, professores = []) {
  const prof = professores.find((p) => p.uidLogin && String(p.uidLogin) === String(uid));
  return prof ? String(prof.id) : null;
}

/**
 * @param {object} p
 * @param {string} p.uid
 * @param {object} p.cracha        crachá atual (userData)
 * @param {string} p.email         e-mail para o aviso
 * @param {Array}  p.unidades      catálogo de unidades (só para os nomes)
 * @param {Array}  p.professores   catálogo de professores
 * @param {boolean} [p.continuaProfessor]  líder que também é professor e quer continuar como professor
 * @returns {Promise<"bloqueado"|"professor"|"mentor">}
 */
export async function sairDaFuncao({ uid, cracha, email, unidades = [], professores = [], continuaProfessor = false }) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  const ehMentor = papel === "mentor";
  const ids = ehMentor ? [] : listaDoCracha(cracha);
  const nomeDe = (id) => unidades.find((u) => u.id === id)?.nome || id;
  const professorId = !ehMentor && continuaProfessor ? professorLigadoAoLogin(uid, professores) : null;
  if (!ehMentor && continuaProfessor && !professorId) throw new Error("Cadastro de professor não encontrado para este login.");

  const batch = writeBatch(db);
  const agora = serverTimestamp();

  if (ehMentor) {
    batch.update(doc(db, "usuarios", uid), { status: "inativo", papelAntes: "mentor", saidaEm: agora });
  } else {
    // Libera a vaga de líder em cada unidade (lê o estado de agora, não o do catálogo).
    for (const id of ids) {
      const snap = await getDoc(doc(db, "unidades", id));
      if (!snap.exists()) continue;
      const u = { id: snap.id, ...snap.data() };
      if (u.liderUid === uid) batch.update(snap.ref, camposAoLiberarVaga(u, 1));
      else if (u.lider2Uid === uid) batch.update(snap.ref, camposAoLiberarVaga(u, 2));
    }
    batch.update(doc(db, "usuarios", uid), professorId
      ? { role: "professor", professorId, unidadeId: deleteField(), unidadeIds: deleteField(), papelAntes: papel, unidadeIdsAntes: ids, saidaEm: agora }
      : { role: "bloqueado", papelAntes: papel, unidadeIdsAntes: ids, saidaEm: agora });
  }

  const nome = String(cracha?.nome || email || "-").slice(0, 80);
  batch.set(doc(db, "saidas_acesso", uid), {
    nome, email: email || "", telefone: String(cracha?.telefone || ""), papel: ehMentor ? "mentor" : "lider",
    unidadeIds: ids, unidadeNomes: (ehMentor ? unidades.filter((u) => u.mentorId === uid).map((u) => u.nome) : ids.map(nomeDe)).slice(0, 30),
    continuaProfessor: !!professorId, status: "pendente", criadoEm: agora,
  });
  // Auditoria na mesma gravação (depois do bloqueio a pessoa já não consegue gravar nada).
  batch.set(doc(collection(db, "auditoria_configuracoes")), {
    tipoAcao: "ALTERADA", modulo: "CONFIGURACOES", categoria: "ACESSOS",
    descricao: ehMentor ? "Mentor saiu da função (acesso desligado)." : professorId ? "Líder saiu da liderança e continua como professor." : "Líder saiu da unidade (acesso desligado).",
    diffExtras: `${nome} (${email || "sem e-mail"})${ids.length ? ` | ${ids.map(nomeDe).join(", ")}` : ""}`,
    unidadeNome: ids.length ? ids.map(nomeDe).join(", ") : "-", usuarioAcaoNome: nome, usuarioAcaoId: uid, dataAcao: agora,
  });
  await batch.commit();
  return ehMentor ? "mentor" : professorId ? "professor" : "bloqueado";
}

/**
 * Desfaz a saída (mentor da unidade ou admin). Devolve a função de antes e recoloca a pessoa como líder das
 * unidades que ainda têm vaga; as que já têm 2 líderes ficam de fora (voltam em "ocupadas").
 * @returns {Promise<{ voltou: string[], ocupadas: string[] }>}
 */
export async function desfazerSaida({ aviso, quem }) {
  const uid = aviso.id;
  const crachaRef = doc(db, "usuarios", uid);
  const snap = await getDoc(crachaRef);
  if (!snap.exists()) throw new Error("Crachá não encontrado.");
  const cracha = snap.data();
  const papelAntes = String(cracha.papelAntes || "").trim().toLowerCase();
  if (!papelAntes) throw new Error("Esta pessoa já não está marcada como tendo saído.");

  const batch = writeBatch(db);
  const voltou = [];
  const ocupadas = [];
  if (papelAntes === "mentor") {
    batch.update(crachaRef, { status: "ativo", papelAntes: deleteField(), saidaEm: deleteField() });
  } else {
    const ids = Array.isArray(cracha.unidadeIdsAntes) ? cracha.unidadeIdsAntes.map(String) : [];
    if (!ids.length) throw new Error("Sem unidades para devolver.");
    batch.update(crachaRef, {
      role: papelAntes, unidadeId: ids[0], unidadeIds: ids,
      papelAntes: deleteField(), unidadeIdsAntes: deleteField(), saidaEm: deleteField(),
    });
    const dados = { uid, nome: cracha.nome, email: cracha.email, telefone: cracha.telefone, tipo: cracha.loginGoogle === true ? "google" : "senha" };
    for (const id of ids) {
      const u = await getDoc(doc(db, "unidades", id));
      if (!u.exists()) continue;
      const d = u.data();
      if (d.liderUid === uid || d.lider2Uid === uid) { voltou.push(d.nome || id); continue; }
      const vaga = !d.liderUid ? 1 : !d.lider2Uid ? 2 : 0;
      if (!vaga) { ocupadas.push(d.nome || id); continue; }
      batch.update(u.ref, dadosDaVaga(vaga, dados));
      voltou.push(d.nome || id);
    }
  }
  batch.update(doc(db, "saidas_acesso", uid), {
    status: "desfeita", analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  await batch.commit();
  await registrarAuditoriaAcesso({
    tipoAcao: "ALTERADA", descricao: "Saída de acesso desfeita (a pessoa voltou à função de antes).",
    detalhes: [voltou.length ? `Voltou em: ${voltou.join(", ")}` : "", ocupadas.length ? `Sem vaga: ${ocupadas.join(", ")}` : ""].filter(Boolean).join(" | "),
    unidadeNome: voltou.join(", ") || "-", papelNovo: papelAntes, quem: quem.cracha,
    alvo: { id: uid, nome: cracha.nome, email: cracha.email, loginGoogle: cracha.loginGoogle },
  });
  return { voltou, ocupadas };
}

// Só tira o aviso da lista (o acesso continua desligado).
export async function darCienciaDaSaida({ aviso, quem }) {
  await updateDoc(doc(db, "saidas_acesso", aviso.id), {
    status: "ciente", analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
}

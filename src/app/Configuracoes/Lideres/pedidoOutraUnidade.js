// Pedido de OUTRA unidade: o líder escolhe, na atualização de cadastro, mais unidades que ele lidera.
// - Cada unidade pedida vira um documento em pedidos_unidade (id = login + "_" + unidade), assim cada mentor
//   vê e resolve só as unidades dele (aparece em Pendências).
// - Aprovar (mentor da unidade ou admin) coloca a pessoa como líder da unidade (1º ou 2º líder, ou substituindo),
//   acrescentando a unidade no crachá dela, uma por vez (como já é na aba Líderes).
// - O mentor continua podendo incluir o líder direto pela aba Líderes: os dois jeitos valem.
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { crachaAoEntrar, dadosDaVaga, professorDoLogin, tirarLiderDaUnidade } from "./saidaDoLider";

export const MAX_UNIDADES_EXTRAS = 4; // o banco aceita até 5 unidades por líder nos pedidos (a atual + 4)

export const idDoPedidoUnidade = (uid, unidadeId) => `${uid}_${unidadeId}`;

// Coloca no `batch` um pedido por unidade escolhida (o líder ainda não comanda nenhuma delas).
// `nomes` = mapa id → nome da unidade; `atuais` = nomes das unidades que ele já lidera (só para o mentor ver).
export function pedirOutrasUnidades(batch, { uid, nome, email, telefone, unidadeIds, nomes = {}, atuais = [] }) {
  for (const unidadeId of unidadeIds) {
    batch.set(doc(db, "pedidos_unidade", idDoPedidoUnidade(uid, unidadeId)), {
      uid, nome, email: email || "", telefone, unidadeId: String(unidadeId), unidadeNome: String(nomes[unidadeId] || "").slice(0, 120),
      unidadesAtuais: atuais.slice(0, 30), status: "pendente", criadoEm: serverTimestamp(),
    });
  }
}

/**
 * Aprova o pedido: a pessoa passa a liderar a unidade.
 * @param {object} p
 * @param {object} p.pedido     documento de pedidos_unidade (com id)
 * @param {object} p.unidade    unidade (catálogo)
 * @param {1|2}    p.vaga       1 = 1º líder (substitui se já houver), 2 = 2º líder
 * @param {boolean} p.substitui o 1º líder atual sai
 * @param {Array}  p.professores catálogo de professores (para o líder que sai e é professor)
 * @param {{id:string,nome:string,cracha:object}} p.quem quem aprovou
 * @returns {Promise<"ok"|"jaEra">}
 */
export async function aprovarPedidoUnidade({ pedido, unidade, vaga, substitui, professores = [], quem }) {
  const uid = pedido.uid;
  const crachaRef = doc(db, "usuarios", uid);
  const snap = await getDoc(crachaRef);
  if (!snap.exists()) throw new Error("Esta pessoa não tem mais cadastro.");
  const cracha = snap.data();
  const analise = { status: "aprovado", analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp() };

  const batch = writeBatch(db);
  const novoCracha = crachaAoEntrar(cracha, unidade.id, professorDoLogin(uid, cracha, professores));
  const jaEra = unidade.liderUid === uid || unidade.lider2Uid === uid;
  if (!jaEra) {
    if (substitui) {
      await tirarLiderDaUnidade(batch, {
        liderUid: unidade.liderUid, unidadeId: unidade.id, professores,
        motivo: `Substituído por ${pedido.nome} como líder da unidade.`, quemId: quem.id, quemNome: quem.nome,
      });
    }
    if (novoCracha) batch.update(crachaRef, novoCracha);
    batch.update(doc(db, "unidades", unidade.id), dadosDaVaga(substitui ? 1 : vaga, {
      uid, nome: cracha.nome || pedido.nome, email: cracha.email || pedido.email, telefone: cracha.telefone || pedido.telefone, tipo: "google",
    }));
  }
  batch.update(doc(db, "pedidos_unidade", pedido.id), analise);
  await batch.commit();
  if (jaEra) return "jaEra";

  await registrarAuditoriaAcesso({
    tipoAcao: "ALTERADA", unidadeNome: unidade.nome, papelNovo: "lider", quem: quem.cracha,
    descricao: vaga === 2 && !substitui ? "2º líder aprovado (pedido de outra unidade)." : "Líder aprovado (pedido de outra unidade).",
    detalhes: substitui ? `Substituiu ${unidade.liderNome || unidade.liderEmail || "-"}` : "",
    alvo: { id: uid, nome: cracha.nome || pedido.nome, email: cracha.email || pedido.email, loginGoogle: true },
  });
  return "ok";
}

export async function recusarPedidoUnidade({ pedido, motivo, quem }) {
  const batch = writeBatch(db);
  batch.update(doc(db, "pedidos_unidade", pedido.id), {
    status: "recusado", motivo: String(motivo || "").trim(),
    analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  await batch.commit();
  await registrarAuditoriaAcesso({
    tipoAcao: "ALTERADA", descricao: "Pedido de outra unidade recusado.", unidadeNome: pedido.unidadeNome || "-", quem: quem.cracha,
    detalhes: motivo?.trim() ? `Motivo: ${motivo.trim()}` : "",
    alvo: { id: pedido.uid, nome: pedido.nome, email: pedido.email, loginGoogle: true },
  });
}

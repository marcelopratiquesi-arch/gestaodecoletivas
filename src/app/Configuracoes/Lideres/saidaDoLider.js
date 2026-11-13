// Liderança das unidades. Cada unidade tem até 2 líderes (campos lider* e lider2* da unidade), e uma
// pessoa pode ser líder de várias unidades (crachá: "unidadeId" = principal, "unidadeIds" = todas).
// O banco só aceita que o mentor mexa em UMA unidade dele por vez no crachá ("unidadeAlterada").
//
// O que acontece com quem deixa de ser o líder de uma unidade (trocado ou removido):
// - admin ou mentor que também era o líder: só sai da unidade; o crachá não muda;
// - quem é líder de outras unidades também: só sai desta e continua nas outras;
// - líder que também é professor de coletiva: volta a ser PROFESSOR (continua entrando no sistema,
//   vendo as aulas e os pagamentos dele); só perde o acesso de líder;
// - os demais: perdem o acesso (o crachá é apagado) e o pedido de acesso dele fica como recusado.
import { doc, getDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { ehLider, liderMantemAcesso } from "../../../permissions";

// Cadastro de professor ligado a este login: pelo crachá (professorId) ou pelo cadastro (uidLogin).
export function professorDoLogin(uid, cracha, professores = []) {
  if (cracha?.professorId) return String(cracha.professorId);
  const prof = professores.find((p) => p.uidLogin && String(p.uidLogin) === String(uid));
  return prof ? String(prof.id) : null;
}

// Lista de unidades do crachá exatamente como o banco a enxerga (o banco compara a lista inteira).
function listaDoCracha(cracha) {
  if (Array.isArray(cracha?.unidadeIds)) return cracha.unidadeIds.map(String);
  return cracha?.unidadeId ? [String(cracha.unidadeId)] : [];
}

// Campos do líder na unidade: vaga 1 = lider*, vaga 2 = lider2*.
const CAMPOS = ["Uid", "Nome", "Email", "Telefone", "Tipo", "Desde"];
export const prefixoDaVaga = (vaga) => (vaga === 2 ? "lider2" : "lider");

export function dadosDaVaga(vaga, { uid, nome, email, telefone, tipo }) {
  const p = prefixoDaVaga(vaga);
  return {
    [`${p}Uid`]: uid, [`${p}Nome`]: nome || "", [`${p}Email`]: email || "", [`${p}Telefone`]: telefone || "",
    [`${p}Tipo`]: tipo || "senha", [`${p}Desde`]: serverTimestamp(),
    ...(vaga === 1 ? { liderAConferir: deleteField() } : {}),
  };
}

// O que gravar na unidade quando a vaga fica livre. Se sair o 1º líder e houver 2º, o 2º passa a ser o 1º.
export function camposAoLiberarVaga(unidade, vaga) {
  const apagar2 = Object.fromEntries(CAMPOS.map((c) => [`lider2${c}`, deleteField()]));
  if (vaga === 2) return apagar2;
  if (unidade.lider2Uid) {
    return {
      ...Object.fromEntries(CAMPOS.map((c) => [`lider${c}`, unidade[`lider2${c}`] ?? deleteField()])),
      liderAConferir: deleteField(), ...apagar2,
    };
  }
  return { ...Object.fromEntries(CAMPOS.map((c) => [`lider${c}`, deleteField()])), liderAConferir: deleteField() };
}

// Crachá de quem passa a ser líder da unidade `unidadeId` (acrescenta a unidade na lista dele).
// Devolve null quando o crachá não muda (admin/mentor).
export function crachaAoEntrar(cracha, unidadeId, professorId) {
  const papel = String(cracha?.role || "").trim().toLowerCase();
  if (liderMantemAcesso(papel)) return null;
  const antes = ehLider(papel) ? listaDoCracha(cracha) : [];
  const lista = antes.includes(String(unidadeId)) ? antes : [...antes, String(unidadeId)];
  return {
    role: "lider", unidadeId: lista[0], unidadeIds: lista, unidadeAlterada: String(unidadeId),
    ...(!ehLider(papel) && professorId ? { professorId } : {}),
  };
}

// Coloca no batch o que for preciso e devolve o que aconteceu:
// "mantem" | "outras" | "professor" | "removido" | "nada".
export async function tirarLiderDaUnidade(batch, { liderUid, unidadeId, professores, motivo, quemId, quemNome }) {
  if (!liderUid) return "nada";
  const cracha = await getDoc(doc(db, "usuarios", liderUid));
  if (cracha.exists() && liderMantemAcesso(cracha.data().role)) return "mantem";

  if (cracha.exists()) {
    const dados = cracha.data();
    const lista = listaDoCracha(dados);
    const resto = lista.filter((id) => id !== String(unidadeId));
    if (ehLider(dados.role) && resto.length > 0) {
      // Continua líder das outras unidades.
      if (resto.length !== lista.length) {
        batch.update(cracha.ref, { unidadeId: resto[0], unidadeIds: resto, unidadeAlterada: String(unidadeId) });
      }
      return "outras";
    }
    const professorId = professorDoLogin(liderUid, dados, professores);
    if (professorId) {
      batch.update(cracha.ref, {
        role: "professor", unidadeId: deleteField(), unidadeIds: deleteField(), professorId, unidadeAlterada: String(unidadeId),
      });
      return "professor";
    }
    batch.delete(cracha.ref);
  }

  const pedido = await getDoc(doc(db, "solicitacoes_acesso", liderUid));
  if (pedido.exists() && pedido.data().status !== "recusado") {
    batch.update(pedido.ref, {
      status: "recusado", motivo, analisadoPor: quemId, analisadoPorNome: quemNome, analisadoEm: serverTimestamp(),
    });
  }
  return "removido";
}

// Texto curto para a auditoria.
export const textoDaSaida = (saida) => ({
  professor: "voltou a ser professor",
  mantem: "manteve o acesso de admin/mentor",
  outras: "continua líder das outras unidades dele",
  removido: "perdeu o acesso",
}[saida] || "");

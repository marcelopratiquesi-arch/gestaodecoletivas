// Leitura e gravação do "Juntar fichas" (só admin: as regras só deixam o admin mexer em validações antigas).
// A conta do que muda está em utils/juntarFichas.js.
// Se parar no meio (cota, conexão), é só juntar de novo: a leitura acha o que ainda aponta para as fichas velhas.
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { montarPlanoJuncao } from '../utils/juntarFichas';
import { removerProfessorDaVitrine } from './vitrinePublica';

const TAMANHO_LOTE = 450; // limite do Firestore: 500 operações por lote
const docsDe = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// Lê só o que aponta para as fichas envolvidas (algumas dezenas/centenas de leituras).
export async function prepararJuncao(principal, outras) {
  const idsOutras = outras.map(o => String(o.id));
  const todos = [String(principal.id), ...idsOutras];
  const logins = [...new Set([principal.uidLogin, ...outras.map(o => o.uidLogin)].filter(Boolean).map(String))];

  const [aulas, vinculos, validacoesTitular, validacoesSubstituido, crachas, crachasDosLogins] = await Promise.all([
    getDocs(query(collection(db, 'aulas'), where('professorId', 'in', idsOutras))),
    getDocs(query(collection(db, 'vinculos'), where('professorId', 'in', todos))),
    getDocs(query(collection(db, 'validacoes'), where('professorId', 'in', idsOutras))),
    getDocs(query(collection(db, 'validacoes'), where('professorOriginalId', 'in', idsOutras))),
    getDocs(query(collection(db, 'usuarios'), where('professorId', 'in', idsOutras))),
    Promise.all(logins.map(uid => getDoc(doc(db, 'usuarios', uid)))),
  ]);

  const validacoes = new Map();
  [...docsDe(validacoesTitular), ...docsDe(validacoesSubstituido)].forEach(v => validacoes.set(v.id, v));
  const crachaDoLogin = Object.fromEntries(crachasDosLogins.map(s => [s.id, s.exists() ? s.data() : null]));

  const leituras = aulas.size + vinculos.size + validacoesTitular.size + validacoesSubstituido.size + crachas.size + logins.length;
  return {
    plano: montarPlanoJuncao({
      principal, outras,
      aulas: docsDe(aulas), vinculos: docsDe(vinculos), validacoes: [...validacoes.values()],
      crachas: docsDe(crachas), crachaDoLogin,
    }),
    leituras,
  };
}

// "Ligar ficha ao crachá": a mesma pessoa tem ficha na grade e crachá (ex.: líder que dá aula) sem estarem
// ligados. Liga nos dois sentidos, como o sistema já faz: professores/{id}.uidLogin e usuarios/{uid}.professorId.
export async function ligarFichaAoCracha({ ficha, cracha, quem }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'professores', String(ficha.id)), { uidLogin: String(cracha.id), updatedAt: serverTimestamp() });
  batch.update(doc(db, 'usuarios', String(cracha.id)), { professorId: String(ficha.id) });
  await batch.commit();
  try {
    await addDoc(collection(db, 'auditoria_cronograma'), {
      tipoAcao: 'ALTERADA',
      descricao: 'Ficha de professor ligada ao crachá.',
      diffExtras: `Ficha: ${ficha.nome || '-'} [${ficha.id}] ↔ crachá: ${cracha.nome || '-'} (${cracha.email || 'sem e-mail'}) [${cracha.id}]`
        + (ficha.uidLogin && ficha.uidLogin !== cracha.id ? `. Login anterior da ficha: ${ficha.uidLogin}` : ''),
      modulo: 'CONFIGURACOES',
      professorNome: ficha.nome || '-',
      unidadeNome: cracha.unidade || '-',
      modalidadeNome: '-',
      usuarioAcaoNome: quem?.nome || quem?.email || 'Administrador',
      usuarioAcaoId: quem?.id || null,
      dataAcao: serverTimestamp(),
    });
  } catch (e) { console.error('Falha ao gravar auditoria da ligação', e); }
}

// Grava o plano em lotes. A ficha principal é atualizada e as outras apagadas só no fim.
export async function executarJuncao({ plano, principal, outras, quem, aoAvancar }) {
  const ops = [
    ...plano.aulas.map(id => (b) => b.update(doc(db, 'aulas', id), { professorId: plano.idPrincipal })),
    ...plano.vinculosMover.map(id => (b) => b.update(doc(db, 'vinculos', id), { professorId: plano.idPrincipal })),
    ...plano.vinculosApagar.map(id => (b) => b.delete(doc(db, 'vinculos', id))),
    ...plano.validacoes.map(({ id, mudar }) => (b) => b.update(doc(db, 'validacoes', id), mudar)),
    ...plano.crachas.map(id => (b) => b.update(doc(db, 'usuarios', id), { professorId: plano.idPrincipal })),
    // Resumo do mês com aulão desse professor fica velho: apagado, é refeito na próxima abertura do admin.
    ...plano.mesesResumo.map(mes => (b) => b.delete(doc(db, 'resumos_mensais', mes))),
  ];

  let feitas = 0;
  for (let i = 0; i < ops.length; i += TAMANHO_LOTE) {
    const batch = writeBatch(db);
    ops.slice(i, i + TAMANHO_LOTE).forEach(op => op(batch));
    await batch.commit();
    feitas += Math.min(TAMANHO_LOTE, ops.length - i);
    aoAvancar?.(feitas, ops.length);
  }

  const final = writeBatch(db);
  final.update(doc(db, 'professores', plano.idPrincipal), {
    ...plano.completar,
    fichasJuntadas: [...new Set([...(principal.fichasJuntadas || []), ...plano.idsApagar])],
    updatedAt: serverTimestamp(),
  });
  plano.idsApagar.forEach(id => final.delete(doc(db, 'professores', id)));
  await final.commit();

  await Promise.all(plano.idsApagar.map(id => removerProfessorDaVitrine(id)));

  try {
    const resumo = outras.map(o => `${o.nome || '-'} [${o.id}] ${o.email || 'sem e-mail'} ${o.telefone || ''}`).join(' ; ');
    await addDoc(collection(db, 'auditoria_cronograma'), {
      tipoAcao: 'ALTERADA',
      descricao: 'Fichas de professor juntadas.',
      diffExtras: `Ficou: ${principal.nome} [${principal.id}]. Juntadas e apagadas: ${resumo}. `
        + `Aulas: ${plano.aulas.length}, unidades movidas: ${plano.vinculosMover.length}, `
        + `validações: ${plano.validacoes.length}, crachás: ${plano.crachas.length}.`,
      modulo: 'CONFIGURACOES',
      professorNome: principal.nome || '-',
      unidadeNome: '-',
      modalidadeNome: '-',
      usuarioAcaoNome: quem?.nome || quem?.email || 'Administrador',
      usuarioAcaoId: quem?.id || null,
      dataAcao: serverTimestamp(),
    });
  } catch (e) { console.error('Falha ao gravar auditoria da junção', e); }
}

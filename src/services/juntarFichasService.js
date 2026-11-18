// Leitura e gravação do "Juntar fichas" (só admin: as regras só deixam o admin mexer em validações antigas).
// A conta do que muda está em utils/juntarFichas.js.
// Se parar no meio (cota, conexão), é só juntar de novo: a leitura acha o que ainda aponta para as fichas velhas.
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { montarPlanoJuncao } from '../utils/juntarFichas';
import { publicarProfessor, removerProfessorDaVitrine } from './vitrinePublica';
import { documentoDaFichaNoLote, lerDocumentoDaFicha, passarDocumentoNoLote } from './documentoFichaService';
import { lerDocumento } from './documentoService';
import { idDocumentoUnico } from '../utils/documento';
import { liberarContatos, sincronizarContatos } from './contatoService';
import { espelharMudanca } from './aulasPublicas';

const TAMANHO_LOTE = 450; // limite do Firestore: 500 operações por lote
const docsDe = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// Lê só o que aponta para as fichas envolvidas (algumas dezenas/centenas de leituras).
export async function prepararJuncao(principal, outras, manter = {}) {
  const idsOutras = outras.map(o => String(o.id));
  const todos = [String(principal.id), ...idsOutras];
  const logins = [...new Set([principal.uidLogin, ...outras.map(o => o.uidLogin)].filter(Boolean).map(String))];

  const [aulas, vinculos, validacoesTitular, validacoesSubstituido, crachas, crachasDosLogins, docs] = await Promise.all([
    getDocs(query(collection(db, 'aulas'), where('professorId', 'in', idsOutras))),
    getDocs(query(collection(db, 'vinculos'), where('professorId', 'in', todos))),
    getDocs(query(collection(db, 'validacoes'), where('professorId', 'in', idsOutras))),
    getDocs(query(collection(db, 'validacoes'), where('professorOriginalId', 'in', idsOutras))),
    getDocs(query(collection(db, 'usuarios'), where('professorId', 'in', idsOutras))),
    Promise.all(logins.map(uid => getDoc(doc(db, 'usuarios', uid)))),
    // Documento só das fichas marcadas com "documentoOk" (as outras não têm: economiza leitura).
    Promise.all([principal, ...outras].filter(f => f.documentoOk).map(async f => [String(f.id), await lerDocumentoDaFicha(f.id)])),
  ]);
  const documentos = Object.fromEntries(docs.filter(([, d]) => d));

  const validacoes = new Map();
  [...docsDe(validacoesTitular), ...docsDe(validacoesSubstituido)].forEach(v => validacoes.set(v.id, v));
  const crachaDoLogin = Object.fromEntries(crachasDosLogins.map(s => [s.id, s.exists() ? s.data() : null]));

  const leituras = aulas.size + vinculos.size + validacoesTitular.size + validacoesSubstituido.size + crachas.size + logins.length + docs.length;
  return {
    plano: montarPlanoJuncao({
      principal, outras,
      aulas: docsDe(aulas), vinculos: docsDe(vinculos), validacoes: [...validacoes.values()],
      crachas: docsDe(crachas), crachaDoLogin, documentos, manter,
    }),
    leituras,
  };
}

// "Ligar ficha ao crachá": a mesma pessoa tem ficha na grade e crachá (ex.: líder que dá aula) sem estarem
// ligados. Liga nos dois sentidos, como o sistema já faz: professores/{id}.uidLogin e usuarios/{uid}.professorId.
// O documento (CPF) do login também vai para a ficha, se ela ainda não tem. Documentos diferentes = pessoas
// diferentes: não liga. Devolve { copiouDocumento }.
export async function ligarFichaAoCracha({ ficha, cracha, quem, manter = {} }) {
  // Nome, e-mail e telefone escolhidos na tela (só grava o que mudou).
  const dados = {};
  if (manter.nome && manter.nome !== ficha.nome) dados.nome = manter.nome;
  if (manter.email && manter.email.trim().toLowerCase() !== String(ficha.email || '').toLowerCase()) dados.email = manter.email.trim().toLowerCase();
  if (manter.telefone && manter.telefone !== ficha.telefone) dados.telefone = manter.telefone;
  const [docLogin, docFicha] = await Promise.all([
    lerDocumento(String(cracha.id)),
    ficha.documentoOk ? lerDocumentoDaFicha(ficha.id) : Promise.resolve(null),
  ]);
  if (docLogin && docFicha && idDocumentoUnico(docLogin.tipo, docLogin.numero) !== idDocumentoUnico(docFicha.tipo, docFicha.numero)) {
    throw new Error('DOCUMENTOS_DIFERENTES');
  }
  const copiar = !!docLogin && !docFicha;
  const batch = writeBatch(db);
  batch.update(doc(db, 'professores', String(ficha.id)), {
    uidLogin: String(cracha.id), updatedAt: serverTimestamp(), ...dados, ...(copiar ? { documentoOk: true } : {}),
  });
  if (copiar) documentoDaFichaNoLote(batch, { professorId: ficha.id, tipo: docLogin.tipo, numero: docLogin.numero, marcarFicha: false });
  // O crachá acompanha o nome escolhido (o e-mail do crachá é o do login e não muda).
  batch.update(doc(db, 'usuarios', String(cracha.id)), { professorId: String(ficha.id), ...(dados.nome ? { nome: dados.nome } : {}) });
  await batch.commit();
  // Reservas de e-mail/telefone: ficha e crachá agora são a mesma pessoa.
  const dono = { professorId: String(ficha.id), uid: String(cracha.id) };
  await sincronizarContatos({
    dono,
    antes: { email: ficha.email, telefone: ficha.telefone, pais: ficha.pais },
    depois: { email: dados.email ?? ficha.email, telefone: dados.telefone ?? ficha.telefone, pais: ficha.pais },
  });
  await sincronizarContatos({ dono, depois: { email: cracha.email, telefone: cracha.telefone, pais: cracha.pais || ficha.pais } });
  if (dados.nome) await publicarProfessor(ficha.id, dados.nome);
  try {
    await addDoc(collection(db, 'auditoria_cronograma'), {
      tipoAcao: 'ALTERADA',
      descricao: 'Ficha de professor ligada ao crachá.',
      diffExtras: `Ficha: ${ficha.nome || '-'} [${ficha.id}] ↔ crachá: ${cracha.nome || '-'} (${cracha.email || 'sem e-mail'}) [${cracha.id}]`
        + (ficha.uidLogin && ficha.uidLogin !== cracha.id ? `. Login anterior da ficha: ${ficha.uidLogin}` : '')
        + (copiar ? '. Documento de identificação do login copiado para a ficha' : ''),
      modulo: 'CONFIGURACOES',
      professorNome: ficha.nome || '-',
      unidadeNome: cracha.unidade || '-',
      modalidadeNome: '-',
      usuarioAcaoNome: quem?.nome || quem?.email || 'Administrador',
      usuarioAcaoId: quem?.id || null,
      dataAcao: serverTimestamp(),
    });
  } catch (e) { console.error('Falha ao gravar auditoria da ligação', e); }
  return { copiouDocumento: copiar };
}

// Grava o plano em lotes. A ficha principal é atualizada e as outras apagadas só no fim.
export async function executarJuncao({ plano, principal, outras, quem, aoAvancar }) {
  const ops = [
    ...plano.aulas.map(id => (b) => b.update(doc(db, 'aulas', id), { professorId: plano.idPrincipal })),
    // A cópia pública da grade (sem valor) acompanha a troca de professor.
    ...plano.aulas.map(id => (b) => espelharMudanca(b, id, { professorId: plano.idPrincipal })),
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

  if (plano.conflitoDocumento) throw new Error('DOCUMENTOS_DIFERENTES');
  const final = writeBatch(db);
  // Documento vai junto com a atualização da principal (o banco confere a gaveta e o login no mesmo lote).
  if (plano.documento) passarDocumentoNoLote(final, { ...plano.documento, paraId: plano.idPrincipal });
  final.update(doc(db, 'professores', plano.idPrincipal), {
    ...plano.completar,
    fichasJuntadas: [...new Set([...(principal.fichasJuntadas || []), ...plano.idsApagar])],
    updatedAt: serverTimestamp(),
  });
  plano.idsApagar.forEach(id => final.delete(doc(db, 'professores', id)));
  await final.commit();

  // Reservas de e-mail/telefone: as fichas apagadas soltam as delas e a que ficou reserva os dados finais.
  for (const o of outras) await liberarContatos({ professorId: String(o.id) }, { email: o.email, telefone: o.telefone, pais: o.pais }, { soltarTudo: true });
  await sincronizarContatos({
    dono: { professorId: String(plano.idPrincipal), uid: principal.uidLogin },
    antes: { email: principal.email, telefone: principal.telefone, pais: principal.pais },
    depois: {
      email: plano.completar.email ?? principal.email,
      telefone: plano.completar.telefone ?? principal.telefone,
      pais: plano.completar.pais ?? principal.pais,
    },
  });

  await Promise.all(plano.idsApagar.map(id => removerProfessorDaVitrine(id)));
  if (plano.completar.nome) await publicarProfessor(plano.idPrincipal, plano.completar.nome);

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

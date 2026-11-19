// Regras por unidade, Etapa 3: as coleções que não tinham regra própria.
// Auditorias: todos criam, só o admin edita/apaga · Financeiro e Loja: só admin e mentor (leitura e gravação) ·
// Play e Modalidades: só o admin grava · coleção desconhecida: só o admin grava.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, Timestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', nome: 'Prof', loginGoogle: true });
    for (const c of ['auditoria_cronograma', 'auditoria_configuracoes', 'auditoria_financeiro', 'indicadores_mensais', 'unipower_stock', 'unipower_workshops', 'unipower_transacoes', 'pratique_play_faixas', 'modalidades', 'qualquer_coisa']) {
      await setDoc(doc(db, `${c}/x1`), { nome: 'existente', valor: 10 });
    }
  });
});

const log = { tipoAcao: 'NOVA', descricao: 'teste', dataAcao: Timestamp.now() };

describe.each(['auditoria_cronograma', 'auditoria_configuracoes'])('%s', (colecao) => {
  it('todo mundo que está logado cria registro, inclusive o professor', async () => {
    for (const quem of ['admin1', 'mentor1', 'liderA', 'prof1']) {
      await assertSucceeds(addDoc(collection(como(quem), colecao), log));
    }
    await assertFails(addDoc(collection(anonimo(), colecao), log));
  });
  it('quem está logado lê; anônimo não', async () => {
    await assertSucceeds(getDocs(collection(como('prof1'), colecao)));
    await assertFails(getDocs(collection(anonimo(), colecao)));
  });
  it('só o admin edita ou apaga', async () => {
    for (const quem of ['mentor1', 'liderA', 'prof1']) {
      await assertFails(updateDoc(doc(como(quem), `${colecao}/x1`), { descricao: 'adulterado' }));
      await assertFails(deleteDoc(doc(como(quem), `${colecao}/x1`)));
    }
    await assertSucceeds(updateDoc(doc(como('admin1'), `${colecao}/x1`), { descricao: 'corrigido' }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), `${colecao}/x1`)));
  });
});

describe.each(['auditoria_financeiro', 'indicadores_mensais', 'unipower_stock', 'unipower_workshops', 'unipower_transacoes'])('%s (financeiro e loja)', (colecao) => {
  it('admin e mentor leem e gravam', async () => {
    for (const quem of ['admin1', 'mentor1']) {
      await assertSucceeds(getDoc(doc(como(quem), `${colecao}/x1`)));
      await assertSucceeds(setDoc(doc(como(quem), `${colecao}/novo_${quem}`), { valor: 1 }));
    }
    await assertSucceeds(updateDoc(doc(como('admin1'), `${colecao}/x1`), { valor: 11 }));
  });
  it('líder e professor não leem nem gravam', async () => {
    for (const quem of ['liderA', 'prof1']) {
      await assertFails(getDoc(doc(como(quem), `${colecao}/x1`)));
      await assertFails(getDocs(collection(como(quem), colecao)));
      await assertFails(setDoc(doc(como(quem), `${colecao}/novo`), { valor: 1 }));
      await assertFails(updateDoc(doc(como(quem), `${colecao}/x1`), { valor: 99 }));
      await assertFails(deleteDoc(doc(como(quem), `${colecao}/x1`)));
    }
    await assertFails(getDoc(doc(anonimo(), `${colecao}/x1`)));
  });
  it('quem tem cobertura de mentor passa a valer como mentor aqui também; vencida, não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios/liderA'), { coberturaMentorId: 'mentor1', coberturaAte: Timestamp.fromMillis(Date.now() + 86400000) });
    });
    await assertSucceeds(getDoc(doc(como('liderA'), `${colecao}/x1`)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios/liderA'), { coberturaAte: Timestamp.fromMillis(Date.now() - 1000) });
    });
    await assertFails(getDoc(doc(como('liderA'), `${colecao}/x1`)));
  });
});

describe('só o admin apaga auditoria financeira e indicadores', () => {
  it('mentor não apaga', async () => {
    await assertFails(deleteDoc(doc(como('mentor1'), 'auditoria_financeiro/x1')));
    await assertFails(updateDoc(doc(como('mentor1'), 'auditoria_financeiro/x1'), { valor: 1 }));
    await assertFails(deleteDoc(doc(como('mentor1'), 'indicadores_mensais/x1')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'indicadores_mensais/x1')));
  });
});

describe('Pratique Play e Modalidades', () => {
  it('faixas: quem está logado lê; só o admin grava', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), 'pratique_play_faixas/x1')));
    await assertSucceeds(getDoc(doc(como('prof1'), 'pratique_play_faixas/x1')));
    await assertFails(setDoc(doc(como('mentor1'), 'pratique_play_faixas/n1'), { titulo: 'a' }));
    await assertFails(deleteDoc(doc(como('liderA'), 'pratique_play_faixas/x1')));
    await assertSucceeds(setDoc(doc(como('admin1'), 'pratique_play_faixas/n1'), { titulo: 'a' }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'pratique_play_faixas/x1')));
  });
  it('modalidades: a página pública lê; só o admin grava', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'modalidades/x1')));
    for (const quem of ['mentor1', 'liderA', 'prof1']) {
      await assertFails(updateDoc(doc(como(quem), 'modalidades/x1'), { nome: 'X' }));
      await assertFails(setDoc(doc(como(quem), 'modalidades/novo'), { nome: 'N' }));
      await assertFails(deleteDoc(doc(como(quem), 'modalidades/x1')));
    }
    await assertSucceeds(updateDoc(doc(como('admin1'), 'modalidades/x1'), { nome: 'Y' }));
  });
});

describe('coleção desconhecida', () => {
  it('quem está logado lê; só o admin grava (restaurar backup)', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), 'qualquer_coisa/x1')));
    for (const quem of ['mentor1', 'liderA', 'prof1']) {
      await assertFails(setDoc(doc(como(quem), 'qualquer_coisa/novo'), { a: 1 }));
      await assertFails(updateDoc(doc(como(quem), 'qualquer_coisa/x1'), { a: 1 }));
      await assertFails(deleteDoc(doc(como(quem), 'qualquer_coisa/x1')));
    }
    await assertSucceeds(setDoc(doc(como('admin1'), 'qualquer_coisa/novo'), { a: 1 }));
  });
});

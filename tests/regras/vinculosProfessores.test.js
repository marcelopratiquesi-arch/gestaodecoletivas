// Regras por unidade, Etapa 2: vínculos (professor × unidade) e fichas de professores.
// Vínculo: admin, mentor da unidade e líder da unidade criam/apagam; só o admin edita.
// Ficha: mentor e líder só mexem nos campos de contato/login; apagar e o resto é do admin.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const vinculo = (db, id) => doc(db, `vinculos/${id}`);
const ficha = (db, id) => doc(db, `professores/${id}`);
const novoVinculo = (unidadeId, extra = {}) => ({ professorId: 'p1', unidadeId, status: 'ativo', createdAt: serverTimestamp(), ...extra });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2' });
    await setDoc(doc(db, 'usuarios/seg1'), { role: 'mentor', nome: 'Segundo', mentorPrincipalId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', nome: 'Prof', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'Unidade A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'Unidade B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'professores/p1'), { nome: 'Prof Um', email: 'p1@x.com', telefone: '1', pais: 'BR', status: 'ativo' });
    await setDoc(doc(db, 'vinculos/vA'), { professorId: 'p1', unidadeId: 'uniA', status: 'ativo' });
    await setDoc(doc(db, 'vinculos/vB'), { professorId: 'p1', unidadeId: 'uniB', status: 'ativo' });
  });
});

describe('vínculos: leitura', () => {
  it('quem está logado lê; anônimo não', async () => {
    await assertSucceeds(getDoc(vinculo(como('prof1'), 'vA')));
    await assertFails(getDoc(vinculo(env.unauthenticatedContext().firestore(), 'vA')));
  });
});

describe('vínculos: criar', () => {
  it('admin cria em qualquer unidade', async () => {
    await assertSucceeds(setDoc(vinculo(como('admin1'), 'n1'), novoVinculo('uniB')));
  });
  it('mentor cria só na unidade dele (1º e 2º mentor)', async () => {
    await assertSucceeds(setDoc(vinculo(como('mentor1'), 'n1'), novoVinculo('uniA')));
    await assertFails(setDoc(vinculo(como('mentor1'), 'n2'), novoVinculo('uniB')));
    await assertSucceeds(setDoc(vinculo(como('seg1'), 'n3'), novoVinculo('uniA')));
  });
  it('líder cria só na unidade dele', async () => {
    await assertSucceeds(setDoc(vinculo(como('liderA'), 'n1'), novoVinculo('uniA')));
    await assertFails(setDoc(vinculo(como('liderA'), 'n2'), novoVinculo('uniB')));
  });
  it('professor não cria; campos estranhos e unidade vazia não passam', async () => {
    await assertFails(setDoc(vinculo(como('prof1'), 'n1'), novoVinculo('uniA')));
    await assertFails(setDoc(vinculo(como('mentor1'), 'n2'), novoVinculo('uniA', { extra: 1 })));
    await assertFails(setDoc(vinculo(como('mentor1'), 'n3'), novoVinculo('')));
  });
});

describe('vínculos: apagar e editar', () => {
  it('mentor e líder apagam só da unidade deles; admin apaga qualquer', async () => {
    await assertSucceeds(deleteDoc(vinculo(como('mentor1'), 'vA')));
    await assertFails(deleteDoc(vinculo(como('mentor1'), 'vB')));
    await assertFails(deleteDoc(vinculo(como('liderA'), 'vB')));
    await assertSucceeds(deleteDoc(vinculo(como('liderB'), 'vB')));
    await assertSucceeds(deleteDoc(vinculo(como('admin1'), 'vA')));
  });
  it('professor não apaga', async () => {
    await assertFails(deleteDoc(vinculo(como('prof1'), 'vA')));
  });
  it('só o admin edita (juntar fichas move o vínculo)', async () => {
    await assertSucceeds(updateDoc(vinculo(como('admin1'), 'vA'), { professorId: 'p2' }));
    await assertFails(updateDoc(vinculo(como('mentor1'), 'vB'), { professorId: 'p9' }));
    await assertFails(updateDoc(vinculo(como('mentor1'), 'vA'), { unidadeId: 'uniB' }));
    await assertFails(updateDoc(vinculo(como('liderA'), 'vA'), { status: 'inativo' }));
  });
});

describe('fichas de professores', () => {
  it('mentor e líder editam contato, status, e-mail e o login da ficha', async () => {
    await assertSucceeds(updateDoc(ficha(como('mentor1'), 'p1'), { nome: 'Novo', telefone: '2', pais: 'AR', status: 'inativo', email: 'n@x.com', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ficha(como('liderA'), 'p1'), { uidLogin: 'abc', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ficha(como('mentor1'), 'p1'), { workshops: [{ id: 'w1' }] }));
  });
  it('mas não gravam campo fora da lista (ex.: apelido, fichasJuntadas, qualquer extra)', async () => {
    await assertFails(updateDoc(ficha(como('mentor1'), 'p1'), { fichasJuntadas: ['x'] }));
    await assertFails(updateDoc(ficha(como('liderA'), 'p1'), { nome: 'ok', campoQualquer: 1 }));
    await assertSucceeds(updateDoc(ficha(como('admin1'), 'p1'), { fichasJuntadas: ['x'], campoQualquer: 1 }));
  });
  it('cria ficha com os campos do cadastro; campo extra só o admin', async () => {
    const base = { nome: 'Novo', email: 'n@x.com', pais: 'BR', telefone: '3', status: 'ativo', createdAt: serverTimestamp(), createdBy: 'mentor1', roleCreator: 'mentor' };
    await assertSucceeds(setDoc(ficha(como('mentor1'), 'novo1'), base));
    await assertSucceeds(setDoc(ficha(como('liderA'), 'novo2'), base));
    await assertFails(setDoc(ficha(como('mentor1'), 'novo3'), { ...base, extra: 1 }));
    await assertSucceeds(setDoc(ficha(como('admin1'), 'novo4'), { ...base, extra: 1 }));
  });
  it('só o admin apaga ficha', async () => {
    await assertFails(deleteDoc(ficha(como('mentor1'), 'p1')));
    await assertFails(deleteDoc(ficha(como('liderA'), 'p1')));
    await assertFails(deleteDoc(ficha(como('prof1'), 'p1')));
    await assertSucceeds(deleteDoc(ficha(como('admin1'), 'p1')));
  });
  it('professor não grava ficha nenhuma; todos logados leem', async () => {
    await assertFails(updateDoc(ficha(como('prof1'), 'p1'), { nome: 'X' }));
    await assertSucceeds(getDoc(ficha(como('prof1'), 'p1')));
  });
  it('documentoOk continua exigindo o documento guardado na gaveta da ficha', async () => {
    await assertFails(updateDoc(ficha(como('mentor1'), 'p1'), { documentoOk: true }));
  });
});

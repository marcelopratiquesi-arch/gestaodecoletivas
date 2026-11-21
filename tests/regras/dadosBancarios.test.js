// Banco Inter do professor: gaveta privada dados_bancarios/{login}. Quem lê: a própria pessoa, o admin, o mentor e o líder
// da unidade dela. Grava: o professor (e o admin). Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const banco = (extra = {}) => ({ banco: 'inter', agencia: '0001', conta: '12345678', atualizadoEm: serverTimestamp(), ...extra });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profB'), { role: 'professor', unidadeId: 'uniB', nome: 'Prof B', loginGoogle: true });
  });
});

describe('gravar', () => {
  it('o professor grava, corrige e apaga o próprio; o admin também grava', async () => {
    const p = como('profA');
    await assertSucceeds(setDoc(doc(p, 'dados_bancarios/profA'), banco()));
    await assertSucceeds(setDoc(doc(p, 'dados_bancarios/profA'), banco({ conta: '99887766' })));
    await assertSucceeds(deleteDoc(doc(p, 'dados_bancarios/profA')));
    await assertSucceeds(setDoc(doc(como('admin1'), 'dados_bancarios/profA'), banco()));
  });
  it('NÃO grava o de outra pessoa; líder e mentor não gravam', async () => {
    await assertFails(setDoc(doc(como('profA'), 'dados_bancarios/profB'), banco()));
    await assertFails(setDoc(doc(como('liderA'), 'dados_bancarios/profA'), banco()));
    await assertFails(setDoc(doc(como('mentor1'), 'dados_bancarios/profA'), banco()));
    await assertFails(setDoc(doc(como('liderA'), 'dados_bancarios/liderA'), banco()));
  });
  it('recusa dado ruim: outro banco, agência/conta fora do formato, campo extra, hora inventada', async () => {
    const p = como('profA');
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ banco: 'itau' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ agencia: '12' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ agencia: '00A1' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ conta: '123' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ conta: '1234567-8' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ extra: 'x' })));
    await assertFails(setDoc(doc(p, 'dados_bancarios/profA'), banco({ atualizadoEm: new Date() })));
  });
});

describe('ler (quem paga vê; o resto não)', () => {
  const semear = () => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'dados_bancarios/profA'), { banco: 'inter', agencia: '0001', conta: '12345678' }));
  it('leem: o dono, o admin, o mentor e o líder da unidade dele', async () => {
    await semear();
    for (const quem of ['profA', 'admin1', 'mentor1', 'liderA']) await assertSucceeds(getDoc(doc(como(quem), 'dados_bancarios/profA')));
  });
  it('NÃO leem: mentor e líder de outra unidade, outro professor; e ninguém lista a coleção toda', async () => {
    await semear();
    for (const quem of ['mentor2', 'liderB', 'profB']) await assertFails(getDoc(doc(como(quem), 'dados_bancarios/profA')));
    await assertFails(getDocs(collection(como('profB'), 'dados_bancarios')));
    await assertFails(getDocs(collection(como('liderA'), 'dados_bancarios')));
  });
  it('só o dono e o admin apagam', async () => {
    await semear();
    await assertFails(deleteDoc(doc(como('liderA'), 'dados_bancarios/profA')));
    await assertFails(deleteDoc(doc(como('profB'), 'dados_bancarios/profA')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'dados_bancarios/profA')));
  });
});

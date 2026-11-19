// Telemetria de leituras (telemetria_leituras/{AAAA-MM-DD}_{uid}): cada pessoa grava só o próprio resumo do dia;
// só o admin lê; ninguém apaga.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'A', email: 'a@x.com' });
    await setDoc(doc(db, 'usuarios/lider1'), { role: 'lider', nome: 'L1', email: 'l1@x.com' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'P1', email: 'p1@x.com', loginGoogle: true });
    await setDoc(doc(db, 'telemetria_leituras/2026-11-17_lider1'), { dia: '2026-11-17', uid: 'lider1', papel: 'lider', total: 10, itens: {} });
  });
});

const resumo = (uid, extra = {}) => ({
  dia: '2026-11-17',
  uid,
  papel: 'lider',
  atualizadoEm: serverTimestamp(),
  total: increment(40),
  itens: { 'app~aulas': increment(30), 'app~unidades': increment(10) },
  ...extra,
});

describe('telemetria de leituras', () => {
  it('líder grava o próprio resumo do dia (cria e soma)', async () => {
    await assertSucceeds(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1'), resumo('lider1'), { merge: true }));
  });
  it('professor também grava o próprio resumo (a regra genérica não o deixaria)', async () => {
    await assertSucceeds(setDoc(doc(como('prof1'), 'telemetria_leituras/2026-11-17_prof1'), resumo('prof1', { papel: 'professor' }), { merge: true }));
  });
  it('não grava no documento de outra pessoa', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_prof1'), resumo('prof1'), { merge: true }));
  });
  it('não grava com uid diferente do próprio', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1'), resumo('prof1'), { merge: true }));
  });
  it('não aceita hora inventada (só a do servidor)', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1'), resumo('lider1', { atualizadoEm: new Date('2020-01-01') }), { merge: true }));
  });
  it('não aceita campo extra', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1'), resumo('lider1', { extra: 1 }), { merge: true }));
  });
  it('não aceita total negativo', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1'), resumo('lider1', { total: increment(-500) }), { merge: true }));
  });
  it('quem não está logado não grava', async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'telemetria_leituras/2026-11-17_lider1'), resumo('lider1'), { merge: true }));
  });
  it('admin lê; líder e professor não leem', async () => {
    await assertSucceeds(getDoc(doc(como('admin1'), 'telemetria_leituras/2026-11-17_lider1')));
    await assertFails(getDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1')));
    await assertFails(getDoc(doc(como('prof1'), 'telemetria_leituras/2026-11-17_lider1')));
  });
  it('ninguém apaga (nem o próprio, nem o admin)', async () => {
    await assertFails(deleteDoc(doc(como('lider1'), 'telemetria_leituras/2026-11-17_lider1')));
    await assertFails(deleteDoc(doc(como('admin1'), 'telemetria_leituras/2026-11-17_lider1')));
  });
});

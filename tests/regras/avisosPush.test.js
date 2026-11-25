// Avisos push: cada pessoa grava/lê/apaga SÓ os aparelhos dela; histórico de avisos só o admin lê e ninguém grava pelo site.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

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
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', nome: 'Prof', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof2'), { role: 'professor', professorId: 'p2', nome: 'Prof 2', loginGoogle: true });
    await setDoc(doc(db, 'push_aparelhos/prof2_abc'), { uid: 'prof2', token: 'x'.repeat(60), plataforma: 'android' });
    await setDoc(doc(db, 'avisos_enviados/a1'), { titulo: 'Oi', texto: 'Oi' });
  });
});

const aparelho = (uid) => ({ uid, token: 't'.repeat(60), plataforma: 'android', atualizadoEm: serverTimestamp() });

describe('push_aparelhos', () => {
  it('a pessoa grava, relê e apaga o PRÓPRIO aparelho', async () => {
    const db = como('prof1');
    await assertSucceeds(setDoc(doc(db, 'push_aparelhos/prof1_abc'), aparelho('prof1')));
    await assertSucceeds(setDoc(doc(db, 'push_aparelhos/prof1_abc'), aparelho('prof1')));
    await assertSucceeds(getDoc(doc(db, 'push_aparelhos/prof1_abc')));
    await assertSucceeds(deleteDoc(doc(db, 'push_aparelhos/prof1_abc')));
  });
  it('não grava em nome de outra pessoa nem com id de outra', async () => {
    const db = como('prof1');
    await assertFails(setDoc(doc(db, 'push_aparelhos/prof2_zzz'), aparelho('prof2')));
    await assertFails(setDoc(doc(db, 'push_aparelhos/prof1_zzz'), aparelho('prof2')));
  });
  it('não lê nem apaga aparelho dos outros (nem o admin pelo site)', async () => {
    for (const quem of ['prof1', 'admin1']) {
      const db = como(quem);
      await assertFails(getDoc(doc(db, 'push_aparelhos/prof2_abc')));
      await assertFails(deleteDoc(doc(db, 'push_aparelhos/prof2_abc')));
      await assertFails(getDocs(collection(db, 'push_aparelhos')));
    }
  });
  it('não aceita campo extra', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'push_aparelhos/prof1_abc'), { ...aparelho('prof1'), role: 'admin' }));
  });
});

describe('avisos_enviados', () => {
  it('só o admin lê; ninguém grava pelo site', async () => {
    await assertSucceeds(getDoc(doc(como('admin1'), 'avisos_enviados/a1')));
    await assertFails(getDoc(doc(como('prof1'), 'avisos_enviados/a1')));
    await assertFails(setDoc(doc(como('admin1'), 'avisos_enviados/novo'), { titulo: 'x' }));
  });
});

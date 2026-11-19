// Tabela de preços (tabela_precos/atual): admin, mentor e líder leem; professor NÃO lê; só o admin grava.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const ref = (uid) => doc(como(uid), 'tabela_precos/atual');

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'A', email: 'a@x.com' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M', status: 'ativo', email: 'm@x.com' });
    await setDoc(doc(db, 'usuarios/lider1'), { role: 'lider', nome: 'L', email: 'l@x.com' });
    await setDoc(doc(db, 'usuarios/unid1'), { role: 'unidade', nome: 'U', email: 'u@x.com' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'P', email: 'p@x.com' });
    await setDoc(doc(db, 'usuarios/bloq1'), { role: 'bloqueado', nome: 'B', email: 'b@x.com' });
    await setDoc(doc(db, 'tabela_precos/atual'), { precos: { core20: { cinza: { qualquer: 10 } } } });
  });
});

const dados = () => ({ precos: { core20: { cinza: { qualquer: 11 } } }, atualizadoEm: serverTimestamp() });

describe('tabela de preços', () => {
  it('admin, mentor e líder leem', async () => {
    await assertSucceeds(getDoc(ref('admin1')));
    await assertSucceeds(getDoc(ref('mentor1')));
    await assertSucceeds(getDoc(ref('lider1')));
    await assertSucceeds(getDoc(ref('unid1'))); // papel antigo de líder
  });
  it('professor não lê (valores de pagamento)', async () => {
    await assertFails(getDoc(ref('prof1')));
  });
  it('bloqueado e quem não está logado não leem', async () => {
    await assertFails(getDoc(ref('bloq1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'tabela_precos/atual')));
  });
  it('só o admin grava', async () => {
    await assertSucceeds(setDoc(ref('admin1'), dados()));
    await assertFails(setDoc(ref('mentor1'), dados()));
    await assertFails(setDoc(ref('lider1'), dados()));
    await assertFails(setDoc(ref('prof1'), dados()));
  });
  it('mentor e líder não apagam', async () => {
    await assertFails(deleteDoc(ref('mentor1')));
    await assertFails(deleteDoc(ref('lider1')));
  });
  it('a regra genérica não libera a coleção (outro documento, mesmo caminho de coleção)', async () => {
    await assertFails(getDoc(doc(como('prof1'), 'tabela_precos/outro')));
    await assertFails(setDoc(doc(como('mentor1'), 'tabela_precos/outro'), dados()));
  });
});

// "Último acesso" (usuarios/{uid}.ultimoAcesso): a própria pessoa carimba só esse campo, com a hora do servidor.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', email: 'm1@x.com' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo', email: 'm2@x.com' });
    await setDoc(doc(db, 'usuarios/mentorInativo'), { role: 'mentor', nome: 'MI', status: 'inativo' });
  });
});

describe('último acesso', () => {
  it('mentor carimba o próprio último acesso com a hora do servidor', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { ultimoAcesso: serverTimestamp() }));
  });
  it('não carimba o de outra pessoa', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor2'), { ultimoAcesso: serverTimestamp() }));
  });
  it('não aceita hora inventada (só a do servidor)', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { ultimoAcesso: new Date('2020-01-01') }));
  });
  it('não aceita mexer em outro campo junto', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { ultimoAcesso: serverTimestamp(), role: 'admin' }));
  });
});

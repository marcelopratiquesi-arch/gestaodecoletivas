// Cadastro de workshops (workshops_cadastro/{id}): só admin e mentor leem e gravam; dados válidos;
// workshop com participantes não é apagado.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'A', email: 'a@x.com' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M', email: 'm@x.com' });
    await setDoc(doc(db, 'usuarios/lider1'), { role: 'lider', nome: 'L', email: 'l@x.com' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'P', email: 'p@x.com', loginGoogle: true });
    await setDoc(doc(db, 'workshops_cadastro/w1'), { nome: 'Workshop de Power Core', modalidade: 'Power Core', data: '2023-07-01', local: 'Pratique Palhoça', status: 'realizado', totalParticipantes: 0 });
    await setDoc(doc(db, 'workshops_cadastro/w2'), { nome: 'Power Training', modalidade: 'Power Training', data: '2026-02-07', status: 'realizado', totalParticipantes: 3 });
  });
});

const novo = (extra = {}) => ({
  nome: 'Workshop de Power Core – Santa Catarina 2023', modalidade: 'Power Core', data: '2023-07-01',
  local: 'Pratique Palhoça', status: 'realizado', totalParticipantes: 0, criadoEm: serverTimestamp(), criadoPor: 'admin1', ...extra,
});

describe('workshops_cadastro', () => {
  it('admin e mentor leem', async () => {
    await assertSucceeds(getDoc(doc(como('admin1'), 'workshops_cadastro/w1')));
    await assertSucceeds(getDoc(doc(como('mentor1'), 'workshops_cadastro/w1')));
  });
  it('líder, professor e visitante não leem', async () => {
    await assertFails(getDoc(doc(como('lider1'), 'workshops_cadastro/w1')));
    await assertFails(getDoc(doc(como('prof1'), 'workshops_cadastro/w1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'workshops_cadastro/w1')));
  });
  it('admin e mentor criam workshop válido', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo()));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'workshops_cadastro/n2'), novo()));
  });
  it('líder e professor não criam (nem pela regra geral)', async () => {
    await assertFails(setDoc(doc(como('lider1'), 'workshops_cadastro/n1'), novo()));
    await assertFails(setDoc(doc(como('prof1'), 'workshops_cadastro/n1'), novo()));
  });
  it('recusa modalidade, situação, data e campo inválidos', async () => {
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ modalidade: 'Zumba' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ status: 'sei la' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ data: '1/7/2023' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ nome: 'ab' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ campoExtra: 1 })));
  });
  it('aceita Power Dance e Power Bumbum', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/n1'), novo({ modalidade: 'Power Dance' })));
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/n2'), novo({ modalidade: 'Power Bumbum' })));
  });
  it('admin e mentor editam a situação', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'workshops_cadastro/w1'), { status: 'cancelado' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'workshops_cadastro/w1'), { status: 'nada' }));
  });
  it('apaga workshop sem participantes; bloqueia o que tem participantes', async () => {
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'workshops_cadastro/w1')));
    await assertFails(deleteDoc(doc(como('admin1'), 'workshops_cadastro/w2')));
    await assertFails(deleteDoc(doc(como('lider1'), 'workshops_cadastro/w1')));
  });
});

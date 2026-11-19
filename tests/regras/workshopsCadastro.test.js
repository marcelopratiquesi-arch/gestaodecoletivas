// Cadastro de workshops (workshops_cadastro/{id}): só admin e mentor leem e gravam; dados válidos;
// workshop com participantes não é apagado.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

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
  it('líder e visitante não leem; o professor lê (para escolher o workshop em Meus workshops)', async () => {
    await assertFails(getDoc(doc(como('lider1'), 'workshops_cadastro/w1')));
    await assertSucceeds(getDoc(doc(como('prof1'), 'workshops_cadastro/w1')));
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
  it('só o admin muda o contador de participantes (mentor não)', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'workshops_cadastro/w1'), { totalParticipantes: 5 }));
    await assertFails(updateDoc(doc(como('mentor1'), 'workshops_cadastro/w2'), { totalParticipantes: 0 }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'workshops_cadastro/w2'), { status: 'cancelado' }));
    await assertFails(setDoc(doc(como('mentor1'), 'workshops_cadastro/n9'), novo({ totalParticipantes: 7 })));
  });
});

describe('workshops_cadastro/participantes', () => {
  const part = (extra = {}) => ({
    nome: 'Ana Exemplo', email: 'ana@exemplo.com', telefone: '(48) 99999-1111', professorIds: ['10', '11'],
    status: 'ligado', origem: 'importacao', criadoEm: serverTimestamp(), criadoPor: 'admin1', ...extra,
  });
  it('só o admin lê e grava (mentor, líder e professor não)', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/e_ana'), part()));
    await assertSucceeds(getDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/e_ana')));
    for (const quem of ['mentor1', 'lider1', 'prof1']) {
      await assertFails(getDoc(doc(como(quem), 'workshops_cadastro/w1/participantes/e_ana')));
      await assertFails(setDoc(doc(como(quem), 'workshops_cadastro/w1/participantes/e_x'), part()));
    }
  });
  it('recusa situação, origem e campo inválidos', async () => {
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/a'), part({ status: 'outro' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/a'), part({ origem: 'x' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/a'), part({ cpf: '123' })));
    await assertFails(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/a'), part({ professorIds: 'x' })));
  });
  it('importar de novo (merge) atualiza sem erro e o admin remove', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/e_ana'), part()));
    await assertSucceeds(setDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/e_ana'), { status: 'sem-cadastro', professorIds: [], atualizadoEm: serverTimestamp() }, { merge: true }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'workshops_cadastro/w1/participantes/e_ana')));
  });
  it('lote da importação: participantes + workshop em professores + contador', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const id of ['10', '11']) await setDoc(doc(ctx.firestore(), `professores/${id}`), { nome: `P${id}`, documentoOk: true });
      for (const id of ['10', '11']) await setDoc(doc(ctx.firestore(), `documentos_ficha/${id}`), { tipo: 'cpf', numero: '1' });
    });
    const db = como('admin1');
    const lote = writeBatch(db);
    lote.set(doc(db, 'workshops_cadastro/w1/participantes/e_ana'), part(), { merge: true });
    lote.update(doc(db, 'professores/10'), { workshops: [{ id: 'wk_w1', nome: 'W', data: '2023-07-01' }] });
    lote.update(doc(db, 'professores/11'), { workshops: [{ id: 'wk_w1', nome: 'W', data: '2023-07-01' }] });
    lote.update(doc(db, 'workshops_cadastro/w1'), { totalParticipantes: 1, atualizadoEm: serverTimestamp() });
    await assertSucceeds(lote.commit());
  });
});

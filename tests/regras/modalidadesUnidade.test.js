// Modalidades habilitadas por unidade: só o admin altera "modalidadesIds"; mentor cria unidade só com a lista básica.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.PORTA_EMULADOR || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', modalidadesIds: ['m1', 'm2'] });
    await setDoc(doc(db, 'unidades/uniSemCampo'), { nome: 'Antiga', mentorId: 'mentor1' });
    await setDoc(doc(db, 'configuracoes/modalidadesBasicas'), { ids: ['m1', 'm2', 'm3'] });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();

describe('unidades: alterar modalidadesIds', () => {
  it('admin altera', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'unidades/uniA'), { modalidadesIds: ['m1', 'm2', 'm9'] }));
    await assertSucceeds(updateDoc(doc(como('admin1'), 'unidades/uniSemCampo'), { modalidadesIds: ['m1'] }));
  });
  it('mentor, líder e professor não alteram nem criam o campo', async () => {
    for (const uid of ['mentor1', 'liderA', 'prof1']) {
      await assertFails(updateDoc(doc(como(uid), 'unidades/uniA'), { modalidadesIds: ['m1', 'm9'] }));
      await assertFails(updateDoc(doc(como(uid), 'unidades/uniSemCampo'), { modalidadesIds: ['m1'] }));
      await assertFails(updateDoc(doc(como(uid), 'unidades/uniA'), { modalidadesAtualizadoPor: 'x' }));
    }
  });
  it('mentor continua editando os outros campos da unidade', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'unidades/uniA'), { telefone: '11999990000' }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'unidades/uniSemCampo'), { status: 'inativa' }));
  });
  it('professor não edita a unidade; todos os logados leem', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'unidades/uniA'), { telefone: '1' }));
    for (const uid of ['prof1', 'liderA', 'mentor1', 'admin1']) await assertSucceeds(getDoc(doc(como(uid), 'unidades/uniA')));
  });
});

describe('unidades: criar', () => {
  it('admin cria com qualquer lista', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'unidades/novaA'), { nome: 'N', modalidadesIds: ['m9'] }));
  });
  it('mentor cria sem o campo ou só com modalidades da lista básica', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'unidades/n1'), { nome: 'N', mentorId: 'mentor1' }));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'unidades/n2'), { nome: 'N', mentorId: 'mentor1', modalidadesIds: ['m1', 'm3'] }));
  });
  it('mentor não cria com modalidade fora da lista básica', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'unidades/n3'), { nome: 'N', mentorId: 'mentor1', modalidadesIds: ['m1', 'm9'] }));
  });
  it('mentor não cria com o campo se a lista básica ainda não existe', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('configuracoes/modalidadesBasicas').delete(); });
    await assertFails(setDoc(doc(como('mentor1'), 'unidades/n4'), { nome: 'N', mentorId: 'mentor1', modalidadesIds: ['m1'] }));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'unidades/n5'), { nome: 'N', mentorId: 'mentor1' }));
  });
  it('professor não cria unidade', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'unidades/n6'), { nome: 'N' }));
  });
});

describe('configuracoes/modalidadesBasicas', () => {
  it('só o admin grava; logados leem', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'configuracoes/modalidadesBasicas'), { ids: ['m1'] }));
    for (const uid of ['mentor1', 'liderA', 'prof1']) {
      await assertFails(setDoc(doc(como(uid), 'configuracoes/modalidadesBasicas'), { ids: ['m1', 'm9'] }));
      await assertSucceeds(getDoc(doc(como(uid), 'configuracoes/modalidadesBasicas')));
    }
  });
});

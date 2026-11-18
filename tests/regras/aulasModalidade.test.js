// Aula só nasce (ou troca de modalidade) numa modalidade habilitada na unidade. Admin fica de fora.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.PORTA_EMULADOR || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

// uniA: configurada (só m1 e m2). uniNova: ainda sem o campo. Aula antiga em m9 (já desabilitada) na uniA.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', modalidadesIds: ['m1', 'm2'] });
    await setDoc(doc(db, 'unidades/uniNova'), { nome: 'N', mentorId: 'mentor1' });
    await setDoc(doc(db, 'aulas/antiga'), { unidadeId: 'uniA', modalidadeId: 'm9', professorId: 'p1', hora: '19:00', valor: 30, dias: ['Segunda'] });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const nova = (unidadeId, modalidadeId) => ({ unidadeId, modalidadeId, professorId: 'p1', hora: '18:00', valor: 30, dias: ['Terça'] });

describe('aulas: modalidade habilitada na unidade', () => {
  it('mentor e líder criam em modalidade habilitada', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'aulas/n1'), nova('uniA', 'm1')));
    await assertSucceeds(setDoc(doc(como('liderA'), 'aulas/n2'), nova('uniA', 'm2')));
  });
  it('mentor e líder não criam em modalidade desabilitada', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'aulas/n3'), nova('uniA', 'm3')));
    await assertFails(setDoc(doc(como('liderA'), 'aulas/n4'), nova('uniA', 'm3')));
  });
  it('unidade ainda sem o campo aceita qualquer modalidade', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'aulas/n5'), nova('uniNova', 'm3')));
  });
  it('admin cria em qualquer modalidade', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'aulas/n6'), nova('uniA', 'm3')));
  });
  it('professor continua sem criar', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'aulas/n7'), nova('uniA', 'm1')));
  });
});

describe('aulas: editar', () => {
  it('aula antiga em modalidade desabilitada continua editável (hora, valor)', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'aulas/antiga'), { hora: '20:00', valor: 35 }));
    await assertSucceeds(updateDoc(doc(como('liderA'), 'aulas/antiga'), { dataFim: '2026-12-31' }));
  });
  it('trocar para modalidade habilitada passa; para desabilitada não', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'aulas/antiga'), { modalidadeId: 'm1' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'aulas/antiga'), { modalidadeId: 'm3' }));
  });
  it('admin troca para qualquer modalidade', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'aulas/antiga'), { modalidadeId: 'm3' }));
  });
});

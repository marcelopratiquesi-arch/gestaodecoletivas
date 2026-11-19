// Mentor temporário = COBERTURA: acesso extra às unidades de outro mentor, com data de fim.
// O papel de verdade não muda; passou o prazo, a pessoa volta sozinha ao que era (líder continua líder; mentor fica só com as unidades dele).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteField, Timestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const DIA = 24 * 60 * 60 * 1000;
const daqui = (dias) => Timestamp.fromMillis(Date.now() + dias * DIA);
const como = (uid) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2' });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'Unidade A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'Unidade B', mentorId: 'mentor2' });
  });
});

const dar = (uid, mentorId, ate = daqui(60)) => env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), `usuarios/${uid}`), { coberturaMentorId: mentorId, coberturaAte: ate, coberturaDesde: Timestamp.now() });
});
// Ação que só o mentor da unidade faz: criar o crachá de um líder para ela.
const novoLider = (db, id, unidade) => setDoc(doc(db, `usuarios/${id}`), { role: 'lider', unidadeId: unidade, unidadeIds: [unidade], nome: 'Novo Líder' });

describe('o admin concede a cobertura', () => {
  it('só o admin grava os campos de cobertura', async () => {
    const campos = { coberturaMentorId: 'mentor1', coberturaAte: daqui(60), coberturaDesde: Timestamp.now() };
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/mentor2'), campos));
    await assertFails(updateDoc(doc(como('mentor2'), 'usuarios/mentor2'), campos)); // ninguém se concede
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor2'), campos)); // nem o mentor concede
    await assertFails(updateDoc(doc(como('liderB'), 'usuarios/liderB'), campos));
  });
  it('quem não é admin não cria crachá já com cobertura', async () => {
    const extra = { coberturaMentorId: 'mentor2', coberturaAte: daqui(60) };
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/novoProf'), { role: 'professor', loginGoogle: true, ...extra }));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'usuarios/novoProf'), { role: 'professor', loginGoogle: true }));
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/novoLider'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], ...extra }));
  });
});

describe('mentor que já tem unidades: continua com as dele e ganha as do outro', () => {
  it('antes da cobertura só mexe nas unidades dele', async () => {
    await assertSucceeds(novoLider(como('mentor2'), 'l1', 'uniB'));
    await assertFails(novoLider(como('mentor2'), 'l2', 'uniA'));
  });
  it('com a cobertura mexe nas duas', async () => {
    await dar('mentor2', 'mentor1');
    await assertSucceeds(novoLider(como('mentor2'), 'l1', 'uniB'));
    await assertSucceeds(novoLider(como('mentor2'), 'l2', 'uniA'));
  });
  it('a cobertura não vale para unidades de um terceiro mentor', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'unidades/uniC'), { nome: 'C', mentorId: 'mentor3' }); });
    await dar('mentor2', 'mentor1');
    await assertFails(novoLider(como('mentor2'), 'l3', 'uniC'));
  });
  it('vencida: volta só às unidades dele, sem perder o acesso', async () => {
    await dar('mentor2', 'mentor1', daqui(-1));
    await assertSucceeds(getDoc(doc(como('mentor2'), 'unidades/uniA')));
    await assertFails(novoLider(como('mentor2'), 'l2', 'uniA'));
    await assertSucceeds(novoLider(como('mentor2'), 'l1', 'uniB'));
  });
});

describe('líder com cobertura: age como mentor e depois volta a ser líder', () => {
  it('com a cobertura faz coisa de mentor nas unidades cobertas; vencida, não', async () => {
    await assertFails(novoLider(como('liderB'), 'l1', 'uniA'));
    await dar('liderB', 'mentor1');
    await assertSucceeds(novoLider(como('liderB'), 'l1', 'uniA'));
    await dar('liderB', 'mentor1', daqui(-1));
    await assertFails(novoLider(como('liderB'), 'l2', 'uniA'));
  });
  it('o papel de verdade não muda: continua líder e logado depois do prazo', async () => {
    await dar('liderB', 'mentor1', daqui(-1));
    await assertSucceeds(getDoc(doc(como('liderB'), 'unidades/uniB')));
  });
  it('o admin prorroga e encerra', async () => {
    await dar('liderB', 'mentor1');
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/liderB'), { coberturaAte: daqui(365) }));
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/liderB'), { coberturaMentorId: deleteField(), coberturaAte: deleteField(), coberturaDesde: deleteField() }));
    await assertFails(novoLider(como('liderB'), 'l1', 'uniA'));
  });
});

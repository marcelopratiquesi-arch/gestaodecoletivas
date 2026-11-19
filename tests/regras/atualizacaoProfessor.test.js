// Atualização de contrato (CLT/Saver) pedida pelo professor em "Meu cadastro": o líder da unidade, o mentor dela ou o
// admin conferem; aprovado, quem aprova grava a ficha. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const saver = { tipoContrato: 'saver', saverLocais: [{ unidadeId: 'uniA', horarios: [{ dia: 1, ini: '06:00', fim: '10:00' }] }] };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A' });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B' });
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profB'), { role: 'professor', unidadeId: 'uniB', nome: 'Prof B', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profSem'), { role: 'professor', nome: 'Prof Sem', loginGoogle: true });
    await setDoc(doc(db, 'professores/fichaA'), { nome: 'PROF A', uidLogin: 'profA', status: 'ativo' });
    await setDoc(doc(db, 'professores/fichaSem'), { nome: 'PROF SEM', uidLogin: 'profSem', status: 'ativo' });
    await setDoc(doc(db, 'vinculos/vSem'), { professorId: 'fichaSem', unidadeId: 'uniA' });
  });
});

const dados = (uid, extra = {}) => ({ uid, nome: 'Prof A', unidadeId: 'uniA', ...saver, status: 'pendente', criadoEm: serverTimestamp(), ...extra });
const pedir = (uid, extra = {}) => setDoc(doc(como(uid), 'atualizacoes_professor', uid), dados(uid, extra));
const semear = (extra = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'atualizacoes_professor/profA'), { ...dados('profA'), criadoEm: new Date(), ...extra });
});
const ref = (uid, quem = uid) => doc(como(quem), 'atualizacoes_professor', uid);
const decisao = (status, extra = {}) => ({ status, analisadoPor: 'x', analisadoPorNome: 'X', analisadoEm: serverTimestamp(), ...extra });

describe('professor pede a mudança', () => {
  it('pede Saver (e CLT) para a própria unidade', async () => {
    await assertSucceeds(pedir('profA'));
    await assertSucceeds(pedir('profA', { tipoContrato: 'clt', saverLocais: [] }));
  });
  it('NÃO pede em nome de outro, para outra unidade, nem com dado ruim', async () => {
    await assertFails(setDoc(doc(como('profA'), 'atualizacoes_professor/profB'), dados('profB', { unidadeId: 'uniB' })));
    await assertFails(pedir('profA', { unidadeId: 'uniB' }));
    await assertFails(pedir('profA', { tipoContrato: 'estagio' }));
    await assertFails(pedir('profA', { tipoContrato: 'saver', saverLocais: [] }));
    await assertFails(pedir('profA', { tipoContrato: 'clt', saverLocais: saver.saverLocais }));
    await assertFails(pedir('profA', { status: 'aprovado' }));
    await assertFails(pedir('profA', { analisadoPor: 'profA' }));
  });
  it('crachá antigo sem unidade usa o vínculo dele', async () => {
    await assertSucceeds(pedir('profSem', { nome: 'Prof Sem', vinculoId: 'vSem' }));
    await assertFails(pedir('profSem', { nome: 'Prof Sem', vinculoId: 'vSem', unidadeId: 'uniB' }));
    await assertFails(pedir('profSem', { nome: 'Prof Sem' }));
  });
  it('líder, mentor e admin NÃO pedem (é do professor)', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'atualizacoes_professor/liderA'), dados('liderA')));
    await assertFails(setDoc(doc(como('mentor1'), 'atualizacoes_professor/mentor1'), dados('mentor1')));
  });
  it('pode trocar o pedido e desistir', async () => {
    await semear();
    await assertSucceeds(pedir('profA', { tipoContrato: 'clt', saverLocais: [] }));
    await assertSucceeds(deleteDoc(ref('profA')));
  });
});

describe('quem lê e decide', () => {
  beforeEach(async () => { await semear(); });
  it('o dono, o líder, o mentor da unidade e o admin leem; os de outra unidade não', async () => {
    for (const uid of ['profA', 'liderA', 'mentor1', 'admin1']) await assertSucceeds(getDoc(ref('profA', uid)));
    for (const uid of ['profB', 'liderB', 'mentor2']) await assertFails(getDoc(ref('profA', uid)));
  });
  it('líder, mentor e admin da unidade aprovam ou recusam; outros não; o dono não se aprova', async () => {
    for (const uid of ['liderA', 'mentor1', 'admin1']) {
      await semear();
      await assertSucceeds(updateDoc(ref('profA', uid), decisao('aprovado')));
    }
    await semear();
    await assertFails(updateDoc(ref('profA', 'liderB'), decisao('aprovado')));
    await assertFails(updateDoc(ref('profA', 'mentor2'), decisao('aprovado')));
    await assertFails(updateDoc(ref('profA', 'profA'), decisao('aprovado')));
    await assertSucceeds(updateDoc(ref('profA', 'liderA'), decisao('recusado', { motivo: 'horário errado' })));
  });
  it('quem decide não muda o conteúdo do pedido', async () => {
    await assertFails(updateDoc(ref('profA', 'liderA'), decisao('aprovado', { tipoContrato: 'clt' })));
  });
  it('aprovar grava a ficha do professor e fecha o pedido, num lote só', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.update(doc(db, 'professores', 'fichaA'), { tipoContrato: 'saver', saverLocais: saver.saverLocais, updatedAt: serverTimestamp() });
    b.update(doc(db, 'atualizacoes_professor', 'profA'), decisao('aprovado'));
    await assertSucceeds(b.commit());
  });
  it('o professor NÃO grava a própria ficha para mudar o contrato', async () => {
    await assertFails(updateDoc(doc(como('profA'), 'professores', 'fichaA'), { tipoContrato: 'clt' }));
  });
});

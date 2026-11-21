// Meu cadastro do professor: pedir mudança de MODALIDADES (junto com o contrato, com aprovação) e pedir UNIDADE NOVA
// (aprovado = vínculo na grade). Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';

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
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profB'), { role: 'professor', unidadeId: 'uniB', nome: 'Prof B', loginGoogle: true });
    await setDoc(doc(db, 'professores/fichaA'), { nome: 'PROF A', uidLogin: 'profA', status: 'ativo', tipoContrato: 'clt', saverLocais: [] });
  });
});

describe('modalidades junto com o pedido de atualização', () => {
  const pedido = (extra = {}) => ({ uid: 'profA', nome: 'Prof A', unidadeId: 'uniA', tipoContrato: 'clt', saverLocais: [], status: 'pendente', criadoEm: serverTimestamp(), ...extra });
  it('o professor pede com modalidades; sem modalidades também vale', async () => {
    const p = como('profA');
    await assertSucceeds(setDoc(doc(p, 'atualizacoes_professor/profA'), pedido({ modalidades: 'Zumba, Pilates' })));
    await assertSucceeds(setDoc(doc(p, 'atualizacoes_professor/profA'), pedido()));
  });
  it('recusa modalidades que não são texto ou passam de 300 letras', async () => {
    const p = como('profA');
    await assertFails(setDoc(doc(p, 'atualizacoes_professor/profA'), pedido({ modalidades: ['Zumba'] })));
    await assertFails(setDoc(doc(p, 'atualizacoes_professor/profA'), pedido({ modalidades: 'x'.repeat(301) })));
  });
  it('o professor NÃO grava modalidades direto na ficha; o líder da unidade e o mentor gravam (aprovação)', async () => {
    await assertFails(updateDoc(doc(como('profA'), 'professores/fichaA'), { modalidades: 'Zumba' }));
    await assertSucceeds(updateDoc(doc(como('liderA'), 'professores/fichaA'), { modalidades: 'Zumba, Pilates', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'professores/fichaA'), { modalidades: 'Zumba' }));
  });
});

describe('pedido de unidade nova do professor', () => {
  const pedido = (uid, unidadeId, extra = {}) => ({ uid, nome: 'Prof A', professorId: 'fichaA', unidadeId, unidadeNome: 'B', status: 'pendente', criadoEm: serverTimestamp(), ...extra });
  const decisao = (uid, status) => ({ status, analisadoPor: uid, analisadoPorNome: uid, analisadoEm: serverTimestamp() });

  it('o professor pede e desiste; não pede em nome de outro nem já aprovado', async () => {
    const p = como('profA');
    await assertSucceeds(setDoc(doc(p, 'pedidos_unidade_professor/profA_uniB'), pedido('profA', 'uniB')));
    await assertSucceeds(deleteDoc(doc(p, 'pedidos_unidade_professor/profA_uniB')));
    await assertFails(setDoc(doc(p, 'pedidos_unidade_professor/profB_uniB'), pedido('profB', 'uniB')));
    await assertFails(setDoc(doc(p, 'pedidos_unidade_professor/profA_uniB'), pedido('profA', 'uniB', { status: 'aprovado' })));
    await assertFails(setDoc(doc(p, 'pedidos_unidade_professor/profA_uniZ'), pedido('profA', 'uniZ')));
  });
  it('quem não é professor não pede', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'pedidos_unidade_professor/liderA_uniB'), pedido('liderA', 'uniB')));
  });
  it('só o mentor/líder da unidade PEDIDA e o admin leem e decidem; os de outra unidade não', async () => {
    await assertSucceeds(setDoc(doc(como('profA'), 'pedidos_unidade_professor/profA_uniB'), pedido('profA', 'uniB')));
    const ref = (c) => doc(como(c), 'pedidos_unidade_professor/profA_uniB');
    await assertFails(updateDoc(ref('mentor1'), decisao('mentor1', 'recusado')));
    await assertFails(updateDoc(ref('liderA'), decisao('liderA', 'recusado')));
    await assertSucceeds(updateDoc(ref('liderB'), decisao('liderB', 'recusado')));
    // já decidido: ninguém decide de novo
    await assertFails(updateDoc(ref('mentor2'), decisao('mentor2', 'aprovado')));
    await assertFails(getDoc(doc(como('profB'), 'pedidos_unidade_professor/profA_uniB')));
    await assertSucceeds(getDoc(doc(como('profA'), 'pedidos_unidade_professor/profA_uniB')));
  });
  it('a lista de pendentes funciona por unidade (líder/mentor) e para o admin; o professor lê só os dele', async () => {
    await assertSucceeds(setDoc(doc(como('profA'), 'pedidos_unidade_professor/profA_uniB'), pedido('profA', 'uniB')));
    const col = (c) => collection(como(c), 'pedidos_unidade_professor');
    await assertSucceeds(getDocs(query(col('liderB'), where('unidadeId', 'in', ['uniB']), where('status', '==', 'pendente'))));
    await assertSucceeds(getDocs(query(col('mentor2'), where('unidadeId', 'in', ['uniB']), where('status', '==', 'pendente'))));
    await assertSucceeds(getDocs(query(col('admin1'), where('status', '==', 'pendente'))));
    await assertSucceeds(getDocs(query(col('profA'), where('uid', '==', 'profA'))));
    // professor de outra pessoa: a listagem sem filtro pelo próprio login é negada
    await assertFails(getDocs(query(col('profB'), where('unidadeId', 'in', ['uniB']))));
  });
  it('aprovado: o líder/mentor da unidade cria o vínculo na grade, junto com a decisão', async () => {
    await assertSucceeds(setDoc(doc(como('profA'), 'pedidos_unidade_professor/profA_uniB'), pedido('profA', 'uniB')));
    const l = como('liderB');
    const b = writeBatch(l);
    b.set(doc(l, 'vinculos/vinc1'), { professorId: 'fichaA', unidadeId: 'uniB', status: 'ativo', createdAt: serverTimestamp() });
    b.update(doc(l, 'pedidos_unidade_professor/profA_uniB'), decisao('liderB', 'aprovado'));
    await assertSucceeds(b.commit());
    // líder de outra unidade não cria vínculo em uniB
    await assertFails(setDoc(doc(como('liderA'), 'vinculos/vinc2'), { professorId: 'fichaA', unidadeId: 'uniB', status: 'ativo', createdAt: serverTimestamp() }));
  });
});

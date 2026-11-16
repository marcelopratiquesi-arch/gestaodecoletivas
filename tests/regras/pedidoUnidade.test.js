// Pedido de OUTRA unidade (pedidos_unidade): o líder pede na atualização de cadastro, o mentor da unidade aprova.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

// Cenário: mentor1 (uniA), mentor2 (uniB, uniC); liderA lidera só uniA; liderAB lidera uniA e uniB.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1', status: 'ativo' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', liderUid: 'liderA' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2', liderUid: 'liderAB' });
    await setDoc(doc(db, 'unidades/uniC'), { nome: 'C', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A' });
    await setDoc(doc(db, 'usuarios/liderAB'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], nome: 'Líder AB' });
    await setDoc(doc(db, 'usuarios/antigo'), { role: 'unidade', unidadeId: 'uniA', nome: 'Unidade A' });
    await setDoc(doc(db, 'usuarios/prof'), { role: 'professor', nome: 'Prof' });
    await setDoc(doc(db, 'usuarios/bloq'), { role: 'bloqueado', unidadeId: 'uniA', nome: 'Bloqueado' });
  });
});
const como = (uid) => env.authenticatedContext(uid).firestore();

const dadosPedido = (uid, unidadeId, extra = {}) => ({
  uid, nome: 'Fulano de Tal', email: 'f@x.com', telefone: '11999999999', unidadeId, unidadeNome: unidadeId,
  unidadesAtuais: ['A'], status: 'pendente', criadoEm: serverTimestamp(), ...extra,
});
const pedir = (uid, unidadeId, extra = {}, id = `${uid}_${unidadeId}`) =>
  setDoc(doc(como(uid), 'pedidos_unidade', id), dadosPedido(uid, unidadeId, extra));

describe('líder faz o pedido', () => {
  it('líder pede uma unidade que ainda não lidera', async () => {
    await assertSucceeds(pedir('liderA', 'uniB'));
  });
  it('login antigo de unidade (papel "unidade") também pede, junto com a atualização do cadastro', async () => {
    await assertSucceeds(pedir('antigo', 'uniC'));
  });
  it('na gravação da atualização de cadastro (crachá + pedidos juntos, já com o Google conectado)', async () => {
    const db = env.authenticatedContext('antigo', { email: 'a@gmail.com', firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
    const b = writeBatch(db);
    b.update(doc(db, 'usuarios/antigo'), {
      nome: 'Fulano de Tal', telefone: '11999999999', email: 'a@gmail.com', role: 'lider', loginGoogle: true, cadastroAtualizadoEm: serverTimestamp(),
    });
    b.set(doc(db, 'pedidos_unidade/antigo_uniC'), dadosPedido('antigo', 'uniC'));
    b.set(doc(db, 'pedidos_unidade/antigo_uniB'), dadosPedido('antigo', 'uniB'));
    await assertSucceeds(b.commit());
  });
  it('pede várias unidades de uma vez (uma por documento)', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'pedidos_unidade/liderA_uniB'), dadosPedido('liderA', 'uniB'));
    b.set(doc(db, 'pedidos_unidade/liderA_uniC'), dadosPedido('liderA', 'uniC'));
    await assertSucceeds(b.commit());
  });
  it('NÃO pede uma unidade que já lidera', async () => {
    await assertFails(pedir('liderA', 'uniA'));
    await assertFails(pedir('liderAB', 'uniB'));
  });
  it('NÃO pede em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'pedidos_unidade/liderAB_uniC'), dadosPedido('liderAB', 'uniC')));
    await assertFails(setDoc(doc(como('liderA'), 'pedidos_unidade/liderA_uniB'), dadosPedido('liderAB', 'uniB')));
  });
  it('NÃO usa id diferente de login_unidade', async () => {
    await assertFails(pedir('liderA', 'uniB', {}, 'qualquer'));
    await assertFails(pedir('liderA', 'uniB', {}, 'liderA_uniC'));
  });
  it('NÃO pede unidade que não existe', async () => {
    await assertFails(pedir('liderA', 'uniZ'));
  });
  it('NÃO nasce já aprovado, nem com campo extra, nem com dado ruim', async () => {
    await assertFails(pedir('liderA', 'uniB', { status: 'aprovado' }));
    await assertFails(pedir('liderA', 'uniB', { role: 'admin' }));
    await assertFails(pedir('liderA', 'uniB', { nome: 'Ab' }));
    await assertFails(pedir('liderA', 'uniB', { telefone: '1' }));
  });
  it('professor, mentor e bloqueado NÃO pedem', async () => {
    await assertFails(pedir('prof', 'uniB'));
    await assertFails(pedir('mentor1', 'uniB'));
    await assertFails(pedir('bloq', 'uniB'));
  });
});

describe('quem lê', () => {
  beforeEach(async () => { await assertSucceeds(pedir('liderA', 'uniB')); });
  it('o próprio líder, o mentor e o admin leem', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), 'pedidos_unidade/liderA_uniB')));
    await assertSucceeds(getDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB')));
    await assertSucceeds(getDoc(doc(como('admin1'), 'pedidos_unidade/liderA_uniB')));
  });
  it('outro líder NÃO lê o pedido alheio', async () => {
    await assertFails(getDoc(doc(como('liderAB'), 'pedidos_unidade/liderA_uniB')));
  });
});

describe('mentor aprova ou recusa', () => {
  beforeEach(async () => { await assertSucceeds(pedir('liderA', 'uniB')); });
  const analise = (status, extra = {}) => ({ status, analisadoPor: 'x', analisadoPorNome: 'X', analisadoEm: serverTimestamp(), ...extra });

  it('mentor da unidade pedida recusa', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB'), analise('recusado', { motivo: 'não é' })));
  });
  it('admin aprova', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'pedidos_unidade/liderA_uniB'), analise('aprovado')));
  });
  it('mentor de OUTRA unidade NÃO decide', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'pedidos_unidade/liderA_uniB'), analise('aprovado')));
  });
  it('o próprio líder NÃO se aprova', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'pedidos_unidade/liderA_uniB'), analise('aprovado')));
  });
  it('mentor só mexe nos campos da análise', async () => {
    await assertFails(updateDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB'), analise('aprovado', { unidadeId: 'uniC' })));
  });
  it('aprovar de verdade: o pedido fecha junto com o crachá e a unidade (uma gravação)', async () => {
    const db = como('mentor2');
    const b = writeBatch(db);
    b.update(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], unidadeAlterada: 'uniB' });
    b.update(doc(db, 'unidades/uniB'), { lider2Uid: 'liderA', lider2Nome: 'Líder A' });
    b.update(doc(db, 'pedidos_unidade/liderA_uniB'), analise('aprovado'));
    await assertSucceeds(b.commit());
  });
  it('mentor NÃO acrescenta unidade que não é dele no crachá do líder', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], unidadeAlterada: 'uniB' }));
  });
});

describe('cancelar e refazer', () => {
  beforeEach(async () => { await assertSucceeds(pedir('liderA', 'uniB')); });
  it('o líder cancela o próprio pedido; o mentor da unidade e o admin também apagam', async () => {
    await assertSucceeds(deleteDoc(doc(como('liderA'), 'pedidos_unidade/liderA_uniB')));
    await pedir('liderA', 'uniB');
    await assertSucceeds(deleteDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB')));
    await pedir('liderA', 'uniB');
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'pedidos_unidade/liderA_uniB')));
  });
  it('outro líder e outro mentor NÃO apagam', async () => {
    await assertFails(deleteDoc(doc(como('liderAB'), 'pedidos_unidade/liderA_uniB')));
    await assertFails(deleteDoc(doc(como('mentor1'), 'pedidos_unidade/liderA_uniB')));
  });
  it('depois de recusado, o líder pode pedir de novo', async () => {
    await updateDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB'), { status: 'recusado', analisadoPor: 'x', analisadoPorNome: 'X', analisadoEm: serverTimestamp() });
    await assertSucceeds(pedir('liderA', 'uniB'));
  });
  it('depois de aprovado e já líder, NÃO refaz o pedido', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], nome: 'Líder A' });
    });
    await assertFails(pedir('liderA', 'uniB'));
  });
});

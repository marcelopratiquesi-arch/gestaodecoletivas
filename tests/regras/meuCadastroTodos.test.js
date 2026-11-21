// "Meu cadastro" dos OUTROS papéis (admin, mentor, líder): cada pessoa salva o próprio contato; o líder também atualiza
// o próprio nome/telefone dentro da(s) unidade(s) dele e pode pedir outra unidade. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

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
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', liderUid: 'liderA', liderNome: 'Líder A', liderTelefone: '3199990000', lider2Uid: 'lider2A', lider2Nome: 'Líder 2A', lider2Telefone: '3188880000' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2', liderUid: 'liderB', liderNome: 'Líder B', liderTelefone: '3177770000' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', telefone: '3199990000', email: 'la@x.com', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/lider2A'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder 2A', telefone: '3188880000', email: 'l2a@x.com', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
  });
});

const contato = { nome: 'NOME NOVO', telefone: '(31) 98888-7777', pais: 'BR', emailContato: 'novo@x.com' };

describe('crachá de admin, mentor e líder', () => {
  it('cada um salva o próprio contato', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/admin1'), contato));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), contato));
    await assertSucceeds(updateDoc(doc(como('liderA'), 'usuarios/liderA'), contato));
  });
  it('NÃO muda papel, unidade, status nem o e-mail de login, e não mexe no cadastro de outra pessoa', async () => {
    const l = como('liderA');
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { unidadeId: 'uniB', unidadeIds: ['uniA', 'uniB'] }));
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { email: 'outro@x.com' }));
    await assertFails(updateDoc(doc(l, 'usuarios/liderB'), contato));
    const m = como('mentor1');
    await assertFails(updateDoc(doc(m, 'usuarios/mentor1'), { status: 'inativo' }));
    await assertFails(updateDoc(doc(m, 'usuarios/mentor2'), contato));
  });
  it('recusa dado ruim (nome curto, telefone curto, país desconhecido)', async () => {
    const l = como('liderA');
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { ...contato, nome: 'Ab' }));
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { ...contato, telefone: '123' }));
    await assertFails(updateDoc(doc(l, 'usuarios/liderA'), { ...contato, pais: 'XX' }));
  });
});

describe('nome e telefone do líder dentro da unidade dele', () => {
  it('o 1º e o 2º líder atualizam a própria vaga, junto com o crachá', async () => {
    const l1 = como('liderA');
    const b1 = writeBatch(l1);
    b1.update(doc(l1, 'usuarios/liderA'), contato);
    b1.update(doc(l1, 'unidades/uniA'), { liderNome: contato.nome, liderTelefone: contato.telefone });
    await assertSucceeds(b1.commit());
    const l2 = como('lider2A');
    const b2 = writeBatch(l2);
    b2.update(doc(l2, 'usuarios/lider2A'), contato);
    b2.update(doc(l2, 'unidades/uniA'), { lider2Nome: contato.nome, lider2Telefone: contato.telefone });
    await assertSucceeds(b2.commit());
  });
  it('NÃO mexe na unidade de outro líder nem em campos que não são de líder', async () => {
    const l = como('liderA');
    await assertFails(updateDoc(doc(l, 'unidades/uniB'), { liderNome: 'X', liderTelefone: '3100000000' }));
    await assertFails(updateDoc(doc(l, 'unidades/uniA'), { mentorId: 'mentor2' }));
    await assertFails(updateDoc(doc(l, 'unidades/uniA'), { nome: 'Outro nome' }));
  });
});

describe('líder pede outra unidade pelo Meu cadastro', () => {
  const pedido = (uid, unidadeId, extra = {}) => ({
    uid, nome: 'Líder A', email: 'la@x.com', telefone: '3199990000', unidadeId, unidadeNome: 'B', unidadesAtuais: ['A'], status: 'pendente', criadoEm: serverTimestamp(), ...extra,
  });
  it('pede uma unidade que ainda não lidera e desiste do pedido', async () => {
    const l = como('liderA');
    await assertSucceeds(setDoc(doc(l, 'pedidos_unidade/liderA_uniB'), pedido('liderA', 'uniB')));
    await assertSucceeds(deleteDoc(doc(l, 'pedidos_unidade/liderA_uniB')));
  });
  it('NÃO pede a unidade que já lidera, nem em nome de outro líder, nem já "aprovado"', async () => {
    const l = como('liderA');
    await assertFails(setDoc(doc(l, 'pedidos_unidade/liderA_uniA'), pedido('liderA', 'uniA')));
    await assertFails(setDoc(doc(l, 'pedidos_unidade/liderB_uniB'), pedido('liderB', 'uniB')));
    await assertFails(setDoc(doc(l, 'pedidos_unidade/liderA_uniB'), pedido('liderA', 'uniB', { status: 'aprovado' })));
  });
  it('o mentor da unidade pedida recusa; o mentor de outra unidade não', async () => {
    await assertSucceeds(setDoc(doc(como('liderA'), 'pedidos_unidade/liderA_uniB'), pedido('liderA', 'uniB')));
    await assertFails(updateDoc(doc(como('mentor1'), 'pedidos_unidade/liderA_uniB'), { status: 'recusado', analisadoPor: 'mentor1', analisadoPorNome: 'M1', analisadoEm: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(como('mentor2'), 'pedidos_unidade/liderA_uniB'), { status: 'recusado', analisadoPor: 'mentor2', analisadoPorNome: 'M2', analisadoEm: serverTimestamp() }));
  });
});

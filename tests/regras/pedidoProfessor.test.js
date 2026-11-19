// Pedido de acesso de PROFESSOR (login pessoal): a pessoa pede UMA unidade; o líder dessa unidade, o mentor dela
// ou o admin aprovam (criando o crachá de professor). Líder de outra unidade não vê nem aprova.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, collection, query, where, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const google = (uid, email = `${uid}@gmail.com`) =>
  env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [uid] } } }).firestore();
const como = (uid) => env.authenticatedContext(uid).firestore();
const pedidoProf = (extra = {}) => ({
  nome: 'Carla Mendes', telefone: '(31) 98888-1234', unidadeId: 'uniA', unidadeNome: 'A', unidadeIds: ['uniA'],
  papel: 'professor', email: 'novata@gmail.com', status: 'pendente', documentoOk: true, modalidades: 'Zumba', ...extra,
});

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
    await setDoc(doc(db, 'solicitacoes_acesso/novata'), pedidoProf());
    await setDoc(doc(db, 'solicitacoes_acesso/novoLider'), pedidoProf({ papel: 'lider', email: 'l@gmail.com' }));
  });
});

describe('pedido de professor', () => {
  it('a pessoa pede UMA unidade, com modalidades opcionais', async () => {
    await assertSucceeds(setDoc(doc(google('nova', 'novata@gmail.com'), 'solicitacoes_acesso/nova'), pedidoProf()));
    const semModalidades = pedidoProf();
    delete semModalidades.modalidades;
    await assertSucceeds(setDoc(doc(google('nova2', 'novata@gmail.com'), 'solicitacoes_acesso/nova2'), semModalidades));
  });
  it('NÃO aceita mais de uma unidade, modalidades enormes nem papel inventado', async () => {
    const db = google('nova', 'novata@gmail.com');
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/nova'), pedidoProf({ unidadeIds: ['uniA', 'uniB'] })));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/nova'), pedidoProf({ modalidades: 'x'.repeat(301) })));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/nova'), pedidoProf({ papel: 'admin' })));
  });
});

describe('CLT ou Saver no pedido de professor', () => {
  const saver = { tipoContrato: 'saver', saverLocais: [{ unidadeId: 'uniA', horarios: [{ dia: 1, ini: '06:00', fim: '10:00' }] }] };
  it('pedido como Saver (e como CLT) passa', async () => {
    await assertSucceeds(setDoc(doc(google('nova', 'novata@gmail.com'), 'solicitacoes_acesso/nova'), pedidoProf(saver)));
    await assertSucceeds(setDoc(doc(google('nova2', 'novata@gmail.com'), 'solicitacoes_acesso/nova2'), pedidoProf({ tipoContrato: 'clt', saverLocais: [] })));
  });
  it('NÃO aceita tipo desconhecido nem mais de 5 unidades de Saver', async () => {
    const db = google('nova', 'novata@gmail.com');
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/nova'), pedidoProf({ tipoContrato: 'estagio' })));
    const seis = Array.from({ length: 6 }, (_, i) => ({ unidadeId: `u${i}`, horarios: [] }));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/nova'), pedidoProf({ tipoContrato: 'saver', saverLocais: seis })));
  });
  it('a aprovação grava o contrato no crachá e na ficha', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitacoes_acesso/novata'), pedidoProf(saver));
      await setDoc(doc(ctx.firestore(), 'professores/fichaC'), { nome: 'CARLA', status: 'ativo' });
    });
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'usuarios', 'novata'), { nome: 'Carla', email: 'novata@gmail.com', telefone: '1', role: 'professor', unidadeId: 'uniA', status: 'ativo', loginGoogle: true, ...saver, professorId: 'fichaC' });
    b.update(doc(db, 'professores', 'fichaC'), { uidLogin: 'novata', ...saver });
    b.update(doc(db, 'solicitacoes_acesso', 'novata'), { status: 'aprovado', analisadoPor: 'liderA', analisadoEm: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

describe('quem lê e aprova pedido de professor', () => {
  const lista = (db) => getDocs(query(collection(db, 'solicitacoes_acesso'), where('papel', '==', 'professor'), where('status', '==', 'pendente')));
  const aprovar = (uid, id = 'novata') => {
    const db = como(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'usuarios', id), { nome: 'Carla', email: 'novata@gmail.com', telefone: '1', role: 'professor', unidadeId: 'uniA', status: 'ativo', loginGoogle: true });
    b.update(doc(db, 'solicitacoes_acesso', id), { status: 'aprovado', analisadoPor: uid, analisadoEm: serverTimestamp() });
    return b.commit();
  };
  it('líder, mentor e admin leem os pedidos de professor', async () => {
    await assertSucceeds(lista(como('liderA')));
    await assertSucceeds(lista(como('mentor1')));
    await assertSucceeds(lista(como('admin1')));
  });
  it('líder NÃO lê pedido de líder ou mentor', async () => {
    await assertFails(getDocs(collection(como('liderA'), 'solicitacoes_acesso')));
  });
  it('líder da unidade aprova', async () => {
    await assertSucceeds(aprovar('liderA'));
  });
  it('mentor da unidade e admin aprovam', async () => {
    await assertSucceeds(aprovar('mentor1'));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'solicitacoes_acesso/novata'), pedidoProf()); });
    await assertSucceeds(aprovar('admin1'));
  });
  it('líder e mentor de OUTRA unidade NÃO aprovam', async () => {
    await assertFails(updateDoc(doc(como('liderB'), 'solicitacoes_acesso/novata'), { status: 'aprovado', analisadoPor: 'liderB', analisadoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('mentor2'), 'solicitacoes_acesso/novata'), { status: 'aprovado', analisadoPor: 'mentor2', analisadoEm: serverTimestamp() }));
  });
  it('líder NÃO aprova pedido de líder nem muda outros campos do pedido', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'solicitacoes_acesso/novoLider'), { status: 'aprovado', analisadoPor: 'liderA', analisadoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('liderA'), 'solicitacoes_acesso/novata'), { status: 'aprovado', unidadeId: 'uniB' }));
  });
  it('líder recusa o pedido da unidade dele, mas NÃO o de outra', async () => {
    await assertSucceeds(updateDoc(doc(como('liderA'), 'solicitacoes_acesso/novata'), { status: 'recusado', motivo: 'x', analisadoPor: 'liderA', analisadoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('liderB'), 'solicitacoes_acesso/novoLider'), { status: 'recusado' }));
  });
});

describe('professor de login antigo (e-mail e senha) NÃO tem mais acesso', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/profAntigo'), { role: 'professor', professorId: 'p1', nome: 'Prof Antigo', telefone: '123456' });
      await setDoc(doc(ctx.firestore(), 'usuarios/profGoogle'), { role: 'professor', nome: 'Prof Google', loginGoogle: true, unidadeId: 'uniA' });
      await setDoc(doc(ctx.firestore(), 'professores/p1'), { nome: 'Prof Antigo' });
    });
  });
  it('não lê nem grava nada com o crachá antigo', async () => {
    await assertFails(getDoc(doc(como('profAntigo'), 'professores/p1')));
    await assertFails(setDoc(doc(como('profAntigo'), 'auditoria_configuracoes/x'), { a: 1 }));
  });
  it('quem entrou pelo Google e foi aprovado (loginGoogle) continua lendo', async () => {
    await assertSucceeds(getDoc(doc(como('profGoogle'), 'professores/p1')));
  });
  it('a própria pessoa apaga o crachá antigo e então consegue pedir acesso', async () => {
    await assertFails(deleteDoc(doc(como('profGoogle'), 'usuarios/profGoogle')));
    await assertFails(deleteDoc(doc(como('outraPessoa'), 'usuarios/profAntigo')));
    await assertSucceeds(deleteDoc(doc(google('profAntigo', 'prof@gmail.com'), 'usuarios/profAntigo')));
    await assertSucceeds(setDoc(doc(google('profAntigo', 'prof@gmail.com'), 'solicitacoes_acesso/profAntigo'), pedidoProf({ email: 'prof@gmail.com' })));
  });
  it('mentor e líder NÃO criam crachá de professor sem o Google (senha padrão)', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/novo1'), { role: 'professor', nome: 'X' }));
    await assertFails(setDoc(doc(como('liderA'), 'usuarios/novo2'), { role: 'professor', nome: 'X' }));
    await assertSucceeds(setDoc(doc(como('liderA'), 'usuarios/novo3'), { role: 'professor', nome: 'X', loginGoogle: true }));
  });
});

// Reservas de e-mail e telefone: contatos_unicos (F3 da chave CPF, parte A).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, writeBatch } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const EMAIL = 'email_ana@x.com';
const TEL = 'tel_BR:1187654321';

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'Prof', loginGoogle: true, unidadeId: 'uniA', professorId: 'f1' });
    await setDoc(doc(db, 'usuarios/prof2'), { role: 'professor', nome: 'Outro', loginGoogle: true, unidadeId: 'uniA' });
    await setDoc(doc(db, 'professores/f1'), { nome: 'PROF', status: 'ativo', uidLogin: 'prof1' });
    await setDoc(doc(db, 'professores/f2'), { nome: 'SOLTA', status: 'ativo' });
  });
});
const como = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
const semCracha = () => env.authenticatedContext('novo', { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
const reservar = (db, id, dados) => setDoc(doc(db, 'contatos_unicos', id), dados);
const semRegras = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

describe('criar reserva', () => {
  it('líder, mentor e admin reservam para um login ou uma ficha', async () => {
    await assertSucceeds(reservar(como('liderA'), EMAIL, { tipo: 'email', uid: 'prof2' }));
    await assertSucceeds(reservar(como('mentor1'), TEL, { tipo: 'tel', professorId: 'f2' }));
    await assertSucceeds(reservar(como('admin1'), 'email_b@x.com', { tipo: 'email', uid: 'prof1', professorId: 'f1' }));
  });
  it('a pessoa reserva só com o próprio login', async () => {
    await assertSucceeds(reservar(como('prof2'), EMAIL, { tipo: 'email', uid: 'prof2' }));
    await assertFails(reservar(como('prof2'), TEL, { tipo: 'tel', uid: 'prof1' }));
    await assertFails(reservar(como('prof2'), TEL, { tipo: 'tel', professorId: 'f2' }));
  });
  it('quem ainda não tem crachá não reserva', async () => {
    await assertFails(reservar(semCracha(), EMAIL, { tipo: 'email', uid: 'novo' }));
  });
  it('login + ficha só se a ficha está ligada a esse login', async () => {
    await assertSucceeds(reservar(como('liderA'), EMAIL, { tipo: 'email', uid: 'prof1', professorId: 'f1' }));
    await assertFails(reservar(como('liderA'), TEL, { tipo: 'tel', uid: 'prof2', professorId: 'f1' }));
  });
  it('formato: chave do tipo certo, ficha existente, sem campos extras', async () => {
    const db = como('admin1');
    await assertFails(reservar(db, EMAIL, { tipo: 'tel', uid: 'prof2' }));
    await assertFails(reservar(db, 'tel_BR:12', { tipo: 'tel', uid: 'prof2' }));
    await assertFails(reservar(db, EMAIL, { tipo: 'email', professorId: 'naoExiste' }));
    await assertFails(reservar(db, EMAIL, { tipo: 'email', uid: 'prof2', nome: 'x' }));
    await assertFails(reservar(db, EMAIL, { tipo: 'email' }));
  });
});

describe('reserva de outra pessoa', () => {
  beforeEach(() => semRegras(db => reservar(db, EMAIL, { tipo: 'email', uid: 'prof2' })));
  it('ninguém toma: nem a pessoa, nem o líder, nem o admin', async () => {
    await assertFails(reservar(como('prof1'), EMAIL, { tipo: 'email', uid: 'prof1' }));
    await assertFails(reservar(como('liderA'), EMAIL, { tipo: 'email', uid: 'prof1', professorId: 'f1' }));
    await assertFails(reservar(como('admin1'), EMAIL, { tipo: 'email', professorId: 'f2' }));
  });
  it('o dono lê e libera a própria; outro professor não lê nem apaga', async () => {
    await assertSucceeds(getDoc(doc(como('prof2'), 'contatos_unicos', EMAIL)));
    await assertFails(getDoc(doc(como('prof1'), 'contatos_unicos', EMAIL)));
    await assertFails(deleteDoc(doc(como('prof1'), 'contatos_unicos', EMAIL)));
    await assertSucceeds(deleteDoc(doc(como('prof2'), 'contatos_unicos', EMAIL)));
  });
  it('achado 2: líder não apaga a reserva de outra pessoa; mentor e admin apagam', async () => {
    await assertFails(deleteDoc(doc(como('liderA'), 'contatos_unicos', EMAIL)));
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'contatos_unicos', EMAIL)));
    await semRegras(db => reservar(db, EMAIL, { tipo: 'email', uid: 'prof2' }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'contatos_unicos', EMAIL)));
  });
  it('líder e mentor conferem uma; só o admin lista', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), 'contatos_unicos', EMAIL)));
    await assertFails(getDocs(collection(como('mentor1'), 'contatos_unicos')));
    await assertSucceeds(getDocs(collection(como('admin1'), 'contatos_unicos')));
  });
  it('sem crachá não lê (a regra geral não abre a coleção)', async () => {
    await assertFails(getDoc(doc(semCracha(), 'contatos_unicos', EMAIL)));
  });
});

describe('botão do admin (lote)', () => {
  it('lote de 10 reservas (todas com login + ficha) passa (limite de consultas do banco)', async () => {
    await semRegras(async (db) => {
      for (let i = 0; i < 10; i++) await setDoc(doc(db, `professores/lote${i}`), { nome: `F${i}`, uidLogin: 'prof2' });
    });
    const db = como('admin1');
    const b = writeBatch(db);
    for (let i = 0; i < 10; i++) {
      b.set(doc(db, 'contatos_unicos', `email_f${i}@x.com`), { tipo: 'email', uid: 'prof2', professorId: `lote${i}` });
    }
    await assertSucceeds(b.commit());
  });
});

describe('a mesma pessoa junta login e ficha', () => {
  it('reserva da ficha ganha o login ligado a ela', async () => {
    await semRegras(db => reservar(db, EMAIL, { tipo: 'email', professorId: 'f1' }));
    await assertSucceeds(reservar(como('prof1'), EMAIL, { tipo: 'email', uid: 'prof1', professorId: 'f1' }));
  });
  it('reserva da ficha solta não vai para outro login', async () => {
    await semRegras(db => reservar(db, EMAIL, { tipo: 'email', professorId: 'f2' }));
    await assertFails(reservar(como('liderA'), EMAIL, { tipo: 'email', uid: 'prof2', professorId: 'f2' }));
  });
});

describe('parte B: conferir antes de salvar', () => {
  it('logado vê que o dado está livre (reserva não existe); anônimo não', async () => {
    await assertSucceeds(getDoc(doc(como('prof1'), 'contatos_unicos', TEL)));
    await assertSucceeds(getDoc(doc(semCracha(), 'contatos_unicos', TEL)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'contatos_unicos', TEL)));
  });
  it('reserva só da ficha ligada ao meu login é minha; a de outra ficha não', async () => {
    await semRegras(async db => {
      await reservar(db, TEL, { tipo: 'tel', professorId: 'f1' });
      await reservar(db, EMAIL, { tipo: 'email', professorId: 'f2' });
    });
    await assertSucceeds(getDoc(doc(como('prof1'), 'contatos_unicos', TEL)));
    await assertFails(getDoc(doc(como('prof1'), 'contatos_unicos', EMAIL)));
    await assertFails(getDoc(doc(como('prof2'), 'contatos_unicos', TEL)));
  });
});

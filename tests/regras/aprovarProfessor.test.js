// F2 da chave CPF: aprovar o pedido de professor LIGANDO à ficha da grade, com o CÓDIGO REAL do site contra o
// emulador e as regras de produção. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// O site usa `db` e `auth` de services/firebase: aqui viram o banco de testes, logado como quem aprova.
const ctx = vi.hoisted(() => ({ db: null, uid: 'mentor1' }));
vi.mock('../../src/services/firebase', () => ({ get db() { return ctx.db; }, auth: { get currentUser() { return { uid: ctx.uid }; } } }));

const CPF = '52998224725';
const CPF_OUTRO = '11144477735';
let env, servico;

const login = (uid) => env.authenticatedContext(uid, { email: `${uid}@x.com`, firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
const semRegras = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const ler = async (caminho) => { const s = await getDoc(doc(ctx.db, caminho)); return s.exists() ? s.data() : null; };
const como = (uid) => { ctx.uid = uid; ctx.db = login(uid); };

const pedido = { id: 'prof1', nome: 'Ana Souza', email: 'ana@gmail.com', telefone: '31999990000', modalidades: 'Zumba' };
const unidade = { id: 'floramar', nome: 'Floramar' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  servico = await import('../../src/services/aprovarProfessorService');
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor' });
    await setDoc(doc(db, 'usuarios/lider1'), { role: 'lider', nome: 'Líder', unidadeId: 'floramar', unidadeIds: ['floramar'] });
    await setDoc(doc(db, 'unidades/floramar'), { nome: 'Floramar', mentorId: 'mentor1', liderUid: 'lider1' });
    await setDoc(doc(db, 'solicitacoes_acesso/prof1'), {
      ...pedido, unidadeId: 'floramar', unidadeNome: 'Floramar', status: 'pendente', papel: 'professor', unidadeIds: ['floramar'], documentoOk: true,
    });
    await setDoc(doc(db, 'documentos_do_pedido/prof1'), { tipo: 'cpf', numero: CPF });
    await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'prof1', tipo: 'cpf', numero: CPF });
  });
});

describe('achar a ficha do pedido', () => {
  const fichaAntiga = { id: 'f1', nome: 'ANA SOUZA', email: 'ana@gmail.com', telefone: '31999990000', pais: 'BR', status: 'ativo' };
  const fichaOutra = { id: 'f2', nome: 'CARLA LIMA', email: 'carla@gmail.com', telefone: '31988887777', pais: 'BR', status: 'ativo' };

  it('mentor: acha a ficha pelo documento e pré-seleciona', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/f2'), { ...fichaOutra, documentoOk: true });
      await setDoc(doc(db, 'documentos_ficha/f2'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'f2', tipo: 'cpf', numero: CPF });
    });
    como('mentor1');
    const r = await servico.acharFichasDoPedido({ pedido, fichas: [fichaAntiga, { ...fichaOutra, documentoOk: true }], pais: 'BR', podeVerDocumento: true });
    const doc2 = r.candidatas.find(c => c.ficha.id === 'f2');
    expect(doc2.campos).toContain('documento');
    expect(doc2.bloqueada).toBeUndefined();
    expect(r.candidatas[0].ficha.id).toBe('f2'); // documento vem antes de e-mail
  });

  it('mentor: ficha com e-mail igual mas OUTRO documento fica bloqueada', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/f1'), { ...fichaAntiga, documentoOk: true });
      await setDoc(doc(db, 'documentos_ficha/f1'), { tipo: 'cpf', numero: CPF_OUTRO });
      await setDoc(doc(db, `documentos_professor/cpf_${CPF_OUTRO}`), { professorId: 'f1', tipo: 'cpf', numero: CPF_OUTRO });
    });
    como('mentor1');
    const r = await servico.acharFichasDoPedido({ pedido, fichas: [{ ...fichaAntiga, documentoOk: true }], pais: 'BR', podeVerDocumento: true });
    expect(r.candidatas[0].bloqueada).toBe('outroDocumento');
  });

  it('líder: acha por e-mail/telefone, mas ficha que já tem documento não é ligada por ele', async () => {
    como('lider1');
    const r = await servico.acharFichasDoPedido({
      pedido, fichas: [fichaAntiga, { ...fichaOutra, email: 'ana@gmail.com', documentoOk: true }], pais: 'BR', podeVerDocumento: false,
    });
    expect(r.documento).toBeNull();
    expect(r.candidatas.find(c => c.ficha.id === 'f1').bloqueada).toBeUndefined();
    expect(r.candidatas.find(c => c.ficha.id === 'f2').bloqueada).toBe('documentoNaoConferido');
  });
});

describe('aprovar ligando à ficha', () => {
  beforeEach(async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/f1'), { nome: 'ANA SOUZA', email: 'ana@gmail.com', telefone: '31999990000', pais: 'BR', status: 'ativo', uidLogin: 'loginAntigo' });
    });
  });

  it('mentor: cria o crachá com professorId, liga a ficha e leva o documento do pedido para ela', async () => {
    como('mentor1');
    const r = await servico.aprovarProfessorPedido({
      pedido, unidade, ficha: { id: 'f1', documentoOk: false }, documento: { tipo: 'cpf', numero: CPF }, podeLevarDocumento: true, quem: { id: 'mentor1', nome: 'Mentor' },
    });
    expect(r.levouDocumento).toBe(true);
    expect(await ler('usuarios/prof1')).toMatchObject({ role: 'professor', professorId: 'f1', loginGoogle: true, status: 'ativo' });
    expect(await ler('professores/f1')).toMatchObject({ uidLogin: 'prof1', documentoOk: true });
    expect(await ler('documentos_ficha/f1')).toMatchObject({ tipo: 'cpf', numero: CPF });
    expect(await ler(`documentos_professor/cpf_${CPF}`)).toMatchObject({ professorId: 'f1' });
    expect((await ler('solicitacoes_acesso/prof1')).status).toBe('aprovado');
  });

  it('líder: liga a ficha sem documento, sem levar o CPF', async () => {
    como('lider1');
    const r = await servico.aprovarProfessorPedido({
      pedido, unidade, ficha: { id: 'f1', documentoOk: false }, documento: null, podeLevarDocumento: false, quem: { id: 'lider1', nome: 'Líder' },
    });
    expect(r.levouDocumento).toBe(false);
    expect(await ler('usuarios/prof1')).toMatchObject({ professorId: 'f1' });
    expect(await ler('professores/f1')).toMatchObject({ uidLogin: 'prof1' });
    expect((await ler('professores/f1')).documentoOk).toBeUndefined();
    // o líder não lê a gaveta; confere direto no banco, sem regras
    await semRegras(async (db) => { expect((await getDoc(doc(db, 'documentos_ficha/f1'))).exists()).toBe(false); });
  });

  it('sem ficha: cria só o acesso, como antes', async () => {
    como('mentor1');
    await servico.aprovarProfessorPedido({ pedido, unidade, ficha: null, quem: { id: 'mentor1', nome: 'Mentor' } });
    const u = await ler('usuarios/prof1');
    expect(u.role).toBe('professor');
    expect(u.professorId).toBeUndefined();
    expect((await ler('professores/f1')).uidLogin).toBe('loginAntigo');
  });
});

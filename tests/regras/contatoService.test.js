// Serviço de reservas de e-mail/telefone (src/services/contatoService.js) com o CÓDIGO REAL do site,
// contra o emulador e as regras de produção. Cobre os achados da revisão da F3 (parte A).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// O site usa `db` de services/firebase: aqui ele vira o banco de testes, trocando de pessoa a cada teste.
const ctx = vi.hoisted(() => ({ db: null }));
vi.mock('../../src/services/firebase', () => ({
  get db() { return ctx.db; },
  auth: { currentUser: null },
}));

const EMAIL = 'email_ana@x.com';
const EMAIL2 = 'email_nova@x.com';
const TEL = 'tel_BR:1187654321';
let env, svc;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
  svc = await import('../../src/services/contatoService');
});
afterAll(async () => { await env?.cleanup(); });

const GOOGLE = { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } };
const como = (uid) => { ctx.db = env.authenticatedContext(uid, GOOGLE).firestore(); };
const semRegras = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const reserva = async (id) => { const s = await getDoc(doc(ctx.db, 'contatos_unicos', id)); return s.exists() ? s.data() : null; };
// withSecurityRulesDisabled não devolve o que a função retorna: guarda o resultado numa variável.
const lerSemRegras = async (id) => { let r = null; await semRegras(async (db) => { const s = await getDoc(doc(db, 'contatos_unicos', id)); r = s.exists() ? s.data() : null; }); return r; };

beforeEach(async () => {
  await env.clearFirestore();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await semRegras(async (db) => {
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    // Crachá do professor SEM o id da ficha (é o caso do achado 1).
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'Prof', loginGoogle: true, unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof2'), { role: 'professor', nome: 'Outro', loginGoogle: true, unidadeId: 'uniA' });
    await setDoc(doc(db, 'professores/f1'), { nome: 'PROF', status: 'ativo', uidLogin: 'prof1' });
    await setDoc(doc(db, 'professores/f2'), { nome: 'SOLTA', status: 'ativo' });
  });
});

describe('achado 1: professor edita o próprio cadastro (reserva só da ficha dele)', () => {
  it('não dá aviso falso e liga o login à reserva', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', professorId: 'f1' }));
    como('prof1');
    const { conflitos } = await svc.sincronizarContatos({ dono: { uid: 'prof1' }, depois: { email: 'ana@x.com' } });
    expect(conflitos).toEqual([]);
    expect(await lerSemRegras(EMAIL)).toEqual({ tipo: 'email', uid: 'prof1', professorId: 'f1' });
  });

  it('continua avisando quando a reserva é mesmo de OUTRA pessoa', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', professorId: 'f2' }));
    como('prof1');
    const { conflitos } = await svc.sincronizarContatos({ dono: { uid: 'prof1' }, depois: { email: 'ana@x.com' } });
    expect(conflitos).toEqual([{ id: EMAIL, tipo: 'email' }]);
    expect(await lerSemRegras(EMAIL)).toEqual({ tipo: 'email', professorId: 'f2' });
  });
});

describe('achado 3: um problema não derruba as outras reservas', () => {
  it('líder troca o e-mail do professor: a antiga fica (ele não apaga) e a nova é reservada', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', professorId: 'f2' }));
    como('liderA');
    const { conflitos } = await svc.sincronizarContatos({
      dono: { professorId: 'f2' },
      antes: { email: 'ana@x.com', telefone: '' },
      depois: { email: 'nova@x.com', telefone: '(11) 98765-4321' },
    });
    expect(conflitos).toEqual([]);
    expect(await lerSemRegras(EMAIL2)).toEqual({ tipo: 'email', professorId: 'f2' });
    expect(await lerSemRegras(TEL)).toEqual({ tipo: 'tel', professorId: 'f2' });
    expect(await lerSemRegras(EMAIL)).toEqual({ tipo: 'email', professorId: 'f2' }); // sobra: o admin limpa
  });

  it('mentor troca o e-mail: a antiga é apagada e a nova reservada', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', professorId: 'f2' }));
    como('mentor1');
    await svc.sincronizarContatos({ dono: { professorId: 'f2' }, antes: { email: 'ana@x.com' }, depois: { email: 'nova@x.com' } });
    expect(await lerSemRegras(EMAIL)).toBeNull();
    expect(await lerSemRegras(EMAIL2)).toEqual({ tipo: 'email', professorId: 'f2' });
  });
});

describe('achado 4: juntar fichas não deixa a principal em conflito com o próprio e-mail', () => {
  it('soltarTudo apaga a reserva da ficha que sai, mesmo com login junto, e a principal reserva em seguida', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fB'), { nome: 'DUP', status: 'ativo', uidLogin: 'prof2' });
      await setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', uid: 'prof2', professorId: 'fB' });
    });
    como('admin1');
    await svc.liberarContatos({ professorId: 'fB' }, { email: 'ana@x.com' }, { soltarTudo: true });
    expect(await lerSemRegras(EMAIL)).toBeNull();
    const { conflitos } = await svc.sincronizarContatos({ dono: { professorId: 'f1', uid: 'prof1' }, depois: { email: 'ana@x.com' } });
    expect(conflitos).toEqual([]);
    expect(await lerSemRegras(EMAIL)).toEqual({ tipo: 'email', uid: 'prof1', professorId: 'f1' });
  });

  it('sem soltarTudo (excluir só a ficha), o login continua dono da reserva', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', EMAIL), { tipo: 'email', uid: 'prof2', professorId: 'f2' }));
    como('admin1');
    await svc.liberarContatos({ professorId: 'f2' }, { email: 'ana@x.com' });
    expect(await lerSemRegras(EMAIL)).toEqual({ tipo: 'email', uid: 'prof2' });
  });
});

describe('achado 7: um lote recusado não aborta o resto', () => {
  it('grava uma a uma, devolve só a que o banco recusou', async () => {
    await semRegras((db) => setDoc(doc(db, 'contatos_unicos', TEL), { tipo: 'tel', uid: 'prof2' }));
    como('admin1');
    const falhas = await svc.gravarReservas([
      [EMAIL, { tipo: 'email', professorId: 'f2' }],
      [TEL, { tipo: 'tel', professorId: 'f2' }], // já é de outra pessoa
    ]);
    expect(falhas).toEqual([TEL]);
    expect(await reserva(EMAIL)).toEqual({ tipo: 'email', professorId: 'f2' });
    expect(await reserva(TEL)).toEqual({ tipo: 'tel', uid: 'prof2' });
  });
});

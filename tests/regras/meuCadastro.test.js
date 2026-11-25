// "Meu cadastro" do professor: salva na hora nome, telefone, país e e-mail de contato (crachá + própria ficha) e a data de
// nascimento (gaveta privada). Rodar: npm run test:regras
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
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A', telefone: '31999990000', email: 'a@x.com', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profB'), { role: 'professor', unidadeId: 'uniB', nome: 'Prof B', loginGoogle: true });
    await setDoc(doc(db, 'professores/fichaA'), { nome: 'PROF A', uidLogin: 'profA', status: 'ativo', tipoContrato: 'clt', saverLocais: [] });
    await setDoc(doc(db, 'professores/fichaB'), { nome: 'PROF B', uidLogin: 'profB', status: 'ativo' });
  });
});

const contato = { nome: 'PROF A NOVO', telefone: '(31) 98888-7777', pais: 'BR', emailContato: 'novo@x.com' };

describe('crachá do professor', () => {
  it('salva o próprio contato (nome, telefone, país, e-mail de contato)', async () => {
    await assertSucceeds(updateDoc(doc(como('profA'), 'usuarios/profA'), contato));
  });
  it('NÃO muda o e-mail de login, o papel, a unidade nem os dados de outra pessoa', async () => {
    const d = como('profA');
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { email: 'outro@x.com' }));
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { unidadeId: 'uniB' }));
    await assertFails(updateDoc(doc(d, 'usuarios/profB'), contato));
  });
  it('recusa dado ruim (nome curto, telefone curto, país desconhecido)', async () => {
    const d = como('profA');
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { ...contato, nome: 'Ab' }));
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { ...contato, telefone: '123' }));
    await assertFails(updateDoc(doc(d, 'usuarios/profA'), { ...contato, pais: 'XX' }));
  });
});

describe('ficha do professor (a ligada ao login dele)', () => {
  const ficha = { nome: 'PROF A NOVO', telefone: '(31) 98888-7777', pais: 'BR', email: 'novo@x.com', updatedAt: serverTimestamp() };
  it('atualiza só o contato da PRÓPRIA ficha, junto com o crachá', async () => {
    const d = como('profA');
    const b = writeBatch(d);
    b.update(doc(d, 'usuarios/profA'), contato);
    b.update(doc(d, 'professores/fichaA'), ficha);
    await assertSucceeds(b.commit());
  });
  it('NÃO mexe em contrato, status, documento nem na ficha de outro', async () => {
    const d = como('profA');
    await assertFails(updateDoc(doc(d, 'professores/fichaA'), { tipoContrato: 'saver' }));
    await assertFails(updateDoc(doc(d, 'professores/fichaA'), { status: 'inativo' }));
    await assertFails(updateDoc(doc(d, 'professores/fichaA'), { documentoOk: true }));
    await assertFails(updateDoc(doc(d, 'professores/fichaA'), { uidLogin: 'profB' }));
    await assertFails(updateDoc(doc(d, 'professores/fichaB'), ficha));
  });
});

describe('data de nascimento (gaveta privada)', () => {
  const nasc = (extra = {}) => ({ nascimento: '1990-05-17', atualizadoEm: serverTimestamp(), ...extra });
  const semear = () => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'nascimentos/profA'), { nascimento: '1990-05-17' }));

  it('o professor grava e corrige a própria; recusa data inventada ou campo extra', async () => {
    const d = como('profA');
    await assertSucceeds(setDoc(doc(d, 'nascimentos/profA'), nasc()));
    await assertSucceeds(setDoc(doc(d, 'nascimentos/profA'), nasc({ nascimento: '1991-12-01' })));
    await assertFails(setDoc(doc(d, 'nascimentos/profA'), nasc({ nascimento: '17/05/1990' })));
    await assertFails(setDoc(doc(d, 'nascimentos/profA'), nasc({ nascimento: '1990-13-01' })));
    await assertFails(setDoc(doc(d, 'nascimentos/profA'), nasc({ extra: 1 })));
  });
  it('quem ainda NÃO tem crachá (pedido de acesso) grava e lê a própria, e só a própria', async () => {
    const novo = como('semCracha');
    await assertSucceeds(setDoc(doc(novo, 'nascimentos/semCracha'), nasc()));
    await assertSucceeds(getDoc(doc(novo, 'nascimentos/semCracha')));
    await assertFails(setDoc(doc(novo, 'nascimentos/profA'), nasc()));
    await assertFails(getDoc(doc(como('profB'), 'nascimentos/semCracha')));
  });
  it('ninguém grava a de outra pessoa (só o admin e o mentor da unidade)', async () => {
    await assertFails(setDoc(doc(como('profB'), 'nascimentos/profA'), nasc()));
    await assertFails(setDoc(doc(como('liderA'), 'nascimentos/profA'), nasc()));
    await assertFails(setDoc(doc(como('mentor2'), 'nascimentos/profA'), nasc())); // mentor de OUTRA unidade
    await assertSucceeds(setDoc(doc(como('mentor1'), 'nascimentos/profA'), nasc())); // mentor da unidade dele (janela Editar)
    await assertSucceeds(setDoc(doc(como('admin1'), 'nascimentos/profA'), nasc()));
  });
  it('leem: o dono, o admin, o mentor e o líder da unidade; os de outra unidade e outros professores não', async () => {
    await semear();
    for (const uid of ['profA', 'admin1', 'mentor1', 'liderA']) await assertSucceeds(getDoc(doc(como(uid), 'nascimentos/profA')));
    for (const uid of ['profB', 'mentor2', 'liderB']) await assertFails(getDoc(doc(como(uid), 'nascimentos/profA')));
  });
  it('o dono pode apagar; outros não', async () => {
    await semear();
    await assertFails(deleteDoc(doc(como('liderA'), 'nascimentos/profA')));
    await assertSucceeds(deleteDoc(doc(como('profA'), 'nascimentos/profA')));
  });
});

describe('nascimento informado no pedido de acesso (ainda sem crachá)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'solicitacoes_acesso/novoProf'), { papel: 'professor', unidadeId: 'uniA', unidadeIds: ['uniA'], status: 'pendente', nome: 'NOVO PROF' });
      await setDoc(doc(db, 'nascimentos/novoProf'), { nascimento: '1992-03-09' });
    });
  });
  it('o líder da unidade, o mentor dela, o admin e o próprio pedido leem', async () => {
    for (const uid of ['liderA', 'mentor1', 'admin1', 'novoProf']) await assertSucceeds(getDoc(doc(como(uid), 'nascimentos/novoProf')));
  });
  it('líder e mentor de OUTRA unidade, e outros professores, não leem', async () => {
    for (const uid of ['liderB', 'mentor2', 'profA', 'profB']) await assertFails(getDoc(doc(como(uid), 'nascimentos/novoProf')));
  });
  it('depois que o pedido some, a leitura de quem aprovava fecha (até existir crachá)', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'solicitacoes_acesso/novoProf')));
    await assertFails(getDoc(doc(como('liderA'), 'nascimentos/novoProf')));
    await assertSucceeds(getDoc(doc(como('novoProf'), 'nascimentos/novoProf')));
  });
});

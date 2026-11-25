// Janela "Editar" do professor (aba Professores): admin e mentor da unidade preenchem a data de nascimento de quem já tem login
// (gaveta nascimentos + marca "nascimentoOk" no crachá e na ficha). Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', liderUid: 'liderA' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Prof A', loginGoogle: true });
    await setDoc(doc(db, 'professores/fichaA'), { nome: 'Prof A', uidLogin: 'profA', status: 'ativo' });
  });
});

// Como a janela grava: data + marca no crachá + marca na ficha, tudo junto.
function gravar(quem, { marcarFicha = true, marcarCracha = true, data = true } = {}) {
  const db = como(quem);
  const b = writeBatch(db);
  if (data) b.set(doc(db, 'nascimentos', 'profA'), { nascimento: '1992-03-09', atualizadoEm: serverTimestamp() });
  if (marcarCracha) b.update(doc(db, 'usuarios', 'profA'), { nascimentoOk: true });
  if (marcarFicha) b.update(doc(db, 'professores', 'fichaA'), { nascimentoOk: true, updatedAt: serverTimestamp() });
  return b.commit();
}

describe('data de nascimento do professor com login', () => {
  it('o administrador preenche', async () => {
    await assertSucceeds(gravar('admin1'));
  });
  it('o mentor da unidade do professor preenche', async () => {
    await assertSucceeds(gravar('mentor1'));
  });
  it('o mentor de OUTRA unidade não consegue', async () => {
    await assertFails(gravar('mentor2'));
  });
  it('o líder da unidade não preenche a data (só admin e mentor)', async () => {
    await assertFails(gravar('liderA'));
  });
  it('a marca na ficha só vale com a data gravada na mesma operação', async () => {
    await assertFails(gravar('mentor1', { data: false, marcarCracha: false }));
  });
  it('o mentor não aproveita para mudar outros campos do crachá do professor', async () => {
    const db = como('mentor1');
    const b = writeBatch(db);
    b.set(doc(db, 'nascimentos', 'profA'), { nascimento: '1992-03-09', atualizadoEm: serverTimestamp() });
    b.update(doc(db, 'usuarios', 'profA'), { nascimentoOk: true, role: 'admin' });
    await assertFails(b.commit());
  });
});

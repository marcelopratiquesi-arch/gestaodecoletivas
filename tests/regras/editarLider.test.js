// Janela "Editar" do líder (aba Líderes): admin e mentor da unidade completam o cadastro de outra pessoa
// (data de nascimento, país, documento e as marcas do aviso "cadastro incompleto"). Rodar: npm run test:regras
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
const CPF = '52998224725';

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'M2', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', liderUid: 'liderA', liderNome: 'Líder A', liderTelefone: '3199990000' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2', liderUid: 'liderB', liderNome: 'Líder B', liderTelefone: '3177770000' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', telefone: '3199990000', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', telefone: '3177770000', loginGoogle: true });
  });
});

// Como a janela grava: data de nascimento + marca no crachá + país, tudo junto.
function gravarNascimento(quem, alvo, { marcar = true, pais = 'BR' } = {}) {
  const db = como(quem);
  const b = writeBatch(db);
  b.update(doc(db, 'usuarios', alvo), { nome: 'Líder Certo', telefone: '(31) 99999-0000', pais, ...(marcar ? { nascimentoOk: true } : {}) });
  b.set(doc(db, 'nascimentos', alvo), { nascimento: '1990-05-17', atualizadoEm: serverTimestamp() });
  return b.commit();
}

// Como a janela grava o documento: gaveta + reserva + marca "documentoOk".
function gravarDocumento(quem, alvo) {
  const db = como(quem);
  const b = writeBatch(db);
  b.set(doc(db, 'documentos_privados', alvo), { tipo: 'cpf', numero: CPF, atualizadoEm: serverTimestamp(), atualizadoPor: quem });
  b.set(doc(db, 'documentos_unicos', `cpf_${CPF}`), { uid: alvo, tipo: 'cpf', numero: CPF });
  b.update(doc(db, 'usuarios', alvo), { documentoOk: true });
  return b.commit();
}

// Como a janela apaga o documento: gaveta + reserva + tira a marca.
function apagarDocumento(quem, alvo) {
  const db = como(quem);
  const b = writeBatch(db);
  b.delete(doc(db, 'documentos_privados', alvo));
  b.delete(doc(db, 'documentos_unicos', `cpf_${CPF}`));
  b.update(doc(db, 'usuarios', alvo), { documentoOk: false });
  return b.commit();
}

describe('data de nascimento, país e marca "nascimentoOk"', () => {
  it('o administrador preenche', async () => {
    await assertSucceeds(gravarNascimento('admin1', 'liderA'));
  });
  it('o mentor da unidade preenche (nome, telefone, país, nascimento e marca juntos)', async () => {
    await assertSucceeds(gravarNascimento('mentor1', 'liderA', { pais: 'AR' }));
  });
  it('o mentor de OUTRA unidade não consegue', async () => {
    await assertFails(gravarNascimento('mentor2', 'liderA'));
  });
  it('a marca só vale se a data foi gravada na mesma operação', async () => {
    const db = como('mentor1');
    await assertFails(writeBatch(db).update(doc(db, 'usuarios/liderA'), { nascimentoOk: true }).commit());
  });
  it('país inventado é recusado', async () => {
    await assertFails(gravarNascimento('mentor1', 'liderA', { pais: 'XX' }));
  });
  it('o mentor não aproveita para mudar papel ou unidade do líder', async () => {
    const db = como('mentor1');
    const b = writeBatch(db);
    b.update(doc(db, 'usuarios/liderA'), { role: 'admin', nascimentoOk: true });
    b.set(doc(db, 'nascimentos/liderA'), { nascimento: '1990-05-17', atualizadoEm: serverTimestamp() });
    await assertFails(b.commit());
  });
  it('data fora do formato é recusada', async () => {
    const db = como('mentor1');
    await assertFails(setDoc(doc(db, 'nascimentos/liderA'), { nascimento: '17/05/1990', atualizadoEm: serverTimestamp() }));
  });
});

describe('documento: trocar e apagar', () => {
  it('administrador e mentor da unidade gravam o documento e a marca', async () => {
    await assertSucceeds(gravarDocumento('admin1', 'liderA'));
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
      await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
      await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    });
    await assertSucceeds(gravarDocumento('mentor1', 'liderA'));
  });
  it('mentor de outra unidade não grava', async () => {
    await assertFails(gravarDocumento('mentor2', 'liderA'));
  });
  it('apagar o documento: administrador e mentor da unidade apagam e a marca volta a false', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'documentos_privados/liderA'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'liderA', tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true, documentoOk: true });
    });
    await assertFails(apagarDocumento('mentor2', 'liderA'));
    await assertSucceeds(apagarDocumento('mentor1', 'liderA'));
  });
  it('o administrador também apaga', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'documentos_privados/liderA'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'liderA', tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true, documentoOk: true });
    });
    await assertSucceeds(apagarDocumento('admin1', 'liderA'));
  });
});

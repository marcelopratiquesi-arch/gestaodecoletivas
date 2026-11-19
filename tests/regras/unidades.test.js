// Regras por unidade, Etapa 1: quem grava em "unidades".
// admin: tudo · mentor (1º, 2º e cobertura): só as unidades dele, sem trocar o mentor · líder: só os campos de líder da própria unidade.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, Timestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const DIA = 24 * 60 * 60 * 1000;
const daqui = (dias) => Timestamp.fromMillis(Date.now() + dias * DIA);
const como = (uid) => env.authenticatedContext(uid).firestore();
const unidade = (db, id) => doc(db, `unidades/${id}`);

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2' });
    await setDoc(doc(db, 'usuarios/seg1'), { role: 'mentor', nome: 'Segundo', mentorPrincipalId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/loginUniA'), { role: 'unidade', unidadeId: 'uniA', nome: 'Login antigo A' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', nome: 'Prof', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'Unidade A', mentorId: 'mentor1', liderUid: 'liderA', liderNome: 'Líder A' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'Unidade B', mentorId: 'mentor2', liderUid: 'liderB', liderNome: 'Líder B' });
  });
});

describe('leitura', () => {
  it('quem está logado lê; anônimo não', async () => {
    await assertSucceeds(getDoc(unidade(como('liderA'), 'uniB')));
    await assertSucceeds(getDoc(unidade(como('prof1'), 'uniA')));
    await assertFails(getDoc(unidade(env.unauthenticatedContext().firestore(), 'uniA')));
  });
});

describe('admin', () => {
  it('cria, edita, troca o mentor e apaga', async () => {
    const db = como('admin1');
    await assertSucceeds(setDoc(unidade(db, 'uniC'), { nome: 'C', mentorId: 'mentor2' }));
    await assertSucceeds(updateDoc(unidade(db, 'uniA'), { nome: 'A novo', mentorId: 'mentor2' }));
    await assertSucceeds(deleteDoc(unidade(db, 'uniB')));
  });
});

describe('mentor: só as unidades dele', () => {
  it('edita a dele (inclusive campos de líder) e não a dos outros', async () => {
    const db = como('mentor1');
    await assertSucceeds(updateDoc(unidade(db, 'uniA'), { nome: 'A novo', telefone: '1' }));
    await assertSucceeds(updateDoc(unidade(db, 'uniA'), { liderNome: 'Outro', liderAConferir: deleteField() }));
    await assertFails(updateDoc(unidade(db, 'uniB'), { nome: 'Invadida' }));
  });
  it('não troca o mentor da unidade (nem passa para ele mesmo)', async () => {
    await assertFails(updateDoc(unidade(como('mentor1'), 'uniA'), { mentorId: 'mentor2' }));
    await assertFails(updateDoc(unidade(como('mentor1'), 'uniB'), { mentorId: 'mentor1' }));
  });
  it('as modalidades da unidade continuam só do admin', async () => {
    await assertFails(updateDoc(unidade(como('mentor1'), 'uniA'), { modalidadesIds: ['zumba'] }));
  });
  it('cria só unidade dele e apaga só a dele', async () => {
    const db = como('mentor1');
    await assertSucceeds(setDoc(unidade(db, 'uniNova'), { nome: 'Nova', mentorId: 'mentor1' }));
    await assertFails(setDoc(unidade(db, 'uniDoOutro'), { nome: 'X', mentorId: 'mentor2' }));
    await assertFails(setDoc(unidade(db, 'uniSemDono'), { nome: 'Y' }));
    await assertSucceeds(deleteDoc(unidade(db, 'uniA')));
    await assertFails(deleteDoc(unidade(db, 'uniB')));
  });
  it('o 2º mentor mexe nas unidades do 1º', async () => {
    await assertSucceeds(updateDoc(unidade(como('seg1'), 'uniA'), { nome: 'Pelo segundo' }));
    await assertFails(updateDoc(unidade(como('seg1'), 'uniB'), { nome: 'Não' }));
  });
});

describe('mentor temporário (cobertura)', () => {
  const dar = (ate) => env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'usuarios/liderB'), { coberturaMentorId: 'mentor1', coberturaAte: ate });
  });
  it('enquanto vale mexe nas unidades cobertas; na própria só como líder (campos de líder)', async () => {
    await dar(daqui(30));
    await assertSucceeds(updateDoc(unidade(como('liderB'), 'uniA'), { nome: 'Coberta' }));
    await assertSucceeds(updateDoc(unidade(como('liderB'), 'uniB'), { liderTelefone: '9' }));
    await assertFails(updateDoc(unidade(como('liderB'), 'uniB'), { nome: 'Própria não é dele como mentor' }));
  });
  it('vencida: só os campos de líder da própria unidade', async () => {
    await dar(daqui(-1));
    await assertFails(updateDoc(unidade(como('liderB'), 'uniA'), { nome: 'Fora do prazo' }));
    await assertFails(updateDoc(unidade(como('liderB'), 'uniB'), { nome: 'Nome não é campo de líder' }));
    await assertSucceeds(updateDoc(unidade(como('liderB'), 'uniB'), { liderTelefone: '9' }));
  });
});

describe('líder: só os campos de líder da própria unidade', () => {
  it('atualiza o próprio contato na unidade dele', async () => {
    const db = como('liderA');
    await assertSucceeds(updateDoc(unidade(db, 'uniA'), { liderNome: 'Novo nome', liderTelefone: '31', liderTipo: 'google', liderAConferir: true }));
    await assertSucceeds(updateDoc(unidade(db, 'uniA'), { lider2Nome: 'Segundo', lider2Email: 'a@b.com' }));
  });
  it('sai da função liberando a vaga (apaga os campos de líder)', async () => {
    await assertSucceeds(updateDoc(unidade(como('liderA'), 'uniA'), { liderUid: deleteField(), liderNome: deleteField(), liderEmail: deleteField(), liderTelefone: deleteField(), liderTipo: deleteField(), liderDesde: deleteField() }));
  });
  it('o login antigo da unidade (papel "unidade") também', async () => {
    await assertSucceeds(updateDoc(unidade(como('loginUniA'), 'uniA'), { loginAntigoDesligado: true, loginAntigoDesligadoEm: Timestamp.now() }));
  });
  it('não mexe em nome, mentor, status, endereço, modalidades nem em unidade dos outros', async () => {
    const db = como('liderA');
    await assertFails(updateDoc(unidade(db, 'uniA'), { nome: 'Renomeada' }));
    await assertFails(updateDoc(unidade(db, 'uniA'), { mentorId: 'liderA' }));
    await assertFails(updateDoc(unidade(db, 'uniA'), { status: 'inativa' }));
    await assertFails(updateDoc(unidade(db, 'uniA'), { modalidadesIds: ['x'] }));
    await assertFails(updateDoc(unidade(db, 'uniA'), { liderNome: 'ok', nome: 'junto não' }));
    await assertFails(updateDoc(unidade(db, 'uniB'), { liderNome: 'Invasor' }));
  });
  it('não cria nem apaga unidade', async () => {
    await assertFails(setDoc(unidade(como('liderA'), 'uniC'), { nome: 'C', mentorId: 'liderA' }));
    await assertFails(deleteDoc(unidade(como('liderA'), 'uniA')));
  });
});

describe('professor e subcoleções', () => {
  it('professor não grava em unidade nenhuma', async () => {
    await assertFails(updateDoc(unidade(como('prof1'), 'uniA'), { nome: 'X' }));
    await assertFails(deleteDoc(unidade(como('prof1'), 'uniA')));
    await assertFails(setDoc(unidade(como('prof1'), 'uniC'), { nome: 'C' }));
  });
  it('subcoleção de unidade: só o admin grava', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'unidades/uniA/anexos/a1'), { x: 1 }));
    await assertFails(setDoc(doc(como('mentor1'), 'unidades/uniA/anexos/a2'), { x: 1 }));
  });
});

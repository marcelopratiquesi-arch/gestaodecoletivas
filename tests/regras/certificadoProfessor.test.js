// Certificados de workshop do professor (certificados_professor): o professor envia (foto JPEG em base64),
// o líder da unidade, o mentor dela ou o admin verificam. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(5000);

// Cenário: uniA (mentor1, liderA), uniB (mentor2, liderB); profA na uniA, profB na uniB; profSemUnidade sem unidade.
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
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A' });
    await setDoc(doc(db, 'usuarios/profB'), { role: 'professor', unidadeId: 'uniB', nome: 'Prof B' });
    await setDoc(doc(db, 'usuarios/profSem'), { role: 'professor', nome: 'Prof Sem' });
  });
});

const dados = (uid, extra = {}) => ({
  uid, unidadeId: 'uniA', nome: 'Prof A', workshop: 'Workshop Pratique 2025', dataFeito: '2025-05-10',
  foto: FOTO, status: 'pendente', criadoEm: serverTimestamp(), ...extra,
});
const enviar = (uid, extra = {}, id = `${uid}_abcd1234`) => setDoc(doc(como(uid), 'certificados_professor', id), dados(uid, extra));
const semear = (id = 'profA_abcd1234', extra = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'certificados_professor', id), { ...dados('profA'), criadoEm: new Date(), ...extra });
});
const analise = (status, extra = {}) => ({ status, analisadoPor: 'x', analisadoPorNome: 'X', analisadoEm: serverTimestamp(), ...extra });
const ref = (uid, id = 'profA_abcd1234') => doc(como(uid), 'certificados_professor', id);

describe('professor envia', () => {
  it('professor envia o próprio certificado', async () => {
    await assertSucceeds(enviar('profA'));
  });
  it('NÃO envia em nome de outro professor nem com id fora do padrão', async () => {
    await assertFails(setDoc(doc(como('profA'), 'certificados_professor/profB_abcd1234'), dados('profB', { unidadeId: 'uniB' })));
    await assertFails(enviar('profA', {}, 'qualquer'));
  });
  it('NÃO envia para uma unidade que não é a dele, nem sem unidade no cadastro', async () => {
    await assertFails(enviar('profA', { unidadeId: 'uniB' }));
    await assertFails(enviar('profSem', { unidadeId: 'uniA' }));
  });
  it('NÃO nasce verificado, com campo extra ou com dado ruim', async () => {
    await assertFails(enviar('profA', { status: 'verificado' }));
    await assertFails(enviar('profA', { analisadoPor: 'profA' }));
    await assertFails(enviar('profA', { workshop: 'ab' }));
    await assertFails(enviar('profA', { dataFeito: '10/05/2025' }));
    await assertFails(enviar('profA', { dataFeito: '2025-13-40' }));
  });
  it('NÃO aceita foto que não é JPEG, é minúscula ou passa de 700 mil caracteres', async () => {
    await assertFails(enviar('profA', { foto: 'data:image/png;base64,' + 'A'.repeat(5000) }));
    await assertFails(enviar('profA', { foto: 'data:image/jpeg;base64,AAA' }));
    await assertFails(enviar('profA', { foto: 'data:image/jpeg;base64,' + 'A'.repeat(700000) }));
  });
  it('foto grande (perto do limite) passa', async () => {
    await assertSucceeds(enviar('profA', { foto: 'data:image/jpeg;base64,' + 'A'.repeat(600000) }));
  });
  it('líder, mentor e admin NÃO enviam certificado (é do professor)', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'certificados_professor/liderA_abcd1234'), dados('liderA')));
    await assertFails(setDoc(doc(como('mentor1'), 'certificados_professor/mentor1_abcd1234'), dados('mentor1')));
  });
});

describe('quem lê', () => {
  beforeEach(async () => { await semear(); });
  it('o dono, o líder, o mentor da unidade e o admin leem', async () => {
    for (const uid of ['profA', 'liderA', 'mentor1', 'admin1']) await assertSucceeds(getDoc(ref(uid)));
  });
  it('outro professor, líder ou mentor de OUTRA unidade NÃO leem', async () => {
    for (const uid of ['profB', 'liderB', 'mentor2']) await assertFails(getDoc(ref(uid)));
  });
  it('o professor lista só os dele', async () => {
    await assertSucceeds(getDocs(query(collection(como('profA'), 'certificados_professor'), where('uid', '==', 'profA'))));
    await assertFails(getDocs(collection(como('profA'), 'certificados_professor')));
  });
  it('líder e mentor listam os pendentes da unidade (consulta com `in`)', async () => {
    const q = (uid, ids) => getDocs(query(collection(como(uid), 'certificados_professor'), where('unidadeId', 'in', ids), where('status', '==', 'pendente')));
    await assertSucceeds(q('liderA', ['uniA']));
    await assertSucceeds(q('mentor1', ['uniA']));
    await assertFails(q('liderB', ['uniA']));
    await assertFails(q('mentor2', ['uniA']));
  });
  it('admin lista todos os pendentes', async () => {
    await assertSucceeds(getDocs(query(collection(como('admin1'), 'certificados_professor'), where('status', '==', 'pendente'))));
  });
});

describe('verificar e recusar', () => {
  beforeEach(async () => { await semear(); });
  it('líder, mentor da unidade e admin verificam', async () => {
    await assertSucceeds(updateDoc(ref('liderA'), analise('verificado')));
    await semear();
    await assertSucceeds(updateDoc(ref('mentor1'), analise('verificado')));
    await semear();
    await assertSucceeds(updateDoc(ref('admin1'), analise('verificado')));
  });
  it('recusa com motivo', async () => {
    await assertSucceeds(updateDoc(ref('liderA'), analise('recusado', { motivo: 'foto ilegível' })));
  });
  it('o próprio professor NÃO se verifica', async () => {
    await assertFails(updateDoc(ref('profA'), analise('verificado')));
  });
  it('líder e mentor de OUTRA unidade NÃO verificam', async () => {
    await assertFails(updateDoc(ref('liderB'), analise('verificado')));
    await assertFails(updateDoc(ref('mentor2'), analise('verificado')));
  });
  it('quem verifica só mexe nos campos da análise', async () => {
    await assertFails(updateDoc(ref('liderA'), analise('verificado', { workshop: 'Outro' })));
    await assertFails(updateDoc(ref('liderA'), analise('verificado', { foto: FOTO + 'B' })));
  });
  it('certificado já verificado não muda mais', async () => {
    await semear('profA_abcd1234', { status: 'verificado' });
    await assertFails(updateDoc(ref('liderA'), analise('recusado')));
    await assertFails(enviar('profA'));
  });
});

describe('gestor adiciona para um professor do cadastro', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'professores/p1'), { nome: 'Carla', uidLogin: 'profA' });
      await setDoc(doc(ctx.firestore(), 'professores/p2'), { nome: 'Sem Login' });
    });
  });
  const gestor = (uid, extra = {}, id = 'prof_p1_abcd1234') => setDoc(doc(como(uid), 'certificados_professor', id), {
    uid: 'profA', professorId: 'p1', unidadeId: 'uniA', nome: 'Carla', workshop: 'Workshop X', dataFeito: '2025-05-10', foto: FOTO,
    status: 'verificado', criadoEm: serverTimestamp(), analisadoPor: uid, analisadoPorNome: 'G', analisadoEm: serverTimestamp(), ...extra,
  });

  it('mentor da unidade, líder da unidade e admin adicionam (já verificado)', async () => {
    await assertSucceeds(gestor('mentor1'));
    await assertSucceeds(gestor('liderA', {}, 'prof_p1_efgh5678'));
    await assertSucceeds(gestor('admin1', { unidadeId: '' }, 'prof_p1_ijkl9012'));
  });
  it('professor sem login pessoal também (uid vazio)', async () => {
    await assertSucceeds(gestor('mentor1', { uid: '', professorId: 'p2', nome: 'Sem Login' }, 'prof_p2_abcd1234'));
  });
  it('mentor/líder de OUTRA unidade NÃO adicionam na unidade alheia', async () => {
    await assertFails(gestor('mentor2'));
    await assertFails(gestor('liderB'));
  });
  it('professor NÃO adiciona como gestor, nem o gestor cria pendente/recusado, id errado ou professor inexistente', async () => {
    await assertFails(gestor('profA'));
    await assertFails(gestor('mentor1', { status: 'pendente' }));
    await assertFails(gestor('mentor1', {}, 'prof_p2_abcd1234'));
    await assertFails(gestor('mentor1', { professorId: 'p9' }, 'prof_p9_abcd1234'));
    await assertFails(gestor('mentor1', { analisadoPor: 'outro' }));
  });
  it('o professor dono lê o que o gestor adicionou, mas não edita nem apaga (verificado)', async () => {
    await assertSucceeds(gestor('mentor1'));
    await assertSucceeds(getDoc(ref('profA', 'prof_p1_abcd1234')));
    await assertFails(updateDoc(ref('profA', 'prof_p1_abcd1234'), { workshop: 'Trocado' }));
    await assertFails(deleteDoc(ref('profA', 'prof_p1_abcd1234')));
  });
  it('o gestor lista os do professor (consulta por professorId + unidade) e apaga os que adicionou', async () => {
    await assertSucceeds(gestor('mentor1'));
    const q = (uid, ids) => getDocs(query(collection(como(uid), 'certificados_professor'), where('professorId', '==', 'p1'), where('unidadeId', 'in', ids)));
    await assertSucceeds(q('mentor1', ['uniA']));
    await assertSucceeds(q('liderA', ['uniA']));
    await assertFails(q('mentor2', ['uniA']));
    await assertSucceeds(deleteDoc(ref('liderA', 'prof_p1_abcd1234')));
  });
  it('admin lista os do professor sem limite de unidade', async () => {
    await assertSucceeds(getDocs(query(collection(como('admin1'), 'certificados_professor'), where('professorId', '==', 'p1'))));
  });
});

describe('corrigir, reenviar e apagar', () => {
  it('recusado: o professor corrige e reenvia (volta a pendente)', async () => {
    await semear('profA_abcd1234', { status: 'recusado', motivo: 'ilegível' });
    await assertSucceeds(enviar('profA', { workshop: 'Workshop Pratique 2025 (corrigido)' }));
  });
  it('o professor apaga o dele enquanto não verificado; verificado só o admin apaga', async () => {
    await semear();
    await assertSucceeds(deleteDoc(ref('profA')));
    await semear('profA_abcd1234', { status: 'verificado' });
    await assertFails(deleteDoc(ref('profA')));
    await assertFails(deleteDoc(ref('liderA')));
    await assertSucceeds(deleteDoc(ref('admin1')));
  });
});

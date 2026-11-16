// Saída da função ("não sou mais da unidade" / "não sou mais mentor"): a própria pessoa se desliga na hora,
// o mentor da unidade (ou o admin) desfaz, e o aviso aparece em Pendências (saidas_acesso).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp, deleteField, getDoc } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

// Cenário: mentor1 (uniA), mentor2 (uniB); liderA (só uniA); liderAB (uniA e uniB); liderProf (uniA, também professor).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1', status: 'ativo' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1', liderUid: 'liderA' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2', liderUid: 'liderAB' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A' });
    await setDoc(doc(db, 'usuarios/liderAB'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], nome: 'Líder AB' });
    await setDoc(doc(db, 'usuarios/liderProf'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], professorId: 'p1', nome: 'Líder Prof' });
    await setDoc(doc(db, 'professores/p1'), { nome: 'Prof', uidLogin: 'liderProf' });
    await setDoc(doc(db, 'usuarios/outro'), { role: 'professor', professorId: 'p2', nome: 'Outro' });
  });
});
const como = (uid) => env.authenticatedContext(uid).firestore();

// Saída do líder como a tela faz: crachá + aviso na mesma gravação.
function sairLider(uid, { antes = ['uniA'], virarProfessor = false, extraCracha = {}, extraAviso = {} } = {}) {
  const db = como(uid);
  const b = writeBatch(db);
  const t = serverTimestamp();
  b.update(doc(db, 'usuarios', uid), virarProfessor
    ? { role: 'professor', unidadeId: deleteField(), unidadeIds: deleteField(), professorId: 'p1', papelAntes: 'lider', unidadeIdsAntes: antes, saidaEm: t, ...extraCracha }
    : { role: 'bloqueado', papelAntes: 'lider', unidadeIdsAntes: antes, saidaEm: t, ...extraCracha });
  b.set(doc(db, 'saidas_acesso', uid), {
    nome: 'X', email: 'x@x.com', telefone: '123', papel: 'lider', unidadeIds: antes, unidadeNomes: ['A'],
    continuaProfessor: virarProfessor, status: 'pendente', criadoEm: t, ...extraAviso,
  });
  return b.commit();
}

describe('líder sai da função', () => {
  it('líder se bloqueia na hora (com o aviso)', async () => {
    await assertSucceeds(sairLider('liderA'));
  });
  it('líder de várias unidades sai de todas de uma vez', async () => {
    await assertSucceeds(sairLider('liderAB', { antes: ['uniA', 'uniB'] }));
  });
  it('líder que também é professor continua como professor', async () => {
    await assertSucceeds(sairLider('liderProf', { virarProfessor: true }));
  });
  it('NÃO vira professor sem vínculo de verdade', async () => {
    await assertFails(sairLider('liderA', { virarProfessor: true }));
  });
  it('NÃO esconde unidades (a lista guardada tem que ser a verdadeira)', async () => {
    await assertFails(sairLider('liderAB', { antes: ['uniA'] }));
  });
  it('NÃO aproveita para mexer em outros campos nem se promover', async () => {
    await assertFails(sairLider('liderA', { extraCracha: { nome: 'Outro nome' } }));
    await assertFails(sairLider('liderA', { extraCracha: { role: 'admin' } }));
  });
  it('NÃO aceita aviso falso (status, unidades ou outra pessoa)', async () => {
    await assertFails(sairLider('liderA', { extraAviso: { status: 'ciente' } }));
    await assertFails(sairLider('liderA', { extraAviso: { unidadeIds: ['uniB'] } }));
  });
  it('NÃO bloqueia outra pessoa', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/liderAB'), { role: 'bloqueado', papelAntes: 'lider', unidadeIdsAntes: ['uniA', 'uniB'], saidaEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderA'), { role: 'bloqueado', papelAntes: 'lider', unidadeIdsAntes: ['uniA'], saidaEm: serverTimestamp() }));
  });
  it('NÃO vale para o professor comum', async () => {
    await assertFails(updateDoc(doc(como('outro'), 'usuarios/outro'), { role: 'bloqueado', papelAntes: 'professor', unidadeIdsAntes: [], saidaEm: serverTimestamp() }));
  });
  it('depois de bloqueado, não lê nem grava mais nada', async () => {
    await sairLider('liderA');
    await assertFails(getDoc(doc(como('liderA'), 'unidades/uniA')));
  });
});

describe('mentor sai da função', () => {
  it('mentor fica inativo, com o aviso', async () => {
    const db = como('mentor1');
    const b = writeBatch(db);
    const t = serverTimestamp();
    b.update(doc(db, 'usuarios/mentor1'), { status: 'inativo', papelAntes: 'mentor', saidaEm: t });
    b.set(doc(db, 'saidas_acesso/mentor1'), { nome: 'M', email: 'm@m.com', telefone: '1', papel: 'mentor', unidadeIds: [], status: 'pendente', criadoEm: t });
    await assertSucceeds(b.commit());
  });
  it('mentor NÃO se tira de outro papel por esse caminho', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { role: 'admin', status: 'inativo', papelAntes: 'mentor', saidaEm: serverTimestamp() }));
  });
});

describe('desfazer a saída e tratar o aviso', () => {
  const desfaz = (uid, ids, extra = {}) => updateDoc(doc(como(uid), 'usuarios/liderA'), {
    role: 'lider', unidadeId: ids[0], unidadeIds: ids, papelAntes: deleteField(), unidadeIdsAntes: deleteField(), saidaEm: deleteField(), ...extra,
  });
  beforeEach(async () => { await sairLider('liderA'); });

  it('mentor da unidade desfaz o bloqueio', async () => {
    await assertSucceeds(desfaz('mentor1', ['uniA']));
  });
  it('admin desfaz', async () => {
    await assertSucceeds(desfaz('admin1', ['uniA']));
  });
  it('mentor de OUTRA unidade NÃO desfaz', async () => {
    await assertFails(desfaz('mentor2', ['uniA']));
  });
  it('mentor NÃO desfaz mudando a função ou as unidades', async () => {
    await assertFails(desfaz('mentor1', ['uniA'], { role: 'mentor' }));
    await assertFails(desfaz('mentor1', ['uniB']));
    await assertFails(desfaz('mentor1', ['uniA', 'uniB']));
  });
  it('a própria pessoa NÃO desfaz (nem consegue: está bloqueada)', async () => {
    await assertFails(desfaz('liderA', ['uniA']));
  });
  it('mentor da unidade e admin dão ciência no aviso; outro mentor não', async () => {
    const ciente = (uid) => updateDoc(doc(como(uid), 'saidas_acesso/liderA'), { status: 'ciente', analisadoPor: uid, analisadoPorNome: 'x', analisadoEm: serverTimestamp() });
    await assertFails(ciente('mentor2'));
    await assertSucceeds(ciente('mentor1'));
    await assertSucceeds(ciente('admin1'));
  });
  it('mentor NÃO muda outros campos do aviso', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'saidas_acesso/liderA'), { status: 'ciente', nome: 'Outro' }));
  });
  it('mentor e admin leem os avisos; professor não', async () => {
    await assertSucceeds(getDoc(doc(como('mentor1'), 'saidas_acesso/liderA')));
    await assertSucceeds(getDoc(doc(como('admin1'), 'saidas_acesso/liderA')));
    await assertFails(getDoc(doc(como('outro'), 'saidas_acesso/liderA')));
  });
});

describe('líder-professor e vários: desfazer', () => {
  it('quem continuou professor volta a líder pelo mentor', async () => {
    await sairLider('liderProf', { virarProfessor: true });
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/liderProf'), {
      role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], papelAntes: deleteField(), unidadeIdsAntes: deleteField(), saidaEm: deleteField(),
    }));
  });
  it('líder de várias unidades: o mentor de UMA delas desfaz tudo', async () => {
    await sairLider('liderAB', { antes: ['uniA', 'uniB'] });
    await assertSucceeds(updateDoc(doc(como('mentor2'), 'usuarios/liderAB'), {
      role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], papelAntes: deleteField(), unidadeIdsAntes: deleteField(), saidaEm: deleteField(),
    }));
  });
});

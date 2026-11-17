// Documento da FICHA da grade (professores/{id}): gaveta documentos_ficha, reserva documentos_professor e marca documentoOk.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch, getDoc, getDocs, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

const CPF = '52998224725';
const CPF2 = '11144477735';

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', nome: 'Prof', loginGoogle: true, unidadeId: 'uniA' });
    await setDoc(doc(db, 'professores/fichaAntiga'), { nome: 'ANTIGA', status: 'ativo' });
    await setDoc(doc(db, 'professores/fichaOutra'), { nome: 'OUTRA', status: 'ativo' });
  });
});
const como = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();

// Grava o documento de uma ficha como a tela faz: gaveta + reserva + marca na ficha (e cria a ficha, se `novaFicha`).
function gravar(quem, fichaId, { numero = CPF, novaFicha = false, anterior = null, marcar = true } = {}) {
  const db = como(quem);
  const b = writeBatch(db);
  if (novaFicha) b.set(doc(db, 'professores', fichaId), { nome: 'NOVA', status: 'ativo', documentoOk: true });
  b.set(doc(db, 'documentos_ficha', fichaId), { tipo: 'cpf', numero, atualizadoEm: serverTimestamp(), atualizadoPor: quem });
  if (anterior) b.delete(doc(db, 'documentos_professor', `cpf_${anterior}`));
  b.set(doc(db, 'documentos_professor', `cpf_${numero}`), { professorId: fichaId, tipo: 'cpf', numero });
  if (!novaFicha && marcar) b.update(doc(db, 'professores', fichaId), { documentoOk: true });
  return b.commit();
}

describe('gravar o documento da ficha', () => {
  it('líder cria ficha nova já com documento', async () => {
    await assertSucceeds(gravar('liderA', 'fichaNova', { novaFicha: true }));
  });
  it('líder completa o documento de ficha antiga; mentor e admin também', async () => {
    await assertSucceeds(gravar('liderA', 'fichaAntiga'));
    await assertSucceeds(gravar('mentor1', 'fichaOutra', { numero: CPF2 }));
  });
  it('NÃO marca documentoOk sem a gaveta', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'professores/fichaAntiga'), { documentoOk: true }));
  });
  it('NÃO grava a gaveta sem a reserva apontando para a mesma ficha', async () => {
    const db = como('liderA');
    await assertFails(setDoc(doc(db, 'documentos_ficha/fichaAntiga'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'liderA' }));
  });
  it('NÃO aceita CPF em formato errado', async () => {
    await assertFails(gravar('liderA', 'fichaAntiga', { numero: '123' }));
  });
  it('professor não grava documento de ficha', async () => {
    await assertFails(gravar('prof1', 'fichaAntiga'));
  });
  it('edição da ficha com documento num lote só (como a tela faz)', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.update(doc(db, 'professores/fichaAntiga'), { nome: 'ANTIGA', telefone: '31 99999-0000', documentoOk: true });
    b.set(doc(db, 'documentos_ficha/fichaAntiga'), { tipo: 'cpf', numero: CPF, atualizadoEm: serverTimestamp(), atualizadoPor: 'liderA' });
    b.set(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaAntiga', tipo: 'cpf', numero: CPF });
    await assertSucceeds(b.commit());
  });
  it('vincular ficha antiga confirmada: documento + vínculo no mesmo lote', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'documentos_ficha/fichaAntiga'), { tipo: 'cpf', numero: CPF, atualizadoEm: serverTimestamp(), atualizadoPor: 'liderA' });
    b.set(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaAntiga', tipo: 'cpf', numero: CPF });
    b.update(doc(db, 'professores/fichaAntiga'), { documentoOk: true });
    b.set(doc(db, 'vinculos/v1'), { professorId: 'fichaAntiga', unidadeId: 'uniA', status: 'ativo' });
    await assertSucceeds(b.commit());
  });
  it('líder ainda edita os outros dados da ficha normalmente', async () => {
    await assertSucceeds(updateDoc(doc(como('liderA'), 'professores/fichaAntiga'), { nome: 'ANTIGA 2' }));
  });
  it('professor continua sem gravar na ficha', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'professores/fichaAntiga'), { nome: 'X' }));
  });
});

describe('documento repetido', () => {
  it('o mesmo CPF não vai para duas fichas', async () => {
    await assertSucceeds(gravar('liderA', 'fichaAntiga'));
    await assertFails(gravar('liderA', 'fichaOutra'));
    await assertFails(gravar('mentor1', 'fichaOutra'));
  });
  it('CPF de quem já tem login só vale para a ficha ligada a esse login', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'prof1', tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, 'professores/fichaDoProf1'), { nome: 'PROF', status: 'ativo', uidLogin: 'prof1' });
    });
    await assertFails(gravar('liderA', 'fichaAntiga'));
    await assertSucceeds(gravar('liderA', 'fichaDoProf1'));
  });
});

describe('quem vê', () => {
  beforeEach(async () => { await gravar('admin1', 'fichaAntiga'); });
  it('número: admin e mentor leem; líder e professor não', async () => {
    await assertSucceeds(getDoc(doc(como('admin1'), 'documentos_ficha/fichaAntiga')));
    await assertSucceeds(getDoc(doc(como('mentor1'), 'documentos_ficha/fichaAntiga')));
    await assertFails(getDoc(doc(como('liderA'), 'documentos_ficha/fichaAntiga')));
    await assertFails(getDoc(doc(como('prof1'), 'documentos_ficha/fichaAntiga')));
  });
  it('conferir um CPF digitado: líder, mentor e admin; professor não', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), `documentos_professor/cpf_${CPF}`)));
    await assertSucceeds(getDoc(doc(como('mentor1'), `documentos_professor/cpf_${CPF}`)));
    await assertFails(getDoc(doc(como('prof1'), `documentos_professor/cpf_${CPF}`)));
  });
  it('listar as reservas: só o admin', async () => {
    await assertFails(getDocs(collection(como('liderA'), 'documentos_professor')));
    await assertFails(getDocs(collection(como('mentor1'), 'documentos_professor')));
    await assertSucceeds(getDocs(collection(como('admin1'), 'documentos_professor')));
  });
});

describe('corrigir e apagar', () => {
  beforeEach(async () => { await gravar('liderA', 'fichaAntiga'); });
  it('mentor corrige o número (troca a reserva); líder não', async () => {
    const corrigir = (quem) => {
      const db = como(quem);
      const b = writeBatch(db);
      b.set(doc(db, 'documentos_ficha/fichaAntiga'), { tipo: 'cpf', numero: CPF2, atualizadoPor: quem });
      b.delete(doc(db, `documentos_professor/cpf_${CPF}`));
      b.set(doc(db, `documentos_professor/cpf_${CPF2}`), { professorId: 'fichaAntiga', tipo: 'cpf', numero: CPF2 });
      return b.commit();
    };
    await assertFails(corrigir('liderA'));
    await assertSucceeds(corrigir('mentor1'));
  });
  it('apagar gaveta e reserva: admin e mentor; líder não', async () => {
    await assertFails(deleteDoc(doc(como('liderA'), `documentos_professor/cpf_${CPF}`)));
    await assertFails(deleteDoc(doc(como('liderA'), 'documentos_ficha/fichaAntiga')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), `documentos_professor/cpf_${CPF}`)));
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'documentos_ficha/fichaAntiga')));
  });
  it('admin passa o documento para outra ficha ao juntar fichas', async () => {
    const db = como('admin1');
    const b = writeBatch(db);
    b.set(doc(db, 'documentos_ficha/fichaOutra'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'admin1' });
    b.set(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaOutra', tipo: 'cpf', numero: CPF });
    b.update(doc(db, 'professores/fichaOutra'), { documentoOk: true });
    b.delete(doc(db, 'documentos_ficha/fichaAntiga'));
    b.delete(doc(db, 'professores/fichaAntiga'));
    await assertSucceeds(b.commit());
  });
  it('líder NÃO toma o documento de outra ficha', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'documentos_ficha/fichaOutra'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'liderA' });
    b.set(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaOutra', tipo: 'cpf', numero: CPF });
    await assertFails(b.commit());
  });
});

// Regras de AULAS (Cronograma) e da cópia pública da grade (aulas_publicas), no emulador local.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

// uniA: mentor1, líder liderA (uma unidade) e liderAB (duas unidades); uniB: mentor2.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/liderAntigo'), { role: 'unidade', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/liderAB'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'] });
    await setDoc(doc(db, 'usuarios/liderSemUnidade'), { role: 'lider' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'aulas/aulaA'), { unidadeId: 'uniA', professorId: 'p1', modalidadeId: 'm1', valor: 50 });
    await setDoc(doc(db, 'aulas/aulaB'), { unidadeId: 'uniB', professorId: 'p1', modalidadeId: 'm1', valor: 30 });
    await setDoc(doc(db, 'aulas_publicas/aulaA'), { unidadeId: 'uniA', professorId: 'p1', modalidadeId: 'm1' });
    await setDoc(doc(db, 'aulas_publicas/aulaB'), { unidadeId: 'uniB', professorId: 'p1', modalidadeId: 'm1' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const nova = (unidadeId, extra = {}) => ({ unidadeId, professorId: 'p1', modalidadeId: 'm1', hora: '19:00', dias: ['Terça'], valor: 60, ...extra });

describe('aulas: criar', () => {
  it('admin cria em qualquer unidade', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'aulas/n1'), nova('uniA')));
    await assertSucceeds(setDoc(doc(como('admin1'), 'aulas/n2'), nova('uniB')));
  });
  it('mentor cria só nas unidades dele', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'aulas/n1'), nova('uniA')));
    await assertFails(setDoc(doc(como('mentor1'), 'aulas/n2'), nova('uniB')));
  });
  it('líder cria só na unidade dele (perfil novo e antigo)', async () => {
    await assertSucceeds(setDoc(doc(como('liderA'), 'aulas/n1'), nova('uniA')));
    await assertSucceeds(setDoc(doc(como('liderAntigo'), 'aulas/n2'), nova('uniA')));
    await assertFails(setDoc(doc(como('liderA'), 'aulas/n3'), nova('uniB')));
  });
  it('líder de várias unidades cria em todas as dele', async () => {
    await assertSucceeds(setDoc(doc(como('liderAB'), 'aulas/n1'), nova('uniA')));
    await assertSucceeds(setDoc(doc(como('liderAB'), 'aulas/n2'), nova('uniB')));
  });
  it('sem unidade na aula ninguém (a não ser o admin) cria', async () => {
    await assertFails(setDoc(doc(como('liderSemUnidade'), 'aulas/n1'), nova('')));
    await assertFails(setDoc(doc(como('liderA'), 'aulas/n2'), { professorId: 'p1' }));
    await assertFails(setDoc(doc(como('mentor1'), 'aulas/n3'), nova('')));
  });
  it('professor e visitante não criam', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'aulas/n1'), nova('uniA')));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'aulas/n2'), nova('uniA')));
  });
});

describe('aulas: editar e excluir', () => {
  it('mentor e líder editam aula da própria unidade', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'aulas/aulaA'), { hora: '20:00' }));
    await assertSucceeds(updateDoc(doc(como('liderA'), 'aulas/aulaA'), { dataFim: '2026-12-01' }));
    await assertSucceeds(updateDoc(doc(como('liderA'), 'aulas/aulaA'), { excluido: true }));
  });
  it('não edita aula de outra unidade', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'aulas/aulaB'), { hora: '20:00' }));
    await assertFails(updateDoc(doc(como('liderA'), 'aulas/aulaB'), { hora: '20:00' }));
  });
  it('não "joga" a aula da própria unidade para a de outro', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'aulas/aulaA'), { unidadeId: 'uniB' }));
    await assertFails(updateDoc(doc(como('liderA'), 'aulas/aulaA'), { unidadeId: 'uniB' }));
    await assertSucceeds(updateDoc(doc(como('liderAB'), 'aulas/aulaA'), { unidadeId: 'uniB' }));
  });
  it('professor não edita', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'aulas/aulaA'), { valor: 999 }));
  });
  it('só o admin apaga de verdade', async () => {
    await assertFails(deleteDoc(doc(como('mentor1'), 'aulas/aulaA')));
    await assertFails(deleteDoc(doc(como('liderA'), 'aulas/aulaA')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'aulas/aulaA')));
  });
  it('a regra-curinga não reabre a gravação em aulas', async () => {
    // outro mentor tentando por caminho "genérico": continua barrado
    await assertFails(setDoc(doc(como('mentor2'), 'aulas/aulaA'), nova('uniA')));
  });
});

describe('aulas: leitura só para quem está logado (tem o valor da aula)', () => {
  it('visitante não lê', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'aulas/aulaA')));
  });
  it('conta sem crachá não lê', async () => {
    await assertFails(getDoc(doc(como('semCracha'), 'aulas/aulaA')));
  });
  it('professor, líder, mentor e admin leem', async () => {
    for (const uid of ['prof1', 'liderA', 'mentor1', 'admin1']) await assertSucceeds(getDoc(doc(como(uid), 'aulas/aulaA')));
  });
});

describe('aulas_publicas (cópia sem valor)', () => {
  it('qualquer pessoa lê', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'aulas_publicas/aulaA')));
  });
  it('mentor/líder gravam a cópia da própria unidade, mas nunca com o valor', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'aulas_publicas/x1'), { unidadeId: 'uniA', hora: '19:00' }));
    await assertSucceeds(setDoc(doc(como('liderA'), 'aulas_publicas/aulaA'), { unidadeId: 'uniA', hora: '20:00' }));
    await assertFails(setDoc(doc(como('mentor1'), 'aulas_publicas/x2'), { unidadeId: 'uniA', hora: '19:00', valor: 60 }));
    await assertFails(setDoc(doc(como('admin1'), 'aulas_publicas/x3'), { unidadeId: 'uniA', hora: '19:00', valor: 60 }));
  });
  it('não grava a cópia de outra unidade', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'aulas_publicas/aulaB'), { unidadeId: 'uniB', hora: '20:00' }));
    await assertFails(setDoc(doc(como('liderA'), 'aulas_publicas/aulaA'), { unidadeId: 'uniB' }));
  });
  it('professor e visitante não gravam', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'aulas_publicas/aulaA'), { unidadeId: 'uniA' }));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'aulas_publicas/aulaA'), { unidadeId: 'uniA' }));
  });
  it('lote da tela (aula + cópia) passa para o líder da unidade', async () => {
    const db = como('liderA');
    const lote = writeBatch(db);
    lote.set(doc(db, 'aulas/novaAula'), nova('uniA'));
    lote.set(doc(db, 'aulas_publicas/novaAula'), { unidadeId: 'uniA', hora: '19:00', dias: ['Terça'] });
    await assertSucceeds(lote.commit());
  });
  it('apagar a cópia: admin e quem cuida da unidade', async () => {
    await assertSucceeds(deleteDoc(doc(como('liderA'), 'aulas_publicas/aulaA')));
    await assertFails(deleteDoc(doc(como('liderA'), 'aulas_publicas/aulaB')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'aulas_publicas/aulaB')));
  });
});

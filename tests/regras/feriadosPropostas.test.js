// Propostas de feriado (mentor propõe, admin decide), no emulador local. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.PORTA_EMULADOR || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'feriados_propostas/pm1'), { propostoPor: 'mentor1', status: 'pendente', escopo: 'unidades', nome: 'X' });
    await setDoc(doc(db, 'feriados_propostas/pm1aprovada'), { propostoPor: 'mentor1', status: 'aprovada', escopo: 'unidades', nome: 'Y' });
    await setDoc(doc(db, 'feriados_propostas/pm2'), { propostoPor: 'mentor2', status: 'pendente', escopo: 'unidades', nome: 'Z' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const proposta = (uid, extra = {}) => ({ propostoPor: uid, status: 'pendente', escopo: 'unidades', nome: 'Recesso', dataInicio: '2026-12-24', dataFim: '2026-12-26', tipo: 'Recesso', unidadeIds: ['uniA'], ...extra });

describe('criar proposta', () => {
  it('mentor propõe (cidade ou unidades), pendente e em nome dele', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'feriados_propostas/n1'), proposta('mentor1')));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'feriados_propostas/n2'), proposta('mentor1', { escopo: 'cidade', cidade: 'BH' })));
  });
  it('mentor não propõe em nome de outro, nem já aprovada, nem escopo de rede/país/estado', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'feriados_propostas/n1'), proposta('mentor2')));
    await assertFails(setDoc(doc(como('mentor1'), 'feriados_propostas/n2'), proposta('mentor1', { status: 'aprovada' })));
    for (const escopo of ['rede', 'pais', 'estado']) await assertFails(setDoc(doc(como('mentor1'), `feriados_propostas/e_${escopo}`), proposta('mentor1', { escopo })));
  });
  it('líder, professor e visitante não propõem', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'feriados_propostas/n1'), proposta('liderA')));
    await assertFails(setDoc(doc(como('prof1'), 'feriados_propostas/n2'), proposta('prof1')));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'feriados_propostas/n3'), proposta('x')));
  });
});

describe('ler proposta', () => {
  it('admin lê todas; mentor só as dele', async () => {
    await assertSucceeds(getDocs(collection(como('admin1'), 'feriados_propostas')));
    await assertSucceeds(getDoc(doc(como('mentor1'), 'feriados_propostas/pm1')));
    await assertFails(getDoc(doc(como('mentor1'), 'feriados_propostas/pm2')));
    await assertSucceeds(getDocs(query(collection(como('mentor1'), 'feriados_propostas'), where('propostoPor', '==', 'mentor1'))));
    await assertFails(getDocs(collection(como('mentor1'), 'feriados_propostas')));
  });
  it('líder e professor não leem', async () => {
    await assertFails(getDoc(doc(como('liderA'), 'feriados_propostas/pm1')));
    await assertFails(getDoc(doc(como('prof1'), 'feriados_propostas/pm1')));
  });
});

describe('decidir e desistir', () => {
  it('só o admin aprova ou recusa', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'feriados_propostas/pm1'), { status: 'aprovada' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'feriados_propostas/pm1'), { status: 'aprovada' }));
    await assertFails(updateDoc(doc(como('mentor2'), 'feriados_propostas/pm1'), { status: 'recusada' }));
  });
  it('mentor desiste só da própria proposta pendente', async () => {
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'feriados_propostas/pm1')));
    await assertFails(deleteDoc(doc(como('mentor1'), 'feriados_propostas/pm1aprovada')));
    await assertFails(deleteDoc(doc(como('mentor1'), 'feriados_propostas/pm2')));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'feriados_propostas/pm2')));
  });
  it('a regra-curinga não reabre a coleção para os outros', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'feriados_propostas/pm1'), proposta('liderA')));
    await assertFails(getDoc(doc(como('liderA'), 'feriados_propostas/pm2')));
  });
});

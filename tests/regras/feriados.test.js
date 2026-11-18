// Só o admin grava feriado (a coleção feriados), no emulador local. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

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
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'feriados/f1'), { nome: 'Natal', dataInicio: '2026-12-25', dataFim: '2026-12-25', escopo: 'rede' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const feriado = { nome: 'Recesso', dataInicio: '2026-12-24', dataFim: '2026-12-26', tipo: 'Recesso', escopo: 'rede' };

describe('feriados: gravar', () => {
  it('admin cria, edita e apaga', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'feriados/n1'), feriado));
    await assertSucceeds(updateDoc(doc(como('admin1'), 'feriados/f1'), { nome: 'Natal 2026' }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'feriados/f1')));
  });
  it('mentor não cria, não edita e não apaga', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'feriados/n1'), feriado));
    await assertFails(updateDoc(doc(como('mentor1'), 'feriados/f1'), { nome: 'X' }));
    await assertFails(deleteDoc(doc(como('mentor1'), 'feriados/f1')));
  });
  it('líder, professor e visitante não gravam', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'feriados/n1'), feriado));
    await assertFails(deleteDoc(doc(como('liderA'), 'feriados/f1')));
    await assertFails(setDoc(doc(como('prof1'), 'feriados/n2'), feriado));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'feriados/n3'), feriado));
  });
});

describe('feriados: ler', () => {
  it('quem está logado lê; visitante não', async () => {
    for (const uid of ['admin1', 'mentor1', 'liderA', 'prof1']) await assertSucceeds(getDoc(doc(como(uid), 'feriados/f1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'feriados/f1')));
  });
});

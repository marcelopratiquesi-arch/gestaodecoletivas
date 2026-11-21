// Aviso obrigatório de cadastro incompleto: a própria pessoa (qualquer papel) grava a marca "nascimentoOk" e o adiamento do
// aviso no crachá, e nada além disso. Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const PESSOAS = ['admin1', 'mentor1', 'liderA', 'profA'];

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // admin1 sem nome e sem telefone de propósito: o adiamento tem de funcionar mesmo assim
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'M1', status: 'ativo', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', telefone: '31999990000', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/profA'), { role: 'professor', unidadeId: 'uniA', nome: 'Prof A', telefone: '31999990000', loginGoogle: true });
    await setDoc(doc(db, 'professores/fichaA'), { nome: 'PROF A', uidLogin: 'profA', status: 'ativo' });
    await setDoc(doc(db, 'professores/fichaB'), { nome: 'PROF B', uidLogin: 'profB', status: 'ativo' });
  });
});

describe('marca "nascimentoOk"', () => {
  it('grava junto com a data de nascimento (mesmo lote), para todos os papéis', async () => {
    for (const quem of PESSOAS) {
      const d = como(quem);
      const b = writeBatch(d);
      b.set(doc(d, `nascimentos/${quem}`), { nascimento: '1990-05-17', atualizadoEm: serverTimestamp() });
      b.update(doc(d, `usuarios/${quem}`), { nascimentoOk: true });
      await assertSucceeds(b.commit());
    }
  });
  it('quem já tinha a data guardada só coloca a marca (leitura única na entrada)', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'nascimentos/profA'), { nascimento: '1990-05-17' }));
    await assertSucceeds(updateDoc(doc(como('profA'), 'usuarios/profA'), { nascimentoOk: true }));
  });
  it('NÃO grava a marca sem a data guardada, nem "false", nem a de outra pessoa', async () => {
    await assertFails(updateDoc(doc(como('profA'), 'usuarios/profA'), { nascimentoOk: true }));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'nascimentos/profA'), { nascimento: '1990-05-17' }));
    await assertFails(updateDoc(doc(como('profA'), 'usuarios/profA'), { nascimentoOk: false }));
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/profA'), { nascimentoOk: true }));
  });
});

describe('adiar o aviso (1 por dia)', () => {
  it('todos os papéis gravam a contagem, até quem ainda não tem nome nem telefone', async () => {
    for (const quem of PESSOAS) {
      await assertSucceeds(updateDoc(doc(como(quem), `usuarios/${quem}`), { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21' }));
      await assertSucceeds(updateDoc(doc(como(quem), `usuarios/${quem}`), { cadastroAdiamentos: 2, cadastroAdiadoEm: '2026-11-22' }));
    }
  });
  it('recusa contagem fora do formato e a de outra pessoa', async () => {
    const p = como('profA');
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: 4, cadastroAdiadoEm: '2026-11-21' }));
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: -1, cadastroAdiadoEm: '2026-11-21' }));
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: '1', cadastroAdiadoEm: '2026-11-21' }));
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: 1, cadastroAdiadoEm: 'ontem' }));
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/profA'), { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21' }));
  });
  it('NÃO aproveita o adiamento para mudar papel, unidade ou status', async () => {
    const p = como('profA');
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21', role: 'admin' }));
    await assertFails(updateDoc(doc(p, 'usuarios/profA'), { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21', unidadeId: 'uniB' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21', status: 'ativo2' }));
  });
});

describe('completar tudo de uma vez (o que o aviso salva)', () => {
  it('contato + marca de nascimento no mesmo lote', async () => {
    const d = como('liderA');
    const b = writeBatch(d);
    b.set(doc(d, 'nascimentos/liderA'), { nascimento: '1985-02-03', atualizadoEm: serverTimestamp() });
    b.update(doc(d, 'usuarios/liderA'), { nome: 'LIDER A', telefone: '(31) 98888-7777', pais: 'BR', emailContato: 'a@x.com', nascimentoOk: true });
    await assertSucceeds(b.commit());
  });
});

describe('ficha do professor espelha a marca (a lista de Professores lê fichas)', () => {
  it('a própria pessoa grava a marca na própria ficha junto com o crachá, e só com a data guardada', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'nascimentos/profA'), { nascimento: '1990-05-17' }));
    const d = como('profA');
    const b = writeBatch(d);
    b.update(doc(d, 'usuarios/profA'), { nascimentoOk: true });
    b.update(doc(d, 'professores/fichaA'), { nascimentoOk: true });
    await assertSucceeds(b.commit());
  });
  it('NÃO grava a marca na ficha sem a data, na ficha de outro, nem outros campos junto', async () => {
    await assertFails(updateDoc(doc(como('profA'), 'professores/fichaA'), { nascimentoOk: true }));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'nascimentos/profA'), { nascimento: '1990-05-17' }));
    await assertFails(updateDoc(doc(como('profA'), 'professores/fichaB'), { nascimentoOk: true }));
    await assertFails(updateDoc(doc(como('profA'), 'professores/fichaA'), { nascimentoOk: true, tipoContrato: 'saver' }));
    await assertFails(updateDoc(doc(como('liderA'), 'professores/fichaA'), { nascimentoOk: true }));
  });
});

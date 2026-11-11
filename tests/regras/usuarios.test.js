// Testes das regras do Firestore, rodando no emulador local (não toca no banco real nem gasta cota).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => { await env?.cleanup(); });

// Cenário: 1 admin, 2 mentores, 2 unidades (uma de cada mentor), 1 professor.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/adminMaiusculo'), { role: 'Admin', nome: 'Admin 2' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'Unidade A', mentorId: 'mentor1', senhaPainel: '123456' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'Unidade B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/loginUniA'), { role: 'unidade', unidadeId: 'uniA', nome: 'Unidade A', telefone: '1' });
    await setDoc(doc(db, 'usuarios/loginUniB'), { role: 'unidade', unidadeId: 'uniB', nome: 'Unidade B' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', nome: 'Prof' });
    await setDoc(doc(db, 'aulas/aula1'), { unidadeId: 'uniA' });
    await setDoc(doc(db, 'publico/vitrine'), { unidades: { uniA: { nome: 'Unidade A' } }, professores: { p1: 'Prof' } });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe('ninguém se promove sozinho', () => {
  it('professor NÃO vira admin', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'usuarios/prof1'), { role: 'admin' }));
  });
  it('unidade NÃO vira admin nem mentor', async () => {
    await assertFails(updateDoc(doc(como('loginUniA'), 'usuarios/loginUniA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(como('loginUniA'), 'usuarios/loginUniA'), { role: 'mentor' }));
  });
  it('mentor NÃO vira admin', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor1'), { role: 'admin' }));
  });
  it('alguém sem crachá NÃO cria crachá de admin para si', async () => {
    await assertFails(setDoc(doc(como('estranho'), 'usuarios/estranho'), { role: 'admin' }));
  });
});

describe('admin continua podendo tudo em usuarios', () => {
  it('muda papel (Controle de Acessos)', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/prof1'), { role: 'mentor' }));
  });
  it('admin gravado como "Admin" (maiúsculo) também funciona', async () => {
    await assertSucceeds(updateDoc(doc(como('adminMaiusculo'), 'usuarios/prof1'), { status: 'inativo' }));
  });
  it('cria mentor, inativa e exclui', async () => {
    const db = como('admin1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/mentor3'), { role: 'mentor', nome: 'M3' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/mentor3'), { status: 'inativo' }));
    await assertSucceeds(deleteDoc(doc(db, 'usuarios/mentor3')));
  });
});

describe('mentor: o que as telas dele fazem continua funcionando', () => {
  it('cria login de unidade e de professor', async () => {
    const db = como('mentor1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/novaUni'), { role: 'unidade', unidadeId: 'uniA' }));
    await assertSucceeds(setDoc(doc(db, 'usuarios/novoProf'), { role: 'professor' }));
  });
  it('NÃO cria mentor nem admin', async () => {
    const db = como('mentor1');
    await assertFails(setDoc(doc(db, 'usuarios/x'), { role: 'mentor' }));
    await assertFails(setDoc(doc(db, 'usuarios/y'), { role: 'admin' }));
  });
  it('edita telefone/e-mail da unidade e nome do professor', async () => {
    const db = como('mentor1');
    await assertSucceeds(updateDoc(doc(db, 'usuarios/loginUniA'), { telefone: '+55 31 9', email: 'a@b.com' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/prof1'), { nome: 'Prof Novo' }));
  });
  it('NÃO muda papel nem unidade de um login', async () => {
    const db = como('mentor1');
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), { unidadeId: 'uniB' }));
  });
  it('NÃO edita outro mentor', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/mentor2'), { nome: 'X' }));
  });
  it('exclui login da PRÓPRIA unidade, não da unidade de outro mentor', async () => {
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'usuarios/loginUniA')));
    await assertFails(deleteDoc(doc(como('mentor1'), 'usuarios/loginUniB')));
  });
  it('NÃO exclui mentor nem professor', async () => {
    await assertFails(deleteDoc(doc(como('mentor1'), 'usuarios/mentor2')));
    await assertFails(deleteDoc(doc(como('mentor1'), 'usuarios/prof1')));
  });
});

describe('unidade: cadastro de professor continua funcionando', () => {
  it('cria login de professor e edita o nome', async () => {
    const db = como('loginUniA');
    await assertSucceeds(setDoc(doc(db, 'usuarios/profNovo'), { role: 'professor' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/prof1'), { nome: 'Outro Nome' }));
  });
  it('NÃO cria unidade/mentor/admin e NÃO exclui ninguém', async () => {
    const db = como('loginUniA');
    await assertFails(setDoc(doc(db, 'usuarios/u2'), { role: 'unidade' }));
    await assertFails(setDoc(doc(db, 'usuarios/m2'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'usuarios/prof1')));
  });
});

describe('professor', () => {
  it('NÃO cria nem edita crachás', async () => {
    const db = como('prof1');
    await assertFails(setDoc(doc(db, 'usuarios/z'), { role: 'professor' }));
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), { nome: 'X' }));
  });
});

describe('favoritos do Pratique Play', () => {
  it('cada um salva, lê e remove os próprios favoritos', async () => {
    const db = como('prof1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/prof1/favoritos_play/faixa1'), { titulo: 'X' }));
    await assertSucceeds(getDoc(doc(db, 'usuarios/prof1/favoritos_play/faixa1')));
    await assertSucceeds(deleteDoc(doc(db, 'usuarios/prof1/favoritos_play/faixa1')));
  });
  it('NÃO mexe nos favoritos de outra pessoa', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'usuarios/mentor1/favoritos_play/f'), { titulo: 'X' }));
  });
});

describe('página pública de horários (vitrine)', () => {
  it('sem login: lê a vitrine, as aulas e as modalidades', async () => {
    const db = anonimo();
    await assertSucceeds(getDoc(doc(db, 'publico/vitrine')));
    await assertSucceeds(getDoc(doc(db, 'aulas/aula1')));
    await assertSucceeds(getDoc(doc(db, 'modalidades/m1')));
  });
  it('sem login: NÃO lê os cadastros completos (e-mail, telefone) de unidades e professores', async () => {
    const db = anonimo();
    await assertFails(getDoc(doc(db, 'unidades/uniA')));
    await assertFails(getDoc(doc(db, 'professores/p1')));
  });
  it('sem login: NÃO grava na vitrine', async () => {
    await assertFails(setDoc(doc(anonimo(), 'publico/vitrine'), { unidades: {} }));
  });
  it('admin, mentor e unidade atualizam a vitrine (telas de cadastro)', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'publico/vitrine'), { unidades: {}, professores: {} }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'publico/vitrine'), { 'unidades.uniA': { nome: 'A' } }));
    await assertSucceeds(updateDoc(doc(como('loginUniA'), 'publico/vitrine'), { 'professores.p1': 'Prof' }));
  });
  it('professor NÃO mexe na vitrine', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'publico/vitrine'), { 'professores.p1': 'Hacker' }));
  });
});

describe('o resto do sistema não mudou', () => {
  it('sem login: lê aulas (página de horários), não lê usuarios nem validações', async () => {
    const db = anonimo();
    await assertSucceeds(getDoc(doc(db, 'aulas/aula1')));
    await assertFails(getDoc(doc(db, 'usuarios/admin1')));
    await assertFails(getDoc(doc(db, 'validacoes/v1')));
  });
  it('sem login: não escreve nada', async () => {
    await assertFails(setDoc(doc(anonimo(), 'aulas/aula2'), { x: 1 }));
    await assertFails(addDoc(collection(anonimo(), 'validacoes'), { x: 1 }));
  });
  it('logado: lê cadastros de unidades e professores', async () => {
    const db = como('prof1');
    await assertSucceeds(getDoc(doc(db, 'unidades/uniA')));
    await assertSucceeds(getDoc(doc(db, 'professores/p1')));
  });
  it('logado: lê crachás e grava aulas, validações e auditoria como antes', async () => {
    const db = como('loginUniA');
    await assertSucceeds(getDoc(doc(db, 'usuarios/admin1')));
    await assertSucceeds(setDoc(doc(db, 'aulas/aula2'), { unidadeId: 'uniA' }));
    await assertSucceeds(addDoc(collection(db, 'validacoes'), { x: 1 }));
    await assertSucceeds(addDoc(collection(db, 'auditoria_cronograma'), { x: 1 }));
  });
});

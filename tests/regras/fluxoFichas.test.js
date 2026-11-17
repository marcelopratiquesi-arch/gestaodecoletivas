// Fluxos completos com o CÓDIGO REAL do site (juntar fichas e ligar ficha ao crachá) contra o emulador, com as
// regras de produção. Reproduz os casos reais: Bárbara (ficha antiga ligada ao login da senha + login novo do
// Google com CPF) e Márcia (líder que já foi professora, ficha antiga ligada ao login antigo).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';

// O site usa `db` e `auth` de services/firebase: aqui eles viram o banco de testes, logado como admin.
const ctx = vi.hoisted(() => ({ db: null, uid: 'admin1' }));
vi.mock('../../src/services/firebase', () => {
  const auth = { currentUser: { uid: ctx.uid } };
  return { db: ctx.db, auth };
});

const CPF = '52998224725';
let env, juntar, ligar, fichasDoLogin;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  ctx.db = env.authenticatedContext('admin1', { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
  juntar = await import('../../src/services/juntarFichasService');
  ligar = juntar.ligarFichaAoCracha;
  ({ fichasDoLogin } = await import('../../src/utils/repetidos'));
});
afterAll(async () => { await env?.cleanup(); });

const semRegras = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const ler = async (caminho) => { const s = await getDoc(doc(ctx.db, caminho)); return s.exists() ? s.data() : null; };
const fichasAtuais = async () => (await getDocs(collection(ctx.db, 'professores'))).docs.map(d => ({ id: d.id, ...d.data() }));

beforeEach(async () => {
  await env.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'unidades/floramar'), { nome: 'Floramar', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/saoGeraldo'), { nome: 'São Geraldo', mentorId: 'mentor1' });
  });
});

describe('Bárbara: ficha antiga (login da senha) + login novo do Google com CPF', () => {
  beforeEach(async () => {
    await semRegras(async (db) => {
      // Ficha antiga da grade, ligada ao login antigo, com aula, vínculo e histórico.
      await setDoc(doc(db, 'professores/fichaVelha'), { nome: 'Barbara Bianca Morais', email: 'barbarabianca_66@gmail.com', telefone: '31986138170', pais: 'BR', status: 'ativo', uidLogin: 'loginVelho' });
      await setDoc(doc(db, 'usuarios/loginVelho'), { role: 'professor', nome: 'Barbara Bianca Morais', professorId: 'fichaVelha' });
      await setDoc(doc(db, 'vinculos/v1'), { professorId: 'fichaVelha', unidadeId: 'floramar', status: 'ativo' });
      await setDoc(doc(db, 'aulas/a1'), { professorId: 'fichaVelha', unidadeId: 'floramar', valor: 50 });
      await setDoc(doc(db, 'aulas_publicas/a1'), { professorId: 'fichaVelha', unidadeId: 'floramar' });
      await setDoc(doc(db, 'validacoes/a1_2026-10-05'), { professorId: 'fichaVelha', aulaId: 'a1', unidadeId: 'floramar', data: '2026-10-05', status: 'realizada' });
      // Login novo (Google), aprovado, com CPF guardado no login.
      await setDoc(doc(db, 'usuarios/loginGoogle'), { role: 'professor', nome: 'Bárbara Bianca Morais Pinho', email: 'barbarabianca_66@hotmail.com', telefone: '31986138170', loginGoogle: true, unidadeId: 'floramar' });
      await setDoc(doc(db, 'documentos_privados/loginGoogle'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'loginGoogle', tipo: 'cpf', numero: CPF });
    });
  });

  it('o "Adicionar professor" ACHA a ficha antiga (antes ele a descartava e criava uma duplicada)', async () => {
    const cracha = await ler('usuarios/loginGoogle');
    const r = fichasDoLogin(await fichasAtuais(), 'loginGoogle', cracha, 'BR');
    expect(r.ligada).toBeNull();
    expect(r.parecidas.map(a => a.ficha.id)).toEqual(['fichaVelha']);
    expect(r.parecidas[0].campos).toContain('telefone');
  });

  it('Ligar ao crachá: a ficha antiga fica com o login novo, o CPF e TUDO o que já tinha', async () => {
    const ficha = (await fichasAtuais()).find(f => f.id === 'fichaVelha');
    const r = await ligar({ ficha, cracha: { id: 'loginGoogle', nome: 'Bárbara' }, quem: { id: 'admin1' } });
    expect(r.copiouDocumento).toBe(true);
    const f = await ler('professores/fichaVelha');
    expect(f.uidLogin).toBe('loginGoogle');
    expect(f.documentoOk).toBe(true);
    expect(f.nome).toBe('Barbara Bianca Morais');
    expect(await ler('documentos_ficha/fichaVelha')).toMatchObject({ tipo: 'cpf', numero: CPF });
    expect(await ler(`documentos_professor/cpf_${CPF}`)).toMatchObject({ professorId: 'fichaVelha' });
    expect((await ler('usuarios/loginGoogle')).professorId).toBe('fichaVelha');
    expect((await ler('aulas/a1')).professorId).toBe('fichaVelha');
    expect((await ler('vinculos/v1')).professorId).toBe('fichaVelha');
  });

  it('cenário que aconteceu: ficha DUPLICADA criada com o CPF + Juntar mantendo a ANTIGA → o CPF vai junto', async () => {
    // A ficha duplicada que o "Adicionar professor" criou (nome novo, e-mail novo, login novo, com CPF).
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fichaNova'), { nome: 'BÁRBARA BIANCA MORAIS PINHO', email: 'barbarabianca_66@hotmail.com', telefone: '(31) 98613-8170', pais: 'BR', status: 'ativo', uidLogin: 'loginGoogle', documentoOk: true });
      await setDoc(doc(db, 'documentos_ficha/fichaNova'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaNova', tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, 'vinculos/v2'), { professorId: 'fichaNova', unidadeId: 'floramar', status: 'ativo' });
    });
    const todas = await fichasAtuais();
    const velha = todas.find(f => f.id === 'fichaVelha');
    const nova = todas.find(f => f.id === 'fichaNova');
    // Mantém a antiga, mas escolhe o NOME e o E-MAIL da nova (novidade da tela).
    const { plano } = await juntar.prepararJuncao(velha, [nova], { nome: nova.nome, email: nova.email, telefone: velha.telefone });
    expect(plano.conflitoDocumento).toBe(false);
    expect(plano.documento).toMatchObject({ deId: 'fichaNova' });
    await juntar.executarJuncao({ plano, principal: velha, outras: [nova], quem: { id: 'admin1' } });

    expect(await ler('professores/fichaNova')).toBeNull();
    const f = await ler('professores/fichaVelha');
    expect(f).toMatchObject({ nome: 'BÁRBARA BIANCA MORAIS PINHO', email: 'barbarabianca_66@hotmail.com', uidLogin: 'loginGoogle', documentoOk: true });
    expect(await ler('documentos_ficha/fichaVelha')).toMatchObject({ numero: CPF });
    expect(await ler('documentos_ficha/fichaNova')).toBeNull();
    expect(await ler(`documentos_professor/cpf_${CPF}`)).toMatchObject({ professorId: 'fichaVelha' });
    expect(await ler('vinculos/v2')).toBeNull(); // mesma unidade: ligação repetida removida
    expect((await ler('aulas/a1')).professorId).toBe('fichaVelha');
  });

  it('Juntar mantendo a NOVA: aulas, histórico e unidade da antiga passam para ela', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fichaNova'), { nome: 'BÁRBARA BIANCA MORAIS PINHO', email: 'barbarabianca_66@hotmail.com', telefone: '(31) 98613-8170', pais: 'BR', status: 'ativo', uidLogin: 'loginGoogle', documentoOk: true });
      await setDoc(doc(db, 'documentos_ficha/fichaNova'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaNova', tipo: 'cpf', numero: CPF });
    });
    const todas = await fichasAtuais();
    const velha = todas.find(f => f.id === 'fichaVelha');
    const nova = todas.find(f => f.id === 'fichaNova');
    const { plano } = await juntar.prepararJuncao(nova, [velha], {});
    await juntar.executarJuncao({ plano, principal: nova, outras: [velha], quem: { id: 'admin1' } });
    expect(await ler('professores/fichaVelha')).toBeNull();
    expect((await ler('aulas/a1')).professorId).toBe('fichaNova');
    expect((await ler('aulas_publicas/a1')).professorId).toBe('fichaNova');
    expect((await ler('validacoes/a1_2026-10-05')).professorId).toBe('fichaNova');
    expect((await ler('vinculos/v1')).professorId).toBe('fichaNova');
    expect((await ler('professores/fichaNova')).documentoOk).toBe(true);
    expect(await ler('documentos_ficha/fichaNova')).toMatchObject({ numero: CPF });
  });
});

describe('consertar a Bárbara pelo "Adicionar professor" (qualquer estado em que ela tenha ficado)', () => {
  beforeEach(async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'usuarios/loginGoogle'), { role: 'professor', nome: 'Bárbara', email: 'b@hotmail.com', telefone: '31986138170', loginGoogle: true });
      await setDoc(doc(db, 'documentos_privados/loginGoogle'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'loginGoogle', tipo: 'cpf', numero: CPF });
    });
  });

  it('ficha já ligada ao login, mas SEM CPF: é achada como "ligada" e recebe o CPF', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fichaVelha'), { nome: 'Barbara', status: 'ativo', uidLogin: 'loginGoogle' });
    });
    const r = fichasDoLogin(await fichasAtuais(), 'loginGoogle', await ler('usuarios/loginGoogle'), 'BR');
    expect(r.ligada?.id).toBe('fichaVelha');
    // O que a tela grava ao confirmar (mesmo código: documentoDaFichaNoLote).
    const { documentoDaFichaNoLote } = await import('../../src/services/documentoFichaService');
    const { writeBatch } = await import('firebase/firestore');
    const b = writeBatch(ctx.db);
    b.update(doc(ctx.db, 'professores/fichaVelha'), { documentoOk: true });
    documentoDaFichaNoLote(b, { professorId: 'fichaVelha', tipo: 'cpf', numero: CPF, marcarFicha: false });
    await b.commit();
    expect((await ler('professores/fichaVelha')).documentoOk).toBe(true);
    expect(await ler(`documentos_professor/cpf_${CPF}`)).toMatchObject({ professorId: 'fichaVelha' });
  });

  it('reserva "órfã" (ficha apagada): admin limpa a sobra e o CPF pode ir para a ficha certa', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, `documentos_professor/cpf_${CPF}`), { professorId: 'fichaApagada', tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, 'documentos_ficha/fichaApagada'), { tipo: 'cpf', numero: CPF });
    });
    const { limparReservaOrfa, acharFichaPorDocumento } = await import('../../src/services/documentoFichaService');
    await limparReservaOrfa('cpf', CPF, 'fichaApagada');
    expect(await acharFichaPorDocumento('cpf', CPF)).toBeNull();
    expect(await ler('documentos_ficha/fichaApagada')).toBeNull();
  });
});

describe('Márcia: líder hoje, professora no passado (ficha antiga ligada ao login antigo)', () => {
  beforeEach(async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fichaMarcia'), { nome: 'Marcia Carolina', email: 'marciacarolinacoelhodelima@gmail.com', telefone: '31987639873', pais: 'BR', status: 'ativo', uidLogin: 'loginAntigoMarcia' });
      await setDoc(doc(db, 'validacoes/x_2025-03-01'), { professorId: 'fichaMarcia', unidadeId: 'saoGeraldo', data: '2025-03-01', status: 'realizada' });
      await setDoc(doc(db, 'usuarios/liderMarcia'), { role: 'lider', nome: 'Márcia Carolina Coelho de Lima', email: 'marciaclima06@gmail.com', loginGoogle: true, unidadeId: 'saoGeraldo', unidadeIds: ['saoGeraldo'] });
      await setDoc(doc(db, 'documentos_privados/liderMarcia'), { tipo: 'cpf', numero: CPF });
      await setDoc(doc(db, `documentos_unicos/cpf_${CPF}`), { uid: 'liderMarcia', tipo: 'cpf', numero: CPF });
    });
  });

  it('Ligar: ela continua LÍDER da mesma unidade; a ficha ganha o login dela e o CPF; o histórico fica', async () => {
    const ficha = (await fichasAtuais())[0];
    await ligar({ ficha, cracha: { id: 'liderMarcia', nome: 'Márcia' }, quem: { id: 'admin1' } });
    const c = await ler('usuarios/liderMarcia');
    expect(c).toMatchObject({ role: 'lider', unidadeId: 'saoGeraldo', unidadeIds: ['saoGeraldo'], professorId: 'fichaMarcia' });
    const f = await ler('professores/fichaMarcia');
    expect(f).toMatchObject({ uidLogin: 'liderMarcia', documentoOk: true, nome: 'Marcia Carolina' });
    expect((await ler('validacoes/x_2025-03-01')).professorId).toBe('fichaMarcia');
  });

  it('CPF diferente na ficha e no login: NÃO liga', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'professores/fichaMarcia'), { nome: 'Marcia Carolina', status: 'ativo', uidLogin: 'loginAntigoMarcia', documentoOk: true });
      await setDoc(doc(db, 'documentos_ficha/fichaMarcia'), { tipo: 'cpf', numero: '11144477735' });
    });
    const ficha = (await fichasAtuais())[0];
    await expect(ligar({ ficha, cracha: { id: 'liderMarcia' }, quem: { id: 'admin1' } })).rejects.toThrow('DOCUMENTOS_DIFERENTES');
    expect((await ler('professores/fichaMarcia')).uidLogin).toBe('loginAntigoMarcia');
  });
});

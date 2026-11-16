// Documento de identificação (CPF/DNI/SSN): gaveta privada, reserva única e quem vê/corrige.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });

// Cenário: admin1; mentor1 (uniA); mentor2 (uniB); liderA (uniA); liderB (uniB); outroLider (uniA); mentorX (sem unidade).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1', status: 'ativo' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2', status: 'ativo' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/outroLider'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Outro', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'], nome: 'Líder B', loginGoogle: true });
  });
});
const como = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['1'] } } }).firestore();
const googleNovo = (uid, email) => env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'google.com' } }).firestore();

const CPF = '52998224725'; // CPF de teste válido
const CPF2 = '11144477735';

// Grava o documento de `alvo` como a tela faz: gaveta + reserva (+ marca o crachá, se pedido).
function gravar(quem, alvo, { tipo = 'cpf', numero = CPF, anterior = null, marcar = false, extraGaveta = {} } = {}) {
  const db = como(quem);
  const b = writeBatch(db);
  b.set(doc(db, 'documentos_privados', alvo), { tipo, numero, atualizadoEm: serverTimestamp(), atualizadoPor: quem, ...extraGaveta });
  if (anterior) b.delete(doc(db, 'documentos_unicos', `${anterior.tipo}_${anterior.numero}`));
  b.set(doc(db, 'documentos_unicos', `${tipo}_${numero}`), { uid: alvo, tipo, numero });
  if (marcar) b.update(doc(db, 'usuarios', alvo), { documentoOk: true });
  return b.commit();
}

describe('informar o próprio documento', () => {
  it('líder grava o documento e marca o crachá', async () => {
    await assertSucceeds(gravar('liderA', 'liderA', { marcar: true }));
  });
  it('aceita DNI argentino e SSN americano', async () => {
    await assertSucceeds(gravar('liderA', 'liderA', { tipo: 'dni', numero: '30123456' }));
    await assertSucceeds(gravar('liderB', 'liderB', { tipo: 'ssn', numero: '123456789' }));
  });
  it('NÃO aceita formato errado nem tipo inventado', async () => {
    await assertFails(gravar('liderA', 'liderA', { numero: '1234567890' }));
    await assertFails(gravar('liderA', 'liderA', { tipo: 'rg', numero: CPF }));
    await assertFails(gravar('liderA', 'liderA', { extraGaveta: { extra: 'x' } }));
  });
  it('NÃO marca "documentoOk" sem ter gravado o documento', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/liderA'), { documentoOk: true }));
  });
  it('NÃO aproveita o "documentoOk" para mexer em outros campos do crachá', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'documentos_privados/liderA'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'liderA' });
    b.set(doc(db, 'documentos_unicos', `cpf_${CPF}`), { uid: 'liderA', tipo: 'cpf', numero: CPF });
    b.update(doc(db, 'usuarios/liderA'), { documentoOk: true, role: 'admin' });
    await assertFails(b.commit());
  });
  it('NÃO grava o documento de outra pessoa (nem líder de outra unidade)', async () => {
    await assertFails(gravar('liderA', 'outroLider'));
    await assertFails(gravar('mentor2', 'liderA'));
  });
});

describe('documento repetido', () => {
  it('o mesmo documento não vale para duas pessoas', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertFails(gravar('outroLider', 'outroLider'));
  });
  it('a mesma pessoa pode regravar o próprio documento', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertSucceeds(gravar('liderA', 'liderA'));
  });
  it('corrigir o número libera o antigo para outra pessoa', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertSucceeds(gravar('liderA', 'liderA', { numero: CPF2, anterior: { tipo: 'cpf', numero: CPF } }));
    await assertSucceeds(gravar('outroLider', 'outroLider'));
  });
  it('NÃO reserva um código diferente do número gravado', async () => {
    const db = como('liderA');
    const b = writeBatch(db);
    b.set(doc(db, 'documentos_privados/liderA'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'liderA' });
    b.set(doc(db, 'documentos_unicos', `cpf_${CPF2}`), { uid: 'liderA', tipo: 'cpf', numero: CPF2 });
    await assertFails(b.commit());
  });
  it('NÃO apaga nem toma a reserva de outra pessoa', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertFails(deleteDoc(doc(como('outroLider'), `documentos_unicos/cpf_${CPF}`)));
    await assertFails(setDoc(doc(como('outroLider'), `documentos_unicos/cpf_${CPF}`), { uid: 'outroLider', tipo: 'cpf', numero: CPF }));
  });
});

describe('quem vê o documento', () => {
  beforeEach(async () => { await gravar('liderA', 'liderA', { marcar: true }); });
  it('a pessoa, o admin e o mentor da unidade dela veem', async () => {
    await assertSucceeds(getDoc(doc(como('liderA'), 'documentos_privados/liderA')));
    await assertSucceeds(getDoc(doc(como('admin1'), 'documentos_privados/liderA')));
    await assertSucceeds(getDoc(doc(como('mentor1'), 'documentos_privados/liderA')));
  });
  it('outro líder, outro mentor e professor NÃO veem', async () => {
    await assertFails(getDoc(doc(como('outroLider'), 'documentos_privados/liderA')));
    await assertFails(getDoc(doc(como('mentor2'), 'documentos_privados/liderA')));
    await assertFails(getDoc(doc(como('liderB'), 'documentos_privados/liderA')));
  });
  it('o número NÃO aparece no crachá aberto', async () => {
    const dados = (await getDoc(doc(como('outroLider'), 'usuarios/liderA'))).data();
    if (JSON.stringify(dados).includes(CPF)) throw new Error('CPF vazou no crachá');
  });
  it('só o admin lê a reserva (busca por documento)', async () => {
    await assertSucceeds(getDoc(doc(como('admin1'), `documentos_unicos/cpf_${CPF}`)));
    await assertFails(getDoc(doc(como('mentor1'), `documentos_unicos/cpf_${CPF}`)));
    await assertFails(getDoc(doc(como('liderA'), `documentos_unicos/cpf_${CPF}`)));
  });
});

describe('quem corrige o documento', () => {
  it('admin corrige o de qualquer pessoa, inclusive mentor', async () => {
    await assertSucceeds(gravar('admin1', 'liderB', { marcar: true }));
    await assertSucceeds(gravar('admin1', 'mentor2', { numero: CPF2, marcar: true }));
  });
  it('mentor corrige o dos líderes da unidade dele, mas não de outra unidade nem de outro mentor', async () => {
    await assertSucceeds(gravar('mentor1', 'liderA'));
    await assertFails(gravar('mentor1', 'liderB', { numero: CPF2 }));
    await assertFails(gravar('mentor1', 'mentor2', { numero: CPF2 }));
  });
  it('mentor corrige trocando o número e o antigo fica livre', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertSucceeds(gravar('mentor1', 'liderA', { numero: CPF2, anterior: { tipo: 'cpf', numero: CPF } }));
    await assertSucceeds(gravar('outroLider', 'outroLider'));
  });
  it('mentor NÃO marca o crachá de outra pessoa', async () => {
    await assertFails(gravar('mentor1', 'liderA', { marcar: true }));
  });
});

describe('documento no pedido de acesso', () => {
  const pedido = {
    nome: 'Novo Líder', telefone: '+55 31 99999-0000', unidadeId: 'uniA', unidadeNome: 'A', unidadeIds: ['uniA'],
    papel: 'lider', email: 'novato@gmail.com', status: 'pendente', documentoOk: true,
  };
  function pedir(uid = 'novato', numero = CPF) {
    const db = googleNovo(uid, 'novato@gmail.com');
    const b = writeBatch(db);
    b.set(doc(db, 'solicitacoes_acesso', uid), pedido);
    b.set(doc(db, 'documentos_do_pedido', uid), { tipo: 'cpf', numero, atualizadoPor: uid });
    b.set(doc(db, 'documentos_unicos', `cpf_${numero}`), { uid, tipo: 'cpf', numero });
    return b.commit();
  }
  it('o pedido leva o documento junto e já reserva o número', async () => {
    await assertSucceeds(pedir());
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'usuarios/outro'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB'] }); });
    await assertFails(gravar('outroLider', 'outroLider'));
  });
  it('quem usa documento já reservado por outra pessoa é recusado', async () => {
    await assertSucceeds(gravar('liderA', 'liderA'));
    await assertFails(pedir());
  });
  it('o documento do pedido é lido só por ele, admin e mentor da unidade', async () => {
    await pedir();
    await assertSucceeds(getDoc(doc(googleNovo('novato', 'novato@gmail.com'), 'documentos_do_pedido/novato')));
    await assertSucceeds(getDoc(doc(como('admin1'), 'documentos_do_pedido/novato')));
    await assertSucceeds(getDoc(doc(como('mentor1'), 'documentos_do_pedido/novato')));
    await assertFails(getDoc(doc(como('mentor2'), 'documentos_do_pedido/novato')));
    await assertFails(getDoc(doc(como('liderA'), 'documentos_do_pedido/novato')));
  });
  it('aprovado, a pessoa copia o documento do pedido para a gaveta do crachá', async () => {
    await pedir();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/novato'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], loginGoogle: true });
    });
    await assertSucceeds(gravar('novato', 'novato', { marcar: true }));
  });
  it('NÃO cria pedido com "documentoOk: false"', async () => {
    const db = googleNovo('novato', 'novato@gmail.com');
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/novato'), { ...pedido, documentoOk: false }));
  });
});

describe('atualização de cadastro com o documento', () => {
  const atualiza = (extra = {}) => ({
    nome: 'Líder Atualizado', telefone: '+55 31 99999-0000', email: 'liderx@gmail.com', loginGoogle: true,
    cadastroAtualizadoEm: serverTimestamp(), ...extra,
  });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/liderX'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Antigo', email: 'liderx@x.com' });
    });
  });
  it('atualiza o contato e informa o documento na mesma gravação', async () => {
    const db = como('liderX');
    const b = writeBatch(db);
    b.update(doc(db, 'usuarios/liderX'), atualiza({ documentoOk: true }));
    b.set(doc(db, 'documentos_privados/liderX'), { tipo: 'cpf', numero: CPF, atualizadoPor: 'liderX' });
    b.set(doc(db, 'documentos_unicos', `cpf_${CPF}`), { uid: 'liderX', tipo: 'cpf', numero: CPF });
    await assertSucceeds(b.commit());
  });
  it('NÃO diz "documentoOk" na atualização sem ter o documento', async () => {
    await assertFails(updateDoc(doc(como('liderX'), 'usuarios/liderX'), atualiza({ documentoOk: true })));
  });
});

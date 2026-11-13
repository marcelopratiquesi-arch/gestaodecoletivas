// Testes das regras do Firestore, rodando no emulador local (não toca no banco real nem gasta cota).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, writeBatch, deleteField } from 'firebase/firestore';

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
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', nome: 'Líder A' });
    await setDoc(doc(db, 'usuarios/liderB'), { role: 'lider', unidadeId: 'uniB', nome: 'Líder B' });
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
  it('logado: lê crachás e grava aulas e auditoria como antes', async () => {
    const db = como('loginUniA');
    await assertSucceeds(getDoc(doc(db, 'usuarios/admin1')));
    await assertSucceeds(setDoc(doc(db, 'aulas/aula2'), { unidadeId: 'uniA' }));
    await assertSucceeds(addDoc(collection(db, 'auditoria_cronograma'), { x: 1 }));
  });
  it('validações agora têm regra própria: lixo sem aula/data/prazo é recusado (ver validacoes.test.js)', async () => {
    await assertFails(addDoc(collection(como('loginUniA'), 'validacoes'), { x: 1 }));
  });
});

describe('líder (perfil novo "lider"): mesmas permissões do antigo "unidade"', () => {
  it('NÃO vira admin nem mentor', async () => {
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/liderA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/liderA'), { role: 'mentor' }));
  });
  it('cria login de professor e edita o nome', async () => {
    const db = como('liderA');
    await assertSucceeds(setDoc(doc(db, 'usuarios/profDoLider'), { role: 'professor' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/prof1'), { nome: 'Outro Nome' }));
  });
  it('NÃO cria líder/mentor/admin e NÃO exclui ninguém', async () => {
    const db = como('liderA');
    await assertFails(setDoc(doc(db, 'usuarios/l2'), { role: 'lider' }));
    await assertFails(setDoc(doc(db, 'usuarios/m2'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'usuarios/prof1')));
  });
  it('mentor cria login de líder, edita telefone e exclui só o da própria unidade', async () => {
    const db = como('mentor1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/novoLider'), { role: 'lider', unidadeId: 'uniA' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/liderA'), { telefone: '+55 31 9' }));
    await assertFails(updateDoc(doc(db, 'usuarios/liderA'), { role: 'admin' }));
    await assertSucceeds(deleteDoc(doc(db, 'usuarios/liderA')));
    await assertFails(deleteDoc(doc(db, 'usuarios/liderB')));
  });
  it('admin troca unidade → líder (Controle de Acessos)', async () => {
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/loginUniA'), { role: 'lider' }));
  });
  it('grava a vitrine pública como o antigo perfil unidade', async () => {
    await assertSucceeds(setDoc(doc(como('liderA'), 'publico/vitrine'), { unidades: {}, professores: {} }));
  });
});

// ===================== LOGIN PELO GOOGLE + PEDIDO DE ACESSO =====================
// Quem entra pelo Google ganha um token com sign_in_provider = 'google.com'.
const google = (uid, email = `${uid}@gmail.com`) =>
  env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'google.com' } }).firestore();
const senha = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const pedido = (extra = {}) => ({
  nome: 'Fulano Líder', telefone: '+55 31 99999-0000', unidadeId: 'uniA', unidadeNome: 'Unidade A',
  email: 'novato@gmail.com', status: 'pendente', ...extra,
});

describe('login pelo Google sem aprovação NÃO vê nada', () => {
  it('não lê unidades, professores, crachás de outros nem validações', async () => {
    const db = google('novato');
    await assertFails(getDoc(doc(db, 'unidades/uniA')));
    await assertFails(getDoc(doc(db, 'professores/p1')));
    await assertFails(getDoc(doc(db, 'usuarios/admin1')));
    await assertFails(getDoc(doc(db, 'validacoes/v1')));
  });
  it('não grava nada e não se dá crachá', async () => {
    const db = google('novato');
    await assertFails(setDoc(doc(db, 'aulas/aula9'), { x: 1 }));
    await assertFails(setDoc(doc(db, 'usuarios/novato'), { role: 'unidade', unidadeId: 'uniA' }));
  });
  it('lê o PRÓPRIO crachá (para saber se já foi aprovado) e a vitrine pública', async () => {
    const db = google('novato');
    await assertSucceeds(getDoc(doc(db, 'usuarios/novato')));
    await assertSucceeds(getDoc(doc(db, 'publico/vitrine')));
  });
  it('login antigo por e-mail e senha continua vendo tudo como antes', async () => {
    await assertSucceeds(getDoc(doc(senha('loginUniA'), 'unidades/uniA')));
  });
  it('líder aprovado pelo Google vê o sistema', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/liderG'), { role: 'unidade', unidadeId: 'uniA' });
    });
    await assertSucceeds(getDoc(doc(google('liderG'), 'unidades/uniA')));
  });
});

describe('pedido de acesso', () => {
  it('a pessoa cria e lê o próprio pedido', async () => {
    const db = google('novato', 'novato@gmail.com');
    await assertSucceeds(setDoc(doc(db, 'solicitacoes_acesso/novato'), pedido()));
    await assertSucceeds(getDoc(doc(db, 'solicitacoes_acesso/novato')));
  });
  it('NÃO cria pedido em nome de outra pessoa nem com e-mail falso', async () => {
    const db = google('novato', 'novato@gmail.com');
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/outro'), pedido()));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/novato'), pedido({ email: 'chefe@gmail.com' })));
  });
  it('NÃO se auto-aprova nem inventa campos', async () => {
    const db = google('novato', 'novato@gmail.com');
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/novato'), pedido({ status: 'aprovado' })));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/novato'), pedido({ role: 'admin' })));
    await assertFails(setDoc(doc(db, 'solicitacoes_acesso/novato'), pedido({ unidadeId: 'naoExiste' })));
  });
  it('NÃO lê pedidos dos outros; unidade e professor também não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitacoes_acesso/novato'), pedido());
    });
    await assertFails(getDoc(doc(google('curioso'), 'solicitacoes_acesso/novato')));
    await assertFails(getDoc(doc(como('loginUniA'), 'solicitacoes_acesso/novato')));
    await assertFails(getDoc(doc(como('prof1'), 'solicitacoes_acesso/novato')));
  });
  it('admin e mentor leem; só o mentor DA UNIDADE (ou admin) aprova/recusa', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitacoes_acesso/novato'), pedido());
    });
    await assertSucceeds(getDoc(doc(como('admin1'), 'solicitacoes_acesso/novato')));
    await assertSucceeds(getDoc(doc(como('mentor2'), 'solicitacoes_acesso/novato')));
    await assertFails(updateDoc(doc(como('mentor2'), 'solicitacoes_acesso/novato'), { status: 'aprovado' }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'solicitacoes_acesso/novato'), { status: 'recusado', motivo: 'Não é líder' }));
  });
  it('mentor dá crachá de líder só para unidade DELE', async () => {
    await assertSucceeds(setDoc(doc(como('mentor1'), 'usuarios/novato'), { role: 'lider', unidadeId: 'uniA' }));
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/outro'), { role: 'lider', unidadeId: 'uniB' }));
  });
  it('depois de aprovado (com crachá), não mexe mais no próprio pedido', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/novato'), { role: 'lider', unidadeId: 'uniA' });
    });
    await assertFails(setDoc(doc(google('novato', 'novato@gmail.com'), 'solicitacoes_acesso/novato'), pedido()));
  });
});

describe('aba Líderes: cadastro manual e remoção pelo mentor', () => {
  it('mentor NÃO cadastra líder em unidade de outro mentor', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/intruso'), { role: 'lider', unidadeId: 'uniB' }));
  });
  it('mentor NÃO cadastra líder sem unidade', async () => {
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/semUnidade'), { role: 'lider' }));
  });
  it('mentor atualiza os dados de líder na unidade dele', async () => {
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'unidades/uniA'), { liderUid: 'liderA', liderNome: 'Líder A', liderTipo: 'senha' }));
  });
  it('líder NÃO cadastra outro líder nem se troca de unidade', async () => {
    await assertFails(setDoc(doc(como('liderA'), 'usuarios/outro'), { role: 'lider', unidadeId: 'uniA' }));
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/liderA'), { unidadeId: 'uniB' }));
  });
});

describe('fechamento do mês (resumos_mensais)', () => {
  it('logados leem o resumo; sem login, não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'resumos_mensais/2026-01'), { mes: '2026-01', porAula: {} });
    });
    await assertSucceeds(getDoc(doc(como('mentor1'), 'resumos_mensais/2026-01')));
    await assertSucceeds(getDoc(doc(como('loginUniA'), 'resumos_mensais/2026-01')));
    await assertFails(getDoc(doc(anonimo(), 'resumos_mensais/2026-01')));
  });
  it('só o admin monta ou refaz o resumo', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'resumos_mensais/2026-02'), { mes: '2026-02', porAula: {} }));
    await assertFails(setDoc(doc(como('mentor1'), 'resumos_mensais/2026-03'), { mes: '2026-03', porAula: {} }));
    await assertFails(setDoc(doc(como('loginUniA'), 'resumos_mensais/2026-03'), { mes: '2026-03' }));
    await assertFails(updateDoc(doc(como('prof1'), 'resumos_mensais/2026-02'), { porAula: { x: { v: 999999 } } }));
  });
});

// ===================== CRACHÁ OBRIGATÓRIO PARA TODOS =====================
// Qualquer pessoa consegue criar uma conta de login por fora das telas; sem crachá ela não vale nada.
describe('crachá obrigatório para todo tipo de login', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/bloq'), { role: 'bloqueado', nome: 'Ex-funcionário' });
    });
  });
  it('conta com e-mail e senha SEM crachá não lê nem grava nada', async () => {
    const db = senha('contaCriadaPorFora');
    await assertFails(getDoc(doc(db, 'unidades/uniA')));
    await assertFails(getDoc(doc(db, 'usuarios/admin1')));
    await assertFails(getDoc(doc(db, 'validacoes/v1')));
    await assertFails(setDoc(doc(db, 'aulas/aula9'), { x: 1 }));
    await assertFails(updateDoc(doc(db, 'unidades/uniA'), { nome: 'invadida' }));
    await assertFails(setDoc(doc(db, 'usuarios/contaCriadaPorFora'), { role: 'lider', unidadeId: 'uniA' }));
  });
  it('login antigo de unidade desligado (crachá apagado) perde o banco também', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'usuarios/loginUniA')); });
    await assertFails(getDoc(doc(senha('loginUniA'), 'unidades/uniA')));
    await assertFails(setDoc(doc(senha('loginUniA'), 'aulas/aula9'), { unidadeId: 'uniA' }));
  });
  it('papel "bloqueado" não lê nem grava, mas enxerga o próprio crachá', async () => {
    const db = senha('bloq');
    await assertFails(getDoc(doc(db, 'unidades/uniA')));
    await assertFails(setDoc(doc(db, 'aulas/aula9'), { x: 1 }));
    await assertSucceeds(getDoc(doc(db, 'usuarios/bloq')));
  });
  it('mentor INATIVO não lê nem grava, mas enxerga o próprio crachá', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/mentorInativo'), { role: 'mentor', status: 'inativo', nome: 'Mentor Inativo' });
      await setDoc(doc(ctx.firestore(), 'unidades/uniI'), { nome: 'Unidade I', mentorId: 'mentorInativo' });
    });
    const db = senha('mentorInativo');
    await assertFails(getDoc(doc(db, 'unidades/uniA')));
    await assertFails(setDoc(doc(db, 'aulas/aula9'), { unidadeId: 'uniI' }));
    await assertFails(setDoc(doc(db, 'usuarios/novoProf'), { role: 'professor' }));
    await assertSucceeds(getDoc(doc(db, 'usuarios/mentorInativo')));
  });
  it('mentor ATIVO (ou sem status, como os atuais) segue entrando', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/mentorAtivo'), { role: 'mentor', status: 'ativo', nome: 'Mentor Ativo' });
    });
    await assertSucceeds(getDoc(doc(senha('mentorAtivo'), 'unidades/uniA')));
    await assertSucceeds(getDoc(doc(senha('mentor1'), 'unidades/uniA')));
  });
  it('status "inativo" em outro papel (professor/líder) continua como antes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios/profInativo'), { role: 'professor', status: 'inativo', nome: 'Prof' });
    });
    await assertSucceeds(getDoc(doc(senha('profInativo'), 'unidades/uniA')));
  });
  it('a página pública de horários continua aberta sem login', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'publico/vitrine')));
    await assertSucceeds(getDoc(doc(anonimo(), 'aulas/aula1')));
  });
});

// ===================== ATUALIZAÇÃO DE CADASTRO (login antigo -> Google) =====================
// Depois de conectar o Google à conta, o token passa a trazer a identidade "google.com".
const comGoogleLigado = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password', identities: { 'google.com': ['g-' + uid] } } }).firestore();
const contato = (extra = {}) => ({
  nome: 'Maria Silva', telefone: '+55 31 99999-0000', email: 'maria@gmail.com', loginGoogle: true, ...extra,
});

describe('atualização de cadastro pela própria pessoa', () => {
  it('login de unidade com o Google conectado vira líder e atualiza o contato', async () => {
    await assertSucceeds(updateDoc(doc(comGoogleLigado('loginUniA'), 'usuarios/loginUniA'),
      contato({ role: 'lider', emailAntigo: 'unia@pratique.com' })));
  });
  it('SEM conectar o Google não atualiza nada', async () => {
    await assertFails(updateDoc(doc(senha('loginUniA'), 'usuarios/loginUniA'), contato({ role: 'lider' })));
  });
  it('não aproveita para virar admin/mentor nem trocar de unidade', async () => {
    const db = comGoogleLigado('loginUniA');
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), contato({ role: 'admin' })));
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), contato({ role: 'mentor' })));
    await assertFails(updateDoc(doc(db, 'usuarios/loginUniA'), contato({ role: 'lider', unidadeId: 'uniB' })));
  });
  it('não mexe no crachá de outra pessoa', async () => {
    await assertFails(updateDoc(doc(comGoogleLigado('loginUniA'), 'usuarios/loginUniB'), contato({ role: 'lider' })));
  });
  it('mentor atualiza o próprio contato, mas não vira admin', async () => {
    await assertSucceeds(updateDoc(doc(comGoogleLigado('mentor1'), 'usuarios/mentor1'), contato()));
    await assertFails(updateDoc(doc(comGoogleLigado('mentor1'), 'usuarios/mentor1'), contato({ role: 'admin' })));
  });
  it('exige nome e WhatsApp de verdade', async () => {
    await assertFails(updateDoc(doc(comGoogleLigado('liderA'), 'usuarios/liderA'), contato({ nome: 'a' })));
    await assertFails(updateDoc(doc(comGoogleLigado('liderA'), 'usuarios/liderA'), contato({ telefone: '1' })));
  });
});

// ===================== CONVITE DE MENTOR (cadastro pelo e-mail Google, sem senha) =====================
// Login real pelo Google: o token traz o e-mail já verificado pelo Google.
const googleVerificado = (uid, email) =>
  env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
const convite = (extra = {}) => ({
  papel: 'mentor', status: 'pendente', email: 'novomentor@gmail.com', nome: 'Novo Mentor',
  telefone: '(31) 99999-0000', pais: 'BR', criadoPor: 'admin1', ...extra,
});
const crachaDoConvite = (extra = {}) => ({
  nome: 'Novo Mentor', email: 'novomentor@gmail.com', telefone: '(31) 99999-0000', pais: 'BR',
  role: 'mentor', status: 'ativo', loginGoogle: true, criadoPor: 'admin1', ...extra,
});
const conviteCriado = (extra = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'convites_acesso/novomentor@gmail.com'), convite(extra));
});
// Aceitar = criar o crachá e marcar o convite como usado na mesma gravação.
const aceitar = (db, uid, cracha = crachaDoConvite()) => {
  const b = writeBatch(db);
  b.set(doc(db, `usuarios/${uid}`), cracha);
  b.update(doc(db, 'convites_acesso/novomentor@gmail.com'), { status: 'usado', usadoPor: uid });
  return b.commit();
};

describe('convite de mentor', () => {
  it('só o admin cria convite', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'convites_acesso/novomentor@gmail.com'), convite()));
    await assertFails(setDoc(doc(como('mentor1'), 'convites_acesso/outro@gmail.com'), convite({ email: 'outro@gmail.com' })));
    await assertFails(setDoc(doc(como('liderA'), 'convites_acesso/outro@gmail.com'), convite({ email: 'outro@gmail.com' })));
    await assertFails(setDoc(doc(googleVerificado('novato', 'novato@gmail.com'), 'convites_acesso/novato@gmail.com'), convite({ email: 'novato@gmail.com' })));
  });
  it('convite só serve para mentor (admin não convida admin por aqui)', async () => {
    await assertFails(setDoc(doc(como('admin1'), 'convites_acesso/novomentor@gmail.com'), convite({ papel: 'admin' })));
  });
  it('mentor, líder e estranhos não leem convites', async () => {
    await conviteCriado();
    await assertFails(getDoc(doc(como('mentor1'), 'convites_acesso/novomentor@gmail.com')));
    await assertFails(getDoc(doc(como('liderA'), 'convites_acesso/novomentor@gmail.com')));
    await assertFails(getDoc(doc(googleVerificado('curioso', 'curioso@gmail.com'), 'convites_acesso/novomentor@gmail.com')));
    await assertSucceeds(getDoc(doc(como('admin1'), 'convites_acesso/novomentor@gmail.com')));
    await assertSucceeds(getDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'convites_acesso/novomentor@gmail.com')));
  });
  it('a pessoa convidada entra pelo Google e vira mentor', async () => {
    await conviteCriado();
    await assertSucceeds(aceitar(googleVerificado('novoM', 'novomentor@gmail.com'), 'novoM'));
    // e daí em diante já tem acesso
    await assertSucceeds(getDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'unidades/uniA')));
  });
  it('sem convite, ninguém se cria mentor', async () => {
    await assertFails(aceitar(googleVerificado('novoM', 'novomentor@gmail.com'), 'novoM'));
    await assertFails(setDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'usuarios/novoM'), crachaDoConvite()));
  });
  it('convite de outro e-mail não serve', async () => {
    await conviteCriado();
    await assertFails(aceitar(googleVerificado('intruso', 'intruso@gmail.com'), 'intruso'));
  });
  it('e-mail não verificado ou login por senha não serve', async () => {
    await conviteCriado();
    const naoVerificado = env.authenticatedContext('novoM', { email: 'novomentor@gmail.com', firebase: { sign_in_provider: 'google.com' } }).firestore();
    await assertFails(aceitar(naoVerificado, 'novoM'));
    const porSenha = env.authenticatedContext('novoM', { email: 'novomentor@gmail.com', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
    await assertFails(aceitar(porSenha, 'novoM'));
  });
  it('não aproveita o convite para virar admin nem mudar os dados', async () => {
    await conviteCriado();
    const db = googleVerificado('novoM', 'novomentor@gmail.com');
    await assertFails(aceitar(db, 'novoM', crachaDoConvite({ role: 'admin' })));
    await assertFails(aceitar(db, 'novoM', crachaDoConvite({ nome: 'Outro Nome' })));
    await assertFails(aceitar(db, 'novoM', crachaDoConvite({ unidadeId: 'uniA' })));
    await assertFails(aceitar(db, 'novoM', crachaDoConvite({ criadoPor: 'novoM' })));
  });
  it('precisa marcar o convite como usado (não serve duas vezes)', async () => {
    await conviteCriado();
    await assertFails(setDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'usuarios/novoM'), crachaDoConvite()));
  });
  it('convite cancelado ou já usado não serve', async () => {
    await conviteCriado({ status: 'cancelado' });
    await assertFails(aceitar(googleVerificado('novoM', 'novomentor@gmail.com'), 'novoM'));
    await conviteCriado({ status: 'usado', usadoPor: 'outro' });
    await assertFails(aceitar(googleVerificado('novoM2', 'novomentor@gmail.com'), 'novoM2'));
  });
  it('admin cancela o convite (sem apagar)', async () => {
    await conviteCriado();
    await assertSucceeds(updateDoc(doc(como('admin1'), 'convites_acesso/novomentor@gmail.com'), { status: 'cancelado' }));
    await assertFails(deleteDoc(doc(como('admin1'), 'convites_acesso/novomentor@gmail.com')));
  });
  it('a pessoa convidada não mexe no convite além de marcá-lo como usado', async () => {
    await conviteCriado();
    await assertFails(updateDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'convites_acesso/novomentor@gmail.com'), { papel: 'admin' }));
    await assertFails(updateDoc(doc(googleVerificado('novoM', 'novomentor@gmail.com'), 'convites_acesso/novomentor@gmail.com'), { status: 'usado', usadoPor: 'novoM' }));
  });
});

// Liderança pela aba Líderes: professor que vira líder, 2º líder da unidade, líder de várias unidades,
// e quem deixa de ser líder (volta a ser professor ou continua nas outras unidades).
// O mentor mexe em UMA unidade dele por vez ("unidadeAlterada").
describe('liderança: professor-líder, 2º líder e líder de várias unidades', () => {
  const montar = async () => env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'unidades/uniC'), { nome: 'Unidade C', mentorId: 'mentor1' });
    await setDoc(doc(db, 'professores/p1'), { nome: 'Prof', uidLogin: 'prof1' });
    await setDoc(doc(db, 'professores/p2'), { nome: 'Outro', uidLogin: 'outroLogin' });
    // Caso real: trocado em Controle de Acessos, ficou "líder sem unidade".
    await setDoc(doc(db, 'professores/p3'), { nome: 'Sem Unidade', uidLogin: 'liderSemUni' });
    await setDoc(doc(db, 'usuarios/liderSemUni'), { role: 'lider', professorId: 'p3', nome: 'Sem Unidade' });
    // Líder da uniA que também é professor.
    await setDoc(doc(db, 'professores/p4'), { nome: 'Líder Prof', uidLogin: 'liderProf' });
    await setDoc(doc(db, 'usuarios/liderProf'), { role: 'lider', unidadeId: 'uniA', professorId: 'p4', nome: 'Líder Prof' });
    // Líder de duas unidades (uniB do mentor2 e uniA do mentor1).
    await setDoc(doc(db, 'usuarios/liderBA'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB', 'uniA'], nome: 'Líder BA' });
  });
  const entra = (quem, alvo, x, lista, extra = {}) =>
    updateDoc(doc(como(quem), 'usuarios/' + alvo), { role: 'lider', unidadeId: lista[0], unidadeIds: lista, unidadeAlterada: x, ...extra });

  // ---- professor vira líder ----
  it('mentor torna líder um professor, numa unidade DELE', async () => {
    await montar();
    await assertSucceeds(entra('mentor1', 'prof1', 'uniA', ['uniA']));
  });
  it('mentor NÃO torna líder em unidade de outro mentor', async () => {
    await montar();
    await assertFails(entra('mentor1', 'prof1', 'uniB', ['uniB']));
  });
  it('mentor NÃO usa o vínculo de professor de OUTRA pessoa', async () => {
    await montar();
    await assertFails(entra('mentor1', 'prof1', 'uniA', ['uniA'], { professorId: 'p2' }));
  });
  it('mentor NÃO torna líder sem dizer a unidade, nem com lista diferente', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/prof1'), { role: 'lider' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/prof1'), { role: 'lider', unidadeId: 'uniA' }));
    await assertFails(entra('mentor1', 'prof1', 'uniA', ['uniA', 'uniB']));
    await assertFails(entra('mentor1', 'prof1', 'uniA', ['uniB', 'uniA']));
  });
  it('mentor NÃO promove professor a mentor/admin nem mexe em outros campos', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/prof1'), { role: 'mentor' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/prof1'), { role: 'admin' }));
    await assertFails(entra('mentor1', 'prof1', 'uniA', ['uniA'], { status: 'x' }));
    await assertFails(entra('mentor1', 'prof1', 'uniA', ['uniA'], { role: 'mentor' }));
  });
  it('corrige o "líder sem unidade" (caso real)', async () => {
    await montar();
    await assertSucceeds(entra('mentor1', 'liderSemUni', 'uniA', ['uniA']));
  });

  // ---- líder passa a cuidar de mais uma unidade (2º líder) ----
  it('mentor coloca o líder de OUTRA unidade (de outro mentor) também na unidade dele', async () => {
    await montar();
    await assertSucceeds(entra('mentor1', 'liderB', 'uniA', ['uniB', 'uniA']));
  });
  it('líder antigo (só "unidadeId") ganha a lista certa', async () => {
    await montar();
    await assertSucceeds(entra('mentor1', 'liderProf', 'uniC', ['uniA', 'uniC']));
  });
  it('mentor NÃO tira a unidade principal do líder ao acrescentar', async () => {
    await montar();
    await assertFails(entra('mentor1', 'liderB', 'uniA', ['uniA']));
    await assertFails(entra('mentor1', 'liderB', 'uniA', ['uniA', 'uniB']));
  });
  it('mentor NÃO acrescenta unidade de outro mentor', async () => {
    await montar();
    await assertFails(entra('mentor1', 'liderA', 'uniB', ['uniA', 'uniB']));
  });
  it('mentor NÃO troca o vínculo de professor de um líder', async () => {
    await montar();
    await assertFails(entra('mentor1', 'liderProf', 'uniC', ['uniA', 'uniC'], { professorId: 'p1' }));
  });

  // ---- sai de uma unidade ----
  it('líder de duas unidades sai de uma (a do mentor) e continua na outra', async () => {
    await montar();
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/liderBA'), { unidadeId: 'uniB', unidadeIds: ['uniB'], unidadeAlterada: 'uniA' }));
  });
  it('a principal muda quando ele sai dela', async () => {
    await montar();
    await assertSucceeds(updateDoc(doc(como('mentor2'), 'usuarios/liderBA'), { unidadeId: 'uniA', unidadeIds: ['uniA'], unidadeAlterada: 'uniB' }));
  });
  it('mentor NÃO tira o líder da unidade de outro mentor', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderBA'), { unidadeId: 'uniA', unidadeIds: ['uniA'], unidadeAlterada: 'uniB' }));
  });
  it('mentor NÃO apaga o crachá de quem lidera outras unidades', async () => {
    await montar();
    await assertFails(deleteDoc(doc(como('mentor2'), 'usuarios/liderBA')));
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'usuarios/liderA')));
  });
  it('líder-professor volta a ser professor (unidade do mentor)', async () => {
    await montar();
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/liderProf'), { role: 'professor', unidadeId: deleteField(), unidadeAlterada: 'uniA' }));
  });
  it('outro mentor NÃO devolve o líder-professor a professor', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor2'), 'usuarios/liderProf'), { role: 'professor', unidadeId: deleteField(), unidadeAlterada: 'uniA' }));
    await assertFails(updateDoc(doc(como('mentor2'), 'usuarios/liderProf'), { role: 'professor', unidadeId: deleteField(), unidadeAlterada: 'uniB' }));
  });
  it('líder comum (sem vínculo de professor) NÃO vira professor por esse caminho', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderA'), { role: 'professor', unidadeId: deleteField(), unidadeAlterada: 'uniA' }));
  });
  it('líder de duas unidades NÃO volta a professor saindo de uma só', async () => {
    await montar();
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderBA'), { role: 'professor', unidadeId: deleteField(), unidadeIds: deleteField(), unidadeAlterada: 'uniA' }));
  });

  // ---- ninguém se promove ----
  it('o próprio professor/líder NÃO se promove nem troca de unidade', async () => {
    await montar();
    await assertFails(entra('prof1', 'prof1', 'uniA', ['uniA']));
    await assertFails(updateDoc(doc(como('liderProf'), 'usuarios/liderProf'), { unidadeId: 'uniB' }));
    await assertFails(entra('liderA', 'liderA', 'uniB', ['uniA', 'uniB']));
  });
  it('líder NÃO promove professor a líder', async () => {
    await montar();
    await assertFails(entra('liderA', 'prof1', 'uniA', ['uniA']));
  });
  it('mentor NÃO cria crachá de líder já com várias unidades', async () => {
    await montar();
    await assertFails(setDoc(doc(como('mentor1'), 'usuarios/novoLider'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'], nome: 'Novo' }));
    await assertSucceeds(setDoc(doc(como('mentor1'), 'usuarios/novoLider'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Novo' }));
  });
  it('admin faz tudo isso', async () => {
    await montar();
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/prof1'), { role: 'lider', unidadeId: 'uniB', unidadeIds: ['uniB', 'uniA'], professorId: 'p1' }));
  });
});

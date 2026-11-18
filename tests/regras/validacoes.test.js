// Regras de VALIDAÇÕES e trava do professor, no emulador local (não toca no banco real nem gasta cota).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc, deleteField } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

// Datas no mesmo fuso das regras (UTC-3).
const fmt = (d) => d.toISOString().slice(0, 10);
const agoraLocal = () => new Date(Date.now() - 3 * 3600 * 1000);
const HOJE = fmt(agoraLocal());
const diasAtras = (n) => { const d = agoraLocal(); d.setUTCDate(d.getUTCDate() - n); return fmt(d); };
const AMANHA = diasAtras(-1);
const MES_PASSADO = (() => { const d = agoraLocal(); d.setUTCDate(0); return fmt(d); })(); // último dia do mês anterior
const MUITO_ANTIGA = diasAtras(70);

// Cenário: uniA (mentor1, líder loginUniA no perfil antigo "unidade" e liderA no perfil novo "lider"), uniB (mentor2). Professor p1 (prof1) e p2 (prof2, ligado só pelo uidLogin).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor' });
    await setDoc(doc(db, 'usuarios/loginUniA'), { role: 'unidade', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA' });
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1', loginGoogle: true });
    await setDoc(doc(db, 'usuarios/prof2'), { role: 'professor', loginGoogle: true });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'B', mentorId: 'mentor2' });
    await setDoc(doc(db, 'professores/p1'), { nome: 'P1', uidLogin: 'prof1' });
    await setDoc(doc(db, 'professores/p2'), { nome: 'P2', uidLogin: 'prof2' });
    await setDoc(doc(db, 'aulas/aulaP1'), { unidadeId: 'uniA', professorId: 'p1', valor: 50 });
    await setDoc(doc(db, 'aulas/aulaP2'), { unidadeId: 'uniA', professorId: 'p2', valor: 40 });
    await setDoc(doc(db, 'aulas/aulaB'), { unidadeId: 'uniB', professorId: 'p1', valor: 30 });
    await setDoc(doc(db, 'aulas/aulaTexto'), { unidadeId: 'uniA', professorId: 'p1', valor: '45' });
    // Validações já existentes (para testar edição)
    await setDoc(doc(db, 'validacoes/feitaHoje'), { aulaId: 'aulaP1', data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 10, valorEfetivo: 50, validadoPor: 'prof1' });
    await setDoc(doc(db, 'validacoes/canceladaHoje'), { aulaId: 'aulaP1', data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'cancelada', motivoCancelamento: 'Chuva/Clima', valorEfetivo: 50, validadoPor: 'loginUniA' });
    await setDoc(doc(db, 'validacoes/doMesPassado'), { aulaId: 'aulaP1', data: MES_PASSADO, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 12, valorEfetivo: 50, validadoPor: 'prof1' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();

// Validação "como a tela grava" (ID fixo aulaId_data)
const validacao = (uid, aulaId, data, extra = {}) => {
  const base = {
    aulaId, data, unidadeId: 'uniA', professorId: aulaId === 'aulaP2' ? 'p2' : 'p1', status: 'realizada', alunos: 20,
    valorEfetivo: aulaId === 'aulaP2' ? 40 : aulaId === 'aulaB' ? 30 : aulaId === 'aulaTexto' ? 45 : 50,
    validadoPor: uid, substituicao: false, professorOriginalId: null, motivoSubstituicao: null,
    professorNomeEfetivo: 'X', modalidadeNomeEfetiva: 'Y',
  };
  const dados = Object.fromEntries(Object.entries({ ...base, ...extra }).filter(([, v]) => v !== undefined));
  return setDoc(doc(como(uid), `validacoes/${aulaId}_${data}`), dados);
};

describe('professor: valida as próprias aulas do mês', () => {
  it('valida a aula dele hoje', async () => { await assertSucceeds(validacao('prof1', 'aulaP1', HOJE)); });
  it('professor ligado só pelo uidLogin também valida a dele', async () => { await assertSucceeds(validacao('prof2', 'aulaP2', HOJE)); });
  it('valor gravado como texto no cronograma ("45") continua funcionando', async () => { await assertSucceeds(validacao('prof1', 'aulaTexto', HOJE)); });
  it('cancela a aula dele hoje', async () => {
    await assertSucceeds(validacao('prof1', 'aulaP1', HOJE, { status: 'cancelada', alunos: undefined, motivoCancelamento: 'Atestado Médico' }));
  });
  it('marca substituição (outro professor deu a aula dele)', async () => {
    await assertSucceeds(validacao('prof1', 'aulaP1', HOJE, { substituicao: true, professorId: 'p2', professorOriginalId: 'p1', motivoSubstituicao: 'Férias' }));
  });
  it('edita a contagem de alunos de uma validação dele no mês', async () => {
    await assertSucceeds(updateDoc(doc(como('prof1'), 'validacoes/feitaHoje'), { alunos: 15, validadoPor: 'prof1' }));
  });
  it('cria registro de auditoria e o log de "Sair"', async () => {
    await assertSucceeds(addDoc(collection(como('prof1'), 'auditoria_cronograma'), { tipoAcao: 'NOVA' }));
    await assertSucceeds(addDoc(collection(como('prof1'), 'auditoria_configuracoes'), { tipoAcao: 'LOGOUT' }));
  });
});

describe('professor: o que ele NÃO pode', () => {
  it('validar aula de OUTRO professor', async () => { await assertFails(validacao('prof1', 'aulaP2', HOJE, { professorId: 'p2' })); });
  it('validar aula do mês passado (mês fechado)', async () => { await assertFails(validacao('prof1', 'aulaP1', MES_PASSADO)); });
  it('editar validação do mês passado', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'validacoes/doMesPassado'), { alunos: 40, validadoPor: 'prof1' }));
  });
  it('validar aula de amanhã', async () => { await assertFails(validacao('prof1', 'aulaP1', AMANHA)); });
  it('mudar o valor da aula', async () => { await assertFails(validacao('prof1', 'aulaP1', HOJE, { valorEfetivo: 999 })); });
  it('mudar o valor ao editar', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'validacoes/feitaHoje'), { valorEfetivo: 999, validadoPor: 'prof1' }));
  });
  it('número de alunos absurdo, negativo ou em texto', async () => {
    await assertFails(validacao('prof1', 'aulaP1', HOJE, { alunos: 500 }));
    await assertFails(validacao('prof1', 'aulaP1', HOJE, { alunos: -1 }));
    await assertFails(validacao('prof1', 'aulaP1', HOJE, { alunos: '22' }));
  });
  it('pagar a aula para outro professor sem marcar substituição', async () => {
    await assertFails(validacao('prof1', 'aulaP1', HOJE, { professorId: 'p2' }));
  });
  it('gravar em nome de outra pessoa (validadoPor)', async () => { await assertFails(validacao('prof1', 'aulaP1', HOJE, { validadoPor: 'admin1' })); });
  it('mudar o dia de uma validação existente', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'validacoes/feitaHoje'), { data: MES_PASSADO, validadoPor: 'prof1' }));
  });
  it('mexer em aula cancelada', async () => {
    await assertFails(updateDoc(doc(como('prof1'), 'validacoes/canceladaHoje'), { status: 'realizada', alunos: 10, validadoPor: 'prof1' }));
  });
  it('apagar validação', async () => { await assertFails(deleteDoc(doc(como('prof1'), 'validacoes/feitaHoje'))); });
  it('lançar aulão', async () => {
    await assertFails(addDoc(collection(como('prof1'), 'validacoes'), {
      isAulao: true, data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 30, valorPago: 500, validadoPor: 'prof1',
    }));
  });
  it('criar validação com ID solto (fora do padrão aulaId_data)', async () => {
    await assertFails(setDoc(doc(como('prof1'), 'validacoes/qualquer'), {
      aulaId: 'aulaP1', data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 20, valorEfetivo: 50, validadoPor: 'prof1',
    }));
  });
  it('mexer no cronograma, unidades, professores, modalidades e feriados', async () => {
    const db = como('prof1');
    await assertFails(updateDoc(doc(db, 'aulas/aulaP1'), { valor: 999 }));
    await assertFails(setDoc(doc(db, 'aulas/nova'), { unidadeId: 'uniA', professorId: 'p1' }));
    await assertFails(updateDoc(doc(db, 'unidades/uniA'), { nome: 'Hack' }));
    await assertFails(updateDoc(doc(db, 'professores/p2'), { uidLogin: 'prof1' }));
    await assertFails(setDoc(doc(db, 'modalidades/m1'), { nome: 'X' }));
    await assertFails(setDoc(doc(db, 'feriados/f1'), { data: HOJE }));
  });
});

describe.each(['loginUniA', 'liderA'])('líder (%s): até 60 dias, mês fechado com justificativa', (quem) => {
  it('valida aula da unidade dele hoje', async () => { await assertSucceeds(validacao(quem, 'aulaP1', HOJE)); });
  it('mês passado SEM justificativa: bloqueado', async () => { await assertFails(validacao(quem, 'aulaP1', MES_PASSADO)); });
  it('mês passado COM justificativa: liberado', async () => {
    await assertSucceeds(validacao(quem, 'aulaP1', MES_PASSADO, { justificativa: 'Professor esqueceu de validar a aula' }));
  });
  it('edita validação do mês passado com justificativa', async () => {
    await assertSucceeds(updateDoc(doc(como(quem), 'validacoes/doMesPassado'), { alunos: 14, validadoPor: quem, justificativa: 'Contagem corrigida pela recepção' }));
  });
  it('mais de 60 dias atrás: bloqueado mesmo com justificativa', async () => {
    await assertFails(validacao(quem, 'aulaP1', MUITO_ANTIGA, { justificativa: 'Professor esqueceu de validar a aula' }));
  });
  it('aula de outra unidade: bloqueado', async () => {
    await assertFails(validacao(quem, 'aulaB', HOJE, { unidadeId: 'uniB' }));
  });
  it('não muda o valor da aula', async () => { await assertFails(validacao(quem, 'aulaP1', HOJE, { valorEfetivo: 999 })); });
  it('lança aulão na unidade dele', async () => {
    await assertSucceeds(addDoc(collection(como(quem), 'validacoes'), {
      isAulao: true, data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 300, valorPago: 500, validadoPor: quem,
    }));
  });
  it('não apaga validação', async () => { await assertFails(deleteDoc(doc(como(quem), 'validacoes/canceladaHoje'))); });
  it('continua editando o cronograma da unidade', async () => {
    await assertSucceeds(updateDoc(doc(como(quem), 'aulas/aulaP1'), { hora: '08:00' }));
  });
});

describe('mentor e admin', () => {
  it('mentor: mês fechado só com justificativa, e só nas unidades dele', async () => {
    await assertFails(validacao('mentor1', 'aulaP1', MES_PASSADO));
    await assertSucceeds(validacao('mentor1', 'aulaP1', MES_PASSADO, { justificativa: 'Ajuste pedido pela coordenação' }));
    await assertSucceeds(validacao('mentor1', 'aulaP1', MUITO_ANTIGA, { justificativa: 'Ajuste pedido pela coordenação' }));
    await assertFails(validacao('mentor2', 'aulaP1', HOJE));
  });
  it('mentor reverte cancelamento só da unidade dele', async () => {
    await assertFails(deleteDoc(doc(como('mentor2'), 'validacoes/canceladaHoje')));
    await assertSucceeds(deleteDoc(doc(como('mentor1'), 'validacoes/canceladaHoje')));
  });
  it('admin faz tudo (inclusive restaurar backup antigo)', async () => {
    await assertSucceeds(setDoc(doc(como('admin1'), 'validacoes/antiga'), { aulaId: 'aulaP1', data: '2024-01-10', status: 'realizada', alunos: 999 }));
    await assertSucceeds(deleteDoc(doc(como('admin1'), 'validacoes/feitaHoje')));
  });
});

// Líder de várias unidades: o crachá lista todas em "unidadeIds" (a principal continua em "unidadeId").
describe('líder de duas unidades', () => {
  const montar = () => env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/liderAB'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA', 'uniB'] });
    await setDoc(doc(db, 'usuarios/liderSoA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'] });
  });
  it('valida aula da unidade principal', async () => { await montar(); await assertSucceeds(validacao('liderAB', 'aulaP1', HOJE)); });
  it('valida aula da segunda unidade', async () => {
    await montar();
    await assertSucceeds(validacao('liderAB', 'aulaB', HOJE, { unidadeId: 'uniB' }));
  });
  it('quem só tem a uniA na lista NÃO valida a uniB', async () => {
    await montar();
    await assertFails(validacao('liderSoA', 'aulaB', HOJE, { unidadeId: 'uniB' }));
  });
});

// Aulão já lançado: a tela edita/cancela/reverte só os campos do aulão (sem aulaId, sem mexer em valor, professor ou dia).
describe('editar, cancelar e reverter aulão', () => {
  const montar = () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'validacoes/aulao1'), {
      isAulao: true, data: HOJE, unidadeId: 'uniA', professorId: 'p1', modalidadeId: 'm1', hora: '10:00',
      status: 'realizada', alunos: 200, valorPago: 500, valorEfetivo: 500, substituicao: false, validadoPor: 'liderA',
    });
  });
  const ref = (uid) => doc(como(uid), 'validacoes/aulao1');

  it('líder edita o número de alunos (inclusive acima de 150)', async () => {
    await montar();
    await assertSucceeds(updateDoc(ref('liderA'), { status: 'realizada', alunos: 220, validadoPor: 'liderA' }));
  });
  it('jeito antigo (aulão ganhava o próprio id como aulaId) continua recusado para o líder', async () => {
    await montar();
    await assertFails(updateDoc(ref('liderA'), { aulaId: 'aulao1', status: 'realizada', alunos: 220, validadoPor: 'liderA' }));
  });
  it('líder e mentor cancelam o aulão', async () => {
    await montar();
    await assertSucceeds(updateDoc(ref('liderA'), { status: 'cancelada', motivoCancelamento: 'Chuva/Clima', validadoPor: 'liderA' }));
    await montar();
    await assertSucceeds(updateDoc(ref('mentor1'), { status: 'cancelada', motivoCancelamento: 'Chuva/Clima', validadoPor: 'mentor1' }));
  });
  it('mentor reverte o cancelamento do aulão (volta a realizada, sem apagar)', async () => {
    await montar();
    await assertSucceeds(updateDoc(ref('mentor1'), { status: 'cancelada', motivoCancelamento: 'Chuva/Clima', validadoPor: 'mentor1' }));
    await assertSucceeds(updateDoc(ref('mentor1'), { status: 'realizada', motivoCancelamento: deleteField(), validadoPor: 'mentor1' }));
  });
  it('mentor de outra unidade não mexe no aulão', async () => {
    await montar();
    await assertFails(updateDoc(ref('mentor2'), { status: 'cancelada', motivoCancelamento: 'Chuva/Clima', validadoPor: 'mentor2' }));
  });
});

// Etapa 4: o mentor passa a ter as mesmas travas que a tela já aplicava.
describe('mentor: travas novas', () => {
  it('continua validando aula da unidade dele hoje', async () => { await assertSucceeds(validacao('mentor1', 'aulaP1', HOJE)); });
  it('não valida aula de data futura', async () => { await assertFails(validacao('mentor1', 'aulaP1', AMANHA)); });
  it('não muda o valor da aula', async () => { await assertFails(validacao('mentor1', 'aulaP1', HOJE, { valorEfetivo: 999 })); });
  it('não grava aula de outra unidade disfarçada com a unidade dele', async () => {
    await assertFails(validacao('mentor1', 'aulaB', HOJE, { unidadeId: 'uniA' }));
  });
  it('edição mantém o valor da época (mesmo diferente do cronograma de hoje)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'validacoes/aulaP1_' + HOJE), { aulaId: 'aulaP1', data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 10, valorEfetivo: 35, validadoPor: 'liderA' });
    });
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'validacoes/aulaP1_' + HOJE), { alunos: 12, validadoPor: 'mentor1' }));
  });
  it('lança aulão na unidade dele (valor livre), mas não com data futura', async () => {
    const aulao = (data) => addDoc(collection(como('mentor1'), 'validacoes'), {
      isAulao: true, data, unidadeId: 'uniA', professorId: 'p1', status: 'realizada', alunos: 40, valorPago: 300, validadoPor: 'mentor1',
    });
    await assertSucceeds(aulao(HOJE));
    await assertFails(aulao(AMANHA));
  });
});

describe('cancelar limpa os restos e feriado pode virar validação', () => {
  it('líder cancela aula realizada apagando alunos e substituto', async () => {
    await assertSucceeds(updateDoc(doc(como('liderA'), 'validacoes/feitaHoje'), {
      status: 'cancelada', motivoCancelamento: 'Chuva/Clima', validadoPor: 'liderA',
      alunos: deleteField(), professorOriginalId: deleteField(), motivoSubstituicao: deleteField(),
    }));
  });
  it('líder valida por cima do cancelamento automático de feriado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'validacoes/aulaP1_' + HOJE), { aulaId: 'aulaP1', data: HOJE, unidadeId: 'uniA', professorId: 'p1', status: 'cancelada', motivoCancelamento: 'Recesso/Feriado', valorEfetivo: 0, validadoPor: 'SISTEMA_FERIADO' });
    });
    await assertSucceeds(validacao('liderA', 'aulaP1', HOJE));
  });
});

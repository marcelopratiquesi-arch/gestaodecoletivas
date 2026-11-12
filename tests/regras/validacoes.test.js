// Regras de VALIDAÇÕES e trava do professor, no emulador local (não toca no banco real nem gasta cota).
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
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
    await setDoc(doc(db, 'usuarios/prof1'), { role: 'professor', professorId: 'p1' });
    await setDoc(doc(db, 'usuarios/prof2'), { role: 'professor' });
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

// Conta única de ganhos (src/utils/ganhos.js). Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { ganhosDasValidacoes } from '../../src/utils/ganhos';
import { valorDaValidacao } from '../../src/utils/valores';
import { deduplicarValidacoes } from '../../src/utils/validacoes';
import { gastoPorProfessor } from '../../src/centrais/contasValores';

const aulas = [
  { id: 'a1', unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '07:00', valor: 60 },
  { id: 'a2', unidadeId: 'u1', modalidadeId: 'm2', professorId: 'p2', hora: '08:00', valor: 40, excluido: true },
];
const aulaPorId = new Map(aulas.map((a) => [a.id, a]));
const val = (id, extra = {}) => ({ id, aulaId: 'a1', data: '2026-10-05', status: 'realizada', unidadeId: 'u1', professorId: 'p1', alunos: 10, valorEfetivo: 50, ...extra });

describe('ganhosDasValidacoes', () => {
  it('só realizada; cancelada e feriado valem zero e ficam de fora', () => {
    const r = ganhosDasValidacoes({ validacoes: [val('v1'), val('v2', { data: '2026-10-06', status: 'cancelada' })], aulaPorId });
    expect(r.map((x) => x.v.id)).toEqual(['v1']);
  });
  it('vale o valor do dia (valorEfetivo), não o valor atual da aula', () => {
    expect(ganhosDasValidacoes({ validacoes: [val('v1')], aulaPorId })[0].valor).toBe(50);
  });
  it('validação antiga sem valorEfetivo usa o valor atual da aula', () => {
    expect(ganhosDasValidacoes({ validacoes: [val('v1', { valorEfetivo: undefined })], aulaPorId })[0].valor).toBe(60);
  });
  it('aulão vale o valor pago e não precisa de aula', () => {
    const r = ganhosDasValidacoes({ validacoes: [val('v1', { isAulao: true, aulaId: undefined, valorPago: 120, valorEfetivo: undefined })], aulaPorId });
    expect(r[0].valor).toBe(120);
    expect(r[0].aula).toBeNull();
  });
  it('quem recebe é o professor da validação (substituto)', () => {
    const r = ganhosDasValidacoes({ validacoes: [val('v1', { professorId: 'p9', substituicao: true })], aulaPorId });
    expect(r[0].professorId).toBe('p9');
  });
  it('respeita o período (inclusivo)', () => {
    const vs = [val('v1', { data: '2026-10-01' }), val('v2', { data: '2026-10-31' }), val('v3', { data: '2026-11-01' })];
    expect(ganhosDasValidacoes({ validacoes: vs, aulaPorId, inicio: '2026-10-01', fim: '2026-10-31' }).map((x) => x.v.id)).toEqual(['v1', 'v2']);
  });
  it('validação repetida da mesma aula e dia conta uma vez', () => {
    const r = ganhosDasValidacoes({ validacoes: [val('v1'), val('v2')], aulaPorId });
    expect(r).toHaveLength(1);
  });
  it('aula que sumiu do cadastro: fora nas Centrais, dentro (com os dados da validação) nos Relatórios', () => {
    const orfa = val('v1', { aulaId: 'sumiu', modalidadeId: 'm5', hora: '09:00' });
    expect(ganhosDasValidacoes({ validacoes: [orfa], aulaPorId })).toHaveLength(0);
    const r = ganhosDasValidacoes({ validacoes: [orfa], aulaPorId, incluirSemAula: true });
    expect(r).toHaveLength(1);
    expect(r[0].aulaEfetiva).toMatchObject({ unidadeId: 'u1', modalidadeId: 'm5', professorId: 'p1', hora: '09:00' });
  });
  it('aula excluída (lixeira) ainda conta: o passado continua valendo', () => {
    const r = ganhosDasValidacoes({ validacoes: [val('v1', { aulaId: 'a2', professorId: 'p2', valorEfetivo: 35 })], aulaPorId });
    expect(r[0].valor).toBe(35);
  });
});

describe('mesma conta nas Centrais e nos Relatórios', () => {
  // Reimplementação da conta ANTIGA dos Relatórios (meses fechados), para provar que o resultado não mudou.
  const contaAntigaRelatorios = (validacoes, aulaPorIdMap) => {
    const total = {};
    deduplicarValidacoes(validacoes.filter((v) => v.status === 'realizada')).forEach((v) => {
      const aula = aulaPorIdMap.get(String(v.aulaId)) || { unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId, hora: v.hora };
      const prof = v.professorId || aula.professorId;
      total[prof] = (total[prof] || 0) + valorDaValidacao(v, aula);
    });
    return total;
  };
  const massa = [
    val('v1'), val('v2', { data: '2026-10-06', valorEfetivo: 55 }), val('v3', { data: '2026-10-07', valorEfetivo: undefined }),
    val('v4', { data: '2026-10-08', status: 'cancelada' }),
    val('v5', { data: '2026-10-09', professorId: 'p9', substituicao: true }),
    val('v6', { data: '2026-10-10', isAulao: true, aulaId: undefined, valorPago: 120, valorEfetivo: undefined, professorId: 'p3' }),
    val('v7', { data: '2026-10-11', aulaId: 'a2', professorId: 'p2', valorEfetivo: 35 }),
    val('v1-repetida', { data: '2026-10-05' }),
  ];
  it('total por professor igual à conta antiga dos Relatórios', () => {
    const antigo = contaAntigaRelatorios(massa, aulaPorId);
    const novo = {};
    ganhosDasValidacoes({ validacoes: massa, aulaPorId, incluirSemAula: true }).forEach((x) => { novo[x.professorId] = (novo[x.professorId] || 0) + x.valor; });
    expect(novo).toEqual(antigo);
  });
  it('Centrais (gastoPorProfessor) dão os mesmos totais por professor', () => {
    const doisCentrais = gastoPorProfessor({ validacoes: massa, inicio: '2026-10-01', fim: '2026-10-31', aulasTodas: aulas });
    const antigo = contaAntigaRelatorios(massa, aulaPorId);
    doisCentrais.forEach((p) => expect(p.valor).toBe(antigo[p.professorId]));
    expect(doisCentrais.reduce((s, p) => s + p.valor, 0)).toBe(Object.values(antigo).reduce((s, x) => s + x, 0));
  });
});

// Contas de valores das Centrais (src/centrais/contasValores.js): gasto da unidade, pagamento por
// professor, gasto por unidade do mentor e ganho do professor.
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import {
  mesesDoTrimestre, limitesDoMes, gastoPorMes, gastoPorProfessor, gastoPorUnidade, gastoPorUnidadeDoResumo,
  totaisPorMoeda, ganhoDoProfessorPorMes, ganhoDoProfessorPorUnidade, ultimasAulasDoProfessor,
} from '../../src/centrais/contasValores';

const u1 = { id: 'u1', nome: 'Centro', pais: 'BR' };
const u2 = { id: 'u2', nome: 'Sul', pais: 'BR' };
const u3 = { id: 'u3', nome: 'Palermo', pais: 'AR' };
const aulasTodas = [
  { id: 'a1', unidadeId: 'u1', professorId: 'p1', modalidadeId: 'mo1', hora: '07:00', valor: 50 },
  { id: 'a2', unidadeId: 'u1', professorId: 'p2', modalidadeId: 'mo2', hora: '19:00', valor: 80 },
  { id: 'a3', unidadeId: 'u2', professorId: 'p1', modalidadeId: 'mo1', hora: '18:00', valor: 70 },
  { id: 'a4', unidadeId: 'u3', professorId: 'p1', modalidadeId: 'mo1', hora: '10:00', valor: 9000 },
];
const feita = (id, aulaId, data, extra = {}) => {
  const aula = aulasTodas.find((a) => a.id === aulaId);
  return { id, aulaId, unidadeId: aula.unidadeId, professorId: aula.professorId, data, status: 'realizada', alunos: 10, valorEfetivo: aula.valor, ...extra };
};
const validacoes = [
  feita('1', 'a1', '2026-09-07'),
  feita('2', 'a1', '2026-10-05'),
  feita('3', 'a2', '2026-10-06', { alunos: 20 }),
  feita('4', 'a1', '2026-11-02'),
  feita('5', 'a1', '2026-11-09', { valorEfetivo: 60 }),                       // valor da época
  feita('6', 'a2', '2026-11-03', { professorId: 'p1', professorOriginalId: 'p2', substituicao: true, alunos: 30 }), // p1 substituiu p2
  feita('7', 'a3', '2026-11-04', { alunos: 14 }),
  feita('8', 'a4', '2026-11-05'),
  { id: '9', aulaId: 'a2', unidadeId: 'u1', professorId: 'p2', data: '2026-11-10', status: 'cancelada' },
  { id: '10', aulaId: 'apagada', unidadeId: 'u1', professorId: 'p2', data: '2026-11-10', status: 'realizada', alunos: 99, valorEfetivo: 999 },
  { id: '11', isAulao: true, unidadeId: 'u1', professorId: 'p2', modalidadeId: 'mo2', data: '2026-11-07', status: 'realizada', alunos: 40, valorPago: 200 },
];
const daUnidade1 = validacoes.filter((v) => v.unidadeId === 'u1');
const aulasDaU1 = aulasTodas.filter((a) => a.unidadeId === 'u1');

describe('períodos', () => {
  it('trimestre = mês escolhido e os dois anteriores (inclusive virando o ano)', () => {
    expect(mesesDoTrimestre('2026-11')).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(mesesDoTrimestre('2026-01')).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('limites do mês', () => {
    expect(limitesDoMes('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
  });
});

describe('gasto da unidade', () => {
  it('por mês: só realizadas, valor da época, aulão conta, aula apagada e cancelada não', () => {
    const r = gastoPorMes({ validacoes: daUnidade1, meses: ['2026-09', '2026-10', '2026-11'], aulasTodas: aulasDaU1 });
    expect(r.map((m) => [m.mes, m.valor, m.realizadas, m.alunos])).toEqual([
      ['2026-09', 50, 1, 10],
      ['2026-10', 130, 2, 30],
      ['2026-11', 50 + 60 + 80 + 200, 4, 90],
    ]);
  });
  it('por professor: na substituição, quem recebe é quem deu a aula', () => {
    const r = gastoPorProfessor({ validacoes: daUnidade1, inicio: '2026-11-01', fim: '2026-11-30', aulasTodas: aulasDaU1 });
    expect(r.map((p) => [p.professorId, p.valor, p.realizadas, p.media])).toEqual([
      ['p2', 200, 1, 40],        // só o aulão (a aula dele do dia 03 foi dada pelo substituto)
      ['p1', 50 + 60 + 80, 3, 17], // duas aulas dele + a substituição
    ]);
  });
});

describe('gasto por unidade (mentor)', () => {
  it('a partir das validações', () => {
    const mapa = gastoPorUnidade({ validacoes, inicio: '2026-11-01', fim: '2026-11-30', aulasTodas, unidades: [u1, u2] });
    expect(mapa.get('u1').valor).toBe(390);
    expect(mapa.get('u2')).toEqual({ valor: 70, realizadas: 1, alunos: 14, media: 14 });
    expect(mapa.has('u3')).toBe(false);
  });
  it('a partir do fechamento do mês (resumos_mensais)', () => {
    const resumo = {
      porAula: { a1: { u: 'u1', r: 2, c: 0, a: 20, v: 100 }, a3: { u: 'u2', r: 1, c: 1, a: 14, v: 70 }, a4: { u: 'u3', r: 1, c: 0, a: 10, v: 9000 } },
      auloes: { x: { u: 'u1', r: 1, c: 0, a: 40, v: 200 } },
    };
    const mapa = gastoPorUnidadeDoResumo(resumo, [u1, u2]);
    expect(mapa.get('u1')).toEqual({ valor: 300, realizadas: 3, alunos: 60, media: 20 });
    expect(mapa.get('u2')).toEqual({ valor: 70, realizadas: 1, alunos: 14, media: 14 });
  });
  it('totais nunca somam moedas diferentes', () => {
    expect(totaisPorMoeda([{ pais: 'BR', valor: 100 }, { pais: 'AR', valor: 9000 }, { pais: 'Brasil', valor: 50 }]))
      .toEqual([{ pais: 'AR', valor: 9000 }, { pais: 'BR', valor: 150 }]);
  });
});

describe('ganho do professor', () => {
  const base = { validacoes, professorId: 'p1', aulasTodas };
  it('por mês, só nas unidades que quem olha enxerga', () => {
    const r = ganhoDoProfessorPorMes({ ...base, meses: ['2026-10', '2026-11'], unidades: [u1, u2] });
    expect(r[0]).toEqual({ mes: '2026-10', realizadas: 1, alunos: 10, media: 10, valores: [{ pais: 'BR', valor: 50 }] });
    expect(r[1].realizadas).toBe(4); // a1 x2, substituição na a2, a3 (a4 é de unidade que não enxerga)
    expect(r[1].valores).toEqual([{ pais: 'BR', valor: 50 + 60 + 80 + 70 }]);
  });
  it('quem enxerga unidades de dois países vê os valores separados por moeda', () => {
    const r = ganhoDoProfessorPorMes({ ...base, meses: ['2026-11'], unidades: [u1, u2, u3] });
    expect(r[0].valores).toEqual([{ pais: 'AR', valor: 9000 }, { pais: 'BR', valor: 260 }]);
  });
  it('por unidade, do maior para o menor', () => {
    const r = ganhoDoProfessorPorUnidade({ ...base, inicio: '2026-11-01', fim: '2026-11-30', unidades: [u1, u2] });
    expect(r.map((x) => [x.unidade.id, x.valor, x.realizadas])).toEqual([['u1', 190, 3], ['u2', 70, 1]]);
  });
  it('últimas aulas dadas, da mais recente para a mais antiga', () => {
    const r = ultimasAulasDoProfessor({ ...base, unidades: [u1, u2], limite: 3 });
    expect(r.map((a) => [a.data, a.unidade.id, a.valor, a.substituicao])).toEqual([
      ['2026-11-09', 'u1', 60, false],
      ['2026-11-04', 'u2', 70, false],
      ['2026-11-03', 'u1', 80, true],
    ]);
  });
});

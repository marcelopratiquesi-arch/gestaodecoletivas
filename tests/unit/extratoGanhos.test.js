// Extrato "Ganhos por professor" (src/utils/extratoGanhos.js). Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { extratoPorProfessor, linhasDeExportacao } from '../../src/utils/extratoGanhos';

const linha = (extra) => ({
  professorId: 'p1', professorNome: 'ANA', unidadeId: 'u1', unidadeNome: 'CENTRO', unidadePais: 'BR', modalidadeNome: 'SPINNING',
  tipoLinha: 'titular', aulasRealizadas: 10, aulasCanceladas: 1, totalReceber: 500, historicoSubstituido: [], ...extra,
});

describe('extratoPorProfessor', () => {
  it('junta as linhas do mesmo professor e soma por unidade e modalidade', () => {
    const r = extratoPorProfessor([
      linha(), linha({ aulasRealizadas: 4, aulasCanceladas: 0, totalReceber: 200 }),
      linha({ modalidadeNome: 'PILATES', aulasRealizadas: 5, aulasCanceladas: 0, totalReceber: 300 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ professorNome: 'ANA', realizadas: 19, canceladas: 1, totais: { BRL: 1000 } });
    expect(r[0].detalhes.map((d) => [d.modalidadeNome, d.realizadas, d.valor])).toEqual([['PILATES', 5, 300], ['SPINNING', 14, 700]]);
  });
  it('nunca soma moedas diferentes', () => {
    const r = extratoPorProfessor([linha(), linha({ unidadeId: 'u2', unidadeNome: 'BUENOS AIRES', unidadePais: 'AR', totalReceber: 80000 })]);
    expect(r[0].totais).toEqual({ BRL: 500, ARS: 80000 });
    expect(r[0].detalhes).toHaveLength(2);
  });
  it('conta substituições feitas (linha de substituto) e aulas em que foi substituído', () => {
    const r = extratoPorProfessor([
      linha({ tipoLinha: 'substituto', aulasRealizadas: 3, aulasCanceladas: 0, totalReceber: 150 }),
      linha({ professorId: 'p2', professorNome: 'BIA', aulasRealizadas: 0, aulasCanceladas: 0, totalReceber: 0, historicoSubstituido: [{ status: 'realizada' }, { status: 'realizada' }, { status: 'cancelada' }] }),
    ]);
    const ana = r.find((p) => p.professorNome === 'ANA');
    const bia = r.find((p) => p.professorNome === 'BIA');
    expect(ana.substituicoesFeitas).toBe(3);
    expect(bia.substituidoEmAulas).toBe(2);
  });
  it('professor sem atividade no período não aparece; lista em ordem alfabética', () => {
    const r = extratoPorProfessor([
      linha({ professorId: 'p3', professorNome: 'ZE', aulasRealizadas: 1, aulasCanceladas: 0 }),
      linha({ professorId: 'p4', professorNome: 'VAZIO', aulasRealizadas: 0, aulasCanceladas: 0, totalReceber: 0 }),
      linha({ professorId: 'p5', professorNome: 'ANA2' }),
    ]);
    expect(r.map((p) => p.professorNome)).toEqual(['ANA2', 'ZE']);
  });
  it('entrada vazia ou nula', () => {
    expect(extratoPorProfessor()).toEqual([]);
    expect(extratoPorProfessor([null])).toEqual([]);
  });
  it('a soma dos professores bate com a soma das linhas, moeda a moeda', () => {
    const linhas = [linha(), linha({ professorId: 'p2', professorNome: 'BIA', totalReceber: 250 }), linha({ unidadePais: 'US', totalReceber: 40 })];
    const r = extratoPorProfessor(linhas);
    const total = {};
    r.forEach((p) => Object.entries(p.totais).forEach(([m, v]) => { total[m] = (total[m] || 0) + v; }));
    expect(total).toEqual({ BRL: 750, USD: 40 });
  });
});

describe('linhasDeExportacao', () => {
  it('uma linha por professor, unidade e modalidade, com a moeda', () => {
    const l = linhasDeExportacao(extratoPorProfessor([linha(), linha({ modalidadeNome: 'PILATES' })]));
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ professor: 'ANA', unidade: 'CENTRO', moeda: 'BRL' });
  });
});

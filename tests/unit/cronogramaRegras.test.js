// Regras do Cronograma (src/utils/cronogramaRegras.js). Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { valorDaAulaValido, aulaRepetida, validarCorteNovaFase, diaAnterior, diaSeguinte, professorPodeReceberAula } from '../../src/utils/cronogramaRegras';

describe('valorDaAulaValido', () => {
  it('exige número maior que zero', () => {
    expect(valorDaAulaValido('')).toBe(false);
    expect(valorDaAulaValido(undefined)).toBe(false);
    expect(valorDaAulaValido('0')).toBe(false);
    expect(valorDaAulaValido(0)).toBe(false);
    expect(valorDaAulaValido('abc')).toBe(false);
    expect(valorDaAulaValido('45')).toBe(true);
    expect(valorDaAulaValido(12.5)).toBe(true);
  });
});

describe('dias vizinhos', () => {
  it('passa de mês e de ano', () => {
    expect(diaAnterior('2026-12-01')).toBe('2026-11-30');
    expect(diaSeguinte('2026-12-31')).toBe('2027-01-01');
  });
});

describe('aulaRepetida', () => {
  const base = { id: 'a1', unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '19:00', dias: ['Terça', 'Quinta'], dataInicio: '2026-01-01' };
  const nova = { unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '19:00', dias: ['Quinta'], dataInicio: '2026-06-01' };

  it('acha a aula igual (um dia em comum, vigências que se cruzam)', () => {
    expect(aulaRepetida([base], nova)).toHaveLength(1);
  });
  it('ignora a própria aula editada e as excluídas', () => {
    expect(aulaRepetida([base], nova, 'a1')).toHaveLength(0);
    expect(aulaRepetida([{ ...base, excluido: true }], nova)).toHaveLength(0);
  });
  it('não confunde quando muda professor, horário, modalidade, unidade ou dia', () => {
    expect(aulaRepetida([{ ...base, professorId: 'p2' }], nova)).toHaveLength(0);
    expect(aulaRepetida([{ ...base, hora: '20:00' }], nova)).toHaveLength(0);
    expect(aulaRepetida([{ ...base, modalidadeId: 'm2' }], nova)).toHaveLength(0);
    expect(aulaRepetida([{ ...base, unidadeId: 'u2' }], nova)).toHaveLength(0);
    expect(aulaRepetida([{ ...base, dias: ['Segunda'] }], nova)).toHaveLength(0);
  });
  it('fases seguidas da mesma aula não contam como repetida', () => {
    // fase antiga termina na véspera do início da nova
    expect(aulaRepetida([{ ...base, dataFim: '2026-05-31' }], nova)).toHaveLength(0);
    expect(aulaRepetida([{ ...base, dataFim: '2026-06-01' }], nova)).toHaveLength(1);
  });
});

describe('validarCorteNovaFase', () => {
  const antiga = { dataInicio: '2026-01-01' };

  it('aceita corte no futuro e no passado sem validação', () => {
    expect(validarCorteNovaFase({ corte: '2026-12-01', aulaAntiga: antiga }).ok).toBe(true);
    expect(validarCorteNovaFase({ corte: '2026-11-05', aulaAntiga: antiga, datasValidadas: ['2026-11-03'] }).ok).toBe(true);
  });
  it('recusa corte no início ou antes do início da aula antiga', () => {
    const r = validarCorteNovaFase({ corte: '2026-01-01', aulaAntiga: antiga });
    expect(r).toMatchObject({ ok: false, motivo: 'antes_do_inicio', minimo: '2026-01-02' });
    expect(validarCorteNovaFase({ corte: '2025-12-01', aulaAntiga: antiga }).motivo).toBe('antes_do_inicio');
  });
  it('recusa corte depois do fim que a aula já tem', () => {
    expect(validarCorteNovaFase({ corte: '2026-08-01', aulaAntiga: { ...antiga, dataFim: '2026-07-31' } }).motivo).toBe('depois_do_fim');
    expect(validarCorteNovaFase({ corte: '2026-07-31', aulaAntiga: { ...antiga, dataFim: '2026-07-31' } }).ok).toBe(true);
  });
  it('recusa corte que deixaria validação já feita fora da aula antiga e sugere o dia seguinte à última', () => {
    const r = validarCorteNovaFase({ corte: '2026-11-10', aulaAntiga: antiga, datasValidadas: ['2026-11-05', '2026-11-12', '2026-11-14', '2026-11-12'] });
    expect(r).toEqual({ ok: false, motivo: 'validacao_depois', datas: ['2026-11-12', '2026-11-14'], minimo: '2026-11-15' });
  });
  it('validação exatamente no dia do corte também bloqueia', () => {
    expect(validarCorteNovaFase({ corte: '2026-11-12', aulaAntiga: antiga, datasValidadas: ['2026-11-12'] }).motivo).toBe('validacao_depois');
  });
  it('sem data não passa', () => {
    expect(validarCorteNovaFase({ corte: '', aulaAntiga: antiga }).motivo).toBe('sem_corte');
  });
});

describe('professorPodeReceberAula', () => {
  it('inativo não; ativo e ficha antiga sem status sim', () => {
    expect(professorPodeReceberAula({ status: 'inativo' })).toBe(false);
    expect(professorPodeReceberAula({ status: 'ativo' })).toBe(true);
    expect(professorPodeReceberAula({})).toBe(true);
    expect(professorPodeReceberAula(null)).toBe(false);
  });
});

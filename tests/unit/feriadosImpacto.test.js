// Exceção de unidades, impacto, data passada e feriado repetido. Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { feriadoAplicaNaUnidade, feriadoNoDia } from '../../src/utils/feriados';
import { impactoDoFeriado, comecaNoPassado, feriadosParecidos } from '../../src/utils/feriadosImpacto';
import { montarFeriado } from '../../src/utils/feriadosProposta';

const sp1 = { id: 'u1', pais: 'BR', estado: 'SP' };
const sp2 = { id: 'u2', pais: 'BR', estado: 'SP' };
const mg1 = { id: 'u3', pais: 'BR', estado: 'MG' };
const ar1 = { id: 'u4', pais: 'AR', estado: 'BA' };
const unidades = [sp1, sp2, mg1, ar1];
// 2026-12-24 é quinta; 2026-12-25 sexta
const base = { dataInicio: '2026-12-24', dataFim: '2026-12-25' };

describe('exceto estas unidades', () => {
  it('rede: a unidade da exceção não folga, as outras sim', () => {
    const f = { ...base, escopo: 'rede', unidadesExcecao: ['u2'] };
    expect(unidades.map(u => feriadoAplicaNaUnidade(f, u))).toEqual([true, false, true, true]);
  });
  it('país e estado também respeitam a exceção', () => {
    expect(feriadoAplicaNaUnidade({ ...base, escopo: 'pais', pais: 'BR', unidadesExcecao: ['u1'] }, sp1)).toBe(false);
    expect(feriadoAplicaNaUnidade({ ...base, escopo: 'estado', estado: 'SP', unidadesExcecao: ['u1'] }, sp2)).toBe(true);
  });
  it('feriadoNoDia deixa a unidade da exceção sem feriado', () => {
    const lista = [{ id: 'f', ...base, escopo: 'rede', unidadesExcecao: ['u2'] }];
    expect(feriadoNoDia('2026-12-24', sp1, lista)?.id).toBe('f');
    expect(feriadoNoDia('2026-12-24', sp2, lista)).toBeNull();
  });
  it('feriado antigo, sem o campo, continua igual', () => {
    expect(feriadoAplicaNaUnidade({ ...base, escopo: 'rede' }, sp2)).toBe(true);
  });
  it('montarFeriado só guarda a exceção onde faz sentido', () => {
    const form = { nome: 'X', ...base, tipo: 'Recesso', unidadesExcecao: ['u2'] };
    expect(montarFeriado({ ...form, escopo: 'rede' }).unidadesExcecao).toEqual(['u2']);
    expect(montarFeriado({ ...form, escopo: 'pais', pais: 'BR' }).unidadesExcecao).toEqual(['u2']);
    expect(montarFeriado({ ...form, escopo: 'cidade', cidade: 'x', unidadeIds: ['u1'] }).unidadesExcecao).toBeUndefined();
    expect(montarFeriado({ ...form, escopo: 'unidades', unidadeIds: ['u1'] }).unidadesExcecao).toBeUndefined();
    expect(montarFeriado({ ...form, escopo: 'rede', unidadesExcecao: [] }).unidadesExcecao).toBeUndefined();
  });
});

describe('impactoDoFeriado', () => {
  const aulas = [
    { id: 'a1', unidadeId: 'u1', dias: ['Quinta'] },          // cai em 24/12
    { id: 'a2', unidadeId: 'u1', dias: ['Quinta', 'Sexta'] }, // cai em 24 e 25
    { id: 'a3', unidadeId: 'u2', dias: ['Quinta'] },
    { id: 'a4', unidadeId: 'u3', dias: ['Segunda'] },         // não cai no período
    { id: 'a5', unidadeId: 'u1', dias: ['Quinta'], excluido: true }, // lixeira: não conta
    { id: 'a6', unidadeId: 'u1', dias: ['Quinta'], dataFim: '2026-12-01' }, // já encerrada
  ];
  it('conta unidades e aulas do período', () => {
    expect(impactoDoFeriado({ feriado: { ...base, escopo: 'estado', estado: 'SP' }, unidades, aulas })).toEqual({ unidades: 2, aulas: 4 });
  });
  it('respeita a exceção', () => {
    expect(impactoDoFeriado({ feriado: { ...base, escopo: 'estado', estado: 'SP', unidadesExcecao: ['u2'] }, unidades, aulas })).toEqual({ unidades: 1, aulas: 3 });
  });
  it('rede alcança todas as unidades', () => {
    expect(impactoDoFeriado({ feriado: { ...base, escopo: 'rede' }, unidades, aulas }).unidades).toBe(4);
  });
});

describe('comecaNoPassado', () => {
  it('compara com hoje', () => {
    expect(comecaNoPassado({ dataInicio: '2026-11-01' }, '2026-11-17')).toBe(true);
    expect(comecaNoPassado({ dataInicio: '2026-11-17' }, '2026-11-17')).toBe(false);
    expect(comecaNoPassado({ dataInicio: '2026-12-01' }, '2026-11-17')).toBe(false);
  });
});

describe('feriadosParecidos', () => {
  const lista = [
    { id: 'f1', nome: 'Natal', dataInicio: '2026-12-25', dataFim: '2026-12-25', escopo: 'pais', pais: 'BR' },
    { id: 'f2', nome: 'Natal AR', dataInicio: '2026-12-25', dataFim: '2026-12-25', escopo: 'pais', pais: 'AR' },
    { id: 'f3', nome: 'Outro mês', dataInicio: '2026-11-01', dataFim: '2026-11-02', escopo: 'rede' },
  ];
  it('acha o que se sobrepõe no período e alcança a mesma unidade', () => {
    const novo = { ...base, escopo: 'estado', estado: 'SP' };
    expect(feriadosParecidos(lista, novo, unidades).map(f => f.id)).toEqual(['f1']);
  });
  it('ignora o próprio feriado ao editar e feriados de outro alcance', () => {
    expect(feriadosParecidos(lista, { ...base, escopo: 'pais', pais: 'BR' }, unidades, 'f1')).toEqual([]);
    expect(feriadosParecidos(lista, { ...base, escopo: 'estado', estado: 'MG', unidadesExcecao: ['u3'] }, unidades)).toEqual([]);
  });
});

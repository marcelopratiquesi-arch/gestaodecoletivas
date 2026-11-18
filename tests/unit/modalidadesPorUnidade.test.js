// Modalidades por unidade (src/utils/modalidadesPorUnidade.js). Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import {
  unidadeTemVinculo, modalidadeHabilitada, situacaoVigencia, contarAulasPorModalidade,
  podeDesativar, modalidadeEmUso, comModalidade, semModalidade,
} from '../../src/utils/modalidadesPorUnidade';

const HOJE = '2026-11-18';

describe('unidade sem o campo (não migrada)', () => {
  it('vê todas as modalidades', () => {
    expect(unidadeTemVinculo({ nome: 'A' })).toBe(false);
    expect(modalidadeHabilitada({ nome: 'A' }, 'm1')).toBe(true);
  });
  it('lista vazia é diferente de campo ausente: nenhuma habilitada', () => {
    expect(unidadeTemVinculo({ modalidadesIds: [] })).toBe(true);
    expect(modalidadeHabilitada({ modalidadesIds: [] }, 'm1')).toBe(false);
  });
  it('com lista, só as da lista', () => {
    expect(modalidadeHabilitada({ modalidadesIds: ['m1'] }, 'm1')).toBe(true);
    expect(modalidadeHabilitada({ modalidadesIds: ['m1'] }, 'm2')).toBe(false);
  });
});

describe('situacaoVigencia', () => {
  it('classifica a aula', () => {
    expect(situacaoVigencia({ excluido: true }, HOJE)).toBe('excluida');
    expect(situacaoVigencia({ dataInicio: '2026-01-01', dataFim: '2026-11-17' }, HOJE)).toBe('historica');
    expect(situacaoVigencia({ dataInicio: '2026-01-01', dataFim: '2026-11-18' }, HOJE)).toBe('ativa');
    expect(situacaoVigencia({ dataInicio: '2026-12-01' }, HOJE)).toBe('futura');
    expect(situacaoVigencia({ dataInicio: '2026-01-01', dataFim: null }, HOJE)).toBe('ativa');
  });
  it('aula antiga sem datas conta como ativa', () => {
    expect(situacaoVigencia({}, HOJE)).toBe('ativa');
  });
});

describe('contarAulasPorModalidade / podeDesativar', () => {
  const aulas = [
    { unidadeId: 'u1', modalidadeId: 'm1' },
    { unidadeId: 'u1', modalidadeId: 'm1', dataInicio: '2027-01-01' },
    { unidadeId: 'u1', modalidadeId: 'm2', dataFim: '2026-01-01' },
    { unidadeId: 'u1', modalidadeId: 'm3', excluido: true },
    { unidadeId: 'u2', modalidadeId: 'm4' },
  ];
  const c = contarAulasPorModalidade(aulas, 'u1', HOJE);
  it('conta só ativas e futuras da unidade', () => {
    expect(c).toEqual({ m1: { ativas: 1, futuras: 1 } });
  });
  it('bloqueia desativar com aula ativa ou futura; libera sem aula ou só histórico', () => {
    expect(podeDesativar(c, 'm1')).toBe(false);
    expect(podeDesativar(c, 'm2')).toBe(true);
    expect(podeDesativar(c, 'm3')).toBe(true);
    expect(podeDesativar(c, 'qualquer')).toBe(true);
  });
});

describe('modalidadeEmUso (bloqueia excluir do catálogo)', () => {
  const unidades = [{ id: 'u1', modalidadesIds: ['m1'] }, { id: 'u2' }];
  const aulas = [{ modalidadeId: 'm2' }, { modalidadeId: 'm3', excluido: true }];
  it('em uso por unidade ou por aula', () => {
    expect(modalidadeEmUso('m1', unidades, aulas).emUnidade).toBe(true);
    expect(modalidadeEmUso('m2', unidades, aulas).emAula).toBe(true);
    expect(modalidadeEmUso('m3', unidades, aulas).emUso).toBe(false);
    expect(modalidadeEmUso('m9', unidades, aulas).emUso).toBe(false);
  });
});

describe('comModalidade / semModalidade', () => {
  it('não duplica e remove', () => {
    expect(comModalidade(['a'], 'b')).toEqual(['a', 'b']);
    expect(comModalidade(['a', 'b'], 'b')).toEqual(['a', 'b']);
    expect(comModalidade(undefined, 'b')).toEqual(['b']);
    expect(semModalidade(['a', 'b'], 'a')).toEqual(['b']);
  });
});

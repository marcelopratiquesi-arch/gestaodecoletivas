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

import { planejarConfiguracaoEmMassa } from '../../src/utils/modalidadesPorUnidade';

describe('planejarConfiguracaoEmMassa', () => {
  const modalidades = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
  const unidades = [
    { id: 'u1' },                              // tem aulas ativas
    { id: 'u2', modalidadesIds: ['m3'] },      // já configurada: não mexe
    { id: 'u3' },                              // sem aula ativa: básicas
    { id: 'u4' },                              // aula em modalidade que não existe no catálogo
  ];
  const aulas = [
    { unidadeId: 'u1', modalidadeId: 'm1' }, { unidadeId: 'u1', modalidadeId: 'm2' }, { unidadeId: 'u1', modalidadeId: 'm2' },
    { unidadeId: 'u1', modalidadeId: 'm3', dataFim: '2026-01-01' },   // histórica: fica de fora
    { unidadeId: 'u3', modalidadeId: 'm1', excluido: true },
    { unidadeId: 'u4', modalidadeId: 'fantasma' },
  ];
  const p = planejarConfiguracaoEmMassa({ unidades, aulas, modalidades, basicasIds: ['m1', 'm9'], hoje: '2026-11-18' });
  it('só aulas ativas/futuras; histórica fica fora', () => {
    expect(p.itens.find((i) => i.unidade.id === 'u1')).toMatchObject({ ids: ['m1', 'm2'], origem: 'aulas' });
  });
  it('unidade já configurada não entra', () => {
    expect(p.jaConfiguradas.map((u) => u.id)).toEqual(['u2']);
    expect(p.itens.some((i) => i.unidade.id === 'u2')).toBe(false);
  });
  it('sem aula ativa recebe as básicas que existem no catálogo', () => {
    expect(p.itens.find((i) => i.unidade.id === 'u3')).toMatchObject({ ids: ['m1'], origem: 'basicas' });
  });
  it('modalidade fora do catálogo vira divergência e não entra', () => {
    expect(p.divergencias).toEqual([{ unidade: unidades[3], modalidadeId: 'fantasma' }]);
    expect(p.itens.find((i) => i.unidade.id === 'u4').origem).toBe('basicas');
  });
  it('sem lista básica, a unidade sem aula fica de fora', () => {
    const q = planejarConfiguracaoEmMassa({ unidades: [{ id: 'u3' }], aulas: [], modalidades, basicasIds: [], hoje: '2026-11-18' });
    expect(q.itens).toHaveLength(0);
    expect(q.semBasicas.map((u) => u.id)).toEqual(['u3']);
  });
});

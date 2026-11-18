// Montagem de feriado e de proposta de mentor (src/utils/feriadosProposta.js). Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { montarFeriado, feriadoDaProposta, ESCOPOS_DO_MENTOR } from '../../src/utils/feriadosProposta';

const base = { nome: '  Recesso  ', dataInicio: '2026-12-24', dataFim: '2026-12-26', tipo: 'Recesso' };

describe('montarFeriado', () => {
  it('rede: só os campos básicos', () => {
    expect(montarFeriado({ ...base, escopo: 'rede', pais: 'BR', estado: 'SP', unidadeIds: ['u1'] }))
      .toEqual({ nome: 'Recesso', dataInicio: '2026-12-24', dataFim: '2026-12-26', tipo: 'Recesso', escopo: 'rede' });
  });
  it('país, estado, cidade e unidades guardam só o que lhes cabe', () => {
    expect(montarFeriado({ ...base, escopo: 'pais', pais: 'AR', estado: 'x' })).toMatchObject({ pais: 'AR' });
    expect(montarFeriado({ ...base, escopo: 'pais', pais: 'AR' }).estado).toBeUndefined();
    expect(montarFeriado({ ...base, escopo: 'estado', estado: 'MG' })).toMatchObject({ estado: 'MG' });
    expect(montarFeriado({ ...base, escopo: 'cidade', cidade: ' BH ', unidadeIds: ['u1'] })).toMatchObject({ cidade: 'BH', unidadeIds: ['u1'] });
    expect(montarFeriado({ ...base, escopo: 'unidades', unidadeIds: ['u1', 'u2'] })).toMatchObject({ unidadeIds: ['u1', 'u2'] });
  });
});

describe('feriadoDaProposta', () => {
  it('copia a proposta como feriado e anota quem propôs e de qual proposta veio', () => {
    const f = feriadoDaProposta({ id: 'p1', propostoPor: 'mentor1', status: 'pendente', propostoPorNome: 'Ana', ...base, escopo: 'unidades', unidadeIds: ['u1'] });
    expect(f).toEqual({ nome: 'Recesso', dataInicio: '2026-12-24', dataFim: '2026-12-26', tipo: 'Recesso', escopo: 'unidades', unidadeIds: ['u1'], propostoPor: 'mentor1', origemProposta: 'p1' });
    expect(f.status).toBeUndefined();
  });
});

describe('escopos do mentor', () => {
  it('só cidade e unidades (as dele)', () => { expect(ESCOPOS_DO_MENTOR).toEqual(['cidade', 'unidades']); });
});

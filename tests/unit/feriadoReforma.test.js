import { describe, it, expect } from 'vitest';
import { TIPO_REFORMA, ehReforma, reformaEmAndamento, feriadoNoDia } from '../../src/utils/feriados';
import { montarFeriado } from '../../src/utils/feriadosProposta';

const reforma = { id: 'r1', nome: 'Reforma do piso', tipo: TIPO_REFORMA, escopo: 'unidades', unidadeIds: ['u1', 'u2'], dataInicio: '2026-11-20', dataFim: '2026-12-03' };

describe('Reforma (unidade fechada em obra)', () => {
  it('reconhece o tipo Reforma e só ele', () => {
    expect(ehReforma(reforma)).toBe(true);
    expect(ehReforma({ tipo: 'Recesso' })).toBe(false);
    expect(ehReforma(null)).toBe(false);
  });

  it('está em andamento só dentro do período (inclui o primeiro e o último dia)', () => {
    expect(reformaEmAndamento(reforma, '2026-11-19')).toBe(false);
    expect(reformaEmAndamento(reforma, '2026-11-20')).toBe(true);
    expect(reformaEmAndamento(reforma, '2026-12-03')).toBe(true);
    expect(reformaEmAndamento(reforma, '2026-12-04')).toBe(false);
    expect(reformaEmAndamento({ ...reforma, tipo: 'Recesso' }, '2026-11-25')).toBe(false);
  });

  it('cancela a aula só nas unidades escolhidas (mesma regra dos feriados)', () => {
    expect(feriadoNoDia('2026-11-25', { id: 'u1' }, [reforma])?.id).toBe('r1');
    expect(feriadoNoDia('2026-11-25', { id: 'u2' }, [reforma])?.id).toBe('r1');
    expect(feriadoNoDia('2026-11-25', { id: 'u3' }, [reforma])).toBeNull();
    expect(feriadoNoDia('2026-12-10', { id: 'u1' }, [reforma])).toBeNull();
  });

  it('o formulário e a proposta do mentor guardam o tipo e as unidades', () => {
    const f = montarFeriado({ nome: 'Reforma', dataInicio: '2026-11-20', dataFim: '2026-12-03', tipo: TIPO_REFORMA, escopo: 'unidades', unidadeIds: ['u1'], estado: 'MG', cidade: 'BH', unidadesExcecao: ['u9'] });
    expect(f).toMatchObject({ tipo: 'Reforma', escopo: 'unidades', unidadeIds: ['u1'] });
    expect(f.estado).toBeUndefined();
    expect(f.unidadesExcecao).toBeUndefined();
  });
});

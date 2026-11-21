import { describe, it, expect } from 'vitest';
import { dadosPublicosReforma, reformaPublicaDaUnidade, DIAS_DE_AVISO } from '../../src/utils/reformaPublica';

const reformas = {
  r1: { unidadeIds: ['u1', 'u2'], ini: '2026-11-20', fim: '2026-12-03' },
  r2: { unidadeIds: ['u3'], ini: '2026-12-20', fim: '2027-01-10' },
};

describe('reforma na página pública', () => {
  it('só vai para a vitrine o que a página precisa (sem o motivo)', () => {
    expect(dadosPublicosReforma({ nome: 'Reforma do piso', tipo: 'Reforma', unidadeIds: [1, 'u2'], dataInicio: '2026-11-20', dataFim: '2026-12-03' }))
      .toEqual({ unidadeIds: ['1', 'u2'], ini: '2026-11-20', fim: '2026-12-03' });
    expect(dadosPublicosReforma({ unidadeIds: ['u1'], dataInicio: '2026-11-20' }).fim).toBe('2026-11-20');
  });

  it('dentro do período: fechada agora, e diz quando as aulas voltam (dia seguinte)', () => {
    expect(reformaPublicaDaUnidade(reformas, 'u1', '2026-11-25')).toEqual({ estado: 'agora', ini: '2026-11-20', fim: '2026-12-03', retorno: '2026-12-04' });
    expect(reformaPublicaDaUnidade(reformas, 'u2', '2026-11-20')?.estado).toBe('agora');
    expect(reformaPublicaDaUnidade(reformas, 'u2', '2026-12-03')?.estado).toBe('agora');
  });

  it('o retorno passa de mês e de ano corretamente', () => {
    expect(reformaPublicaDaUnidade({ x: { unidadeIds: ['u9'], ini: '2026-12-20', fim: '2026-12-31' } }, 'u9', '2026-12-25')?.retorno).toBe('2027-01-01');
  });

  it('antes de começar: aviso só se começa em até 30 dias', () => {
    expect(reformaPublicaDaUnidade(reformas, 'u1', '2026-11-10')?.estado).toBe('em-breve');
    expect(reformaPublicaDaUnidade(reformas, 'u3', '2026-12-10')?.estado).toBe('em-breve'); // 10 dias antes
    expect(reformaPublicaDaUnidade(reformas, 'u3', '2026-11-10')).toBeNull(); // 40 dias antes
    expect(DIAS_DE_AVISO).toBe(30);
  });

  it('depois de terminar, some sozinha; unidade sem reforma não mostra nada', () => {
    expect(reformaPublicaDaUnidade(reformas, 'u1', '2026-12-04')).toBeNull();
    expect(reformaPublicaDaUnidade(reformas, 'u99', '2026-11-25')).toBeNull();
    expect(reformaPublicaDaUnidade(undefined, 'u1', '2026-11-25')).toBeNull();
  });

  it('com duas reformas, vale a que está acontecendo; senão a mais próxima', () => {
    const duas = { a: { unidadeIds: ['u1'], ini: '2026-11-20', fim: '2026-11-30' }, b: { unidadeIds: ['u1'], ini: '2026-12-05', fim: '2026-12-10' } };
    expect(reformaPublicaDaUnidade(duas, 'u1', '2026-11-25')?.fim).toBe('2026-11-30');
    expect(reformaPublicaDaUnidade(duas, 'u1', '2026-12-01')?.ini).toBe('2026-12-05');
  });

  it('ignora reforma com datas inválidas', () => {
    expect(reformaPublicaDaUnidade({ x: { unidadeIds: ['u1'], ini: '2026-12-10', fim: '2026-12-01' } }, 'u1', '2026-12-05')).toBeNull();
  });
});

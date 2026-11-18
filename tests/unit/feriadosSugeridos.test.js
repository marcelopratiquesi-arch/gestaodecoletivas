// Lista sugerida de feriados nacionais (src/utils/feriadosSugeridos.js). Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { pascoa, feriadosSugeridos, sugestaoJaAplicada } from '../../src/utils/feriadosSugeridos';

const por = (pais, ano) => Object.fromEntries(feriadosSugeridos(pais, ano).map(f => [f.chave.split('-').slice(2).join('-'), f]));

describe('Páscoa', () => {
  it('datas conhecidas', () => {
    const f = (a) => pascoa(a).toISOString().slice(0, 10);
    expect(f(2024)).toBe('2024-03-31');
    expect(f(2025)).toBe('2025-04-20');
    expect(f(2026)).toBe('2026-04-05');
    expect(f(2027)).toBe('2027-03-28');
  });
});

describe('Brasil 2026', () => {
  const br = por('BR', 2026);
  it('móveis a partir da Páscoa', () => {
    expect(br.carnaval).toMatchObject({ dataInicio: '2026-02-16', dataFim: '2026-02-17', tipo: 'Recesso' });
    expect(br['sexta-santa'].dataInicio).toBe('2026-04-03');
    expect(br['corpus-christi'].dataInicio).toBe('2026-06-04');
  });
  it('fixos e Consciência Negra (nacional desde 2024)', () => {
    expect(br.tiradentes.dataInicio).toBe('2026-04-21');
    expect(br.natal.dataInicio).toBe('2026-12-25');
    expect(br['consciencia-negra'].dataInicio).toBe('2026-11-20');
    expect(por('BR', 2023)['consciencia-negra']).toBeUndefined();
  });
});

describe('Argentina 2026', () => {
  const ar = por('AR', 2026);
  it('carnaval e Semana Santa', () => {
    expect(ar.carnaval).toMatchObject({ dataInicio: '2026-02-16', dataFim: '2026-02-17' });
    expect(ar['viernes-santo'].dataInicio).toBe('2026-04-03');
    expect(ar['jueves-santo']).toMatchObject({ dataInicio: '2026-04-02', conferir: true });
  });
  it('trasladables: quarta vai para a segunda anterior, sexta para a segunda seguinte, segunda fica', () => {
    expect(ar.guemes.dataInicio).toBe('2026-06-15');      // 17/06 é quarta
    expect(ar['san-martin'].dataInicio).toBe('2026-08-17'); // 17/08 é segunda
    expect(ar.diversidad.dataInicio).toBe('2026-10-12');    // 12/10 é segunda
    expect(ar.soberania.dataInicio).toBe('2026-11-23');     // 20/11 é sexta
    for (const k of ['guemes', 'san-martin', 'diversidad', 'soberania']) expect(ar[k].conferir).toBe(true);
  });
  it('inamovíveis não pedem conferência', () => {
    expect(ar.belgrano).toMatchObject({ dataInicio: '2026-06-20', conferir: false });
  });
});

describe('Estados Unidos 2026', () => {
  const us = por('US', 2026);
  it('segundas por posição no mês', () => {
    expect(us.mlk.dataInicio).toBe('2026-01-19');
    expect(us.presidents.dataInicio).toBe('2026-02-16');
    expect(us.memorial.dataInicio).toBe('2026-05-25');
    expect(us.labor.dataInicio).toBe('2026-09-07');
    expect(us.columbus.dataInicio).toBe('2026-10-12');
    expect(us.thanksgiving.dataInicio).toBe('2026-11-26');
  });
  it('fixo no sábado é observado na sexta; no domingo, na segunda', () => {
    expect(us.independence).toMatchObject({ dataInicio: '2026-07-03' }); // 04/07/2026 é sábado
    expect(us.independence.nota).toMatch(/Observado/);
    expect(por('US', 2027)['new-year'].dataInicio).toBe('2027-01-01');   // sexta: sem mudança
    expect(por('US', 2028)['new-year'].dataInicio).toBe('2027-12-31');   // 01/01/2028 é sábado: o governo folga na sexta anterior
  });
});

describe('geral', () => {
  it('país ou ano inválidos voltam vazio; lista vem em ordem de data', () => {
    expect(feriadosSugeridos('XX', 2026)).toEqual([]);
    expect(feriadosSugeridos('BR', 'abc')).toEqual([]);
    const datas = feriadosSugeridos('AR', 2026).map(f => f.dataInicio);
    expect(datas).toEqual([...datas].sort());
  });
});

describe('sugestaoJaAplicada', () => {
  const natal = feriadosSugeridos('BR', 2026).find(f => f.chave.endsWith('natal'));
  it('conta como aplicado se há feriado de rede ou do mesmo país no mesmo período', () => {
    expect(sugestaoJaAplicada(natal, [{ escopo: 'pais', pais: 'BR', dataInicio: '2026-12-25', dataFim: '2026-12-25' }])).toBe(true);
    expect(sugestaoJaAplicada(natal, [{ escopo: 'rede', dataInicio: '2026-12-25', dataFim: '2026-12-25' }])).toBe(true);
  });
  it('não conta outro país, outro período ou outro alcance', () => {
    expect(sugestaoJaAplicada(natal, [{ escopo: 'pais', pais: 'AR', dataInicio: '2026-12-25', dataFim: '2026-12-25' }])).toBe(false);
    expect(sugestaoJaAplicada(natal, [{ escopo: 'pais', pais: 'BR', dataInicio: '2026-12-24', dataFim: '2026-12-25' }])).toBe(false);
    expect(sugestaoJaAplicada(natal, [{ escopo: 'estado', estado: 'SP', dataInicio: '2026-12-25', dataFim: '2026-12-25' }])).toBe(false);
  });
});

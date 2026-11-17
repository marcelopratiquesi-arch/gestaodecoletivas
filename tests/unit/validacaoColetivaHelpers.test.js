import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { formatPendencias } from '../../src/utils/pendencias.js';

describe('Validação Coletiva — texto das pendências', () => {
  it('agrupa por dia e mostra os horários', () => {
    const txt = formatPendencias([
      { data: '2020-03-02', info: '20:00' },
      { data: '2020-03-02', info: '19:00' },
      { data: '2020-03-03', info: '19:00' },
    ]);
    expect(txt).toMatch(/\(19:00, 20:00\)/);
    expect(txt.split('),').length).toBe(2);
  });

  it('não repete horário igual e ignora datas futuras', () => {
    const txt = formatPendencias([
      { data: '2020-03-02', info: '19:00' },
      { data: '2020-03-02', info: '19:00' },
      { data: '2999-01-01', info: '10:00' },
    ]);
    expect(txt.match(/19:00/g).length).toBe(1);
    expect(txt).not.toMatch(/10:00/);
  });

  it('sem horário informado, mostra só o dia; lista vazia dá texto vazio', () => {
    expect(formatPendencias([{ data: '2020-03-02' }])).not.toMatch(/\(/);
    expect(formatPendencias([])).toBe('');
    expect(formatPendencias()).toBe('');
  });
});

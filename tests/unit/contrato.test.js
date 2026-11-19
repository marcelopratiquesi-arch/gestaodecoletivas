import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { validarContrato, resumoContrato, mesmoContrato, contratoVazio, localVazio } from '../../src/utils/contrato.js';

const h = (dia = 1, ini = '06:00', fim = '10:00') => ({ dia, ini, fim });

describe('validar o contrato do professor', () => {
  it('CLT é o padrão e não guarda locais', () => {
    expect(validarContrato(undefined)).toEqual({ ok: true, valor: contratoVazio() });
    expect(validarContrato({ tipoContrato: 'clt', saverLocais: [localVazio('u1')] }).valor).toEqual({ tipoContrato: 'clt', saverLocais: [] });
  });
  it('Saver em 1 unidade com horários', () => {
    const r = validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(1), h(3)] }] });
    expect(r.ok).toBe(true);
    expect(r.valor.saverLocais[0].horarios).toHaveLength(2);
  });
  it('Saver em 2 unidades', () => {
    const r = validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h()] }, { unidadeId: 'u2', horarios: [h(2, '14:00', '18:00')] }] });
    expect(r.ok).toBe(true);
    expect(r.valor.saverLocais).toHaveLength(2);
  });
  it('recusa: sem unidade, unidade repetida, sem horário, horário ruim, tipo desconhecido, unidades demais', () => {
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [] }).erro).toBe('unit');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: '', horarios: [h()] }] }).erro).toBe('unit');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h()] }, { unidadeId: 'u1', horarios: [h()] }] }).erro).toBe('sameUnit');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [] }] }).erro).toBe('hours');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(1, '10:00', '10:00')] }] }).erro).toBe('hour');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(1, '10:00', '09:00')] }] }).erro).toBe('hour');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(7)] }] }).erro).toBe('hour');
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(1, '6:00', '10:00')] }] }).erro).toBe('hour');
    expect(validarContrato({ tipoContrato: 'estagio' }).erro).toBe('type');
    const seis = Array.from({ length: 6 }, (_, i) => ({ unidadeId: `u${i}`, horarios: [h()] }));
    expect(validarContrato({ tipoContrato: 'saver', saverLocais: seis }).erro).toBe('tooMany');
  });
  it('resumo legível e comparação', () => {
    expect(resumoContrato({ tipoContrato: 'clt' })).toBe('CLT');
    expect(resumoContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h(1), h(3)] }] }, () => 'Santa Inês'))
      .toBe('Saver: Santa Inês (seg 06:00-10:00, qua 06:00-10:00)');
    expect(mesmoContrato(undefined, { tipoContrato: 'clt', saverLocais: [] })).toBe(true);
    expect(mesmoContrato({ tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [h()] }] }, undefined)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { agenciaValida, contaValida, formatarAgencia, formatarConta, professorTemBancoInter, validarDadosBancarios } from '../../src/utils/dadosBancarios';

describe('Banco Inter do professor', () => {
  it('agência: de 3 a 5 números', () => {
    expect(agenciaValida('0001')).toBe(true);
    expect(agenciaValida('12')).toBe(false);
    expect(agenciaValida('123456')).toBe(false);
    expect(agenciaValida('')).toBe(false);
  });
  it('conta: de 4 a 15 números, com ou sem hífen', () => {
    expect(contaValida('1234567-8')).toBe(true);
    expect(contaValida('12345678')).toBe(true);
    expect(contaValida('123')).toBe(false);
    expect(contaValida('abc')).toBe(false);
  });
  it('formata: último número vira dígito; agência só números', () => {
    expect(formatarConta('12345678')).toBe('1234567-8');
    expect(formatarConta('1234567-8')).toBe('1234567-8');
    expect(formatarConta('5')).toBe('5');
    expect(formatarAgencia('00-01 x')).toBe('0001');
  });
  it('só existe para quem trabalha no Brasil (sem país = Brasil)', () => {
    expect(professorTemBancoInter('BR')).toBe(true);
    expect(professorTemBancoInter(undefined)).toBe(true);
    expect(professorTemBancoInter('AR')).toBe(false);
    expect(professorTemBancoInter('US')).toBe(false);
  });
  it('valida e devolve só números', () => {
    expect(validarDadosBancarios({ agencia: '0001', conta: '1234567-8' })).toEqual({ ok: true, valor: { agencia: '0001', conta: '12345678' } });
    expect(validarDadosBancarios({ agencia: '1', conta: '12345678' })).toEqual({ ok: false, erro: 'agency' });
    expect(validarDadosBancarios({ agencia: '0001', conta: '12' })).toEqual({ ok: false, erro: 'account' });
  });
});

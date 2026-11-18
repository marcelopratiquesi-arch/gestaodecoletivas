// Totais por moeda (src/utils/moedas.js). Rodar: npx vitest run tests/unit
import { describe, it, expect, beforeAll } from 'vitest';

// O formatador carrega o sistema de idiomas, que lê o localStorage do navegador: simula antes de importar.
let somarPorMoeda, juntarTotais, moedasEmOrdem, dividirPorMoeda, moedaDoPais, textoPorMoeda;
beforeAll(async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  ({ somarPorMoeda, juntarTotais, moedasEmOrdem, dividirPorMoeda, moedaDoPais, textoPorMoeda } = await import('../../src/utils/moedas'));
});

const linhas = [
  { pais: 'BR', v: 100 }, { pais: 'BR', v: 50 },
  { pais: 'AR', v: 80000 }, { pais: 'US', v: 30 }, { pais: 'Brasil', v: 10 },
];

describe('somarPorMoeda', () => {
  it('nunca mistura moedas', () => {
    expect(somarPorMoeda(linhas, (l) => l.pais, (l) => l.v)).toEqual({ BRL: 160, ARS: 80000, USD: 30 });
  });
  it('lista vazia, valor inválido e país vazio', () => {
    expect(somarPorMoeda([], (l) => l.pais, (l) => l.v)).toEqual({});
    expect(somarPorMoeda([{ pais: 'BR', v: 'abc' }, { pais: '', v: 5 }], (l) => l.pais, (l) => l.v)).toEqual({ BRL: 5 });
  });
});

describe('moedaDoPais', () => {
  it('reconhece siglas e nomes; desconhecido cai em real', () => {
    expect(moedaDoPais('AR')).toBe('ARS');
    expect(moedaDoPais('Estados Unidos')).toBe('USD');
    expect(moedaDoPais(undefined)).toBe('BRL');
  });
});

describe('juntarTotais / moedasEmOrdem / dividirPorMoeda', () => {
  it('junta moeda a moeda', () => {
    expect(juntarTotais({ BRL: 1, USD: 2 }, { BRL: 3, ARS: 4 })).toEqual({ BRL: 4, USD: 2, ARS: 4 });
  });
  it('ordena pela maior e é estável no empate', () => {
    expect(moedasEmOrdem({ USD: 5, ARS: 900, BRL: 5 })).toEqual(['ARS', 'BRL', 'USD']);
  });
  it('média por moeda, sem dividir por zero', () => {
    expect(dividirPorMoeda({ BRL: 100, ARS: 50 }, { BRL: 4, ARS: 0 })).toEqual({ BRL: 25, ARS: 0 });
  });
});

describe('textoPorMoeda', () => {
  it('uma moeda por trecho, com o símbolo certo', () => {
    const t = textoPorMoeda({ BRL: 1200, ARS: 80000 });
    expect(t).toContain('R$');
    expect(t).toContain('AR$');
    expect(t).toContain(' · ');
  });
  it('vazio mostra zero em real', () => {
    expect(textoPorMoeda({})).toContain('R$');
  });
});

import { describe, it, expect } from 'vitest';
import { camposFaltando, hojeLocal, proximoAdiamento, situacaoDoAdiamento, entraNaRegraDoCadastro } from '../../src/utils/cadastroCompleto';

const completo = { nome: 'Ana Souza', telefone: '(31) 98888-7777', pais: 'BR', nascimentoOk: true, role: 'professor' };

describe('o que falta no cadastro', () => {
  it('cadastro completo não falta nada', () => {
    expect(camposFaltando({ cracha: completo })).toEqual([]);
  });
  it('aponta nome, telefone, país e nascimento que faltam', () => {
    expect(camposFaltando({ cracha: { role: 'mentor' } })).toEqual(['nome', 'telefone', 'pais', 'nascimento']);
    expect(camposFaltando({ cracha: { ...completo, telefone: '123' } })).toEqual(['telefone']);
    expect(camposFaltando({ cracha: { ...completo, nascimentoOk: undefined } })).toEqual(['nascimento']);
  });
  it('país vem do crachá ou da unidade; nascimento vale se já está guardado', () => {
    expect(camposFaltando({ cracha: { ...completo, pais: undefined }, paisDaUnidade: 'AR' })).toEqual([]);
    expect(camposFaltando({ cracha: { ...completo, pais: undefined } })).toEqual(['pais']);
    expect(camposFaltando({ cracha: { ...completo, nascimentoOk: undefined }, temNascimento: true })).toEqual([]);
  });
});

describe('adiar o aviso: 1 por dia, trava no 3º dia', () => {
  it('dia 1: pode adiar; depois de adiar, não aparece mais hoje', () => {
    const c0 = {};
    expect(situacaoDoAdiamento(c0, '2026-11-21')).toMatchObject({ podeAdiar: true, adiadoHoje: false, travado: false, restantes: 2 });
    const c1 = { ...c0, ...proximoAdiamento(c0, '2026-11-21') };
    expect(c1).toEqual({ cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21' });
    expect(situacaoDoAdiamento(c1, '2026-11-21')).toMatchObject({ adiadoHoje: true, podeAdiar: false, travado: false });
  });
  it('dia 2: pode adiar de novo; dia 3: trava', () => {
    const c1 = { cadastroAdiamentos: 1, cadastroAdiadoEm: '2026-11-21' };
    expect(situacaoDoAdiamento(c1, '2026-11-22')).toMatchObject({ podeAdiar: true, travado: false, restantes: 1 });
    const c2 = { ...c1, ...proximoAdiamento(c1, '2026-11-22') };
    expect(situacaoDoAdiamento(c2, '2026-11-22')).toMatchObject({ adiadoHoje: true, travado: false });
    expect(situacaoDoAdiamento(c2, '2026-11-23')).toMatchObject({ travado: true, podeAdiar: false, adiadoHoje: false });
  });
  it('hoje em "AAAA-MM-DD" e só os papéis com acesso entram na regra', () => {
    expect(hojeLocal(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(entraNaRegraDoCadastro({ role: 'Mentor' })).toBe(true);
    expect(entraNaRegraDoCadastro({ role: 'bloqueado' })).toBe(false);
    expect(entraNaRegraDoCadastro(null)).toBe(false);
  });
});

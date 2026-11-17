// Conta do "Juntar fichas" (src/utils/juntarFichas.js).
// Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { montarPlanoJuncao, gravacoesDoPlano } from '../../src/utils/juntarFichas';

const principal = { id: 'P', status: 'ativo', email: 'moises@x.com', telefone: '', uidLogin: '' };
const outra = { id: 'S', status: 'ativo', email: 'outro@x.com', telefone: '31991632715', pais: 'BR', uidLogin: 'uGoogle' };

describe('montarPlanoJuncao', () => {
  const plano = montarPlanoJuncao({
    principal,
    outras: [outra],
    aulas: [{ id: 'a1', professorId: 'S' }, { id: 'a2', professorId: 'S' }],
    vinculos: [
      { id: 'vP1', professorId: 'P', unidadeId: 'U1' },
      { id: 'vS1', professorId: 'S', unidadeId: 'U1' },  // mesma unidade: apaga
      { id: 'vS2', professorId: 'S', unidadeId: 'U2' },  // unidade nova: move
    ],
    validacoes: [
      { id: 'val1', professorId: 'S', data: '2026-10-05' },
      { id: 'val2', professorId: 'X', professorOriginalId: 'S', data: '2026-10-06' },  // S foi substituído
      { id: 'val3', professorId: 'S', isAulao: true, data: '2026-09-10' },             // aulão: refaz resumo
      { id: 'val4', professorId: 'P', data: '2026-10-07' },                            // já da principal
    ],
    crachas: [{ id: 'uGoogle', professorId: 'S' }],
    crachaDoLogin: { uGoogle: { loginGoogle: true } },
  });

  it('move aulas e uma ligação por unidade', () => {
    expect(plano.aulas).toEqual(['a1', 'a2']);
    expect(plano.vinculosMover).toEqual(['vS2']);
    expect(plano.vinculosApagar).toEqual(['vS1']);
  });
  it('move o histórico: titular e substituído', () => {
    expect(plano.validacoes).toEqual([
      { id: 'val1', mudar: { professorId: 'P' } },
      { id: 'val2', mudar: { professorOriginalId: 'P' } },
      { id: 'val3', mudar: { professorId: 'P' } },
    ]);
    expect(plano.mesesResumo).toEqual(['2026-09']);
  });
  it('religa o crachá, leva o login do Google e completa o que falta', () => {
    expect(plano.crachas).toEqual(['uGoogle']);
    expect(plano.completar).toEqual({ telefone: '31991632715', pais: 'BR', uidLogin: 'uGoogle' });
    expect(plano.idsApagar).toEqual(['S']);
  });
  it('conta as gravações', () => {
    // 2 aulas + 1 mover + 1 apagar vínculo + 3 validações + 1 crachá + 1 resumo + 1 ficha apagada + 1 principal
    expect(gravacoesDoPlano(plano)).toBe(11);
  });
  it('não troca o login da principal por um login antigo sem Google', () => {
    const p = montarPlanoJuncao({
      principal: { ...principal, uidLogin: 'uP' },
      outras: [{ ...outra, uidLogin: 'uVelho' }],
      crachaDoLogin: { uP: { loginGoogle: false }, uVelho: { loginGoogle: false } },
    });
    expect(p.completar.uidLogin).toBeUndefined();
  });
  it('ficha que fica inativa volta a ativa se alguma outra estava ativa', () => {
    const p = montarPlanoJuncao({ principal: { ...principal, status: 'inativo' }, outras: [outra] });
    expect(p.completar.status).toBe('ativo');
  });
  it('nunca apaga a própria ficha principal', () => {
    const p = montarPlanoJuncao({ principal, outras: [principal, outra] });
    expect(p.idsApagar).toEqual(['S']);
  });
});

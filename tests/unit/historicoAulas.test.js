// Histórico de aulas (src/utils/historicoAulas.js). Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { podeVerHistorico, aulasDoHistorico, continuidadeDasAulas, filtrarHistorico } from '../../src/utils/historicoAulas';

const hoje = '2026-11-18';
const aula = (id, extra = {}) => ({ id, unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '07:00', dias: ['Segunda'], valor: 50, dataInicio: '2026-01-01', dataFim: null, ...extra });

describe('quem pode ver', () => {
  it('professor nunca; admin, mentor e líder sim', () => {
    expect(podeVerHistorico('professor')).toBe(false);
    expect(podeVerHistorico('')).toBe(false);
    expect(podeVerHistorico('admin')).toBe(true);
    expect(podeVerHistorico('mentor')).toBe(true);
    expect(podeVerHistorico('lider_unidade', true)).toBe(true);
  });
});

describe('aulasDoHistorico', () => {
  const todas = [
    aula('a', { dataFim: '2026-03-31' }),
    aula('b', { dataFim: '2026-11-17' }),
    aula('c', { dataFim: '2026-11-18' }),            // termina hoje: ainda vale
    aula('d'),                                        // sem fim: ativa
    aula('e', { unidadeId: 'u2', dataFim: '2026-01-31' }),
    aula('f', { excluido: true, dataFim: null }),
  ];
  it('só encerradas, da mais recente para a mais antiga', () => {
    const r = aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: ['u1', 'u2'], ehAdmin: false, hoje });
    expect(r.map((x) => x.id)).toEqual(['b', 'a', 'e']);
  });
  it('respeita as unidades permitidas (líder/mentor)', () => {
    const r = aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: ['u1'], hoje });
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('excluídas só para o admin', () => {
    expect(aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: ['u1'], ehAdmin: true, hoje }).map((x) => x.id)).toContain('f');
    expect(aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: ['u1'], ehAdmin: false, hoje }).map((x) => x.id)).not.toContain('f');
  });
  it('filtro de uma unidade só', () => {
    const r = aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: ['u1', 'u2'], unidadeId: 'u2', hoje });
    expect(r.map((x) => x.id)).toEqual(['e']);
  });
  it('sem unidade permitida, nada', () => {
    expect(aulasDoHistorico({ aulasTodas: todas, unidadesPermitidas: [], ehAdmin: true, hoje })).toEqual([]);
  });
});

describe('continuidadeDasAulas', () => {
  it('acha a nova fase e diz o que mudou', () => {
    const velha = aula('velha', { dataFim: '2026-06-30' });
    const nova = aula('nova', { dataInicio: '2026-07-01', professorId: 'p2', valor: 60 });
    const r = continuidadeDasAulas([velha, nova]);
    expect(r.get('velha').continuadaPor.id).toBe('nova');
    expect(r.get('velha').mudou).toEqual(['professor', 'valor']);
    expect(r.has('nova')).toBe(false);
  });
  it('sem continuação quando não começa no dia seguinte, ou a sucessora foi excluída', () => {
    const velha = aula('velha', { dataFim: '2026-06-30' });
    expect(continuidadeDasAulas([velha, aula('x', { dataInicio: '2026-08-01' })]).size).toBe(0);
    expect(continuidadeDasAulas([velha, aula('y', { dataInicio: '2026-07-01', excluido: true })]).size).toBe(0);
  });
  it('não mistura modalidades nem unidades', () => {
    const velha = aula('velha', { dataFim: '2026-06-30' });
    expect(continuidadeDasAulas([velha, aula('z', { dataInicio: '2026-07-01', modalidadeId: 'm2' })]).size).toBe(0);
    expect(continuidadeDasAulas([velha, aula('w', { dataInicio: '2026-07-01', unidadeId: 'u9' })]).size).toBe(0);
  });
  it('horário e dias diferentes aparecem como mudança', () => {
    const velha = aula('velha', { dataFim: '2026-06-30' });
    const nova = aula('nova', { dataInicio: '2026-07-01', dias: ['Segunda', 'Quarta'] });
    expect(continuidadeDasAulas([velha, nova]).get('velha').mudou).toEqual(['dias']);
  });
});

describe('filtrarHistorico', () => {
  const linhas = [aula('a', { dataFim: '2026-03-31' }), aula('b', { dataFim: '2026-06-30', professorId: 'p2', modalidadeId: 'm2' })];
  it('por professor, modalidade e período', () => {
    expect(filtrarHistorico(linhas, { professorId: 'p2' }).map((x) => x.id)).toEqual(['b']);
    expect(filtrarHistorico(linhas, { modalidadeId: 'm1' }).map((x) => x.id)).toEqual(['a']);
    expect(filtrarHistorico(linhas, { de: '2026-04-01' }).map((x) => x.id)).toEqual(['b']);
    expect(filtrarHistorico(linhas, { ate: '2026-03-31' }).map((x) => x.id)).toEqual(['a']);
    expect(filtrarHistorico(linhas, {}).length).toBe(2);
  });
});

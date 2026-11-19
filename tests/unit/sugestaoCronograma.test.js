import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { tabelaPadrao } from '../../src/utils/tabelaPrecos.js';
import { sugestaoDoCronograma } from '../../src/utils/sugestaoCronograma.js';

const T = tabelaPadrao();
const wk = (modalidade, data) => ({ id: `wk_${modalidade}`, modalidade, data });
const maria = { workshops: [wk('Power Core', '2026-03-10'), wk('Power Training', '2026-04-05')] };
const base = { tabela: T, unidadeId: 'u1', hora: '09:00', dias: ['Terça'], hojeISO: '2026-11-19' };

describe('valor sugerido no Cronograma', () => {
  it('Maria em Training: vermelha = R$ 30', () => {
    const r = sugestaoDoCronograma({ ...base, professor: maria, modalidadeNome: 'Power Training' });
    expect(r).toMatchObject({ nivel: 'vermelha', quantidade: 2, valores: [30], mista: false, valorNormal: 30 });
  });
  it('Maria em Jump (sem o workshop de Jump): cinza = 35 e aulas seguidas 30', () => {
    const r = sugestaoDoCronograma({ ...base, professor: maria, modalidadeNome: 'Energy Jump' });
    expect(r).toMatchObject({ nivel: 'cinza', valores: [35], seguidas: 30 });
  });
  it('Saver: todos os dias no horário = só acadêmico; nenhum = só normal; misto = os dois', () => {
    const saver = { ...maria, tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [{ dia: 2, ini: '06:00', fim: '10:00' }, { dia: 4, ini: '14:00', fim: '18:00' }] }] };
    const so = sugestaoDoCronograma({ ...base, professor: saver, modalidadeNome: 'Power Training' });
    expect(so).toMatchObject({ soAcademico: true, mista: false, valorAcademico: 20 });
    const nenhum = sugestaoDoCronograma({ ...base, dias: ['Segunda'], professor: saver, modalidadeNome: 'Power Training' });
    expect(nenhum).toMatchObject({ soAcademico: false, mista: false, valorNormal: 30 });
    const misto = sugestaoDoCronograma({ ...base, dias: ['Terça', 'Quarta'], professor: saver, modalidadeNome: 'Power Training' });
    expect(misto).toMatchObject({ mista: true, valorNormal: 30, valorAcademico: 20, valores: [20, 30] });
  });
  it('preta candidata mostra o extra; sem professor, sem horário ou fora da tabela = sem sugestão', () => {
    const tres = { workshops: [...maria.workshops, wk('Jump', '2026-05-01')] };
    expect(sugestaoDoCronograma({ ...base, professor: tres, modalidadeNome: 'Jump' })).toMatchObject({ candidataPreta: true, extraPreta: 5, valores: [45] });
    expect(sugestaoDoCronograma({ ...base, professor: null, modalidadeNome: 'Jump' })).toBe(null);
    expect(sugestaoDoCronograma({ ...base, hora: '', professor: maria, modalidadeNome: 'Jump' })).toBe(null);
    expect(sugestaoDoCronograma({ ...base, professor: maria, modalidadeNome: 'Power Fight' })).toBe(null);
  });
});

describe('aulas seguidas no Cronograma (Power Core 20 min; demais 40 min; lutas 60 min)', () => {
  it('duração por modalidade e hora de fim', async () => {
    const { duracaoDaModalidade, fimDaAula } = await import('../../src/utils/pulseira.js');
    expect(duracaoDaModalidade('Power Core 20')).toBe(20);
    expect(duracaoDaModalidade('Energy Jump')).toBe(40);
    expect(duracaoDaModalidade('Power Fight')).toBe(60);
    expect(fimDaAula('18:00', 'Energy Jump')).toBe('18:40');
    expect(fimDaAula('18:00', 'Power Core')).toBe('18:20');
    expect(fimDaAula('23:50', 'Power Fight')).toBe('23:59');
  });
  it('Dance logo depois de um Jump (intervalo de 10 min) paga o valor de seguidas', () => {
    const jump = { id: 'a1', modalidade: 'Energy Jump', unidadeId: 'u1', hora: '18:00', dias: ['Terça'] };
    const r = sugestaoDoCronograma({ ...base, hora: '18:50', professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [jump] });
    expect(r.temSeguida).toBe(true);
    expect(r.valores).toEqual([30]); // cinza em Dance: seguidas = 30
  });
  it('mais de 20 min de intervalo, Training no meio ou outra unidade não contam', () => {
    const jump = { id: 'a1', modalidade: 'Energy Jump', unidadeId: 'u1', hora: '18:00', dias: ['Terça'] };
    expect(sugestaoDoCronograma({ ...base, hora: '19:05', professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [jump] }).temSeguida).toBe(false);
    expect(sugestaoDoCronograma({ ...base, hora: '18:50', professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [{ ...jump, unidadeId: 'u2' }] }).temSeguida).toBe(false);
    expect(sugestaoDoCronograma({ ...base, hora: '18:50', professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [{ ...jump, modalidade: 'Power Training' }] }).temSeguida).toBe(false);
    expect(sugestaoDoCronograma({ ...base, hora: '18:50', professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [{ ...jump, dias: ['Quarta'] }] }).temSeguida).toBe(false);
  });
  it('valores diferentes por dia aparecem dia a dia', () => {
    const jump = { id: 'a1', modalidade: 'Energy Jump', unidadeId: 'u1', hora: '18:00', dias: ['Terça'] };
    const r = sugestaoDoCronograma({ ...base, hora: '18:50', dias: ['Segunda', 'Terça'], professor: maria, modalidadeNome: 'Power Dance', outrasAulas: [jump] });
    expect(r.valores).toEqual([30, 35]);
    expect(r.porDia).toEqual([{ dia: 1, valor: 35, saver: false, seguida: false }, { dia: 2, valor: 30, saver: false, seguida: true }]);
  });
});

describe('workshop antigo sem modalidade e país da unidade', () => {
  it('workshop sem modalidade gravada vale pelo NOME (Workshop Jump) e a pulseira sobe', () => {
    const antigo = { workshops: [{ id: 'a', nome: 'Workshop Jump', data: '2026-03-10' }, { id: 'b', nome: 'Workshop Training', data: '2026-04-05' }] };
    const r = sugestaoDoCronograma({ ...base, professor: antigo, modalidadeNome: 'Energy Jump' });
    expect(r).toMatchObject({ nivel: 'vermelha', quantidade: 2, valores: [45] });
  });
  it('nome sem modalidade reconhecível não conta; item com modalidade usa só ela', () => {
    const p = { workshops: [{ id: 'a', nome: 'Palestra de liderança', data: '2026-03-10' }, { id: 'b', nome: 'Workshop Jump', modalidade: 'Power Dance', data: '2026-03-10' }] };
    expect(sugestaoDoCronograma({ ...base, professor: p, modalidadeNome: 'Jump' })).toMatchObject({ nivel: 'cinza' });
    expect(sugestaoDoCronograma({ ...base, professor: p, modalidadeNome: 'Power Dance' })).toMatchObject({ nivel: 'verde' });
  });
  it('ehUnidadeBrasil aceita BR, Brasil e vazio; recusa Argentina e EUA', async () => {
    const { ehUnidadeBrasil } = await import('../../src/utils/pulseira.js');
    expect(['BR', 'Brasil', ' brasil ', '', undefined].every(ehUnidadeBrasil)).toBe(true);
    expect(['AR', 'Argentina', 'US', 'EUA'].some(ehUnidadeBrasil)).toBe(false);
  });
});

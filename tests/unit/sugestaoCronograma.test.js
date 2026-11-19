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

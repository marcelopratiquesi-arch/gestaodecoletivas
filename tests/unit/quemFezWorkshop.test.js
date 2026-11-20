import { describe, it, expect } from 'vitest';
import { quemFezWorkshop } from '../../src/utils/quemFezWorkshop.js';

const profs = [
  { id: '1', nome: 'Ana Souza', unidadeId: 'u1', status: 'ativo', workshops: [{ id: 'wk_a', workshopId: 'a', nome: 'Core SC', data: '2023-07-01' }] },
  { id: '2', nome: 'Ana Souza', unidadeId: 'u2', status: 'ativo', workshops: [] },
  { id: '3', nome: 'Bia Lima', unidadeId: 'u1', status: 'ativo', workshops: [{ nome: 'Workshop Jump', data: '2022-01-01' }] },
  { id: '4', nome: 'Caio Reis', unidadeId: 'u1', status: 'inativo', workshops: [] },
  { id: '5', nome: 'Dani Paz', unidadeId: 'u1', status: 'ativo' },
];
const cadastro = [{ id: 'a', modalidade: 'Power Core' }];

describe('quemFezWorkshop', () => {
  it('por workshop: agrupa fichas irmãs e ignora inativos', () => {
    const r = quemFezWorkshop(profs, cadastro, { workshopId: 'a' });
    expect(r.map((x) => [x.nome, x.fez])).toEqual([['Ana Souza', true], ['Bia Lima', false], ['Dani Paz', false]]);
    expect(r[0].unidadeIds).toEqual(['u1', 'u2']);
    expect(r[0].data).toBe('2023-07-01');
  });
  it('por modalidade: usa o cadastro e, sem modalidade, o nome', () => {
    expect(quemFezWorkshop(profs, cadastro, { grupo: 'core' }).filter((x) => x.fez).map((x) => x.nome)).toEqual(['Ana Souza']);
    expect(quemFezWorkshop(profs, cadastro, { grupo: 'jump' }).filter((x) => x.fez).map((x) => x.nome)).toEqual(['Bia Lima']);
  });
  it('sem alvo ninguém fez', () => {
    expect(quemFezWorkshop(profs, cadastro, {}).some((x) => x.fez)).toBe(false);
  });
});

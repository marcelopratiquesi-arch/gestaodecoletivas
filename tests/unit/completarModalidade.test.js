import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { planejarCompletarModalidade } from '../../src/utils/completarModalidade.js';

const cadastro = [{ id: 'abc', modalidade: 'Power Core' }, { id: 'def', modalidade: 'Jump' }];

describe('completar a modalidade dos workshops antigos', () => {
  it('usa o workshop do cadastro (workshopId ou id wk_), depois o nome, e deixa o resto sem resposta', () => {
    const profs = [{ id: 'p1', workshops: [
      { id: 'wk_abc', workshopId: 'abc', nome: 'Qualquer', data: '2023-07-01' },
      { id: 'wk_def', nome: 'Sem campo workshopId', data: '2024-01-01' },
      { id: 'x1', nome: 'Workshop Power Training 2025', data: '2025-01-01' },
      { id: 'x2', nome: 'Pilates 2025', data: '2025-02-01' },
    ] }];
    const r = planejarCompletarModalidade(profs, cadastro);
    expect(r.porCadastro).toBe(2);
    expect(r.porNome).toBe(1);
    expect(r.semResposta).toHaveLength(1);
    expect(r.semResposta[0].item.id).toBe('x2');
    expect(r.gravar).toHaveLength(1);
    expect(r.gravar[0].workshops.map((w) => w.modalidade)).toEqual(['Power Core', 'Jump', 'Power Training', undefined]);
  });
  it('não mexe no que já tem modalidade nem em professor sem workshops; rodar de novo não muda nada', () => {
    const profs = [{ id: 'p1', workshops: [{ id: 'a', nome: 'Jump', modalidade: 'Energy Jump', data: '2025-01-01' }] }, { id: 'p2' }, { id: 'p3', workshops: [] }];
    expect(planejarCompletarModalidade(profs, cadastro).gravar).toEqual([]);
    const primeira = planejarCompletarModalidade([{ id: 'p9', workshops: [{ id: 'wk_abc', nome: 'x', data: '2023-01-01' }] }], cadastro);
    const segunda = planejarCompletarModalidade([{ id: 'p9', workshops: primeira.gravar[0].workshops }], cadastro);
    expect(segunda.gravar).toEqual([]);
  });
});

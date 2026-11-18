// Cópia pública da aula (src/services/aulasPublicas.js): o valor nunca pode ir junto.
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { dadosPublicosAula } from '../../src/services/aulasPublicas';

describe('dadosPublicosAula', () => {
  it('tira o valor e os carimbos internos, mantém o que a grade pública usa', () => {
    const aula = {
      unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '19:00', dias: ['Terça'],
      dataInicio: '2026-01-01', dataFim: null, excluido: false,
      valor: 50, createdAt: { seconds: 1 }, updatedAt: { seconds: 2 }, deletedAt: {}, deletedBy: 'x', dataCriacao: '2026-01-01',
    };
    expect(dadosPublicosAula(aula)).toEqual({
      unidadeId: 'u1', modalidadeId: 'm1', professorId: 'p1', hora: '19:00', dias: ['Terça'],
      dataInicio: '2026-01-01', dataFim: null, excluido: false,
    });
  });
  it('valor como texto ou zero também sai; campos indefinidos não vão', () => {
    expect(dadosPublicosAula({ valor: '45', hora: '07:00', x: undefined })).toEqual({ hora: '07:00' });
    expect(dadosPublicosAula({ valor: 0, hora: '07:00' })).toEqual({ hora: '07:00' });
    expect(dadosPublicosAula(null)).toEqual({});
  });
});

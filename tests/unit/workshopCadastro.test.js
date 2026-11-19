import { describe, it, expect } from 'vitest';
import { dataBr, dataValida, chaveWorkshop, errosDoWorkshop, montarWorkshop, ordenarWorkshops, MODALIDADES_WORKSHOP } from '../../src/utils/workshopCadastro';

const ok = { nome: 'Workshop de Power Core – Santa Catarina 2023', modalidade: 'Power Core', data: '2023-07-01', local: 'Pratique Palhoça', status: 'realizado' };

describe('workshopCadastro', () => {
  it('formata a data em português', () => {
    expect(dataBr('2023-07-01')).toBe('01/07/2023');
    expect(dataBr('')).toBe('');
  });
  it('só aceita datas que existem', () => {
    expect(dataValida('2023-07-01')).toBe(true);
    expect(dataValida('2023-02-31')).toBe(false);
    expect(dataValida('01/07/2023')).toBe(false);
  });
  it('o primeiro workshop do pedido é válido', () => {
    expect(errosDoWorkshop(ok)).toEqual([]);
  });
  it('aponta o que está errado', () => {
    expect(errosDoWorkshop({ ...ok, nome: 'ab', modalidade: 'Zumba', data: '', status: 'x' })).toEqual(['nome', 'modalidade', 'data', 'status']);
  });
  it('inclui Power Dance e Power Bumbum', () => {
    expect(MODALIDADES_WORKSHOP).toContain('Power Dance');
    expect(MODALIDADES_WORKSHOP).toContain('Power Bumbum');
  });
  it('chave ignora acento, caixa e espaço sobrando', () => {
    expect(chaveWorkshop('  Power  Training ', '2026-02-07')).toBe(chaveWorkshop('power training', '2026-02-07'));
    expect(chaveWorkshop('Power Training', '2026-02-07')).not.toBe(chaveWorkshop('Power Training', '2026-02-08'));
  });
  it('monta só os campos conhecidos e só põe titular com nome', () => {
    expect(montarWorkshop({ ...ok, extra: 1, titularProfessorId: '5' })).toEqual({ nome: ok.nome, modalidade: 'Power Core', data: '2023-07-01', local: 'Pratique Palhoça', status: 'realizado' });
    expect(montarWorkshop({ ...ok, titularNome: ' Ana ', titularProfessorId: 5 })).toMatchObject({ titularNome: 'Ana', titularProfessorId: '5' });
  });
  it('ordena da data mais nova para a mais antiga', () => {
    expect(ordenarWorkshops([{ nome: 'a', data: '2023-01-01' }, { nome: 'b', data: '2026-01-01' }]).map((w) => w.nome)).toEqual(['b', 'a']);
  });
});

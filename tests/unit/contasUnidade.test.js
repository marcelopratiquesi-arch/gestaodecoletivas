// Contas da Central da Unidade (src/centrais/contasUnidade.js).
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import {
  acessoUnidade, acharUnidade, periodoDoMes, resumoValidacoes, variacao, aulasDaUnidade, aulasNaSemana,
  gradePorDia, professoresDaUnidade, pendenciasDaUnidade, itensEmDia,
} from '../../src/centrais/contasUnidade';

const unidade = { id: 'u1', nome: 'Centro', mentorId: 'm1', pais: 'BR', estado: 'SP' };

describe('acessoUnidade', () => {
  it('admin edita qualquer unidade', () => {
    expect(acessoUnidade({ id: 'x', role: 'admin' }, unidade)).toBe('editar');
    expect(acessoUnidade({ id: 'x', role: 'Master' }, unidade)).toBe('editar');
  });
  it('mentor só abre as unidades dele', () => {
    expect(acessoUnidade({ id: 'm1', role: 'mentor' }, unidade)).toBe('editar');
    expect(acessoUnidade({ id: 'm2', role: 'mentor' }, unidade)).toBe(null);
  });
  it('líder só abre a própria, em modo leitura (o perfil antigo "unidade" vale igual)', () => {
    expect(acessoUnidade({ id: 'l1', role: 'lider', unidadeId: 'u1' }, unidade)).toBe('ver');
    expect(acessoUnidade({ id: 'l1', role: 'unidade', unidadeId: 'u1' }, unidade)).toBe('ver');
    expect(acessoUnidade({ id: 'l1', role: 'lider', unidadeId: 'u2' }, unidade)).toBe(null);
  });
  it('professor não abre', () => {
    expect(acessoUnidade({ id: 'p1', role: 'professor' }, unidade)).toBe(null);
  });
});

describe('acharUnidade', () => {
  const lista = [unidade, { id: 'u2', nome: 'Savassi' }];
  it('acha pelo id, pelo nome ou pelo próprio cadastro', () => {
    expect(acharUnidade(lista, 'u2').id).toBe('u2');
    expect(acharUnidade(lista, ' savassi ').id).toBe('u2');
    expect(acharUnidade(lista, { id: 'u1' }).id).toBe('u1');
    expect(acharUnidade(lista, 'não existe')).toBe(null);
  });
});

describe('periodoDoMes', () => {
  it('mês em andamento compara as mesmas datas do mês passado', () => {
    expect(periodoDoMes('2026-11', '2026-11-12')).toEqual({
      inicio: '2026-11-01', fim: '2026-11-12', inicioAnterior: '2026-10-01', fimAnterior: '2026-10-12', emAndamento: true,
    });
  });
  it('dia 31 comparado com mês de 28 dias vai até o fim dele', () => {
    const p = periodoDoMes('2026-03', '2026-03-31');
    expect(p.inicioAnterior).toBe('2026-02-01');
    expect(p.fimAnterior).toBe('2026-02-28');
  });
  it('mês fechado compara mês inteiro com mês inteiro (inclusive virando o ano)', () => {
    expect(periodoDoMes('2026-01', '2026-11-12')).toEqual({
      inicio: '2026-01-01', fim: '2026-01-31', inicioAnterior: '2025-12-01', fimAnterior: '2025-12-31', emAndamento: false,
    });
  });
});

describe('resumoValidacoes', () => {
  const validacoes = [
    { id: '1', aulaId: 'a1', data: '2026-11-03', status: 'realizada', alunos: 10 },
    { id: '2', aulaId: 'a1', data: '2026-11-04', status: 'realizada', alunos: 15 },
    { id: '3', aulaId: 'a2', data: '2026-11-04', status: 'cancelada' },
    { id: '4', aulaId: 'a1', data: '2026-10-03', status: 'realizada', alunos: 99 }, // fora do período
    { id: '5', isAulao: true, data: '2026-11-05', status: 'realizada', alunos: 30 },
  ];
  it('soma alunos só das realizadas do período e tira a média por aula', () => {
    expect(resumoValidacoes(validacoes, '2026-11-01', '2026-11-30')).toEqual({ realizadas: 3, alunos: 55, media: 18 });
  });
  it('validação repetida da mesma aula no mesmo dia conta uma vez (vale a mais recente)', () => {
    const repetida = [
      { id: 'a', aulaId: 'a1', data: '2026-11-03', status: 'realizada', alunos: 10, timestamp: { seconds: 1 } },
      { id: 'b', aulaId: 'a1', data: '2026-11-03', status: 'realizada', alunos: 12, timestamp: { seconds: 2 } },
    ];
    expect(resumoValidacoes(repetida, '2026-11-01', '2026-11-30')).toEqual({ realizadas: 1, alunos: 12, media: 12 });
  });
  it('sem aula realizada a média é zero', () => {
    expect(resumoValidacoes([], '2026-11-01', '2026-11-30')).toEqual({ realizadas: 0, alunos: 0, media: 0 });
  });
});

describe('variacao', () => {
  it('sobe, desce e fica igual', () => {
    expect(variacao(120, 100)).toEqual({ direcao: 'sobe', percentual: 20 });
    expect(variacao(75, 100)).toEqual({ direcao: 'desce', percentual: 25 });
    expect(variacao(100, 100)).toEqual({ direcao: 'igual', percentual: 0 });
  });
  it('sem base de comparação não mostra nada', () => {
    expect(variacao(50, 0)).toBe(null);
  });
});

describe('grade', () => {
  const aulas = [
    { id: 'a1', unidadeId: 'u1', dias: ['Segunda', 'Quarta'], hora: '19:00', professorId: 'p1', modalidadeId: 'm1' },
    { id: 'a2', unidadeId: 'u1', dias: ['Segunda'], hora: '07:00', professorId: 'p2', modalidadeId: 'm2' },
    { id: 'a3', unidadeId: 'u1', dias: ['Sexta'], hora: '08:00', dataFim: '2026-10-31' }, // encerrada
    { id: 'a4', unidadeId: 'u1', dias: ['Sexta'], hora: '08:00', excluido: true },        // lixeira
    { id: 'a5', unidadeId: 'u2', dias: ['Sexta'], hora: '08:00' },                         // outra unidade
  ];
  const vigentes = aulasDaUnidade(aulas, 'u1', '2026-11-12');
  it('só as aulas da unidade, fora da lixeira e não encerradas', () => {
    expect(vigentes.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
  it('conta uma aula por dia da semana', () => {
    expect(aulasNaSemana(vigentes)).toBe(3);
  });
  it('organiza por dia, em ordem de horário', () => {
    const grade = gradePorDia(vigentes);
    expect(grade.map((d) => d.dia)).toEqual(['Segunda', 'Quarta']);
    expect(grade[0].aulas.map((a) => a.id)).toEqual(['a2', 'a1']);
  });
  it('professores vêm dos vínculos da unidade', () => {
    const lista = professoresDaUnidade({
      unidadeId: 'u1',
      vinculos: [
        { professorId: 'p1', unidadeId: 'u1', status: 'ativo' },
        { professorId: 'p2', unidadeId: 'u1', status: 'ativo' },
        { professorId: 'p3', unidadeId: 'u2', status: 'ativo' },
      ],
      professores: [
        { id: 'p1', nome: 'Bia', status: 'ativo' },
        { id: 'p2', nome: 'Ana', status: 'inativo' },
        { id: 'p3', nome: 'Caio', status: 'ativo' },
      ],
      aulas: vigentes,
    });
    expect(lista.map((l) => [l.professor.nome, l.ativo, l.aulasNaSemana])).toEqual([['Ana', false, 1], ['Bia', true, 2]]);
  });
});

describe('pendenciasDaUnidade', () => {
  // 2026-11-10 é terça; 2026-11-09 é segunda.
  const aulas = [{ id: 'a1', unidadeId: 'u1', dias: ['Segunda', 'Terça'], hora: '19:00' }];
  const base = { aulas, unidade, feriados: [], hoje: '2026-11-10', agoraHHMM: '08:00' };
  it('conta aulas de dias passados sem validação; a de hoje que ainda não começou não é atraso', () => {
    const r = pendenciasDaUnidade({ ...base, validacoes: [] });
    // janela de 7 dias: 04 a 10/11 -> segunda 09 (atrasada) e terça 10 (ainda não começou)
    expect(r.aValidar).toBe(1);
    expect(r.maisAntiga).toBe('2026-11-09');
    expect(r.inicio).toBe('2026-11-04');
  });
  it('aula validada ou cancelada sai da conta', () => {
    const validacoes = [{ id: 'v', aulaId: 'a1', data: '2026-11-09', status: 'cancelada' }];
    expect(pendenciasDaUnidade({ ...base, validacoes }).aValidar).toBe(0);
  });
  it('feriado não é pendência', () => {
    const feriados = [{ dataInicio: '2026-11-09', dataFim: '2026-11-09', escopo: 'rede' }];
    expect(pendenciasDaUnidade({ ...base, feriados, validacoes: [] }).aValidar).toBe(0);
  });
});

describe('itensEmDia', () => {
  const completa = {
    ...unidade, liderUid: 'l1', liderTelefone: '31 99999-0000', telefone: '+55 31 3333-0000',
    enderecoCompleto: 'Rua A, 10', metragemSalaColetiva: 80,
  };
  const professores = [{ id: 'p1', status: 'ativo' }];
  const aulas = [{ id: 'a1', professorId: 'p1' }];
  it('unidade completa não tem nada faltando', () => {
    const itens = itensEmDia({ unidade: completa, mentor: { id: 'm1' }, aulas, professores, pendencias: { aValidar: 0 } });
    expect(itens.filter((i) => !i.ok)).toEqual([]);
  });
  it('aponta o que falta', () => {
    const itens = itensEmDia({
      unidade: { ...unidade, uidLogin: 'antigo' }, mentor: null,
      aulas: [{ id: 'a1', professorId: 'p9' }], professores, pendencias: { aValidar: 4 },
    });
    const faltando = itens.filter((i) => !i.ok).map((i) => i.id);
    expect(faltando).toEqual(['lider', 'mentor', 'telefone', 'endereco', 'metragem', 'aulasSemProfessor', 'validacoes']);
    expect(itens.find((i) => i.id === 'validacoes').quantidade).toBe(4);
  });
  it('líder a conferir, sem telefone e com login antigo ligado viram avisos', () => {
    const itens = itensEmDia({
      unidade: { ...completa, liderAConferir: true, liderTelefone: '', uidLogin: 'antigo' },
      mentor: { id: 'm1' }, aulas, professores, pendencias: null,
    });
    expect(itens.filter((i) => !i.ok).map((i) => i.id)).toEqual(['liderConferido', 'liderTelefone', 'loginAntigo']);
    expect(itens.some((i) => i.id === 'validacoes')).toBe(false); // ainda carregando: não aparece
  });
});

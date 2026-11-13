// Contas e permissões das Centrais do Mentor, do Líder e do Professor, e os indicadores do Relatório
// na Central da Unidade (src/centrais/contasPessoas.js, acessos.js e contasUnidade.js).
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { acessoCentral, resolverAlvo, unidadesVisiveis } from '../../src/centrais/acessos';
import { horariosVagosNoDia, taxaDeVacancia, indicadoresDaUnidade } from '../../src/centrais/contasUnidade';
import {
  linhasDoMentor, professoresDoMentor, aValidarPorUnidade, itensEmDiaMentor, itensEmDiaLider,
  unidadesDoProfessor, aulasDoProfessor, resumoDoProfessor, aValidarDoProfessor, itensEmDiaProfessor,
} from '../../src/centrais/contasPessoas';

const u1 = { id: 'u1', nome: 'Centro', mentorId: 'm1', pais: 'BR', liderUid: 'l1', liderNome: 'Lia', liderTelefone: '31 99999-0000' };
const u2 = { id: 'u2', nome: 'Sul', mentorId: 'm1', pais: 'BR' };
const u3 = { id: 'u3', nome: 'Norte', mentorId: 'm2', pais: 'AR', liderUid: 'l3', liderNome: 'Leo' };
const mentores = [{ id: 'm1', nome: 'Marta', status: 'ativo' }, { id: 'm2', nome: 'Mauro', status: 'ativo' }];
const professores = [
  { id: 'p1', nome: 'Ana', status: 'ativo', uidLogin: 'login-p1', telefone: '(31) 97777-0001', email: 'ana@example.com' },
  { id: 'p2', nome: 'Bruno', status: 'ativo' },
  { id: 'p3', nome: 'Caio', status: 'ativo' },
];
const vinculos = [
  { professorId: 'p1', unidadeId: 'u1', status: 'ativo' },
  { professorId: 'p1', unidadeId: 'u2', status: 'ativo' },
  { professorId: 'p2', unidadeId: 'u2', status: 'ativo' },
  { professorId: 'p3', unidadeId: 'u3', status: 'ativo' },
];
const catalogs = { unidades: [u1, u2, u3], mentores, professores, vinculos };

const admin = { id: 'adm', role: 'admin' };
const mentor1 = { id: 'm1', role: 'mentor' };
const lider1 = { id: 'l1', role: 'lider', unidadeId: 'u1' };
const profAna = { id: 'login-p1', role: 'professor', professorId: 'p1' };

describe('quem pode abrir cada Central', () => {
  it('unidades visíveis de cada perfil', () => {
    expect(unidadesVisiveis(admin, catalogs.unidades).length).toBe(3);
    expect(unidadesVisiveis(mentor1, catalogs.unidades).map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(unidadesVisiveis(lider1, catalogs.unidades).map((u) => u.id)).toEqual(['u1']);
    expect(unidadesVisiveis(profAna, catalogs.unidades)).toEqual([]);
  });
  it('mentor: admin abre todos; o próprio mentor abre só a dele, em leitura', () => {
    expect(acessoCentral('mentor', mentores[0], admin, catalogs)).toBe('editar');
    expect(acessoCentral('mentor', mentores[0], mentor1, catalogs)).toBe('ver');
    expect(acessoCentral('mentor', mentores[1], mentor1, catalogs)).toBe(null);
    expect(acessoCentral('mentor', mentores[0], lider1, catalogs)).toBe(null);
  });
  it('líder: segue a unidade dele; unidade sem líder não tem ficha de líder', () => {
    expect(acessoCentral('lider', u1, admin, catalogs)).toBe('editar');
    expect(acessoCentral('lider', u1, mentor1, catalogs)).toBe('editar');
    expect(acessoCentral('lider', u1, lider1, catalogs)).toBe('ver');
    expect(acessoCentral('lider', u3, mentor1, catalogs)).toBe(null); // unidade de outro mentor
    expect(acessoCentral('lider', u2, admin, catalogs)).toBe(null);   // sem líder
  });
  it('professor: mentor e líder só os vinculados às unidades deles; o próprio abre a dele em leitura', () => {
    expect(acessoCentral('professor', professores[2], admin, catalogs)).toBe('editar');
    expect(acessoCentral('professor', professores[1], mentor1, catalogs)).toBe('editar');
    expect(acessoCentral('professor', professores[2], mentor1, catalogs)).toBe(null); // só na unidade de outro mentor
    expect(acessoCentral('professor', professores[0], lider1, catalogs)).toBe('editar');
    expect(acessoCentral('professor', professores[1], lider1, catalogs)).toBe(null); // não dá aula na unidade dele
    expect(acessoCentral('professor', professores[0], profAna, catalogs)).toBe('ver');
    expect(acessoCentral('professor', professores[1], profAna, catalogs)).toBe(null);
  });
  it('acha o cadastro pelo id, pelo nome ou (líder) pelo login dele', () => {
    expect(resolverAlvo('mentor', 'm2', catalogs).nome).toBe('Mauro');
    expect(resolverAlvo('professor', 'bruno', catalogs).id).toBe('p2');
    expect(resolverAlvo('lider', 'l3', catalogs).id).toBe('u3');
    expect(resolverAlvo('lider', u1, catalogs).id).toBe('u1');
    expect(resolverAlvo('professor', 'ninguém', catalogs)).toBe(null);
  });
});

describe('indicadores do Relatório na Central da Unidade', () => {
  it('horários vagos do dia: intervalos de 1h ou mais, em blocos de 40 min, das 06h às 22h', () => {
    // sem aula: 16h livres = 960 min -> 24 blocos de 40 min
    expect(horariosVagosNoDia([])).toBe(24);
    // aula às 06:00 (ocupa até 06:40): sobra 06:40–22:00 = 920 min -> 23 blocos
    expect(horariosVagosNoDia([{ hora: '06:00' }])).toBe(23);
    // 07:00 e 07:40 coladas: 06:00–07:00 (1 bloco) + 08:20–22:00 = 820 min (20 blocos)
    expect(horariosVagosNoDia([{ hora: '07:00' }, { hora: '07:40' }])).toBe(21);
    // intervalo menor que 1h não conta como vago
    expect(horariosVagosNoDia([{ hora: '06:00' }, { hora: '07:30' }])).toBe(20); // 06:40–07:30 (50 min) ignorado; 08:10–22:00 = 830 min -> 20 blocos
  });
  it('vacância: vagos de segunda a sexta ÷ 24 horários por dia', () => {
    expect(taxaDeVacancia([])).toBe(100);
    const todoDia = { hora: '06:00', dias: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'] };
    expect(taxaDeVacancia([todoDia])).toBeCloseTo((23 * 5 / 120) * 100, 5);
    // aula só no sábado não muda a conta (o Relatório olha de segunda a sexta)
    expect(taxaDeVacancia([{ hora: '06:00', dias: ['Sábado'] }])).toBe(100);
  });
  it('valor investido, custo médio e ocupação', () => {
    const unidade = { id: 'u1', metragemSalaColetiva: 60 };
    const modalidades = [{ id: 'mo1', indiceOcupacao: 3 }]; // capacidade = 60 ÷ 3 = 20 alunos
    const aulasTodas = [
      { id: 'a1', unidadeId: 'u1', modalidadeId: 'mo1', valor: 50, dias: ['Segunda'], hora: '07:00' },
      { id: 'a2', unidadeId: 'u1', modalidadeId: 'mo1', valor: 80, dias: ['Terça'], hora: '19:00' },
    ];
    const validacoes = [
      { id: '1', aulaId: 'a1', data: '2026-11-02', status: 'realizada', alunos: 10, valorEfetivo: 50 },
      { id: '2', aulaId: 'a1', data: '2026-11-09', status: 'realizada', alunos: 10, valorEfetivo: 60 }, // valor da época
      { id: '3', aulaId: 'a2', data: '2026-11-03', status: 'realizada', alunos: 20 },                    // antiga: usa o valor da aula
      { id: '4', aulaId: 'a2', data: '2026-11-10', status: 'cancelada' },
      { id: '5', aulaId: 'apagada', data: '2026-11-03', status: 'realizada', alunos: 99, valorEfetivo: 999 }, // aula não existe mais: fora
      { id: '6', isAulao: true, modalidadeId: 'mo1', data: '2026-11-07', status: 'realizada', alunos: 30, valorPago: 200 },
    ];
    const r = indicadoresDaUnidade({ validacoes, inicio: '2026-11-01', fim: '2026-11-30', aulasTodas, unidade, modalidades });
    expect(r.realizadas).toBe(4);
    expect(r.alunos).toBe(70);
    expect(r.media).toBe(18);
    expect(r.valor).toBe(50 + 60 + 80 + 200);
    expect(r.custoMedio).toBe(390 / 4);
    // linhas: a1 (média 10 -> 50%), a2 (média 20 -> 100%), aulão (30 -> 150%) => média 100%
    expect(r.ocupacao).toBeCloseTo(100, 5);
  });
  it('sem metragem não há taxa de ocupação (não inventa número)', () => {
    const r = indicadoresDaUnidade({
      validacoes: [{ id: '1', aulaId: 'a1', data: '2026-11-02', status: 'realizada', alunos: 10 }],
      inicio: '2026-11-01', fim: '2026-11-30', aulasTodas: [{ id: 'a1', valor: 50, dias: ['Segunda'], hora: '07:00' }],
      unidade: { id: 'u1' }, modalidades: [],
    });
    expect(r.ocupacao).toBe(null);
    expect(r.valor).toBe(50);
  });
});

describe('Central do Mentor', () => {
  const aulas = [
    { id: 'a1', unidadeId: 'u1', professorId: 'p1', dias: ['Segunda', 'Terça'], hora: '19:00' },
    { id: 'a2', unidadeId: 'u2', professorId: 'p2', dias: ['Segunda'], hora: '07:00' },
    { id: 'a3', unidadeId: 'u3', professorId: 'p3', dias: ['Segunda'], hora: '07:00' },
  ];
  const linhas = linhasDoMentor({ mentor: mentores[0], unidades: catalogs.unidades, aulas, vinculos, professores, hoje: '2026-11-10' });
  it('só as unidades dele, com grade e professores', () => {
    expect(linhas.map((l) => [l.unidade.id, l.aulasNaSemana, l.professoresAtivos])).toEqual([['u1', 2, 1], ['u2', 1, 2]]);
  });
  it('professor que dá aula em duas unidades aparece uma vez só', () => {
    const lista = professoresDoMentor(linhas);
    expect(lista.map((p) => [p.professor.nome, p.unidades.length, p.aulasNaSemana])).toEqual([['Ana', 2, 2], ['Bruno', 1, 1]]);
  });
  it('aulas a validar por unidade (2026-11-10 é terça)', () => {
    const mapa = aValidarPorUnidade({ unidades: [u1, u2], aulas, feriados: [], validacoes: [], hoje: '2026-11-10', agoraHHMM: '08:00' });
    expect(mapa.get('u1')).toBe(1); // segunda 09 às 19h (a de hoje às 19h ainda não começou)
    expect(mapa.get('u2')).toBe(1); // segunda 09 às 07h
  });
  it('está tudo em dia?', () => {
    const itens = itensEmDiaMentor({ mentor: { ...mentores[0], telefone: '31 98888-0000', loginGoogle: true }, linhas, aValidar: 2 });
    expect(itens.filter((i) => !i.ok).map((i) => [i.id, i.quantidade])).toEqual([['semLider', 1], ['validacoes', 2]]);
    const carregando = itensEmDiaMentor({ mentor: mentores[0], linhas: [], aValidar: null });
    expect(carregando.map((i) => i.id)).toEqual(['ativo', 'telefone', 'loginGoogle', 'unidades']);
  });
});

describe('Central do Líder', () => {
  it('está tudo em dia?', () => {
    const tudoCerto = itensEmDiaLider({ unidade: u1, aulas: [{ id: 'a1', professorId: 'p1' }], professores, pendencias: { aValidar: 0 } });
    expect(tudoCerto.filter((i) => !i.ok)).toEqual([]);
    const comFaltas = itensEmDiaLider({
      unidade: { ...u1, liderTelefone: '', liderAConferir: true, uidLogin: 'antigo' },
      aulas: [{ id: 'a1', professorId: '' }], professores, pendencias: { aValidar: 3 },
    });
    expect(comFaltas.filter((i) => !i.ok).map((i) => i.id)).toEqual(['telefone', 'conferido', 'loginAntigo', 'aulasSemProfessor', 'validacoes']);
  });
});

describe('Central do Professor', () => {
  const aulas = [
    { id: 'a1', unidadeId: 'u1', professorId: 'p1', dias: ['Segunda', 'Terça'], hora: '19:00', valor: 50 },
    { id: 'a2', unidadeId: 'u2', professorId: 'p1', dias: ['Quarta'], hora: '07:00', valor: 70 },
    { id: 'a3', unidadeId: 'u3', professorId: 'p1', dias: ['Quinta'], hora: '07:00', valor: 90 }, // unidade de outro mentor
    { id: 'a4', unidadeId: 'u1', professorId: 'p1', dias: ['Sexta'], hora: '07:00', dataFim: '2026-10-01' }, // encerrada
  ];
  const visiveis = [u1, u2]; // o que o mentor m1 enxerga
  it('unidades e aulas só do que quem está olhando pode ver', () => {
    expect(unidadesDoProfessor({ professorId: 'p1', vinculos, unidades: visiveis }).map((u) => u.unidade.id)).toEqual(['u1', 'u2']);
    expect(aulasDoProfessor({ aulas, professorId: 'p1', unidades: visiveis, hoje: '2026-11-10' }).map((a) => a.id)).toEqual(['a1', 'a2']);
  });
  it('aulas dadas, alunos, última aula e valor a receber (por moeda)', () => {
    const validacoes = [
      { id: '1', aulaId: 'a1', unidadeId: 'u1', professorId: 'p1', data: '2026-11-02', status: 'realizada', alunos: 10, valorEfetivo: 50 },
      { id: '2', aulaId: 'a2', unidadeId: 'u2', professorId: 'p1', data: '2026-11-04', status: 'realizada', alunos: 20, valorEfetivo: 70 },
      { id: '3', aulaId: 'a3', unidadeId: 'u3', professorId: 'p1', data: '2026-11-05', status: 'realizada', alunos: 30, valorEfetivo: 90 }, // fora do que o mentor vê
      { id: '4', aulaId: 'a1', unidadeId: 'u1', professorId: 'p2', professorOriginalId: 'p1', substituicao: true, data: '2026-11-03', status: 'realizada', alunos: 9, valorEfetivo: 50 }, // quem deu foi o substituto
      { id: '5', aulaId: 'a1', unidadeId: 'u1', professorId: 'p1', data: '2026-11-09', status: 'cancelada' },
    ];
    const r = resumoDoProfessor({ validacoes, inicio: '2026-11-01', fim: '2026-11-30', professorId: 'p1', aulasTodas: aulas, unidades: visiveis });
    expect(r.realizadas).toBe(2);
    expect(r.alunos).toBe(30);
    expect(r.media).toBe(15);
    expect(r.ultimaAula).toBe('2026-11-04');
    expect(r.valores).toEqual([{ pais: 'BR', valor: 120 }]);
  });
  it('aulas dele sem validar no mês: aula dada por substituto não é pendência (2026-11-10 é terça)', () => {
    const validacoes = [
      { id: '1', aulaId: 'a1', data: '2026-11-02', status: 'realizada' },
      { id: '2', aulaId: 'a1', data: '2026-11-03', status: 'realizada', professorId: 'p2', professorOriginalId: 'p1' },
      { id: '3', aulaId: 'a2', data: '2026-11-04', status: 'realizada' },
    ];
    // a1: seg 02 ✓, ter 03 ✓ (substituto), seg 09 ✗, ter 10 ✗ · a2: qua 04 ✓
    expect(aValidarDoProfessor({ aulas, unidades: visiveis, feriados: [], validacoes, professorId: 'p1', hoje: '2026-11-10' })).toBe(2);
  });
  it('está tudo em dia?', () => {
    const unidades = [{ unidade: u1, ativo: true }];
    expect(itensEmDiaProfessor({ professor: professores[0], unidades, aulas: [aulas[0]], aValidar: 0 }).filter((i) => !i.ok)).toEqual([]);
    const faltas = itensEmDiaProfessor({ professor: { id: 'p9', status: 'inativo', telefone: '9999' }, unidades: [], aulas: [], aValidar: null });
    expect(faltas.filter((i) => !i.ok).map((i) => i.id)).toEqual(['ativo', 'telefone', 'email', 'login', 'vinculo', 'grade']);
  });
});

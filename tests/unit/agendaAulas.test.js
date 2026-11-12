// Regra única da agenda (src/utils/agendaAulas.js), usada pela Página de Início e pela Validação Diária.
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { aulaNaGradeDoDia, situacaoDaAula, SITUACAO, somarDias, datasEntre } from '../../src/utils/agendaAulas';

// 2026-11-10 é uma terça-feira; 2026-11-09 é segunda.
const unidade = { id: 'u1', pais: 'BR', estado: 'SP' };
const aula = { id: 'a1', unidadeId: 'u1', dias: ['Segunda', 'Terça'], hora: '19:00' };
const base = { aula, unidade, feriados: [], hoje: '2026-11-10', agoraHHMM: '08:00' };

describe('aulaNaGradeDoDia', () => {
  it('respeita o dia da semana', () => {
    expect(aulaNaGradeDoDia(aula, '2026-11-10')).toBe(true);  // terça
    expect(aulaNaGradeDoDia(aula, '2026-11-11')).toBe(false); // quarta
  });
  it('respeita a vigência (data de início e de fim)', () => {
    expect(aulaNaGradeDoDia({ ...aula, dataInicio: '2026-11-15' }, '2026-11-10')).toBe(false);
    expect(aulaNaGradeDoDia({ ...aula, dataFim: '2026-11-05' }, '2026-11-10')).toBe(false);
    expect(aulaNaGradeDoDia({ ...aula, dataInicio: '2026-11-01', dataFim: '2026-11-30' }, '2026-11-10')).toBe(true);
  });
  it('ignora vigência vazia ou inválida', () => {
    expect(aulaNaGradeDoDia({ ...aula, dataFim: '' }, '2026-11-10')).toBe(true);
    expect(aulaNaGradeDoDia({ ...aula, dataFim: null }, '2026-11-10')).toBe(true);
    expect(aulaNaGradeDoDia({ ...aula, dataFim: 'N/A' }, '2026-11-10')).toBe(true);
  });
});

describe('situacaoDaAula', () => {
  it('aula de hoje que ainda não começou não é atraso', () => {
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-10' })).toBe(SITUACAO.MAIS_TARDE);
  });
  it('aula de hoje que já começou precisa validar', () => {
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-10', agoraHHMM: '19:00' })).toBe(SITUACAO.A_VALIDAR);
  });
  it('aula de ontem sem validação precisa validar', () => {
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09' })).toBe(SITUACAO.A_VALIDAR);
  });
  it('validada ou cancelada por alguém = resolvida', () => {
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09', validacao: { status: 'realizada' } })).toBe(SITUACAO.RESOLVIDA);
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09', validacao: { status: 'cancelada' } })).toBe(SITUACAO.RESOLVIDA);
  });
  it('feriado não é pendência', () => {
    const feriados = [{ data: '2026-11-09', escopo: 'rede' }];
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09', feriados })).toBe(SITUACAO.FERIADO);
  });
  it('feriado de outro estado não afeta a unidade', () => {
    const feriados = [{ data: '2026-11-09', escopo: 'estado', estado: 'RJ' }];
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09', feriados })).toBe(SITUACAO.A_VALIDAR);
  });
  it('cancelamento automático antigo de feriado conta como feriado', () => {
    const validacao = { status: 'cancelada', validadoPor: 'SISTEMA_FERIADO' };
    expect(situacaoDaAula({ ...base, dataStr: '2026-11-09', validacao })).toBe(SITUACAO.FERIADO);
  });
});

describe('datas', () => {
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-11-01', -1)).toBe('2026-10-31');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('lista o período inclusive', () => {
    expect(datasEntre('2026-11-08', '2026-11-10')).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
  });
});

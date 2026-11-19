import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { tabelaPadrao } from '../../src/utils/tabelaPrecos.js';
import {
  grupoDaModalidade, chaveDaTabela, mesDoBeneficio, gruposVigentes, pulseiraDoProfessor, turnoDaHora,
  ehHorarioSaver, marcarSeguidas, valorSugerido, compararValor,
} from '../../src/utils/pulseira.js';

const T = tabelaPadrao();
const wk = (modalidade, data, id = `wk_${modalidade}${data}`) => ({ id, modalidade, data });
const maria = { workshops: [wk('Power Core', '2026-03-10'), wk('Power Training', '2026-04-05')] };
const tres = { workshops: [...maria.workshops, wk('Jump', '2026-05-01')] };
const aula = (modalidade, extra = {}) => ({ modalidade, unidadeId: 'u1', data: '2026-11-10', hora: '09:00', seguida: false, ...extra });

describe('nomes de modalidade', () => {
  it('Jump e Energy Jump são a mesma; Power Core vale para Core 20 e 40', () => {
    expect(grupoDaModalidade('Jump')).toBe('jump');
    expect(grupoDaModalidade('ENERGY JUMP')).toBe('jump');
    expect(grupoDaModalidade('Power Dance')).toBe('dance');
    expect(grupoDaModalidade('Power Bumbum')).toBe('bumbum');
    expect(grupoDaModalidade('Power Fight')).toBe('fight');
    expect(grupoDaModalidade('Yoga')).toBe(null);
    expect(chaveDaTabela('Power Core 20')).toBe('core20');
    expect(chaveDaTabela('POWER CORE 40')).toBe('core40');
    expect(chaveDaTabela('Power Core')).toBe('core20');
    expect(chaveDaTabela('Energy Jump')).toBe('jump');
    expect(chaveDaTabela('Power Fight')).toBe(null);
  });
});

describe('vigência: a partir do mês seguinte à data do workshop', () => {
  it('10/11 vale desde dezembro; dezembro vira janeiro do ano seguinte', () => {
    expect(mesDoBeneficio('2026-11-10')).toBe('2026-12');
    expect(mesDoBeneficio('2026-12-31')).toBe('2027-01');
    expect(mesDoBeneficio('lixo')).toBe(null);
  });
  it('novembro ainda não conta o workshop de 10/11; dezembro conta', () => {
    const w = [wk('Power Core', '2026-11-10')];
    expect(gruposVigentes(w, '2026-11').size).toBe(0);
    expect(gruposVigentes(w, '2026-12').has('core')).toBe(true);
  });
  it('item antigo sem modalidade usa o mapa por workshopId; sem nenhum, não conta', () => {
    const w = [{ id: 'wk_a', workshopId: 'a', data: '2026-01-10' }];
    expect(gruposVigentes(w, '2026-11').size).toBe(0);
    expect(gruposVigentes(w, '2026-11', { a: 'Power Dance' }).has('dance')).toBe(true);
  });
});

describe('pulseira por modalidade', () => {
  it('Maria (Core + Training) em Training: 2 modalidades = vermelha', () => {
    expect(pulseiraDoProfessor(maria.workshops, 'training', '2026-11')).toEqual({ nivel: 'vermelha', quantidade: 2, candidataPreta: false });
  });
  it('Maria em Jump (sem workshop de Jump): cinza, mesmo com 2 workshops', () => {
    expect(pulseiraDoProfessor(maria.workshops, 'jump', '2026-11').nivel).toBe('cinza');
  });
  it('faz o de Jump: 3 modalidades = preta candidata (vale a vermelha até a média confirmar)', () => {
    expect(pulseiraDoProfessor(tres.workshops, 'jump', '2026-11')).toEqual({ nivel: 'vermelha', quantidade: 3, candidataPreta: true });
  });
  it('2 certificados da mesma modalidade contam UM (verde)', () => {
    const w = [wk('Power Core', '2026-01-10'), wk('Power Core', '2026-06-10', 'wk_atualizacao')];
    expect(pulseiraDoProfessor(w, 'core', '2026-11')).toEqual({ nivel: 'verde', quantidade: 1, candidataPreta: false });
  });
  it('sem workshop nenhum: cinza', () => {
    expect(pulseiraDoProfessor([], 'training', '2026-11').nivel).toBe('cinza');
    expect(pulseiraDoProfessor(undefined, 'training', '2026-11').nivel).toBe('cinza');
  });
});

describe('turno da aula', () => {
  it('6h às 16h59 manhã; a partir das 17h e de madrugada, noite', () => {
    expect(turnoDaHora('06:00')).toBe('manha');
    expect(turnoDaHora('16:59')).toBe('manha');
    expect(turnoDaHora('17:00')).toBe('noite');
    expect(turnoDaHora('20:30')).toBe('noite');
    expect(turnoDaHora('05:59')).toBe('noite');
    expect(turnoDaHora('')).toBe(null);
  });
});

describe('Saver (acadêmico)', () => {
  // 2026-11-10 é terça (dia 2)
  const saver = { tipoContrato: 'saver', saverLocais: [
    { unidadeId: 'u1', horarios: [{ dia: 2, ini: '06:00', fim: '10:00' }] },
    { unidadeId: 'u2', horarios: [{ dia: 2, ini: '14:00', fim: '18:00' }, { dia: 4, ini: '06:00', fim: '09:00' }] },
  ] };
  it('dentro do horário e na unidade do Saver', () => {
    expect(ehHorarioSaver(saver, 'u1', '2026-11-10', '07:00')).toBe(true);
    expect(ehHorarioSaver(saver, 'u2', '2026-11-10', '14:00')).toBe(true);
    expect(ehHorarioSaver(saver, 'u2', '2026-11-12', '08:00')).toBe(true); // quinta
  });
  it('fim do horário não vale; outra unidade, outro dia e CLT não valem', () => {
    expect(ehHorarioSaver(saver, 'u1', '2026-11-10', '10:00')).toBe(false);
    expect(ehHorarioSaver(saver, 'u1', '2026-11-10', '20:00')).toBe(false);
    expect(ehHorarioSaver(saver, 'u3', '2026-11-10', '07:00')).toBe(false);
    expect(ehHorarioSaver(saver, 'u1', '2026-11-11', '07:00')).toBe(false);
    expect(ehHorarioSaver({ tipoContrato: 'clt' }, 'u1', '2026-11-10', '07:00')).toBe(false);
    expect(ehHorarioSaver({}, 'u1', '2026-11-10', '07:00')).toBe(false);
  });
});

describe('aulas seguidas (só Jump e Dance entre si)', () => {
  const a = (id, modalidade, ini, fim, unidadeId = 'u1') => ({ id, modalidade, ini, fim, unidadeId });
  it('Jump e depois Dance (intervalo de 10 min): as duas são seguidas', () => {
    const r = marcarSeguidas([a(1, 'Energy Jump', '18:00', '18:50'), a(2, 'Power Dance', '19:00', '19:50')]);
    expect(r.get(1)).toEqual({ seguida: true, posicao: 1, tamanho: 2 });
    expect(r.get(2)).toEqual({ seguida: true, posicao: 2, tamanho: 2 });
  });
  it('intervalo de 20 min ainda é seguida; 21 min não', () => {
    expect(marcarSeguidas([a(1, 'Jump', '18:00', '18:50'), a(2, 'Jump', '19:10', '20:00')]).get(2).seguida).toBe(true);
    expect(marcarSeguidas([a(1, 'Jump', '18:00', '18:50'), a(2, 'Jump', '19:11', '20:00')]).get(2).seguida).toBe(false);
  });
  it('Training seguido de Jump: nenhuma é seguida', () => {
    const r = marcarSeguidas([a(1, 'Power Training', '18:00', '18:50'), a(2, 'Jump', '19:00', '19:50')]);
    expect(r.get(1).seguida).toBe(false);
    expect(r.get(2).seguida).toBe(false);
  });
  it('Training no meio quebra a sequência; 3 seguidas contam; outra unidade não conta', () => {
    expect(marcarSeguidas([a(1, 'Jump', '18:00', '18:50'), a(2, 'Power Training', '18:55', '19:45'), a(3, 'Power Dance', '19:50', '20:40')]).get(3).seguida).toBe(false);
    const r = marcarSeguidas([a(1, 'Jump', '17:00', '17:50'), a(2, 'Power Dance', '18:00', '18:50'), a(3, 'Jump', '19:00', '19:50')]);
    expect([1, 2, 3].map((i) => r.get(i).tamanho)).toEqual([3, 3, 3]);
    expect(marcarSeguidas([a(1, 'Jump', '18:00', '18:50', 'u1'), a(2, 'Power Dance', '19:00', '19:50', 'u2')]).get(2).seguida).toBe(false);
  });
});

describe('valor sugerido (conferido com a tabela)', () => {
  it('Maria em Training, vermelha: R$ 30', () => {
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Power Training') }))
      .toMatchObject({ chave: 'training', nivel: 'vermelha', campo: 'qualquer', valor: 30, saver: false });
  });
  it('Maria em Jump (sem workshop de Jump): cinza, 1 aula = R$ 35; seguida = R$ 30', () => {
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Jump') }).valor).toBe(35);
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Jump', { seguida: true }) }).valor).toBe(30);
  });
  it('Maria em Core 20 (tem o de Core, 2 modalidades): vermelha = R$ 20', () => {
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Power Core 20') }).valor).toBe(20);
  });
  it('Saver dentro do horário na unidade dele: acadêmico (Training vermelha = R$ 20); fora: R$ 30', () => {
    const saver = { ...maria, tipoContrato: 'saver', saverLocais: [{ unidadeId: 'u1', horarios: [{ dia: 2, ini: '06:00', fim: '10:00' }] }] };
    expect(valorSugerido({ tabela: T, professor: saver, aula: aula('Power Training', { hora: '07:00' }) }))
      .toMatchObject({ saver: true, campo: 'academico', valor: 20 });
    expect(valorSugerido({ tabela: T, professor: saver, aula: aula('Power Training', { hora: '20:00' }) }).valor).toBe(30);
    expect(valorSugerido({ tabela: T, professor: saver, aula: aula('Power Training', { hora: '07:00', unidadeId: 'u9' }) }).valor).toBe(30);
  });
  it('preta candidata: sem a média do mês vale a vermelha e mostra o extra a ajustar', () => {
    expect(valorSugerido({ tabela: T, professor: tres, aula: aula('Jump') }))
      .toMatchObject({ nivel: 'vermelha', valor: 45, candidataPreta: true, pretaPendente: true, valorPreta: 50, extraPreta: 5 });
  });
  it('preta com média do mês: manhã precisa de mais de 15; noite, mais de 25', () => {
    const m = (hora, mediaMes) => valorSugerido({ tabela: T, professor: tres, aula: aula('Jump', { hora }), mediaMes });
    expect(m('09:00', 16)).toMatchObject({ nivel: 'preta', valor: 50, extraPreta: 0 });
    expect(m('09:00', 15)).toMatchObject({ nivel: 'vermelha', valor: 45, pretaPendente: false, extraPreta: 0 });
    expect(m('19:00', 25)).toMatchObject({ nivel: 'vermelha', valor: 45 });
    expect(m('19:00', 26)).toMatchObject({ nivel: 'preta', valor: 50 });
  });
  it('preta de Jump seguida = 45', () => {
    expect(valorSugerido({ tabela: T, professor: tres, aula: aula('Jump', { seguida: true }), mediaMes: 30 }).valor).toBe(45);
  });
  it('sem sugestão: Power Fight, modalidade desconhecida e Core 40 escondido', () => {
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Power Fight') })).toBe(null);
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Yoga') })).toBe(null);
    expect(valorSugerido({ tabela: T, professor: maria, aula: aula('Power Core 40') })).toBe(null);
  });
  it('aula antes da vigência do workshop usa a pulseira da época (não recalcula o passado)', () => {
    const w = { workshops: [wk('Power Training', '2026-11-10')] };
    expect(valorSugerido({ tabela: T, professor: w, aula: aula('Power Training', { data: '2026-11-20' }) }).valor).toBe(20); // cinza
    expect(valorSugerido({ tabela: T, professor: w, aula: aula('Power Training', { data: '2026-12-02' }) }).valor).toBe(25); // verde
  });
});

describe('comparar pago x sugerido', () => {
  it('certo, maior, menor e sem sugestão', () => {
    expect(compararValor(30, 30)).toBe('certo');
    expect(compararValor('30.00', 30)).toBe('certo');
    expect(compararValor(50, 25)).toBe('maior');
    expect(compararValor(20, 30)).toBe('menor');
    expect(compararValor(30, null)).toBe('sem-sugestao');
  });
});

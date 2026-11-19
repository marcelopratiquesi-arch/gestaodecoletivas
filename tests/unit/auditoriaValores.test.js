import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { tabelaPadrao } from '../../src/utils/tabelaPrecos.js';
import { auditarValores, mediasDoMes, mesConfirmavel, seguidasDasValidacoes, ultimoDiaDoMes } from '../../src/utils/auditoriaValores.js';

const T = tabelaPadrao();
const wk = (modalidade, data) => ({ id: `wk_${modalidade}`, modalidade, data });
const maria = { id: 'p1', nome: 'MARIA', workshops: [wk('Power Core', '2026-03-10'), wk('Power Training', '2026-04-05')] };
const tres = { id: 'p2', nome: 'ANA', workshops: [wk('Power Core', '2026-03-10'), wk('Power Training', '2026-04-05'), wk('Jump', '2026-05-01')] };
const mods = new Map([['mT', { id: 'mT', nome: 'Power Training' }], ['mJ', { id: 'mJ', nome: 'Energy Jump' }], ['mD', { id: 'mD', nome: 'Power Dance' }]]);
const unis = new Map([['u1', { id: 'u1', pais: 'BR' }], ['u9', { id: 'u9', pais: 'AR' }]]);
const aulas = new Map([
  ['a1', { id: 'a1', modalidadeId: 'mT', unidadeId: 'u1', professorId: 'p1', hora: '09:00', valor: 30 }],
  ['a2', { id: 'a2', modalidadeId: 'mJ', unidadeId: 'u1', professorId: 'p2', hora: '09:00', valor: 50 }],
  ['a3', { id: 'a3', modalidadeId: 'mD', unidadeId: 'u1', professorId: 'p2', hora: '09:50', valor: 50 }],
  ['a9', { id: 'a9', modalidadeId: 'mT', unidadeId: 'u9', professorId: 'p1', hora: '09:00', valor: 30 }],
]);
const profs = new Map([['p1', maria], ['p2', tres]]);
const periodoOutubro = { start: '2026-10-01', end: '2026-10-31' };
const valorPago = (v, aula) => (v.valorEfetivo ?? aula.valor);
const val = (id, aulaId, data, alunos, extra = {}) => ({ id, aulaId, data, status: 'realizada', alunos, ...extra });
const linha = (aulaId, historico, extra = {}) => ({ id: aulaId, tipoLinha: 'titular', aulaBase: aulas.get(aulaId), professorId: aulas.get(aulaId).professorId, professorNome: profs.get(aulas.get(aulaId).professorId).nome, unidadeNome: 'U1', modalidadeNome: mods.get(aulas.get(aulaId).modalidadeId).nome.toUpperCase(), historico, ...extra });
const rodar = (linhas, validacoes, hojeISO = '2026-11-19', periodo = periodoOutubro) => auditarValores({
  linhas, tabela: T, professorPorId: profs, modalidadePorId: mods, unidadePorId: unis, aulaPorId: aulas, validacoesDoPeriodo: validacoes, periodo, hojeISO, valorPago,
});

describe('mês fechado e média', () => {
  it('último dia do mês e quando a média vale', () => {
    expect(ultimoDiaDoMes('2026-10')).toBe('2026-10-31');
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28');
    expect(mesConfirmavel('2026-10', periodoOutubro, '2026-11-19')).toBe(true);
    expect(mesConfirmavel('2026-11', { start: '2026-11-01', end: '2026-11-30' }, '2026-11-19')).toBe(false); // mês ainda aberto
    expect(mesConfirmavel('2026-10', { start: '2026-10-10', end: '2026-10-31' }, '2026-11-19')).toBe(false); // período parcial
  });
  it('média por professor, modalidade, turno e mês (aulão e cancelada fora)', () => {
    const v = [val('1', 'a2', '2026-10-05', 20), val('2', 'a2', '2026-10-12', 10), { ...val('3', 'a2', '2026-10-19', 99), status: 'cancelada' }, val('4', 'a2', '2026-10-26', 99, { isAulao: true })];
    const m = mediasDoMes(v, aulas, (id) => mods.get(id).nome);
    expect(m.get('p2|jump|manha|2026-10')).toEqual({ total: 30, aulas: 2, media: 15 });
  });
  it('aulas seguidas só entre Jump e Dance realizadas no mesmo dia', () => {
    const v = [val('1', 'a2', '2026-10-05', 20), val('2', 'a3', '2026-10-05', 20), val('3', 'a2', '2026-10-12', 20)];
    const s = seguidasDasValidacoes(v, aulas, (id) => mods.get(id).nome);
    expect(s.get('1')).toBe(true);
    expect(s.get('2')).toBe(true);
    expect(s.get('3')).toBe(false);
  });
});

describe('aba Valores: pago x sugerido', () => {
  it('Maria em Training (vermelha = 30): pago 30 certo; pago 20 menor; pago 50 maior', () => {
    const v = [val('1', 'a1', '2026-10-05', 12), val('2', 'a1', '2026-10-12', 12, { valorEfetivo: 20 }), val('3', 'a1', '2026-10-19', 12, { valorEfetivo: 50 })];
    const r = rodar([linha('a1', v)], v);
    expect(r.itens.map((i) => i.situacao)).toEqual(['certo', 'menor', 'maior']);
    expect(r.resumo).toMatchObject({ aulas: 3, certas: 1, maiores: 1, menores: 1, diferenca: 10 }); // +20 (maior) e -10 (menor)
    expect(r.porProfessor[0]).toMatchObject({ professorNome: 'MARIA', certas: 1, maiores: 1, menores: 1 });
  });
  it('aulas seguidas pagas como aula única aparecem como "maior" (ex.: 50 em vez de 30+30)', () => {
    // Ana: Jump (3 modalidades, preta candidata, média 12 < 15 => vermelha, seguidas = 40) e Dance (sem workshop de Dance => cinza, seguidas = 30)
    const v = [val('1', 'a2', '2026-10-05', 12), val('2', 'a3', '2026-10-05', 12)];
    const r = rodar([linha('a2', [v[0]]), linha('a3', [v[1]])], v);
    expect(r.itens.every((i) => i.seguida)).toBe(true);
    expect(r.itens.map((i) => i.sugerido)).toEqual([40, 30]);
    expect(r.itens.map((i) => i.situacao)).toEqual(['maior', 'maior']);
  });
  it('preta confirmada com média acima de 15 (manhã) no mês fechado: sugerido 50; média baixa: 45', () => {
    const boas = [val('1', 'a2', '2026-10-05', 20), val('2', 'a2', '2026-10-12', 20)];
    expect(rodar([linha('a2', boas)], boas).itens[0]).toMatchObject({ nivel: 'preta', sugerido: 50, situacao: 'certo', pretaPendente: false });
    const fracas = [val('1', 'a2', '2026-10-05', 10), val('2', 'a2', '2026-10-12', 10)];
    expect(rodar([linha('a2', fracas)], fracas).itens[0]).toMatchObject({ nivel: 'vermelha', sugerido: 45 });
  });
  it('mês ainda aberto: preta fica pendente (vale a vermelha) e mostra o extra', () => {
    const v = [val('1', 'a2', '2026-11-05', 30)];
    const r = rodar([linha('a2', v)], v, '2026-11-19', { start: '2026-11-01', end: '2026-11-30' });
    expect(r.itens[0]).toMatchObject({ nivel: 'vermelha', sugerido: 45, pretaPendente: true, extraPreta: 5 });
  });
  it('sem sugestão: unidade de outro país, aulão e não realizadas ficam de fora ou marcadas', () => {
    const v = [val('1', 'a9', '2026-10-05', 12)];
    const r = rodar([linha('a9', v)], v);
    expect(r.itens[0]).toMatchObject({ situacao: 'sem-sugestao', motivo: 'moeda' });
    const outras = [{ ...val('2', 'a1', '2026-10-05', 12), status: 'cancelada' }, { ...val('3', 'a1', '2026-10-06', 12), isFeriadoVirtual: true }];
    expect(rodar([linha('a1', outras), { ...linha('a1', [val('4', 'a1', '2026-10-07', 5)]), tipoLinha: 'aulao' }], outras).itens).toHaveLength(0);
  });
  it('workshop de 10/10 só vale a partir de novembro (não recalcula o passado)', () => {
    const nova = { ...maria, workshops: [wk('Power Training', '2026-10-10')] };
    profs.set('p1', nova);
    const v = [val('1', 'a1', '2026-10-20', 12), val('2', 'a1', '2026-11-03', 12)];
    const r = rodar([linha('a1', v)], v, '2026-11-19', { start: '2026-10-01', end: '2026-11-30' });
    expect(r.itens.map((i) => i.sugerido)).toEqual([20, 25]); // cinza em outubro, verde em novembro
    profs.set('p1', maria);
  });
});

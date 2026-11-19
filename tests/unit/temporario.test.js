// Líder temporário: contas de prazo (calendário de Brasília), avisos 7/3/1 e validação do convite.
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import {
  hojeBrasilia, somarDias, fimDoDia, fimPorDias, diasRestantes, diasDoPrazo, nivelDoAviso, temporarioVencido, ehTemporario,
} from '../../src/utils/temporario';
import { crachaSemAcesso } from '../../src/permissions';
import { validarConvite } from '../../src/app/Configuracoes/Lideres/liderTemporario';

// 19/11/2026 às 15:00 em Brasília (18:00 UTC)
const AGORA = Date.parse('2026-11-19T15:00:00-03:00');

describe('prazo em Brasília', () => {
  it('hoje de Brasília, mesmo depois das 21h (já é outro dia em UTC)', () => {
    expect(hojeBrasilia(AGORA)).toBe('2026-11-19');
    expect(hojeBrasilia(Date.parse('2026-11-19T22:30:00-03:00'))).toBe('2026-11-19');
    expect(hojeBrasilia(Date.parse('2026-11-19T00:10:00-03:00'))).toBe('2026-11-19');
  });
  it('hoje conta como dia 1 e vale até 23:59:59', () => {
    expect(fimPorDias(1, AGORA).toISOString()).toBe('2026-11-20T02:59:59.000Z'); // 19/11 23:59:59 -03
    expect(fimPorDias(7, AGORA).toISOString()).toBe('2026-11-26T02:59:59.000Z'); // 25/11 23:59:59 -03
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
  });
  it('60 dias não passa de 61 dias à frente (limite das regras do banco)', () => {
    expect(fimPorDias(60, AGORA).getTime() - AGORA).toBeLessThan(61 * 86400000);
  });
});

describe('dias que faltam e avisos', () => {
  const fim = fimDoDia('2026-11-26');
  it('conta dias de calendário; 0 = último dia; vencido = -1', () => {
    expect(diasRestantes(fim, AGORA)).toBe(7);
    expect(diasRestantes(fimDoDia('2026-11-19'), AGORA)).toBe(0);
    expect(diasRestantes(fimDoDia('2026-11-18'), AGORA)).toBe(-1);
    expect(diasRestantes(null, AGORA)).toBe(null);
  });
  it('último dia ainda funciona até 23:59 e vence logo depois', () => {
    const ultimo = fimDoDia('2026-11-19');
    expect(diasRestantes(ultimo, Date.parse('2026-11-19T23:58:00-03:00'))).toBe(0);
    expect(diasRestantes(ultimo, Date.parse('2026-11-20T00:00:01-03:00'))).toBe(-1);
  });
  it('níveis: 7 atenção, 3 alto, 1 e hoje urgente, vencido', () => {
    expect(nivelDoAviso(8)).toBe(null);
    expect(nivelDoAviso(7)).toBe('atencao');
    expect(nivelDoAviso(4)).toBe('atencao');
    expect(nivelDoAviso(3)).toBe('alto');
    expect(nivelDoAviso(2)).toBe('alto');
    expect(nivelDoAviso(1)).toBe('urgente');
    expect(nivelDoAviso(0)).toBe('urgente');
    expect(nivelDoAviso(-1)).toBe('vencido');
  });
  it('tamanho do prazo contando o primeiro dia', () => {
    expect(diasDoPrazo(new Date(AGORA), fimPorDias(30, AGORA))).toBe(30);
  });
});

describe('crachá temporário', () => {
  const ate = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
  it('só é temporário quem tem prazo', () => {
    expect(ehTemporario({ role: 'lider' })).toBe(false);
    expect(ehTemporario({ role: 'lider', temporarioAte: ate(AGORA + 1000) })).toBe(true);
  });
  it('vencido perde o acesso; dentro do prazo e sem prazo seguem normais', () => {
    expect(temporarioVencido({ temporarioAte: ate(AGORA - 1000) }, AGORA)).toBe(true);
    expect(temporarioVencido({ temporarioAte: ate(AGORA + 1000) }, AGORA)).toBe(false);
    expect(crachaSemAcesso({ role: 'lider', temporarioAte: ate(Date.now() - 1000) })).toBe(true);
    expect(crachaSemAcesso({ role: 'lider', temporarioAte: ate(Date.now() + 86400000) })).toBe(false);
    expect(crachaSemAcesso({ role: 'lider' })).toBe(false);
    expect(crachaSemAcesso({ role: 'bloqueado' })).toBe(true);
  });
});

describe('validação do convite', () => {
  const ok = { email: 'a@gmail.com', nome: 'Ana Souza', telefone: '31999990000', unidadeIds: ['u1'], fim: new Date(AGORA + 86400000) };
  it('aceita o convite certo', () => {
    expect(validarConvite({ ...ok, agora: AGORA })).toBe(null);
  });
  it('recusa e-mail, nome, telefone, unidade, excesso de unidades e prazo passado', () => {
    expect(validarConvite({ ...ok, email: 'x', agora: AGORA })).toBe('email');
    expect(validarConvite({ ...ok, nome: 'A', agora: AGORA })).toBe('name');
    expect(validarConvite({ ...ok, telefone: '1', agora: AGORA })).toBe('phone');
    expect(validarConvite({ ...ok, unidadeIds: [], agora: AGORA })).toBe('unit');
    expect(validarConvite({ ...ok, unidadeIds: ['1', '2', '3', '4', '5', '6'], agora: AGORA })).toBe('tooMany');
    expect(validarConvite({ ...ok, fim: new Date(AGORA - 1), agora: AGORA })).toBe('past');
    expect(validarConvite({ ...ok, fim: null, agora: AGORA })).toBe('past');
  });
});

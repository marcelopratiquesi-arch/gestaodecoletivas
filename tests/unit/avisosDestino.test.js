// Avisos do admin: quem recebe, validação do texto e quem pode enviar (regras puras de api/_avisos.js).
import { describe, it, expect } from 'vitest';
import { escolherDestinatarios, validarAviso, ehAdmin, montarMensagem } from '../../api/_avisos.js';

const usuarios = [
  { id: 'a1', role: 'admin', nome: 'Admin' },
  { id: 'm1', role: 'mentor', nome: 'Mentor', unidadeIds: ['u1', 'u2'] },
  { id: 'l1', role: 'lider', nome: 'Líder 1', unidadeId: 'u1', unidadeIds: ['u1'] },
  { id: 'l2', role: 'unidade', nome: 'Líder antigo', unidadeId: 'u2' },
  { id: 'p1', role: 'professor', nome: 'Prof 1', professorId: 'f1' },
  { id: 'p2', role: 'professor', nome: 'Prof 2', professorId: 'f2' },
  { id: 'x1', role: 'bloqueado', nome: 'Bloqueado' },
  { id: 'x2', role: 'professor', nome: 'Inativo', status: 'inativo' },
];
const professores = [{ id: 'f1' }, { id: 'f2' }];
const vinculos = [
  { professorId: 'f1', unidadeId: 'u1', status: 'ativo' },
  { professorId: 'f2', unidadeId: 'u1', status: 'inativo' },
  { professorId: 'f2', unidadeId: 'u2' },
];
const ids = (d) => escolherDestinatarios({ usuarios, professores, vinculos, destino: d }).map((p) => p.id).sort();

describe('quem recebe o aviso', () => {
  it('sem filtro = todos, menos bloqueado e inativo', () => {
    expect(ids({ tipo: 'filtro' })).toEqual(['a1', 'l1', 'l2', 'm1', 'p1', 'p2']);
  });
  it('por papel (unidade conta como líder)', () => {
    expect(ids({ tipo: 'filtro', papeis: ['lider'] })).toEqual(['l1', 'l2']);
    expect(ids({ tipo: 'filtro', papeis: ['professor', 'mentor'] })).toEqual(['m1', 'p1', 'p2']);
  });
  it('por unidade: líder pelo crachá, professor pelo vínculo ativo', () => {
    expect(ids({ tipo: 'filtro', unidadeIds: ['u1'] })).toEqual(['l1', 'm1', 'p1']);
    expect(ids({ tipo: 'filtro', unidadeIds: ['u2'] })).toEqual(['l2', 'm1', 'p2']);
  });
  it('papel + unidade juntos', () => {
    expect(ids({ tipo: 'filtro', papeis: ['professor'], unidadeIds: ['u1'] })).toEqual(['p1']);
  });
  it('pessoas escolhidas (bloqueado nunca recebe)', () => {
    expect(ids({ tipo: 'pessoas', uids: ['p1', 'x1', 'a1'] })).toEqual(['a1', 'p1']);
  });
});

describe('validação e permissão', () => {
  const ok = { titulo: 'Atualize', texto: 'Abra de novo o app', destino: { tipo: 'filtro' } };
  it('aceita aviso normal', () => expect(validarAviso(ok)).toBe(''));
  it('recusa título/texto vazio ou longo', () => {
    expect(validarAviso({ ...ok, titulo: ' ' })).not.toBe('');
    expect(validarAviso({ ...ok, texto: 'x'.repeat(301) })).not.toBe('');
  });
  it('link só de tela do sistema', () => {
    expect(validarAviso({ ...ok, link: '/app/meu-cadastro' })).toBe('');
    expect(validarAviso({ ...ok, link: 'https://site-ruim.com' })).not.toBe('');
    expect(validarAviso({ ...ok, link: '//site-ruim.com' })).not.toBe('');
  });
  it('pessoas escolhidas exige lista', () => {
    expect(validarAviso({ ...ok, destino: { tipo: 'pessoas', uids: [] } })).not.toBe('');
  });
  it('só admin ativo envia', () => {
    expect(ehAdmin({ role: 'admin' })).toBe(true);
    expect(ehAdmin({ role: 'mentor' })).toBe(false);
    expect(ehAdmin({ role: 'admin', status: 'inativo' })).toBe(false);
  });
  it('mensagem leva só dados (quem mostra é o sw.js)', () => {
    const m = montarMensagem(ok);
    expect(m.data).toEqual({ titulo: 'Atualize', texto: 'Abra de novo o app', link: '/app' });
    expect(m.notification).toBeUndefined();
  });
});

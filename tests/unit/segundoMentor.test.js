// 2º mentor: contas puras (quem é o 2º, quem pode virar, escopo de unidades) e o texto do último acesso.
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { escopoMentor, ehSegundoMentor } from '../../src/permissions';
import { segundoDe, principalDe, conviteDe, motivoQueBloqueia } from '../../src/app/Configuracoes/Mentores/segundoMentor';
import { resumoDoAcesso, corDoAcesso } from '../../src/utils/ultimoAcesso';
import { unidadesVisiveis } from '../../src/centrais/acessos';
import { acessoUnidade } from '../../src/centrais/contasUnidade';
import { acessoCentral } from '../../src/centrais/acessos';
import { linkWhatsApp } from '../../src/centrais/contato';

const mentores = [
  { id: 'm1', nome: 'Primeiro', role: 'mentor' },
  { id: 'm2', nome: 'Segundo', role: 'mentor', mentorPrincipalId: 'm1' },
  { id: 'm3', nome: 'Outro', role: 'mentor' },
];
const unidades = [{ id: 'u1', mentorId: 'm1' }, { id: 'u2', mentorId: 'm3' }];

describe('2º mentor', () => {
  it('acha o 2º do mentor e o principal do 2º', () => {
    expect(segundoDe(mentores, 'm1').id).toBe('m2');
    expect(segundoDe(mentores, 'm3')).toBe(null);
    expect(principalDe(mentores, mentores[1]).id).toBe('m1');
    expect(principalDe(mentores, mentores[0])).toBe(null);
  });
  it('convite pendente só conta se for do mesmo mentor', () => {
    const convites = [{ mentorPrincipalId: 'm1', status: 'pendente' }, { mentorPrincipalId: 'm3', status: 'usado' }];
    expect(conviteDe(convites, 'm1')).toBeTruthy();
    expect(conviteDe(convites, 'm3')).toBe(null);
  });
  it('escopo: o 2º mentor usa o id do principal; o 1º, o dele', () => {
    expect(escopoMentor({ id: 'm2', mentorPrincipalId: 'm1' })).toBe('m1');
    expect(escopoMentor({ id: 'm1' })).toBe('m1');
    expect(ehSegundoMentor(mentores[1])).toBe(true);
    expect(ehSegundoMentor(mentores[0])).toBe(false);
  });
  it('o 2º mentor enxerga as unidades do 1º e só elas', () => {
    expect(unidadesVisiveis(mentores[1], unidades).map((u) => u.id)).toEqual(['u1']);
    expect(acessoUnidade(mentores[1], unidades[0])).toBe('editar');
    expect(acessoUnidade(mentores[1], unidades[1])).toBe(null);
  });
  it('quem pode virar 2º mentor: líder e professor sim; admin, mentor e bloqueado não', () => {
    expect(motivoQueBloqueia({ role: 'lider' })).toBe(null);
    expect(motivoQueBloqueia({ role: 'professor' })).toBe(null);
    expect(motivoQueBloqueia({ role: 'unidade' })).toBe(null);
    expect(motivoQueBloqueia({ role: 'admin' })).toBe('admin');
    expect(motivoQueBloqueia({ role: 'mentor' })).toBe('alreadyMentor');
    expect(motivoQueBloqueia({ role: 'bloqueado' })).toBe('blocked');
    expect(motivoQueBloqueia(null)).toBe('noLogin');
  });
});

describe('Central do mentor com 2º mentor', () => {
  it('o 1º e o 2º mentor abrem a ficha um do outro (só leitura); outro mentor não', () => {
    expect(acessoCentral('mentor', mentores[0], mentores[1], {})).toBe('ver');
    expect(acessoCentral('mentor', mentores[1], mentores[0], {})).toBe('ver');
    expect(acessoCentral('mentor', mentores[0], mentores[2], {})).toBe(null);
    expect(acessoCentral('mentor', mentores[0], { id: 'a', role: 'admin' }, {})).toBe('editar');
  });
});

describe('WhatsApp padrão', () => {
  it('telefone com número gera link; sem número não', () => {
    expect(linkWhatsApp('(48) 99853-4505', 'BR')).toBe('https://wa.me/5548998534505');
    expect(linkWhatsApp('', 'BR')).toBe(null);
  });
});

describe('último acesso', () => {
  const agora = new Date('2026-11-18T15:00:00').getTime();
  it('mostra data e hora e "há X dias"', () => {
    const r = resumoDoAcesso(new Date('2026-11-15T14:32:00'), 'pt-BR', agora);
    expect(r.hora).toBe('14:32');
    expect(r.dia).toBe('15/11/2026');
    expect(r.dias).toBe(3);
    expect(r.relativo).toMatch(/3/);
  });
  it('sem registro devolve null', () => {
    expect(resumoDoAcesso(null)).toBe(null);
    expect(resumoDoAcesso(undefined)).toBe(null);
  });
  it('aceita carimbo do Firebase', () => {
    const r = resumoDoAcesso({ toDate: () => new Date('2026-11-18T10:05:00') }, 'pt-BR', agora);
    expect(r.hora).toBe('10:05');
    expect(r.dias).toBe(0);
  });
  it('cores: até 7 dias verde, até 30 âmbar, depois vermelho', () => {
    expect(corDoAcesso(7)).toBe('emerald');
    expect(corDoAcesso(8)).toBe('amber');
    expect(corDoAcesso(31)).toBe('red');
  });
});

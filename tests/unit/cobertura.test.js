// Mentor temporário = COBERTURA: acesso extra às unidades de outro mentor, até uma data. O papel de verdade não muda.
// Rodar: npx vitest run tests/unit
import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import { coberturaAtiva, escoposMentor, ehDoMeuEscopo, papelEfetivo } from '../../src/permissions';
import { unidadesVisiveis } from '../../src/centrais/acessos';
import { acessoUnidade } from '../../src/centrais/contasUnidade';
import { motivoQueBloqueia, motivoQueBloqueiaCobertura, camposAoSair, coberturasDe } from '../../src/app/Configuracoes/Mentores/segundoMentor';

const AGORA = Date.parse('2026-11-19T15:00:00-03:00');
const ate = (ms) => ({ toMillis: () => ms });
const unidades = [{ id: 'u1', mentorId: 'm1' }, { id: 'u2', mentorId: 'm2' }, { id: 'u3', mentorId: 'm3' }];

describe('cobertura ativa', () => {
  it('vale enquanto o prazo não passou', () => {
    expect(coberturaAtiva({ coberturaMentorId: 'm1', coberturaAte: ate(AGORA + 1000) }, AGORA)).toBe('m1');
    expect(coberturaAtiva({ coberturaMentorId: 'm1', coberturaAte: ate(AGORA - 1000) }, AGORA)).toBe(null);
    expect(coberturaAtiva({ coberturaAte: ate(AGORA + 1000) }, AGORA)).toBe(null);
    expect(coberturaAtiva({}, AGORA)).toBe(null);
  });
});

describe('papel que vale agora', () => {
  it('líder e professor viram mentor durante a cobertura e voltam depois', () => {
    const lider = { role: 'lider', coberturaMentorId: 'm1' };
    expect(papelEfetivo({ ...lider, coberturaAte: ate(AGORA + 1000) }, AGORA)).toBe('mentor');
    expect(papelEfetivo({ ...lider, coberturaAte: ate(AGORA - 1000) }, AGORA)).toBe('lider');
    expect(papelEfetivo({ role: 'professor', coberturaMentorId: 'm1', coberturaAte: ate(AGORA + 1000) }, AGORA)).toBe('mentor');
  });
  it('admin continua admin; sem cobertura o papel não muda', () => {
    expect(papelEfetivo({ role: 'admin', coberturaMentorId: 'm1', coberturaAte: ate(AGORA + 1000) }, AGORA)).toBe('admin');
    expect(papelEfetivo({ role: 'Lider' }, AGORA)).toBe('lider');
  });
});

describe('unidades que o mentor enxerga', () => {
  it('mentor com cobertura: as dele e as do mentor coberto, não as de um terceiro', () => {
    const m2 = { id: 'm2', role: 'mentor', coberturaMentorId: 'm1', coberturaAte: ate(Date.now() + 86400000) };
    expect(escoposMentor(m2).sort()).toEqual(['m1', 'm2']);
    expect(unidadesVisiveis(m2, unidades).map((u) => u.id).sort()).toEqual(['u1', 'u2']);
    expect(acessoUnidade(m2, unidades[0])).toBe('editar');
    expect(acessoUnidade(m2, unidades[2])).toBe(null);
  });
  it('vencida: volta só às dele', () => {
    const m2 = { id: 'm2', role: 'mentor', coberturaMentorId: 'm1', coberturaAte: ate(Date.now() - 1000) };
    expect(escoposMentor(m2)).toEqual(['m2']);
    expect(ehDoMeuEscopo(m2, 'm1')).toBe(false);
    expect(ehDoMeuEscopo(m2, 'm2')).toBe(true);
  });
  it('2º mentor fixo continua usando as unidades do titular', () => {
    expect(escoposMentor({ id: 'seg', mentorPrincipalId: 'm1' })).toEqual(['m1']);
  });
  it('sem id de mentor nunca bate', () => {
    expect(ehDoMeuEscopo({ id: 'm2' }, undefined)).toBe(false);
    expect(ehDoMeuEscopo({ id: 'm2' }, '')).toBe(false);
  });
});

describe('2º mentor fixo: quem pode', () => {
  it('mentor com unidades próprias é barrado (deve usar o mentor temporário)', () => {
    expect(motivoQueBloqueia({ role: 'mentor' }, { temUnidades: true })).toBe('mentorWithUnits');
    expect(motivoQueBloqueia({ role: 'mentor' }, { temUnidades: false })).toBe(null);
    expect(motivoQueBloqueia({ role: 'mentor', mentorPrincipalId: 'm9' })).toBe('alreadySecond');
    expect(motivoQueBloqueia({ role: 'lider' })).toBe(null);
  });
  it('mentor sem unidades que deixa de ser 2º continua mentor', () => {
    const saiu = camposAoSair({ papelAntesSegundoMentor: 'mentor' });
    expect(saiu.role).toBeUndefined();
    expect(saiu.status).toBeUndefined();
    expect(camposAoSair({ papelAntesSegundoMentor: 'lider' }).role).toBe('lider');
    expect(camposAoSair({}).status).toBe('inativo');
  });
});

describe('cobertura: quem pode ser coberto e a lista de quem cobre', () => {
  it('qualquer papel pode, menos admin, bloqueado e o próprio mentor', () => {
    expect(motivoQueBloqueiaCobertura({ id: 'a', role: 'mentor' }, 'm1')).toBe(null);
    expect(motivoQueBloqueiaCobertura({ id: 'a', role: 'lider' }, 'm1')).toBe(null);
    expect(motivoQueBloqueiaCobertura({ id: 'a', role: 'professor' }, 'm1')).toBe(null);
    expect(motivoQueBloqueiaCobertura({ id: 'm1', role: 'mentor' }, 'm1')).toBe('self');
    expect(motivoQueBloqueiaCobertura({ id: 'a', role: 'admin' }, 'm1')).toBe('admin');
    expect(motivoQueBloqueiaCobertura({ id: 'a', role: 'bloqueado' }, 'm1')).toBe('blocked');
    expect(motivoQueBloqueiaCobertura(null, 'm1')).toBe('noLogin');
  });
  it('vários por mentor', () => {
    const pessoas = [{ id: 'a', coberturaMentorId: 'm1' }, { id: 'b', coberturaMentorId: 'm1' }, { id: 'c', coberturaMentorId: 'm2' }, { id: 'd' }];
    expect(coberturasDe(pessoas, 'm1').map((p) => p.id)).toEqual(['a', 'b']);
  });
});

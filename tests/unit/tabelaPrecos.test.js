import './_semNavegador.js';
import { describe, it, expect } from 'vitest';
import {
  tabelaPadrao, mesclarComPadrao, paraTexto, deTexto, listarDiferencas, camposDoNivel,
  podeVerTabelaPrecos, podeEditarTabelaPrecos, NIVEIS, ORDEM,
} from '../../src/utils/tabelaPrecos.js';

describe('valores padrão (combinados com o usuário em 2026-11-19)', () => {
  const p = tabelaPadrao();
  it('Power Core 20', () => {
    expect(p.precos.core20.cinza).toEqual({ qualquer: 10, academico: 5 });
    expect(p.precos.core20.verde).toEqual({ qualquer: 15, academico: 10 });
    expect(p.precos.core20.vermelha).toEqual({ qualquer: 20, academico: 15 });
    expect(p.precos.core20.preta).toEqual({ qualquer: 25, academico: 20 });
  });
  it('Power Training', () => {
    expect(p.precos.training.cinza).toEqual({ qualquer: 20, academico: 10 });
    expect(p.precos.training.verde).toEqual({ qualquer: 25, academico: 15 });
    expect(p.precos.training.vermelha).toEqual({ qualquer: 30, academico: 20 });
    expect(p.precos.training.preta).toEqual({ qualquer: 35, academico: 25 });
  });
  it('Jump e Dance: aulas seguidas e pulseira preta = 50 (corrigido, imagem dizia 45)', () => {
    for (const id of ['jump', 'dance']) {
      expect(p.precos[id].cinza).toEqual({ umaAula: 35, seguidas: 30, academico: 20 });
      expect(p.precos[id].verde).toEqual({ umaAula: 40, seguidas: 35, academico: 25 });
      expect(p.precos[id].vermelha).toEqual({ umaAula: 45, seguidas: 40, academico: 30 });
      expect(p.precos[id].preta).toEqual({ qualquer: 50, academico: 35 });
    }
  });
  it('Power Bumbum: pulseira preta = 35 (corrigido)', () => {
    expect(p.precos.bumbum.cinza).toEqual({ qualquer: 15, academico: 10 });
    expect(p.precos.bumbum.verde).toEqual({ qualquer: 20, academico: 15 });
    expect(p.precos.bumbum.vermelha).toEqual({ qualquer: 25, academico: 20 });
    expect(p.precos.bumbum.preta).toEqual({ qualquer: 35, academico: 25 });
  });
  it('Core 40 começa escondido; frequência da preta 15 (manhã) e 25 (noite)', () => {
    expect(p.modalidades.core40.visivel).toBe(false);
    expect(p.modalidades.core20.visivel).toBe(true);
    expect(p.frequenciaPreta).toEqual({ manha: 15, noite: 25 });
  });
  it('todo campo de cada célula existe e é número', () => {
    ORDEM.forEach((id) => NIVEIS.forEach((nivel) => {
      const tipo = id === 'jump' || id === 'dance' ? 'seguidas' : 'simples';
      camposDoNivel(tipo, nivel).forEach((campo) => expect(typeof p.precos[id][nivel][campo]).toBe('number'));
    }));
  });
});

describe('mesclarComPadrao', () => {
  it('sem nada salvo, devolve o padrão', () => {
    expect(mesclarComPadrao(null)).toEqual(tabelaPadrao());
  });
  it('usa o que está salvo e completa o que faltar ou vier estragado', () => {
    const m = mesclarComPadrao({
      precos: { core20: { verde: { qualquer: 16 } }, jump: { preta: { qualquer: 'abc', academico: -3 } } },
      modalidades: { core40: { visivel: true } },
      frequenciaPreta: { manha: 18 },
    });
    expect(m.precos.core20.verde.qualquer).toBe(16);
    expect(m.precos.core20.verde.academico).toBe(10); // faltava: padrão
    expect(m.precos.jump.preta).toEqual({ qualquer: 50, academico: 35 }); // estragado: padrão
    expect(m.modalidades.core40.visivel).toBe(true);
    expect(m.frequenciaPreta).toEqual({ manha: 18, noite: 25 });
  });
});

describe('edição em texto', () => {
  it('aceita vírgula e converte de volta', () => {
    const t = paraTexto(tabelaPadrao());
    t.precos.core20.cinza.qualquer = '12,5';
    const { tabela, invalidos } = deTexto(t);
    expect(invalidos).toEqual([]);
    expect(tabela.precos.core20.cinza.qualquer).toBe(12.5);
  });
  it('aponta campo vazio, letra e negativo', () => {
    const t = paraTexto(tabelaPadrao());
    t.precos.core20.cinza.qualquer = '';
    t.precos.core20.verde.qualquer = 'x';
    t.frequenciaPreta.noite = '-1';
    const { invalidos } = deTexto(t);
    expect(invalidos).toEqual(['core20.cinza.qualquer', 'core20.verde.qualquer', 'frequenciaPreta.noite']);
  });
});

describe('listarDiferencas (auditoria)', () => {
  it('lista só o que mudou, com de ➔ para', () => {
    const a = tabelaPadrao();
    const d = tabelaPadrao();
    d.precos.jump.preta.qualquer = 55;
    d.modalidades.core40.visivel = true;
    d.frequenciaPreta.manha = 20;
    expect(listarDiferencas(a, d)).toEqual([
      'Power Core 40: passou a aparecer',
      'Energy Jump · Preta · Qualquer aula: R$ 50 ➔ R$ 55',
      'Frequência preta (manhã): 15 ➔ 20',
    ]);
  });
  it('igual = lista vazia', () => {
    expect(listarDiferencas(tabelaPadrao(), tabelaPadrao())).toEqual([]);
  });
});

describe('quem vê e quem edita', () => {
  it('admin, mentor e líder veem; professor e bloqueado não', () => {
    ['admin', 'mentor', 'lider', 'unidade'].forEach((r) => expect(podeVerTabelaPrecos(r)).toBe(true));
    ['professor', 'bloqueado', '', undefined].forEach((r) => expect(podeVerTabelaPrecos(r)).toBe(false));
  });
  it('só o admin edita', () => {
    expect(podeEditarTabelaPrecos('admin')).toBe(true);
    ['mentor', 'lider', 'unidade', 'professor'].forEach((r) => expect(podeEditarTabelaPrecos(r)).toBe(false));
  });
});

// TABELA DE PREÇOS DO PLANO DE CARREIRA (valor por aula, por modalidade e por pulseira).
//
// Pulseira = quantos workshops a pessoa fez (cada modalidade conta como um workshop):
//   cinza = 0 (sem workshop) · verde = 1 · vermelha = 2 · preta = 3 (e frequência mínima de alunos).
// "Acadêmicos" = aula dada no horário de estágio/trabalho (paga menos).
// Jump e Dance têm um valor para 1 aula e outro para 2 a 3 aulas seguidas (nas pulseiras cinza, verde e vermelha).
//
// Esta tabela é de CONSULTA e EDIÇÃO (só o admin edita). Ela ainda NÃO calcula o pagamento: o valor de cada aula
// continua sendo o do Cronograma (regra única em src/utils/valores.js).
//
// Onde fica: tabela_precos/atual (um documento só, lido quando a tabela é aberta; não pesa no login).
// Se o documento ainda não existe, valem os números abaixo (PADRAO), e o primeiro "Salvar" do admin o cria.
import { ehLider } from '../permissions';

export const NIVEIS = ['cinza', 'verde', 'vermelha', 'preta'];

// Ordem em que as linhas aparecem. As escondidas (visivel: false) só aparecem para o admin editando.
export const MODALIDADES_TABELA = {
  core20: { nome: 'Power Core 20', tipo: 'simples' },
  core40: { nome: 'Power Core 40', tipo: 'simples' },
  training: { nome: 'Power Training', tipo: 'simples' },
  jump: { nome: 'Energy Jump', tipo: 'seguidas' },
  dance: { nome: 'Power Dance', tipo: 'seguidas' },
  bumbum: { nome: 'Power Bumbum', tipo: 'simples' },
};
export const ORDEM = Object.keys(MODALIDADES_TABELA);

const SIMPLES = (c, v, r, p) => ({
  cinza: { qualquer: c[0], academico: c[1] },
  verde: { qualquer: v[0], academico: v[1] },
  vermelha: { qualquer: r[0], academico: r[1] },
  preta: { qualquer: p[0], academico: p[1] },
});
const SEGUIDAS = (c, v, r, p) => ({
  cinza: { umaAula: c[0], seguidas: c[1], academico: c[2] },
  verde: { umaAula: v[0], seguidas: v[1], academico: v[2] },
  vermelha: { umaAula: r[0], seguidas: r[1], academico: r[2] },
  preta: { qualquer: p[0], academico: p[1] },
});

// Valores combinados com o usuário em 2026-11-19 (imagem "Plano de Carreira - Valores Coletivas", com 2 correções:
// Jump/Dance pulseira preta = 50 e Bumbum pulseira preta = 35).
export function tabelaPadrao() {
  return {
    modalidades: {
      core20: { visivel: true },
      core40: { visivel: false }, // fora por ora; o admin liga se precisar
      training: { visivel: true },
      jump: { visivel: true },
      dance: { visivel: true },
      bumbum: { visivel: true },
    },
    precos: {
      core20: SIMPLES([10, 5], [15, 10], [20, 15], [25, 20]),
      core40: SIMPLES([20, 10], [25, 15], [30, 20], [35, 25]),
      training: SIMPLES([20, 10], [25, 15], [30, 20], [35, 25]),
      jump: SEGUIDAS([35, 30, 20], [40, 35, 25], [45, 40, 30], [50, 35]),
      dance: SEGUIDAS([35, 30, 20], [40, 35, 25], [45, 40, 30], [50, 35]),
      bumbum: SIMPLES([15, 10], [20, 15], [25, 20], [35, 25]),
    },
    // Pulseira preta: média de alunos acima destes números (regra mudada em 2026-11-19).
    frequenciaPreta: { manha: 15, noite: 25 },
  };
}

// Quais valores existem em cada célula.
export function camposDoNivel(tipo, nivel) {
  if (tipo === 'seguidas' && nivel !== 'preta') return ['umaAula', 'seguidas', 'academico'];
  return ['qualquer', 'academico'];
}

export const valorValido = (n) => Number.isFinite(n) && n >= 0 && n <= 9999;

// Junta o que está salvo com o padrão: campo que faltar ou vier estragado volta ao padrão.
export function mesclarComPadrao(salvo) {
  const base = tabelaPadrao();
  if (!salvo || typeof salvo !== 'object') return base;
  ORDEM.forEach((id) => {
    const tipo = MODALIDADES_TABELA[id].tipo;
    if (typeof salvo.modalidades?.[id]?.visivel === 'boolean') base.modalidades[id].visivel = salvo.modalidades[id].visivel;
    NIVEIS.forEach((nivel) => {
      camposDoNivel(tipo, nivel).forEach((campo) => {
        const v = Number(salvo.precos?.[id]?.[nivel]?.[campo]);
        if (salvo.precos?.[id]?.[nivel]?.[campo] != null && valorValido(v)) base.precos[id][nivel][campo] = v;
      });
    });
  });
  ['manha', 'noite'].forEach((p) => {
    const v = Number(salvo.frequenciaPreta?.[p]);
    if (salvo.frequenciaPreta?.[p] != null && valorValido(v)) base.frequenciaPreta[p] = v;
  });
  return base;
}

// A tela edita em texto (para aceitar "12,5"). Converte de volta e aponta o que está inválido.
export function paraTexto(tabela) {
  const copia = JSON.parse(JSON.stringify(tabela));
  ORDEM.forEach((id) => NIVEIS.forEach((nivel) => {
    Object.keys(copia.precos[id][nivel]).forEach((c) => { copia.precos[id][nivel][c] = String(copia.precos[id][nivel][c]); });
  }));
  Object.keys(copia.frequenciaPreta).forEach((p) => { copia.frequenciaPreta[p] = String(copia.frequenciaPreta[p]); });
  return copia;
}

export function deTexto(texto) {
  const copia = JSON.parse(JSON.stringify(texto));
  const invalidos = [];
  const num = (s, onde) => {
    const n = Number(String(s).trim().replace(',', '.'));
    if (String(s).trim() === '' || !valorValido(n)) { invalidos.push(onde); return 0; }
    return n;
  };
  ORDEM.forEach((id) => NIVEIS.forEach((nivel) => {
    Object.keys(copia.precos[id][nivel]).forEach((c) => {
      copia.precos[id][nivel][c] = num(copia.precos[id][nivel][c], `${id}.${nivel}.${c}`);
    });
  }));
  Object.keys(copia.frequenciaPreta).forEach((p) => { copia.frequenciaPreta[p] = num(copia.frequenciaPreta[p], `frequenciaPreta.${p}`); });
  return { tabela: copia, invalidos };
}

const ROTULO_NIVEL = { cinza: 'Cinza', verde: 'Verde', vermelha: 'Vermelha', preta: 'Preta' };
const ROTULO_CAMPO = { qualquer: 'Qualquer aula', academico: 'Acadêmicos', umaAula: '1 aula', seguidas: '2 a 3 aulas' };
const ROTULO_FREQ = { manha: 'Frequência preta (manhã)', noite: 'Frequência preta (noite)' };

// Lista legível do que mudou (vai para a auditoria).
export function listarDiferencas(antes, depois) {
  const lista = [];
  ORDEM.forEach((id) => {
    const nome = MODALIDADES_TABELA[id].nome;
    if (antes.modalidades[id].visivel !== depois.modalidades[id].visivel) {
      lista.push(`${nome}: ${depois.modalidades[id].visivel ? 'passou a aparecer' : 'passou a ficar escondida'}`);
    }
    NIVEIS.forEach((nivel) => {
      Object.keys(depois.precos[id][nivel]).forEach((campo) => {
        const a = antes.precos[id][nivel][campo];
        const d = depois.precos[id][nivel][campo];
        if (a !== d) lista.push(`${nome} · ${ROTULO_NIVEL[nivel]} · ${ROTULO_CAMPO[campo]}: R$ ${a} ➔ R$ ${d}`);
      });
    });
  });
  ['manha', 'noite'].forEach((p) => {
    if (antes.frequenciaPreta[p] !== depois.frequenciaPreta[p]) {
      lista.push(`${ROTULO_FREQ[p]}: ${antes.frequenciaPreta[p]} ➔ ${depois.frequenciaPreta[p]}`);
    }
  });
  return lista;
}

// Quem pode VER (professor não vê) e quem pode EDITAR (só admin).
export function podeVerTabelaPrecos(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'mentor' || ehLider(r);
}
export const podeEditarTabelaPrecos = (role) => String(role || '').trim().toLowerCase() === 'admin';

// Contas das Centrais do Mentor, do Líder e do Professor. Conta pura (sem banco e sem tela), com teste.
// Reaproveita as regras da Central da Unidade (contasUnidade.js) e do resto do sistema
// (pendências do professor: src/utils/validacoes.js — o mesmo número do selo do menu dele).
import { deduplicarValidacoes, pendenciasDoProfessor } from '../utils/validacoes';
import { valorDaValidacao } from '../utils/valores';
import { getDiaSemana, getCurrencyCode } from '../utils/formatters';
import { feriadoNoDia } from '../utils/feriados';
import {
  aulasDaUnidade, aulasNaSemana, professoresDaUnidade, itensEmDia, pendenciasDaUnidade,
} from './contasUnidade';

const texto = (v) => String(v ?? '').trim();
const soNumeros = (v) => texto(v).replace(/\D/g, '');

// ======================= MENTOR =======================
// Uma linha por unidade do mentor: grade, professores e o que falta no cadastro da unidade.
export function linhasDoMentor({ mentor, unidades = [], aulas = [], vinculos = [], professores = [], hoje }) {
  return unidades
    .filter((u) => u.mentorId && u.mentorId === mentor?.id)
    .map((unidade) => {
      const aulasVigentes = aulasDaUnidade(aulas, unidade.id, hoje);
      const profs = professoresDaUnidade({ unidadeId: unidade.id, vinculos, professores, aulas: aulasVigentes });
      const faltas = itensEmDia({ unidade, mentor, aulas: aulasVigentes, professores, pendencias: null }).filter((i) => !i.ok).length;
      return {
        unidade,
        aulasNaSemana: aulasNaSemana(aulasVigentes),
        professores: profs,
        professoresAtivos: profs.filter((p) => p.ativo).length,
        faltasCadastro: faltas,
      };
    })
    .sort((a, b) => texto(a.unidade.nome).localeCompare(texto(b.unidade.nome)));
}

// Professores das unidades do mentor, sem repetir quem dá aula em mais de uma.
export function professoresDoMentor(linhas = []) {
  const porId = new Map();
  linhas.forEach(({ unidade, professores }) => professores.forEach((p) => {
    const atual = porId.get(String(p.professor.id)) || { professor: p.professor, ativo: false, aulasNaSemana: 0, unidades: [] };
    atual.ativo = atual.ativo || p.ativo;
    atual.aulasNaSemana += p.aulasNaSemana;
    atual.unidades.push(unidade);
    porId.set(String(p.professor.id), atual);
  }));
  return [...porId.values()].sort((a, b) => texto(a.professor.nome).localeCompare(texto(b.professor.nome)));
}

// Aulas a validar (7 dias) em cada unidade: Map unidadeId -> quantidade.
export function aValidarPorUnidade({ unidades = [], aulas = [], feriados = [], validacoes = [], hoje, agoraHHMM }) {
  const porUnidade = new Map();
  unidades.forEach((unidade) => {
    const id = String(unidade.id);
    const r = pendenciasDaUnidade({
      aulas: aulas.filter((a) => String(a.unidadeId) === id && a.excluido !== true),
      unidade, feriados,
      validacoes: validacoes.filter((v) => String(v.unidadeId) === id),
      hoje, agoraHHMM,
    });
    porUnidade.set(id, r.aValidar);
  });
  return porUnidade;
}

// `aValidar` = null enquanto as validações não carregaram.
export function itensEmDiaMentor({ mentor, linhas = [], aValidar = null }) {
  const semLider = linhas.filter((l) => !l.unidade.liderUid).length;
  const aConferir = linhas.filter((l) => l.unidade.liderUid && l.unidade.liderAConferir === true).length;
  return [
    { id: 'ativo', ok: mentor?.status === 'ativo', nivel: 'erro' },
    { id: 'telefone', ok: !!texto(mentor?.telefone), nivel: 'atencao' },
    { id: 'loginGoogle', ok: mentor?.loginGoogle === true, nivel: 'atencao' },
    { id: 'unidades', ok: linhas.length > 0, nivel: 'atencao' },
    linhas.length > 0 && { id: 'semLider', ok: semLider === 0, nivel: 'erro', quantidade: semLider },
    linhas.length > 0 && { id: 'lideresAConferir', ok: aConferir === 0, nivel: 'atencao', quantidade: aConferir },
    aValidar !== null && { id: 'validacoes', ok: aValidar === 0, nivel: 'erro', quantidade: aValidar },
  ].filter(Boolean);
}

// ======================= LÍDER =======================
// O líder fica gravado dentro da unidade (liderNome, liderEmail, liderTelefone...).
export function itensEmDiaLider({ unidade, aulas = [], professores = [], pendencias = null }) {
  const profPorId = new Map(professores.map((p) => [String(p.id), p]));
  const semProfessor = aulas.filter((a) => {
    const prof = a.professorId ? profPorId.get(String(a.professorId)) : null;
    return !prof || prof.status !== 'ativo';
  }).length;
  return [
    { id: 'telefone', ok: !!texto(unidade?.liderTelefone), nivel: 'atencao' },
    { id: 'conferido', ok: unidade?.liderAConferir !== true, nivel: 'atencao' },
    { id: 'loginAntigo', ok: !(unidade?.uidLogin && !unidade.loginAntigoDesligado), nivel: 'atencao' },
    aulas.length > 0 && { id: 'aulasSemProfessor', ok: semProfessor === 0, nivel: 'erro', quantidade: semProfessor },
    pendencias && { id: 'validacoes', ok: pendencias.aValidar === 0, nivel: 'erro', quantidade: pendencias.aValidar },
  ].filter(Boolean);
}

// ======================= PROFESSOR =======================
// Unidades em que o professor tem vínculo (só as que quem está olhando enxerga).
export function unidadesDoProfessor({ professorId, vinculos = [], unidades = [] }) {
  const porId = new Map(unidades.map((u) => [String(u.id), u]));
  const vistos = new Set();
  const lista = [];
  vinculos.forEach((v) => {
    if (String(v.professorId) !== String(professorId)) return;
    const unidade = porId.get(String(v.unidadeId));
    if (!unidade || vistos.has(String(unidade.id))) return;
    vistos.add(String(unidade.id));
    lista.push({ unidade, ativo: (v.status ?? 'ativo') === 'ativo' });
  });
  return lista.sort((a, b) => texto(a.unidade.nome).localeCompare(texto(b.unidade.nome)));
}

// Aulas em que ele é o titular: fora da lixeira, não encerradas e de unidades visíveis.
export function aulasDoProfessor({ aulas = [], professorId, unidades = [], hoje }) {
  const visiveis = new Set(unidades.map((u) => String(u.id)));
  return aulas.filter((a) => String(a.professorId) === String(professorId)
    && a.excluido !== true
    && !(a.dataFim && a.dataFim < hoje)
    && visiveis.has(String(a.unidadeId)));
}

// Aulas que ELE deu no período (como titular ou substituto), só nas unidades visíveis.
// O valor é separado por moeda (real e peso nunca se somam), como na Página de Início.
export function resumoDoProfessor({ validacoes = [], inicio, fim, professorId, aulasTodas = [], unidades = [] }) {
  const aulaPorId = new Map(aulasTodas.map((a) => [String(a.id), a]));
  const unidadePorId = new Map(unidades.map((u) => [String(u.id), u]));
  let realizadas = 0;
  let alunos = 0;
  let ultimaAula = null;
  const porMoeda = {};
  deduplicarValidacoes(validacoes.filter((v) => v && v.data >= inicio && v.data <= fim)).forEach((v) => {
    if (String(v.professorId) !== String(professorId) || v.status !== 'realizada') return;
    const aula = v.aulaId ? aulaPorId.get(String(v.aulaId)) : null;
    const unidade = unidadePorId.get(String(v.unidadeId ?? aula?.unidadeId));
    if (!unidade) return;
    realizadas += 1;
    alunos += Number(v.alunos) || 0;
    if (!ultimaAula || v.data > ultimaAula) ultimaAula = v.data;
    const moeda = getCurrencyCode(unidade.pais);
    if (!porMoeda[moeda]) porMoeda[moeda] = { pais: unidade.pais, valor: 0 };
    porMoeda[moeda].valor += valorDaValidacao(v, aula);
  });
  return {
    realizadas, alunos, media: realizadas > 0 ? Math.round(alunos / realizadas) : 0, ultimaAula,
    valores: Object.values(porMoeda).sort((a, b) => b.valor - a.valor),
  };
}

// Aulas dele (titular) do dia 1 do mês até hoje que ninguém validou: o mesmo número do selo do menu do professor.
export function aValidarDoProfessor({ aulas = [], unidades = [], feriados = [], validacoes = [], professorId, hoje }) {
  return pendenciasDoProfessor({ aulas, unidades, feriados, validacoes, professorId, getDiaSemana, feriadoNoDia, hoje }).length;
}

// `aValidar` = null enquanto as validações não carregaram.
export function itensEmDiaProfessor({ professor, unidades = [], aulas = [], aValidar = null }) {
  return [
    { id: 'ativo', ok: professor?.status === 'ativo', nivel: 'erro' },
    { id: 'telefone', ok: soNumeros(professor?.telefone).length >= 10, nivel: 'atencao' },
    { id: 'email', ok: !!texto(professor?.email), nivel: 'atencao' },
    { id: 'login', ok: !!professor?.uidLogin, nivel: 'atencao' },
    { id: 'vinculo', ok: unidades.some((u) => u.ativo), nivel: 'erro' },
    { id: 'grade', ok: aulas.length > 0, nivel: 'atencao' },
    aValidar !== null && { id: 'validacoes', ok: aValidar === 0, nivel: 'erro', quantidade: aValidar },
  ].filter(Boolean);
}

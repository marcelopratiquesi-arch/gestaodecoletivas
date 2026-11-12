// Regra única de validações de aula.
//
// Cada aula da grade tem no máximo UMA validação por dia. O documento no Firestore usa um ID fixo
// "<aulaId>_<data>", então duas pessoas validando ao mesmo tempo atualizam o mesmo registro em vez de
// criar dois (o que contava a aula e o pagamento em dobro).
//
// Validações antigas foram gravadas com ID aleatório e podem estar duplicadas no banco; quem lê deve
// passar a lista por deduplicarValidacoes() antes de contar aulas, alunos ou valores.

export const idValidacao = (aulaId, data) => `${aulaId}_${data}`;

const SISTEMA_FERIADO = 'SISTEMA_FERIADO';

const segundos = (v) => {
  const ts = v?.timestamp;
  if (!ts) return 0;
  if (typeof ts.seconds === 'number') return ts.seconds;
  if (typeof ts.toMillis === 'function') return ts.toMillis() / 1000;
  return 0;
};

// Entre duas validações da mesma aula/dia: a feita por uma pessoa vence a automática de feriado;
// empatando nisso, vence a mais recente.
const vence = (nova, atual) => {
  const novaHumana = nova.validadoPor !== SISTEMA_FERIADO;
  const atualHumana = atual.validadoPor !== SISTEMA_FERIADO;
  if (novaHumana !== atualHumana) return novaHumana;
  return segundos(nova) >= segundos(atual);
};

// Aulões (isAulao) não pertencem à grade e não têm aulaId: passam direto, sem deduplicar.
export function deduplicarValidacoes(lista = []) {
  const porAulaDia = new Map();
  const avulsas = [];
  for (const v of lista) {
    if (!v || v.isAulao || !v.aulaId || !v.data) { avulsas.push(v); continue; }
    const chave = idValidacao(v.aulaId, v.data);
    const atual = porAulaDia.get(chave);
    if (!atual || vence(v, atual)) porAulaDia.set(chave, v);
  }
  return [...porAulaDia.values(), ...avulsas];
}

// ============================================================================
// PRAZO PARA VALIDAR / EDITAR / CANCELAR (mesma regra do firestore.rules)
// - Professor: só aulas do MÊS ATUAL (até hoje). Virou o mês, o que ficou para trás ficou.
// - Líder (perfil "lider", ou o antigo "unidade"): até 60 dias para trás; mexer em mês já fechado exige justificativa.
// - Mentor / admin: sem limite de dias; mexer em mês já fechado exige justificativa.
// Ninguém valida aula de data futura.
// ============================================================================
export const LIMITE_ALUNOS = 150;          // teto de alunos numa aula da grade
export const DIAS_RETROATIVOS_LIDER = 60;
export const MIN_JUSTIFICATIVA = 10;       // caracteres mínimos da justificativa

// Data/mês no fuso do aparelho (não em UTC: à noite o toISOString já "pula" para o dia seguinte).
export const dataLocal = (d = new Date()) => d.toLocaleDateString('en-CA');
export const hojeLocal = () => dataLocal();
export const mesLocal = () => hojeLocal().slice(0, 7);

const somarDias = (dataStr, dias) => {
  const d = new Date(`${dataStr}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
};

const papelNormalizado = (role) => {
  const r = String(role || '').trim().toLowerCase();
  if (['admin', 'administrador', 'master'].includes(r)) return 'admin';
  if (r === 'unidade') return 'lider'; // perfil antigo, vale igual ao líder durante a transição
  return r;
};

// Retorna { pode, motivo, precisaJustificativa }.
// motivo: 'futuro' | 'mesFechado' | 'limiteDias' | 'semPermissao' | null
export function regraDePrazo(role, data, hoje = hojeLocal()) {
  const papel = papelNormalizado(role);
  if (!data) return { pode: false, motivo: 'semPermissao', precisaJustificativa: false };
  if (data > hoje) return { pode: false, motivo: 'futuro', precisaJustificativa: false };

  const mesFechado = data.slice(0, 7) < hoje.slice(0, 7);

  if (papel === 'professor') {
    return mesFechado
      ? { pode: false, motivo: 'mesFechado', precisaJustificativa: false }
      : { pode: true, motivo: null, precisaJustificativa: false };
  }
  if (papel === 'lider') {
    if (data < somarDias(hoje, -DIAS_RETROATIVOS_LIDER)) return { pode: false, motivo: 'limiteDias', precisaJustificativa: false };
    return { pode: true, motivo: null, precisaJustificativa: mesFechado };
  }
  if (papel === 'admin' || papel === 'mentor') {
    return { pode: true, motivo: null, precisaJustificativa: mesFechado };
  }
  return { pode: false, motivo: 'semPermissao', precisaJustificativa: false };
}

// Número de alunos válido para uma aula da grade: inteiro entre 0 e LIMITE_ALUNOS.
export function alunosValidos(valor, limite = LIMITE_ALUNOS) {
  const texto = String(valor ?? '').trim();
  if (!/^\d+$/.test(texto)) return false;
  const n = parseInt(texto, 10);
  return n >= 0 && n <= limite;
}

// ============================================================================
// PENDÊNCIAS DO PROFESSOR (usado no selo do menu e no aviso da Validação Diária)
// Conta as aulas em que ele é o TITULAR, do 1º dia do mês até hoje, que ninguém validou
// nem cancelou (inclusive por substituição) e que não caem em feriado.
// ============================================================================
export function pendenciasDoProfessor({ aulas = [], unidades = [], feriados = [], validacoes = [], professorId, getDiaSemana, feriadoNoDia, hoje = hojeLocal() }) {
  if (!professorId) return [];
  const feitas = new Set(validacoes.filter(v => v && v.aulaId && v.data).map(v => idValidacao(v.aulaId, v.data)));
  const unidadesPorId = new Map(unidades.map(u => [String(u.id), u]));
  const minhasAulas = aulas.filter(a => String(a.professorId) === String(professorId) && a.excluido !== true);
  const pendentes = [];

  let dia = `${hoje.slice(0, 7)}-01`;
  while (dia <= hoje) {
    const diaSemana = getDiaSemana(new Date(`${dia}T12:00:00`));
    for (const aula of minhasAulas) {
      if (!aula.dias?.includes(diaSemana)) continue;
      if (aula.dataInicio && dia < aula.dataInicio) continue;
      if (aula.dataFim && dia > aula.dataFim) continue;
      const unidade = unidadesPorId.get(String(aula.unidadeId));
      if (!unidade) continue;
      if (feitas.has(idValidacao(aula.id, dia))) continue;
      if (feriadoNoDia(dia, unidade, feriados)) continue;
      pendentes.push({ aulaId: aula.id, data: dia });
    }
    dia = somarDias(dia, 1);
  }
  return pendentes;
}

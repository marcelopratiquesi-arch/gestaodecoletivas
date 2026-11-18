// Regras do Cronograma que não dependem da tela (para poder testar sem navegador).
// Datas sempre "AAAA-MM-DD".

const somarUmDia = (dataStr, n) => {
  const d = new Date(`${dataStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

export const diaAnterior = (dataStr) => somarUmDia(dataStr, -1);
export const diaSeguinte = (dataStr) => somarUmDia(dataStr, 1);

// Valor da aula é obrigatório e maior que zero (o valor vazio virava R$ 0 sem ninguém perceber).
export const valorDaAulaValido = (valor) => {
  const n = parseFloat(valor);
  return Number.isFinite(n) && n > 0;
};

// Duas vigências [inicio, fim] se cruzam? Fim vazio = sem limite.
const vigenciasSeCruzam = (a, b) => {
  const fimA = a.dataFim || '9999-12-31';
  const fimB = b.dataFim || '9999-12-31';
  const iniA = a.dataInicio || '0000-01-01';
  const iniB = b.dataInicio || '0000-01-01';
  return iniA <= fimB && iniB <= fimA;
};

/**
 * Aula igual a uma que já existe: mesma unidade, modalidade, professor, horário,
 * ao menos um dia da semana em comum e vigências que se cruzam (pagaria a mesma aula duas vezes).
 * @param {object[]} aulas  aulas já cadastradas (as excluídas são ignoradas)
 * @param {object} nova     { unidadeId, modalidadeId, professorId, hora, dias, dataInicio, dataFim }
 * @param {string} [ignorarId] a própria aula que está sendo editada
 */
export function aulaRepetida(aulas, nova, ignorarId = null) {
  return (aulas || []).filter(a =>
    a && a.excluido !== true && String(a.id) !== String(ignorarId)
    && String(a.unidadeId) === String(nova.unidadeId)
    && String(a.modalidadeId) === String(nova.modalidadeId)
    && String(a.professorId) === String(nova.professorId)
    && String(a.hora) === String(nova.hora)
    && (a.dias || []).some(d => (nova.dias || []).includes(d))
    && vigenciasSeCruzam(a, nova)
  );
}

/**
 * Valida a data em que a "nova fase" começa a valer.
 * O passado é permitido (esqueceu de ajustar na hora), mas não pode deixar validação já feita
 * da aula antiga fora da vigência dela (o relatório esconderia essa aula e o pagamento sumiria).
 * @param {object} p
 * @param {string} p.corte            dia em que a nova configuração passa a valer
 * @param {object} p.aulaAntiga       { dataInicio, dataFim }
 * @param {string[]} p.datasValidadas datas já validadas da aula antiga (sem cancelamento automático de feriado)
 * @returns {{ok: true} | {ok: false, motivo: 'sem_corte'|'antes_do_inicio'|'depois_do_fim'|'validacao_depois', minimo?: string, datas?: string[]}}
 */
export function validarCorteNovaFase({ corte, aulaAntiga, datasValidadas = [] }) {
  if (!corte) return { ok: false, motivo: 'sem_corte' };
  if (aulaAntiga?.dataInicio && corte <= aulaAntiga.dataInicio) {
    return { ok: false, motivo: 'antes_do_inicio', minimo: diaSeguinte(aulaAntiga.dataInicio) };
  }
  if (aulaAntiga?.dataFim && corte > aulaAntiga.dataFim) {
    return { ok: false, motivo: 'depois_do_fim' };
  }
  const depois = [...new Set(datasValidadas.filter(d => d >= corte))].sort();
  if (depois.length > 0) {
    return { ok: false, motivo: 'validacao_depois', datas: depois, minimo: diaSeguinte(depois[depois.length - 1]) };
  }
  return { ok: true };
}

// Professor inativo não recebe aula nova (ficha sem status conta como ativa, como nas fichas antigas).
export const professorPodeReceberAula = (professor) => !!professor && (professor.status || 'ativo') !== 'inativo';

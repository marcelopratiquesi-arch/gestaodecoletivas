// Montagem do feriado a partir do formulário e a partir de uma PROPOSTA de mentor (aprovada pelo admin).
// Proposta fica em feriados_propostas e não afeta nenhuma aula; só vira feriado quando o admin aprova.

// Só grava os campos que fazem sentido para a abrangência escolhida.
export function montarFeriado(form) {
  const base = { nome: String(form.nome || '').trim(), dataInicio: form.dataInicio, dataFim: form.dataFim, tipo: form.tipo, escopo: form.escopo };
  if (form.escopo === 'pais') return { ...base, pais: form.pais };
  if (form.escopo === 'estado') return { ...base, estado: form.estado };
  if (form.escopo === 'cidade') return { ...base, cidade: String(form.cidade || '').trim(), unidadeIds: form.unidadeIds || [] };
  if (form.escopo === 'unidades') return { ...base, unidadeIds: form.unidadeIds || [] };
  return base;
}

// Escopos que o mentor pode propor: só onde ele escolhe as unidades dele.
export const ESCOPOS_DO_MENTOR = ['cidade', 'unidades'];

// Proposta aprovada vira feriado: mesmos campos, mais quem propôs e de onde veio.
export function feriadoDaProposta(proposta) {
  const feriado = montarFeriado(proposta);
  return { ...feriado, propostoPor: proposta.propostoPor || null, origemProposta: proposta.id || null };
}

export const STATUS_PROPOSTA = { PENDENTE: 'pendente', APROVADA: 'aprovada', RECUSADA: 'recusada' };

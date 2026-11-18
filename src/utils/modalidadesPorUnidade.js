// Modalidades habilitadas por unidade (campo "modalidadesIds" no documento da unidade).
// Funções puras, sem Firebase. Testes: tests/unit/modalidadesPorUnidade.test.js

// Unidade sem o campo = ainda não migrada: vale "todas as modalidades" (nada muda para ela).
export const unidadeTemVinculo = (unidade) => Array.isArray(unidade?.modalidadesIds);

export const idsHabilitados = (unidade) =>
  unidadeTemVinculo(unidade) ? unidade.modalidadesIds.map(String) : [];

export const modalidadeHabilitada = (unidade, modalidadeId) =>
  !unidadeTemVinculo(unidade) || idsHabilitados(unidade).includes(String(modalidadeId));

// Situação de uma aula numa data: 'excluida' | 'historica' | 'futura' | 'ativa'.
// (mesma regra da auditoria: sem dataFim, ou dataFim de hoje em diante, e já iniciada = ativa)
export function situacaoVigencia(aula, hoje) {
  if (aula?.excluido === true) return 'excluida';
  const fim = typeof aula?.dataFim === 'string' ? aula.dataFim : null;
  const ini = typeof aula?.dataInicio === 'string' ? aula.dataInicio : null;
  if (fim && fim < hoje) return 'historica';
  if (ini && ini > hoje) return 'futura';
  return 'ativa';
}

// Quantas aulas ativas e futuras a unidade tem em cada modalidade: { [modalidadeId]: { ativas, futuras } }
export function contarAulasPorModalidade(aulas, unidadeId, hoje) {
  const r = {};
  for (const a of aulas || []) {
    if (String(a.unidadeId) !== String(unidadeId) || !a.modalidadeId) continue;
    const s = situacaoVigencia(a, hoje);
    if (s !== 'ativa' && s !== 'futura') continue;
    const c = (r[a.modalidadeId] ??= { ativas: 0, futuras: 0 });
    if (s === 'ativa') c.ativas++; else c.futuras++;
  }
  return r;
}

// Desativar só é permitido sem aula ativa ou futura naquela modalidade.
export function podeDesativar(contagens, modalidadeId) {
  const c = contagens?.[modalidadeId];
  return !c || (c.ativas === 0 && c.futuras === 0);
}

// Modalidade do catálogo está em uso? (alguma unidade a habilita ou alguma aula não excluída a usa)
export function modalidadeEmUso(modalidadeId, unidades, aulas) {
  const id = String(modalidadeId);
  const emUnidade = (unidades || []).some((u) => idsHabilitados(u).includes(id));
  const emAula = (aulas || []).some((a) => String(a.modalidadeId) === id && a.excluido !== true);
  return { emUnidade, emAula, emUso: emUnidade || emAula };
}

// Ids novos da lista após ativar/desativar (sem duplicar, mantém a ordem).
export const comModalidade = (ids, modalidadeId) => {
  const id = String(modalidadeId);
  const base = (ids || []).map(String);
  return base.includes(id) ? base : [...base, id];
};
export const semModalidade = (ids, modalidadeId) => (ids || []).map(String).filter((x) => x !== String(modalidadeId));

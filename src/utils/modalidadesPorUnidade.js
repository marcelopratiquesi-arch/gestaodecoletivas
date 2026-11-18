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

// Plano da configuração em massa (nada é gravado aqui). Só entram unidades que AINDA NÃO têm o campo.
// - ids = modalidades com aula ativa ou futura na unidade (e que existem no catálogo);
// - unidade sem nenhuma aula ativa/futura recebe as básicas da rede (se a lista básica existir; senão fica de fora);
// - modalidade que a aula usa mas não existe no catálogo vira "divergência" (não entra, só é relatada).
export function planejarConfiguracaoEmMassa({ unidades, aulas, modalidades, basicasIds, hoje }) {
  const noCatalogo = new Set((modalidades || []).map((m) => String(m.id)));
  const basicas = (basicasIds || []).map(String).filter((id) => noCatalogo.has(id));
  const itens = [];
  const jaConfiguradas = [];
  const semBasicas = [];
  const divergencias = [];
  for (const u of unidades || []) {
    if (unidadeTemVinculo(u)) { jaConfiguradas.push(u); continue; }
    const cont = contarAulasPorModalidade(aulas, u.id, hoje);
    const usadas = Object.keys(cont);
    const ids = usadas.filter((id) => noCatalogo.has(String(id)));
    usadas.filter((id) => !noCatalogo.has(String(id))).forEach((id) => divergencias.push({ unidade: u, modalidadeId: id }));
    if (ids.length > 0) itens.push({ unidade: u, ids, origem: 'aulas' });
    else if (basicas.length > 0) itens.push({ unidade: u, ids: basicas, origem: 'basicas' });
    else semBasicas.push(u);
  }
  return { itens, jaConfiguradas, semBasicas, divergencias };
}

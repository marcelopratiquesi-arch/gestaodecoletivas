// "Quem fez / quem falta": cruza os professores ATIVOS com o que cada um já fez (professores/{id}.workshops).
// Zero leituras: usa só o catálogo já carregado. A mesma pessoa em várias unidades conta uma vez (agrupa pelo nome).
import { grupoDaModalidade } from './pulseira.js';
import { normalizarNome } from './repetidos.js';

const idDoItem = (w) => String(w?.workshopId || (String(w?.id || '').startsWith('wk_') ? String(w.id).slice(3) : ''));

/**
 * @param professores fichas do catálogo (com .workshops, .unidadeId, .status)
 * @param cadastro workshops de workshops_cadastro ({ id, modalidade })
 * @param alvo { workshopId } para um workshop específico, ou { grupo } (jump, dance, training, core, bumbum, fight)
 * @returns linhas { chave, nome, unidadeIds[], fez, data } — uma por pessoa, só professores ativos
 */
export function quemFezWorkshop(professores, cadastro, alvo) {
  const modalidadePorId = new Map((cadastro || []).map((w) => [String(w.id), w.modalidade]));
  const bate = (w) => {
    if (alvo?.workshopId) return idDoItem(w) === String(alvo.workshopId);
    if (!alvo?.grupo) return false;
    const modalidade = w?.modalidade || modalidadePorId.get(idDoItem(w));
    const g = grupoDaModalidade(modalidade) || (modalidade ? null : grupoDaModalidade(w?.nome));
    return g === alvo.grupo;
  };
  const pessoas = new Map();
  (professores || []).forEach((p) => {
    if (p.status !== 'ativo') return;
    const chave = normalizarNome(p.nome);
    if (!chave) return;
    const linha = pessoas.get(chave) || { chave, nome: p.nome, unidadeIds: [], fez: false, data: '' };
    if (p.unidadeId && !linha.unidadeIds.includes(String(p.unidadeId))) linha.unidadeIds.push(String(p.unidadeId));
    (Array.isArray(p.workshops) ? p.workshops : []).filter(bate).forEach((w) => {
      linha.fez = true;
      if (String(w.data || '') > linha.data) linha.data = String(w.data || '');
    });
    pessoas.set(chave, linha);
  });
  return [...pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

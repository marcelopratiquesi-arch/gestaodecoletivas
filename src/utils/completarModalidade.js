// Completa a MODALIDADE dos workshops que já estão nos professores (professores/{id}.workshops), para a pulseira
// (src/utils/pulseira.js). Itens novos já nascem com a modalidade; este plano cuida dos antigos, que só têm nome e data.
// Ordem de confiança: 1) o próprio item; 2) o workshop do cadastro (workshopId, ou "wk_{id}"); 3) pelo nome (palpite).
import { grupoDaModalidade } from './pulseira.js';

export const NOME_POR_GRUPO = {
  jump: 'Jump', dance: 'Power Dance', training: 'Power Training', core: 'Power Core', bumbum: 'Power Bumbum', fight: 'Power Fight',
};

/**
 * @param professores fichas com .workshops
 * @param cadastro workshops de workshops_cadastro ({ id, modalidade })
 * @returns {{ gravar: {professorId, workshops}[], porCadastro: number, porNome: number, semResposta: {professor, item}[] }}
 */
export function planejarCompletarModalidade(professores, cadastro) {
  const modalidadePorId = new Map((cadastro || []).map((w) => [String(w.id), w.modalidade]));
  const gravar = [];
  const semResposta = [];
  let porCadastro = 0;
  let porNome = 0;
  (professores || []).forEach((p) => {
    if (!Array.isArray(p.workshops) || p.workshops.length === 0) return;
    let mudou = false;
    const novos = p.workshops.map((w) => {
      if (grupoDaModalidade(w?.modalidade)) return w;
      const idCadastro = String(w?.workshopId || (String(w?.id || '').startsWith('wk_') ? String(w.id).slice(3) : ''));
      const doCadastro = idCadastro ? modalidadePorId.get(idCadastro) : null;
      if (grupoDaModalidade(doCadastro)) { mudou = true; porCadastro += 1; return { ...w, modalidade: doCadastro }; }
      const palpite = NOME_POR_GRUPO[grupoDaModalidade(w?.nome)];
      if (palpite) { mudou = true; porNome += 1; return { ...w, modalidade: palpite }; }
      semResposta.push({ professor: p, item: w });
      return w;
    });
    if (mudou) gravar.push({ professorId: String(p.id), workshops: novos });
  });
  return { gravar, porCadastro, porNome, semResposta };
}

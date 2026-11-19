// Cadastro de workshops (coleção workshops_cadastro). Regras de validação e formatação, sem tocar no banco.
// As mesmas listas estão em firestore.rules (workshopCadastroOk): se mudar aqui, mude lá.

export const MODALIDADES_WORKSHOP = ['Jump', 'Power Dance', 'Power Training', 'Energy Jump', 'Power Core', 'Power Fight', 'Power Bumbum'];
export const STATUS_WORKSHOP = ['agendado', 'realizado', 'cancelado'];

/** "2023-07-01" -> "01/07/2023" (vazio se a data não for válida). */
export const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');

/** true para uma data AAAA-MM-DD que existe no calendário (e não 2023-02-31). */
export function dataValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
  const [a, m, d] = iso.split('-').map(Number);
  if (a < 1990 || a > 2100) return false;
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Mesma chave para achar workshop repetido: nome sem acento/caixa/espaço sobrando + data. */
export const chaveWorkshop = (nome, data) =>
  `${String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()}|${data || ''}`;

/**
 * Confere os dados de um workshop. Devolve a lista de erros (códigos, traduzidos pela tela).
 * `d` = { nome, modalidade, data, local, status }.
 */
export function errosDoWorkshop(d) {
  const erros = [];
  const nome = String(d?.nome || '').trim();
  if (nome.length < 3) erros.push('nome');
  if (nome.length > 150) erros.push('nomeLongo');
  if (!MODALIDADES_WORKSHOP.includes(d?.modalidade)) erros.push('modalidade');
  if (!dataValida(d?.data)) erros.push('data');
  if (!STATUS_WORKSHOP.includes(d?.status)) erros.push('status');
  if (String(d?.local || '').length > 150) erros.push('localLongo');
  return erros;
}

/** Monta o documento a gravar (só os campos conhecidos, textos aparados; titular só se houver). */
export function montarWorkshop(d) {
  const out = {
    nome: String(d.nome).trim(),
    modalidade: d.modalidade,
    data: d.data,
    local: String(d.local || '').trim(),
    status: d.status,
  };
  const titularNome = String(d.titularNome || '').trim();
  if (titularNome) out.titularNome = titularNome;
  if (titularNome && d.titularProfessorId) out.titularProfessorId = String(d.titularProfessorId);
  return out;
}

/** Ordem da lista: data mais nova primeiro; empate pelo nome. */
export const ordenarWorkshops = (lista) =>
  [...lista].sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

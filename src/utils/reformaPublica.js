// Reforma na PÁGINA PÚBLICA de horários (/horarios). A página abre sem login e não lê a coleção de feriados, então as
// reformas vão para a vitrine (publico/vitrine.reformas) e a página decide pela data de hoje o que mostrar.
// Funções puras, com teste (tests/unit/reformaPublica.test.js).
//
//   vitrine.reformas = { [idDoFeriado]: { unidadeIds: ["..."], ini: "AAAA-MM-DD", fim: "AAAA-MM-DD" } }
//
// A página só mostra: "fechada para reforma" (hoje está dentro do período) ou "reforma programada" (começa em até
// DIAS_DE_AVISO dias). Reforma que já terminou some sozinha. O motivo ("Reforma do piso") não vai para a vitrine.

export const DIAS_DE_AVISO = 30;

/** O que vai para a vitrine a partir do feriado do tipo Reforma. */
export const dadosPublicosReforma = (feriado) => ({
  unidadeIds: (feriado?.unidadeIds || []).map(String),
  ini: String(feriado?.dataInicio || '').slice(0, 10),
  fim: String(feriado?.dataFim || feriado?.dataInicio || '').slice(0, 10),
});

const somarDias = (dataAAAAMMDD, dias) => {
  const d = new Date(`${dataAAAAMMDD}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * @param {Record<string,{unidadeIds:string[],ini:string,fim:string}>} reformas vitrine.reformas
 * @param {string} unidadeId
 * @param {string} hoje "AAAA-MM-DD" (relógio do aparelho)
 * @returns {{ estado: 'agora'|'em-breve', ini: string, fim: string, retorno: string } | null}
 *   `retorno` = primeiro dia depois da reforma (quando as aulas voltam).
 *   Várias reformas: a que está valendo hoje; se nenhuma, a que começa primeiro.
 */
export function reformaPublicaDaUnidade(reformas, unidadeId, hoje) {
  const limite = somarDias(hoje, DIAS_DE_AVISO);
  const dela = Object.values(reformas || {})
    .filter((r) => r && Array.isArray(r.unidadeIds) && r.unidadeIds.map(String).includes(String(unidadeId)) && r.ini && r.fim && r.fim >= r.ini)
    .map((r) => ({ ...r, retorno: somarDias(r.fim, 1) }));
  const agora = dela.filter((r) => r.ini <= hoje && hoje <= r.fim).sort((a, b) => b.fim.localeCompare(a.fim))[0];
  if (agora) return { estado: 'agora', ini: agora.ini, fim: agora.fim, retorno: agora.retorno };
  const breve = dela.filter((r) => r.ini > hoje && r.ini <= limite).sort((a, b) => a.ini.localeCompare(b.ini))[0];
  return breve ? { estado: 'em-breve', ini: breve.ini, fim: breve.fim, retorno: breve.retorno } : null;
}

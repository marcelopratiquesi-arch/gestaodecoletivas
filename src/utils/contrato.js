// CONTRATO DO PROFESSOR: CLT (padrão) ou Saver (acadêmico/estagiário do salão de musculação).
// Saver: em cada unidade onde é Saver, tem os dias e horários de trabalho; só nesses horários, nessas unidades, vale o valor
// de "acadêmico" (ver src/utils/pulseira.js). Fora disso, vale o valor normal.
//   tipoContrato: 'clt' | 'saver'
//   saverLocais: [{ unidadeId, horarios: [{ dia: 0-6 (0 = domingo), ini: 'HH:MM', fim: 'HH:MM' }] }]
// Guardado: no pedido de acesso e no crachá (o que o professor informou) e na ficha professores/{id} (o que vale para o pagamento).
export const TIPOS_CONTRATO = ['clt', 'saver'];
export const MAX_LOCAIS = 5;
export const MAX_HORARIOS = 14;

export const contratoVazio = () => ({ tipoContrato: 'clt', saverLocais: [] });
export const horarioVazio = () => ({ dia: 1, ini: '06:00', fim: '10:00' });
export const localVazio = (unidadeId = '') => ({ unidadeId, horarios: [horarioVazio()] });

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Confere e limpa. Devolve { ok: true, valor } ou { ok: false, erro } (erro = chave de texto: unit, sameUnit, hours, hour, tooMany). */
export function validarContrato(entrada) {
  const tipo = String(entrada?.tipoContrato || 'clt').toLowerCase();
  if (!TIPOS_CONTRATO.includes(tipo)) return { ok: false, erro: 'type' };
  if (tipo === 'clt') return { ok: true, valor: contratoVazio() };
  const locais = Array.isArray(entrada?.saverLocais) ? entrada.saverLocais : [];
  if (locais.length === 0) return { ok: false, erro: 'unit' };
  if (locais.length > MAX_LOCAIS) return { ok: false, erro: 'tooMany' };
  const vistas = new Set();
  const limpos = [];
  for (const l of locais) {
    const unidadeId = String(l?.unidadeId ?? '').trim();
    if (!unidadeId) return { ok: false, erro: 'unit' };
    if (vistas.has(unidadeId)) return { ok: false, erro: 'sameUnit' };
    vistas.add(unidadeId);
    const horarios = Array.isArray(l?.horarios) ? l.horarios : [];
    if (horarios.length === 0) return { ok: false, erro: 'hours' };
    if (horarios.length > MAX_HORARIOS) return { ok: false, erro: 'tooMany' };
    const hs = [];
    for (const h of horarios) {
      const dia = Number(h?.dia);
      if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !HORA.test(String(h?.ini)) || !HORA.test(String(h?.fim)) || String(h.fim) <= String(h.ini)) {
        return { ok: false, erro: 'hour' };
      }
      hs.push({ dia, ini: String(h.ini), fim: String(h.fim) });
    }
    limpos.push({ unidadeId, horarios: hs });
  }
  return { ok: true, valor: { tipoContrato: 'saver', saverLocais: limpos } };
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Texto curto para listas e auditoria: "CLT" ou "Saver: Santa Inês (seg 06:00-10:00, qua 06:00-10:00); ...". */
export function resumoContrato(c, nomeDaUnidade = (id) => id) {
  if (String(c?.tipoContrato || '').toLowerCase() !== 'saver') return 'CLT';
  const partes = (c.saverLocais || []).map((l) => `${nomeDaUnidade(l.unidadeId)} (${(l.horarios || []).map((h) => `${DIAS[h.dia] ?? h.dia} ${h.ini}-${h.fim}`).join(', ')})`);
  return `Saver: ${partes.join('; ')}`;
}

/** Duas respostas iguais (para a auditoria só anotar o que mudou). */
export const mesmoContrato = (a, b) => JSON.stringify(validarContrato(a).valor || a || null) === JSON.stringify(validarContrato(b).valor || b || null);

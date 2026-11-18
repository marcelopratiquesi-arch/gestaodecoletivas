// Texto das aulas que faltam validar, usado nas mensagens de cobrança da Validação Coletiva.
// "17/11 (19:00, 20:00), 18/11 (19:00)": diz também o HORÁRIO da aula que falta, não só o dia.
import { formatDate } from './formatters';
import { dataLocalStr } from './agendaAulas';

export const formatPendencias = (pendencias = []) => {
  const hoje = dataLocalStr();
  const porDia = new Map();
  pendencias.filter(p => p.data && p.data <= hoje).forEach(p => {
    if (!porDia.has(p.data)) porDia.set(p.data, []);
    if (p.info) porDia.get(p.data).push(String(p.info).slice(0, 5));
  });
  return [...porDia.keys()].sort().map(d => {
    const horas = [...new Set(porDia.get(d))].sort();
    const dia = formatDate(d, 'dayMonth');
    return horas.length ? `${dia} (${horas.join(', ')})` : dia;
  }).join(', ');
};

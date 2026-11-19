// Líder temporário: contas de prazo, todas no calendário de Brasília (sem horário de verão desde 2019, UTC-3).
// O prazo conta o dia de hoje como dia 1 e vale até 23:59:59 do último dia.
// O banco recusa o crachá depois de "temporarioAte" (firestore.rules, crachaAtivo); aqui é só a conta para mostrar e avisar.
import { paraData } from "./ultimoAcesso";

const FUSO = "America/Sao_Paulo";
const MS_DIA = 86400000;

export const DIAS_MAXIMOS = 60; // prazo máximo de um convite (o banco aceita até 61 por causa do fim do dia)
export const ATALHOS_DIAS = [7, 15, 30, 60];

// "AAAA-MM-DD" do dia de Brasília em que `agora` cai.
export function hojeBrasilia(agora = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(agora));
}

export function somarDias(iso, dias) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Fim do dia (23:59:59 de Brasília) de uma data "AAAA-MM-DD".
export function fimDoDia(iso) {
  return new Date(`${iso}T23:59:59-03:00`);
}

// Prazo de N dias: hoje é o dia 1.
export function fimPorDias(dias, agora = Date.now()) {
  return fimDoDia(somarDias(hojeBrasilia(agora), Math.max(1, dias) - 1));
}

// Quantos dias faltam no calendário (0 = último dia, termina hoje 23:59). Negativo = já venceu.
export function diasRestantes(fim, agora = Date.now()) {
  const d = paraData(fim);
  if (!d) return null;
  if (agora > d.getTime()) return -1;
  const hoje = Date.parse(`${hojeBrasilia(agora)}T00:00:00Z`);
  const ultimo = Date.parse(`${hojeBrasilia(d.getTime())}T00:00:00Z`);
  return Math.round((ultimo - hoje) / MS_DIA);
}

// Quantos dias tem o prazo todo, contando o primeiro (para mostrar "30 dias").
export function diasDoPrazo(desde, fim) {
  const a = paraData(desde);
  const b = paraData(fim);
  if (!a || !b) return null;
  const inicio = Date.parse(`${hojeBrasilia(a.getTime())}T00:00:00Z`);
  const ultimo = Date.parse(`${hojeBrasilia(b.getTime())}T00:00:00Z`);
  return Math.max(1, Math.round((ultimo - inicio) / MS_DIA) + 1);
}

// Avisos: faltando 7, 3 e 1 dia (e no último dia) o aviso fica cada vez mais forte.
export function nivelDoAviso(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 0) return "vencido";
  if (dias <= 1) return "urgente";
  if (dias <= 3) return "alto";
  if (dias <= 7) return "atencao";
  return null;
}

export function fimDoTemporario(cracha) {
  return paraData(cracha?.temporarioAte);
}
export const ehTemporario = (cracha) => !!fimDoTemporario(cracha);
export function temporarioVencido(cracha, agora = Date.now()) {
  const fim = fimDoTemporario(cracha);
  return !!fim && fim.getTime() <= agora;
}

// Texto "30/11/2026" do último dia.
export function diaDoFim(fim, idioma = "pt-BR") {
  const d = paraData(fim);
  return d ? d.toLocaleDateString(idioma, { timeZone: FUSO }) : "";
}

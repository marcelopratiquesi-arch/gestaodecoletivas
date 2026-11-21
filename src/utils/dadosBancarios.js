// Banco Inter do professor (agência e conta). Funções puras, com teste (tests/unit/dadosBancarios.test.js).
// Só professor do Brasil. O número fica numa gaveta privada (services/dadosBancariosService.js).

export const BANCO_INTER = "inter";
export const NOME_BANCO = "Banco Inter";

export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Agência: de 3 a 5 números (a do Inter costuma ser 0001). */
export const agenciaValida = (agencia) => /^\d{3,5}$/.test(soDigitos(agencia));

/** Conta com dígito: de 4 a 15 números, escritos com ou sem hífen (ex.: 1234567-8). */
export const contaValida = (conta) => /^\d{4,15}$/.test(soDigitos(conta));

/** "12345678" → "1234567-8" (o último número é o dígito). Curto demais fica como está. */
export function formatarConta(conta) {
  const d = soDigitos(conta).slice(0, 15);
  return d.length > 1 ? `${d.slice(0, -1)}-${d.slice(-1)}` : d;
}

export const formatarAgencia = (agencia) => soDigitos(agencia).slice(0, 5);

/** O banco do professor só existe para quem trabalha no Brasil. */
export const professorTemBancoInter = (pais) => String(pais || "BR").toUpperCase() === "BR";

/** Valida o que a pessoa digitou. Devolve { ok: true, valor: {agencia, conta} } ou { ok: false, erro: "agency" | "account" }. */
export function validarDadosBancarios({ agencia, conta }) {
  if (!agenciaValida(agencia)) return { ok: false, erro: "agency" };
  if (!contaValida(conta)) return { ok: false, erro: "account" };
  return { ok: true, valor: { agencia: soDigitos(agencia), conta: soDigitos(conta) } };
}

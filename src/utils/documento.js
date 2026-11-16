// Documento de identificação oficial de cada país: CPF (Brasil), DNI (Argentina) e SSN (Estados Unidos).
// Guardamos só os números. Aqui ficam a limpeza, a conferência dos dígitos e a formatação.
// (O banco só confere o formato; os dígitos verificadores são conferidos aqui, na tela.)

export const TIPOS_DOCUMENTO = ["cpf", "dni", "ssn"];

const soNumeros = (v) => String(v ?? "").replace(/\D/g, "");

// CPF: 11 dígitos, não pode ser sequência repetida, e os 2 últimos são dígitos verificadores.
function cpfValido(n) {
  if (!/^\d{11}$/.test(n) || /^(\d)\1{10}$/.test(n)) return false;
  const digito = (qtd) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(n[i]) * (qtd + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(n[9]) && digito(10) === Number(n[10]);
}

// DNI argentino: 7 ou 8 números (não existe dígito verificador).
function dniValido(n) {
  return /^\d{7,8}$/.test(n) && Number(n) >= 1000000 && !/^(\d)\1+$/.test(n);
}

// SSN americano: 9 números; área ≠ 000, 666 e 9xx; grupo ≠ 00; série ≠ 0000.
function ssnValido(n) {
  if (!/^\d{9}$/.test(n)) return false;
  const area = n.slice(0, 3), grupo = n.slice(3, 5), serie = n.slice(5);
  return area !== "000" && area !== "666" && area[0] !== "9" && grupo !== "00" && serie !== "0000";
}

const VALIDADORES = { cpf: cpfValido, dni: dniValido, ssn: ssnValido };

/** Tira pontos, traços e espaços: só os números. */
export const limparDocumento = soNumeros;

/** O número é válido para esse tipo de documento? (aceita com ou sem pontuação) */
export function documentoValido(tipo, valor) {
  const validar = VALIDADORES[tipo];
  return !!validar && validar(soNumeros(valor));
}

/** Mostra com a pontuação do país (123.456.789-09 / 12.345.678 / 123-45-6789). */
export function formatarDocumento(tipo, valor) {
  const n = soNumeros(valor);
  if (tipo === "cpf") {
    return n.slice(0, 11).replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, d) => a + (b ? "." + b : "") + (c ? "." + c : "") + (d ? "-" + d : ""));
  }
  if (tipo === "ssn") {
    return n.slice(0, 9).replace(/^(\d{3})(\d{0,2})(\d{0,4}).*/, (_, a, b, c) => a + (b ? "-" + b : "") + (c ? "-" + c : ""));
  }
  const m = n.slice(0, 8);
  return m.length > 5 ? `${m.slice(0, m.length - 6)}.${m.slice(-6, -3)}.${m.slice(-3)}` : m;
}

/** Tipo sugerido pelo idioma da tela (pt-BR → CPF, es-AR → DNI, en-US → SSN). */
export function tipoDocumentoPadrao(idioma) {
  const i = String(idioma || "").toLowerCase();
  if (i.startsWith("es")) return "dni";
  if (i.startsWith("en")) return "ssn";
  return "cpf";
}

/** Código do documento na reserva (documentos_unicos): "cpf_12345678909". */
export const idDocumentoUnico = (tipo, numero) => `${tipo}_${soNumeros(numero)}`;

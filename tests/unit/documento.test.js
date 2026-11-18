// Documento de identificação: conferência dos dígitos e formatação (src/utils/documento.js).
// Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { documentoValido, formatarDocumento, limparDocumento, tipoDocumentoPadrao, idDocumentoUnico } from '../../src/utils/documento';

describe('CPF', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    expect(documentoValido('cpf', '529.982.247-25')).toBe(true);
    expect(documentoValido('cpf', '52998224725')).toBe(true);
    expect(documentoValido('cpf', '11144477735')).toBe(true);
  });
  it('recusa dígito verificador errado, tamanho errado e sequência repetida', () => {
    expect(documentoValido('cpf', '52998224726')).toBe(false);
    expect(documentoValido('cpf', '5299822472')).toBe(false);
    expect(documentoValido('cpf', '111.111.111-11')).toBe(false);
    expect(documentoValido('cpf', '')).toBe(false);
  });
});

describe('DNI e SSN', () => {
  it('DNI: 7 ou 8 números', () => {
    expect(documentoValido('dni', '30.123.456')).toBe(true);
    expect(documentoValido('dni', '9123456')).toBe(true);
    expect(documentoValido('dni', '123456')).toBe(false);
    expect(documentoValido('dni', '000000000')).toBe(false);
  });
  it('SSN: 9 números, sem área 000/666/9xx, grupo 00 ou série 0000', () => {
    expect(documentoValido('ssn', '123-45-6789')).toBe(true);
    expect(documentoValido('ssn', '000-45-6789')).toBe(false);
    expect(documentoValido('ssn', '666-45-6789')).toBe(false);
    expect(documentoValido('ssn', '900-45-6789')).toBe(false);
    expect(documentoValido('ssn', '123-00-6789')).toBe(false);
    expect(documentoValido('ssn', '123-45-0000')).toBe(false);
  });
  it('tipo desconhecido nunca é válido', () => {
    expect(documentoValido('rg', '123456789')).toBe(false);
  });
});

describe('formatação', () => {
  it('põe a pontuação de cada país enquanto digita', () => {
    expect(formatarDocumento('cpf', '52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('cpf', '5299')).toBe('529.9');
    expect(formatarDocumento('dni', '30123456')).toBe('30.123.456');
    expect(formatarDocumento('ssn', '123456789')).toBe('123-45-6789');
  });
  it('limpa e monta o código da reserva', () => {
    expect(limparDocumento('529.982.247-25')).toBe('52998224725');
    expect(idDocumentoUnico('cpf', '529.982.247-25')).toBe('cpf_52998224725');
  });
  it('sugere o tipo pelo idioma', () => {
    expect(tipoDocumentoPadrao('pt-BR')).toBe('cpf');
    expect(tipoDocumentoPadrao('es-AR')).toBe('dni');
    expect(tipoDocumentoPadrao('en-US')).toBe('ssn');
  });
});

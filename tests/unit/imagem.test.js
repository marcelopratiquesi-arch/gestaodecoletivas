// Foto de certificado: conferências que não dependem do navegador (a compressão em si usa canvas).
// Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { dataDoWorkshopValida, ehFotoJpegValida, LIMITE_FOTO_BANCO } from '../../src/utils/imagem';

describe('data do workshop', () => {
  const hoje = new Date(2026, 10, 14); // 14/11/2026
  it('aceita data existente, de 2000 em diante e que não é futura', () => {
    expect(dataDoWorkshopValida('2025-05-10', hoje)).toBe(true);
    expect(dataDoWorkshopValida('2026-11-14', hoje)).toBe(true);
    expect(dataDoWorkshopValida('2024-02-29', hoje)).toBe(true);
  });
  it('recusa futuro, dia inexistente, formato errado e ano antigo', () => {
    expect(dataDoWorkshopValida('2026-11-15', hoje)).toBe(false);
    expect(dataDoWorkshopValida('2025-02-29', hoje)).toBe(false);
    expect(dataDoWorkshopValida('10/05/2025', hoje)).toBe(false);
    expect(dataDoWorkshopValida('1999-12-31', hoje)).toBe(false);
    expect(dataDoWorkshopValida('', hoje)).toBe(false);
  });
});

describe('foto em base64', () => {
  it('aceita JPEG dentro do limite', () => {
    expect(ehFotoJpegValida('data:image/jpeg;base64,' + 'A'.repeat(5000))).toBe(true);
  });
  it('recusa outros formatos, vazio e acima do limite do banco', () => {
    expect(ehFotoJpegValida('data:image/png;base64,' + 'A'.repeat(5000))).toBe(false);
    expect(ehFotoJpegValida('data:image/jpeg;base64,AAA')).toBe(false);
    expect(ehFotoJpegValida('data:image/jpeg;base64,' + 'A'.repeat(LIMITE_FOTO_BANCO))).toBe(false);
    expect(ehFotoJpegValida(null)).toBe(false);
  });
});

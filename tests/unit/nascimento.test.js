import { describe, it, expect } from 'vitest';
import { formatarNascimento } from '../../src/utils/nascimento.js';

describe('formatar a data de nascimento', () => {
  it('AAAA-MM-DD vira DD/MM/AAAA', () => {
    expect(formatarNascimento('1990-05-17')).toBe('17/05/1990');
  });
  it('vazio e formato estranho voltam como vieram', () => {
    expect(formatarNascimento('')).toBe('');
    expect(formatarNascimento(undefined)).toBe('');
    expect(formatarNascimento('17/05/1990')).toBe('17/05/1990');
  });
});

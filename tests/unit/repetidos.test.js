// Comparação de e-mail, telefone e nome (src/utils/repetidos.js).
// Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { normalizarEmail, emailFormatoValido, emailDeMentira, chaveTelefone, normalizarNome, acharRepetidos } from '../../src/utils/repetidos';

describe('e-mail', () => {
  it('ignora maiúsculas e espaços, mas não pontos', () => {
    expect(normalizarEmail(' Joao@Gmail.com ')).toBe('joao@gmail.com');
    expect(normalizarEmail('jo ao@gmail.com')).toBe('joao@gmail.com');
    expect(normalizarEmail('j.oao@gmail.com')).not.toBe(normalizarEmail('joao@gmail.com'));
  });
  it('confere o formato', () => {
    expect(emailFormatoValido('a.b@x.com.br')).toBe(true);
    expect(emailFormatoValido('semarroba.com')).toBe(false);
    expect(emailFormatoValido('a@b')).toBe(false);
  });
  it('reconhece e-mail de mentira', () => {
    expect(emailDeMentira('naoinformou@gmail.com')).toBe(true);
    expect(emailDeMentira('Sem.Email@hotmail.com')).toBe(true);
    expect(emailDeMentira('maria@teste.com')).toBe(true);
    expect(emailDeMentira('aaaa@gmail.com')).toBe(true);
    expect(emailDeMentira('maria.souza@gmail.com')).toBe(false);
  });
});

describe('telefone', () => {
  it('BR: com e sem 55, com e sem o 9 da frente dão a mesma chave', () => {
    const a = chaveTelefone('(11) 98765-4321', 'BR');
    expect(a).toBe('BR:1187654321');
    expect(chaveTelefone('+55 11 98765-4321', 'BR')).toBe(a);
    expect(chaveTelefone('11 8765-4321', 'BR')).toBe(a);
    expect(chaveTelefone('011 98765 4321', 'BR')).toBe(a);
  });
  it('BR: DDD 55 (RS) não é confundido com o código do país', () => {
    expect(chaveTelefone('55 3222-1234', 'BR')).toBe('BR:5532221234');
  });
  it('BR: recusa DDD inválido, todos iguais e tamanho errado', () => {
    expect(chaveTelefone('(10) 98765-4321', 'BR')).toBeNull();
    expect(chaveTelefone('99999999999', 'BR')).toBeNull();
    expect(chaveTelefone('11 99999-9999', 'BR')).toBeNull();
    expect(chaveTelefone('98765-4321', 'BR')).toBeNull();
    expect(chaveTelefone('', 'BR')).toBeNull();
  });
  it('AR: com e sem 54/9/0 dão a mesma chave', () => {
    const a = chaveTelefone('+54 9 11 1234-5678', 'AR');
    expect(chaveTelefone('011 15 1234-5678', 'AR')).toBe(a);
    expect(chaveTelefone('11 1234 5678', 'AR')).toBe(a);
  });
  it('US: com e sem o 1', () => {
    expect(chaveTelefone('+1 (305) 555-0123', 'US')).toBe(chaveTelefone('305 555 0123', 'US'));
    expect(chaveTelefone('555 0123', 'US')).toBeNull();
  });
});

describe('nome', () => {
  it('maiúsculas, sem acento e sem espaço duplo', () => {
    expect(normalizarNome('  João   da Silva ')).toBe('JOAO DA SILVA');
  });
});

describe('acharRepetidos', () => {
  it('acha o mesmo e-mail em pessoas diferentes', () => {
    const r = acharRepetidos([
      { origem: 'professor', id: 'p1', nome: 'João', email: 'JOAO@gmail.com' },
      { origem: 'pedido', id: 'u9', nome: 'João S', email: 'joao@gmail.com' },
    ]);
    expect(r.email).toHaveLength(1);
    expect(r.email[0].pessoas).toBe(2);
  });
  it('a mesma pessoa (professor ligado ao crachá, pedido do mesmo login) não conta', () => {
    const r = acharRepetidos([
      { origem: 'professor', id: 'p1', nome: 'Ana', email: 'ana@x.com', telefone: '11987654321', uidLogin: 'u1' },
      { origem: 'cracha', id: 'u1', nome: 'Ana', email: 'ana@x.com', telefone: '11987654321' },
      { origem: 'pedido', id: 'u1', nome: 'Ana', email: 'ana@x.com', telefone: '+5511987654321' },
    ]);
    expect(r.email).toHaveLength(0);
    expect(r.telefone).toHaveLength(0);
    expect(r.nome).toHaveLength(0);
  });
  it('liga pelo professorId do crachá também', () => {
    const r = acharRepetidos([
      { origem: 'professor', id: 'p1', nome: 'Bia' },
      { origem: 'cracha', id: 'u2', nome: 'Bia', professorId: 'p1' },
    ]);
    expect(r.nome).toHaveLength(0);
  });
  it('separa e-mail de mentira e telefone inválido', () => {
    const r = acharRepetidos([
      { origem: 'professor', id: 'p1', nome: 'A', email: 'naoinformou@gmail.com', telefone: '11111111' },
      { origem: 'professor', id: 'p2', nome: 'B', email: 'naoinformou@gmail.com' },
    ]);
    expect(r.email).toHaveLength(0);
    expect(r.problemas.emailDeMentira).toHaveLength(2);
    expect(r.problemas.telefoneInvalido).toHaveLength(1);
  });
});

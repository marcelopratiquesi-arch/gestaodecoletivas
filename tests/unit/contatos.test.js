// Reservas de e-mail e telefone (src/utils/contatos.js).
// Rodar: npx vitest run tests/unit
import { describe, it, expect } from 'vitest';
import { chavesDeContato, idContatoEmail, idContatoTelefone, mesmoDono, planejarReservas } from '../../src/utils/contatos';

describe('chaves de reserva', () => {
  it('e-mail minúsculo e sem espaços; mentira e formato ruim não reservam', () => {
    expect(idContatoEmail(' Ana.Silva@Gmail.com ')).toBe('email_ana.silva@gmail.com');
    expect(idContatoEmail('naoinformou@gmail.com')).toBeNull();
    expect(idContatoEmail('ana@')).toBeNull();
    expect(idContatoEmail('')).toBeNull();
  });
  it('telefone pela chave do país (BR ignora 55 e o 9)', () => {
    expect(idContatoTelefone('+55 (11) 98765-4321')).toBe('tel_BR:1187654321');
    expect(idContatoTelefone('11 8765-4321')).toBe('tel_BR:1187654321');
    expect(idContatoTelefone('(201) 555-0123', 'US')).toBe('tel_US:2015550123');
    expect(idContatoTelefone('123')).toBeNull();
  });
  it('lista só as chaves que valem', () => {
    expect(chavesDeContato({ email: 'ana@b.com', telefone: '11987654321' })).toEqual([
      { id: 'email_ana@b.com', tipo: 'email' }, { id: 'tel_BR:1187654321', tipo: 'tel' },
    ]);
    expect(chavesDeContato({ email: 'teste@teste.com', telefone: '' })).toEqual([]);
  });
  it('mesmo dono = mesmo login ou mesma ficha', () => {
    expect(mesmoDono({ uid: 'u1' }, { uid: 'u1' })).toBe(true);
    expect(mesmoDono({ professorId: '7' }, { uid: 'u1', professorId: 7 })).toBe(true);
    expect(mesmoDono({ uid: 'u1' }, { uid: 'u2' })).toBe(false);
    expect(mesmoDono({ professorId: '7' }, { uid: 'u1' })).toBe(false);
  });
});

describe('planejarReservas', () => {
  const ficha = (id, extra) => ({ origem: 'professor', id, pais: 'BR', ...extra });
  const cracha = (id, extra) => ({ origem: 'cracha', id, pais: 'BR', ...extra });

  it('ficha ligada ao crachá com o mesmo e-mail = uma reserva com os dois donos', () => {
    const { reservas, conflitos } = planejarReservas([
      ficha('7', { email: 'ana@x.com', uidLogin: 'u1' }),
      cracha('u1', { email: 'ANA@x.com', professorId: '7' }),
    ]);
    expect(conflitos).toEqual([]);
    expect(reservas.get('email_ana@x.com')).toEqual({ tipo: 'email', uid: 'u1', professorId: '7' });
  });
  it('dado só na ficha ligada: leva o login junto', () => {
    const { reservas } = planejarReservas([ficha('7', { telefone: '11987654321', uidLogin: 'u1' }), cracha('u1', {})]);
    expect(reservas.get('tel_BR:1187654321')).toEqual({ tipo: 'tel', uid: 'u1', professorId: '7' });
  });
  it('login antigo (fora da lista) não vira dono', () => {
    const { reservas } = planejarReservas([ficha('7', { email: 'ana@x.com', uidLogin: 'antigo' })]);
    expect(reservas.get('email_ana@x.com')).toEqual({ tipo: 'email', professorId: '7' });
  });
  it('duas fichas soltas com o mesmo e-mail = conflito (falta juntar)', () => {
    const { reservas, conflitos } = planejarReservas([ficha('7', { email: 'ana@x.com' }), ficha('8', { email: 'ana@x.com' })]);
    expect(reservas.has('email_ana@x.com')).toBe(false);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].itens.map(i => i.id)).toEqual(['7', '8']);
  });
  it('pedidos de acesso ficam de fora', () => {
    const { reservas } = planejarReservas([{ origem: 'pedido', id: 'p1', email: 'ana@x.com' }]);
    expect(reservas.size).toBe(0);
  });
});

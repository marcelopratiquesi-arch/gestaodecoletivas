import { describe, it, expect } from 'vitest';
import { dataDoTexto, lerLista, contaComoPresente, idParticipante, juntarPessoas, acharProfessor, montarConferencia, fichasEscolhidas } from '../../src/utils/importarParticipantes';

// Planilha de exemplo no formato da plataforma de ingressos (dados inventados).
const CAB = ['Ordem de inscrição', 'Nº ingresso', 'Nome', 'Sobrenome', 'Tipo de ingresso', 'Valor', 'Data compra', 'Nº pedido', 'Canal', 'Email', 'Estado de pagamento', 'Check-in', 'Data Check-in', 'Telefone'];
const linha = (nome, sobre, email, pag, chk, tel) => ['1', 'X', ` ${nome}`, ` ${sobre}`, 'Lote', 'R$ 44', '', '', 'Online', email, pag, chk, '', tel];
const MATRIZ = [
  ['WORKSHOP DE POWER CORE'], ['Data:', 'Local:'], ['01/07/2023 08h', 'Academia Exemplo - Palhoça'], [''],
  CAB,
  linha('Ana', 'Exemplo Souza', 'ANA@Provedor.com ', 'Aprovado', 'Sim', '(48) 99999-1111'),
  linha('Ana', 'Exemplo Souza', 'ana@provedor.com', 'Aprovado', 'Sim', '(48) 99999-1111'), // 2º ingresso, mesma pessoa
  linha('Bruno', 'Modelo Lima', 'bruno@provedor.com', 'Aprovado', 'Não', '(48) 98888-2222'),
  linha('Carla', 'Teste Ramos', 'carla@provedor.com', 'Não pago', 'Não', ''),
  linha('Dani', 'Sem Ficha', 'dani@provedor.com', 'Aprovado', 'Sim', '(11) 97777-3333'),
  [''], ['Exportado em 14/11/2026 às 11h03*'],
];

const FICHAS = [
  { id: 10, nome: 'ANA EXEMPLO SOUZA', email: 'ana@provedor.com', telefone: '48999991111', unidadeId: 'u1' },
  { id: 11, nome: 'ANA EXEMPLO SOUZA', email: 'ana.outra@provedor.com', telefone: '(48) 9 9999-1111', unidadeId: 'u2' }, // ficha irmã (outra unidade)
  { id: 12, nome: 'BRUNO MODELO LIMA', email: 'outro@provedor.com', telefone: '48988882222', unidadeId: 'u1' }, // só o telefone bate
  { id: 13, nome: 'MARIA OUTRA', email: 'ana@provedor.com', telefone: '48911112222', unidadeId: 'u1' }, // só o e-mail da Ana bate
];

describe('lerLista', () => {
  it('acha cabeçalho, data, local e junta nome e sobrenome', () => {
    const r = lerLista(MATRIZ);
    expect(r.dataIso).toBe('2023-07-01');
    expect(r.local).toBe('Academia Exemplo - Palhoça');
    expect(r.linhas).toHaveLength(5);
    expect(r.linhas[0]).toMatchObject({ nome: 'Ana Exemplo Souza', email: 'ana@provedor.com', pagamento: 'Aprovado', checkin: 'Sim' });
  });
  it('avisa quando não é o arquivo certo', () => {
    expect(lerLista([['a', 'b']]).erro).toBe('cabecalho');
    expect(lerLista(null).erro).toBe('cabecalho');
  });
  it('lê a data do texto', () => {
    expect(dataDoTexto('01/07/2023 08h')).toBe('2023-07-01');
    expect(dataDoTexto('sem data')).toBe('');
  });
});

describe('quem conta e juntar pessoas', () => {
  it('só pagamento aprovado + check-in sim', () => {
    expect(contaComoPresente({ pagamento: 'Aprovado', checkin: 'Sim' })).toBe(true);
    expect(contaComoPresente({ pagamento: 'Aprovado', checkin: 'Não' })).toBe(false);
    expect(contaComoPresente({ pagamento: 'Cancelado', checkin: 'Sim' })).toBe(false);
  });
  it('o mesmo e-mail com dois ingressos vira uma pessoa só', () => {
    const pessoas = juntarPessoas(lerLista(MATRIZ).linhas);
    expect(pessoas).toHaveLength(4);
    expect(pessoas.find((p) => p.email === 'ana@provedor.com').linhas).toHaveLength(2);
  });
  it('o código é o mesmo ao importar de novo e não aceita e-mail de mentira', () => {
    expect(idParticipante({ nome: 'Ana', email: 'ANA@provedor.com' })).toBe(idParticipante({ nome: 'Outra', email: 'ana@provedor.com' }));
    expect(idParticipante({ nome: 'Fulano Silva', email: 'naoinformado@gmail.com' })).toMatch(/^n_/);
  });
});

describe('achar o professor', () => {
  const pessoa = (email, tel) => ({ email, telefones: tel ? [tel] : [] });
  it('verde: e-mail e telefone batem; leva junto a ficha irmã (mesmo nome, outra unidade)', () => {
    const r = acharProfessor(pessoa('ana@provedor.com', '(48) 99999-1111'), FICHAS);
    expect(r.cls).toBe('v');
    const ids = fichasEscolhidas({ grupos: r.grupos, grupoSel: r.grupoSel });
    expect(ids.sort()).toEqual(['10', '11']);
  });
  it('amarelo: só o telefone bate', () => {
    const r = acharProfessor(pessoa('bruno@provedor.com', '(48) 98888-2222'), FICHAS);
    expect(r.cls).toBe('a');
    expect(fichasEscolhidas({ grupos: r.grupos, grupoSel: r.grupoSel })).toEqual(['12']);
  });
  it('cinza: ninguém bate', () => {
    expect(acharProfessor(pessoa('dani@provedor.com', '(11) 97777-3333'), FICHAS).cls).toBe('c');
  });
  it('e-mail de mentira e telefone inválido não ligam ninguém', () => {
    expect(acharProfessor(pessoa('teste@gmail.com', '1111'), [{ id: 1, nome: 'X', email: 'teste@gmail.com', telefone: '1111' }]).cls).toBe('c');
  });
});

describe('montarConferencia', () => {
  it('quem não conta vira vermelho e vem desmarcado; os outros vêm marcados', () => {
    const c = montarConferencia(lerLista(MATRIZ).linhas, FICHAS);
    const por = (e) => c.find((l) => l.email === e);
    expect(por('ana@provedor.com')).toMatchObject({ cls: 'v', incluir: true });
    expect(por('bruno@provedor.com')).toMatchObject({ cls: 'x', incluir: false, achado: 'a' });
    expect(por('carla@provedor.com')).toMatchObject({ cls: 'x', incluir: false });
    expect(por('dani@provedor.com')).toMatchObject({ cls: 'c', incluir: true });
  });
});

describe('arquivo sem check-in', () => {
  it('vale só o pagamento aprovado quando ninguém tem check-in', async () => {
    const { arquivoUsaCheckin } = await import('../../src/utils/importarParticipantes');
    const linhas = [{ nome: 'Ana', email: 'ana@x.com', telefones: [], pagamento: 'Aprovado', checkin: 'Não', linha: 1 }, { nome: 'Bia', email: 'bia@x.com', telefones: [], pagamento: 'Pendente', checkin: 'Não', linha: 2 }];
    expect(arquivoUsaCheckin(linhas)).toBe(false);
    const c = montarConferencia(linhas, []);
    expect(c.map((x) => [x.nome, x.incluir])).toEqual([['Ana', true], ['Bia', false]]);
    expect(arquivoUsaCheckin([{ checkin: 'Sim' }])).toBe(true);
  });
});

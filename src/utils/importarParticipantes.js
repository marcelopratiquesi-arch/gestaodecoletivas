// Importar lista de participantes (planilha exportada da plataforma de ingressos) para um workshop.
// Funções puras: ler as linhas, juntar a mesma pessoa, achar o professor no cadastro por e-mail E telefone.
import { normalizarEmail, emailFormatoValido, emailDeMentira, chaveTelefone, normalizarNome } from './repetidos';

const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const minusculo = (v) => txt(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "01/07/2023 08h" -> "2023-07-01" (vazio se não achar). */
export function dataDoTexto(valor) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(valor ?? ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * Lê as linhas da planilha (matriz, como a biblioteca xlsx entrega). Acha o cabeçalho (a linha que tem "Nome" e
 * "Email"), os telefones (a plataforma exporta duas colunas "Telefone"), a data e o local do topo.
 * Devolve { dataIso, local, linhas: [{ linha, nome, email, telefones, pagamento, checkin, ingresso }] }.
 */
export function lerLista(rows) {
  const matriz = Array.isArray(rows) ? rows : [];
  const h = matriz.findIndex((r) => (r || []).some((c) => minusculo(c) === 'nome') && (r || []).some((c) => /^e-?mail$/.test(minusculo(c))));
  if (h < 0) return { erro: 'cabecalho', dataIso: '', local: '', linhas: [] };
  const cab = matriz[h].map(minusculo);
  const col = (nome) => cab.findIndex((c) => c === nome);
  const cNome = col('nome'); const cSobre = col('sobrenome');
  const cEmail = cab.findIndex((c) => /^e-?mail$/.test(c));
  const cPag = cab.findIndex((c) => c.startsWith('estado de pagamento'));
  const cChk = cab.findIndex((c) => c === 'check-in');
  const cIng = cab.findIndex((c) => c.startsWith('tipo de ingresso'));
  const cTels = cab.map((c, i) => (c === 'telefone' ? i : -1)).filter((i) => i >= 0);

  let dataIso = ''; let local = '';
  for (let r = 0; r < h; r += 1) {
    (matriz[r] || []).forEach((c, i) => {
      const v = minusculo(c);
      if (v === 'data:') dataIso = dataDoTexto(matriz[r + 1]?.[i]);
      if (v === 'local:') local = txt(matriz[r + 1]?.[i]);
    });
  }

  const linhas = [];
  for (let r = h + 1; r < matriz.length; r += 1) {
    const l = matriz[r] || [];
    if (minusculo(l[0]).startsWith('exportado')) break;
    const nome = txt(`${txt(l[cNome])} ${cSobre >= 0 ? txt(l[cSobre]) : ''}`);
    const email = normalizarEmail(l[cEmail]);
    if (!nome && !email) continue;
    const telefones = [...new Set(cTels.map((i) => txt(l[i])).filter(Boolean))];
    linhas.push({ linha: r + 1, nome, email, telefones, pagamento: txt(l[cPag]), checkin: txt(l[cChk]), ingresso: cIng >= 0 ? txt(l[cIng]) : '' });
  }
  return { dataIso, local, linhas };
}

/** Só conta como "fez o workshop": pagamento aprovado E check-in feito. */
export const contaComoPresente = (l, exigirCheckin = true) => minusculo(l.pagamento) === 'aprovado' && (!exigirCheckin || ['sim', 's', 'yes'].includes(minusculo(l.checkin)));

/** O arquivo usa check-in? Se ninguém tem "Sim", a plataforma não foi usada na porta: vale só o pagamento aprovado. */
export const arquivoUsaCheckin = (linhas) => (linhas || []).some((l) => ['sim', 's', 'yes'].includes(minusculo(l.checkin)));

const emailUsavel = (e) => !!e && emailFormatoValido(e) && !emailDeMentira(e);
const limparId = (s) => String(s).toLowerCase().replace(/[^a-z0-9@._+-]/g, '_').slice(0, 100);

/** Código do participante no workshop: o e-mail (ou o nome, sem e-mail usável). Importar de novo cai no mesmo código. */
export const idParticipante = (p) => (emailUsavel(p.email) ? `e_${limparId(p.email)}` : `n_${limparId(normalizarNome(p.nome))}`);

/** Junta as linhas da mesma pessoa (mesmo e-mail; vários ingressos): conta se alguma linha conta. */
export function juntarPessoas(linhas, exigirCheckin = true) {
  const mapa = new Map();
  for (const l of linhas) {
    const base = { nome: l.nome, email: l.email, telefones: l.telefones };
    const id = idParticipante(base);
    const atual = mapa.get(id);
    const conta = contaComoPresente(l, exigirCheckin);
    if (!atual) { mapa.set(id, { id, ...base, pagamento: l.pagamento, checkin: l.checkin, conta, linhas: [l.linha] }); continue; }
    atual.linhas.push(l.linha);
    atual.telefones = [...new Set([...atual.telefones, ...l.telefones])];
    if (!atual.nome) atual.nome = l.nome;
    if (conta && !atual.conta) { atual.conta = true; atual.pagamento = l.pagamento; atual.checkin = l.checkin; }
  }
  return [...mapa.values()];
}

/**
 * Procura a pessoa nas fichas dos professores.
 *  - verde: e-mail E telefone batem com a mesma ficha (entram também as fichas "irmãs": mesmo nome, outra unidade);
 *  - amarelo: só e-mail ou só telefone bate (a pessoa confere; vem escolhido o grupo do e-mail);
 *  - cinza: ninguém.
 * `grupos` = fichas candidatas agrupadas por nome (cada grupo é uma pessoa, com todas as suas fichas).
 */
export function acharProfessor(pessoa, fichas) {
  const e = emailUsavel(pessoa.email) ? pessoa.email : '';
  const tels = new Set(pessoa.telefones.map((t) => chaveTelefone(t, 'BR')).filter(Boolean));
  const achadas = [];
  for (const f of fichas || []) {
    const porEmail = !!e && normalizarEmail(f.email) === e;
    const kt = f.telefone ? chaveTelefone(f.telefone, f.pais || 'BR') : null;
    const porTel = !!kt && tels.has(kt);
    if (porEmail || porTel) achadas.push({ ficha: f, porEmail, porTel });
  }
  if (!achadas.length) {
    // Nem e-mail nem telefone: tenta o nome completo igual (sem acento/caixa). Vira amarelo, para o admin conferir.
    const k = normalizarNome(pessoa.nome);
    const mesmas = k.split(' ').length >= 2 ? (fichas || []).filter((f) => normalizarNome(f.nome) === k) : [];
    if (!mesmas.length) return { cls: 'c', grupos: [], grupoSel: -1 };
    return { cls: 'a', grupos: [{ nome: mesmas[0].nome, fichas: mesmas, email: false, tel: false }], grupoSel: 0 };
  }

  const porNome = new Map();
  for (const a of achadas) {
    const k = normalizarNome(a.ficha.nome);
    if (!porNome.has(k)) porNome.set(k, { nome: a.ficha.nome, fichas: [], email: false, tel: false });
    const g = porNome.get(k);
    g.fichas.push(a.ficha);
    g.email = g.email || a.porEmail; g.tel = g.tel || a.porTel;
  }
  const grupos = [...porNome.values()].sort((a, b) => (b.email + b.tel) - (a.email + a.tel));
  const verdes = achadas.filter((a) => a.porEmail && a.porTel);
  if (verdes.length) {
    const nomeVerde = normalizarNome(verdes[0].ficha.nome);
    const i = grupos.findIndex((g) => normalizarNome(g.nome) === nomeVerde);
    return { cls: 'v', grupos, grupoSel: i };
  }
  const iEmail = grupos.findIndex((g) => g.email);
  return { cls: 'a', grupos, grupoSel: iEmail >= 0 ? iEmail : 0 };
}

/** Passa por todas as pessoas do arquivo e monta as linhas da tela de conferência. */
export function montarConferencia(linhas, fichas, exigirCheckin = arquivoUsaCheckin(linhas)) {
  return juntarPessoas(linhas, exigirCheckin).map((p) => {
    const r = acharProfessor(p, fichas);
    const cls = p.conta ? r.cls : 'x';
    return { ...p, cls, achado: r.cls, grupos: r.grupos, grupoSel: r.grupoSel, incluir: p.conta };
  });
}

/** Ids das fichas escolhidas numa linha da conferência (vazio = guardar sem cadastro). */
export function fichasEscolhidas(l) {
  if (!l.grupos?.length || l.grupoSel < 0) return [];
  return (l.grupos[l.grupoSel]?.fichas || []).map((f) => String(f.id));
}

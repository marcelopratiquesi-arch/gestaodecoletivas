// Contas da Central da Unidade.
//
// Tudo aqui é conta pura (sem banco e sem tela), para poder ser testada e para os números da Central
// baterem com os das telas completas. Por isso reaproveita as MESMAS regras que elas usam:
//   - grade e pendências: src/utils/agendaAulas.js (Página de Início e Validação Diária);
//   - validações repetidas: src/utils/validacoes.js (deduplicarValidacoes);
//   - alunos e média por aula: mesma conta do Relatório (soma dos alunos das aulas realizadas ÷ aulas realizadas).
import { aulaNaGradeDoDia, situacaoDaAula, SITUACAO, somarDias, datasEntre } from '../utils/agendaAulas';
import { deduplicarValidacoes } from '../utils/validacoes';
import { getDiaSemana, DIAS_SEMANA_GRADE } from '../utils/formatters';
import { ehLider } from '../permissions';
import { valorDaValidacao } from '../utils/valores';

// Pendências: hoje e os 6 dias anteriores (mesma janela da Página de Início).
export const DIAS_JANELA_PENDENCIAS = 7;

const texto = (v) => String(v ?? '').trim();
const papelDe = (userData) => texto(userData?.role).toLowerCase();
export const ehAdmin = (role) => ['admin', 'administrador', 'master'].includes(texto(role).toLowerCase());

// Quem pode abrir a Central de uma unidade:
//   'editar' = admin (todas) e mentor (só as dele): vê tudo e tem os atalhos de edição;
//   'ver'    = líder (só a própria): modo leitura;
//   null     = não pode abrir.
export function acessoUnidade(userData, unidade) {
  if (!userData || !unidade) return null;
  const papel = papelDe(userData);
  const meuId = userData.id || userData.uid;
  if (ehAdmin(papel)) return 'editar';
  if (papel === 'mentor') return unidade.mentorId && unidade.mentorId === meuId ? 'editar' : null;
  if (ehLider(papel)) return String(userData.unidadeId || '') === String(unidade.id) ? 'ver' : null;
  return null;
}

// Aceita o cadastro da unidade, o id ou o nome.
export function acharUnidade(unidades = [], alvo) {
  if (!alvo) return null;
  const id = typeof alvo === 'object' ? alvo.id : alvo;
  const porId = unidades.find((u) => String(u.id) === String(id));
  if (porId) return porId;
  const nome = texto(typeof alvo === 'object' ? alvo.nome : alvo).toLowerCase();
  return nome ? unidades.find((u) => texto(u.nome).toLowerCase() === nome) || null : null;
}

// ---------- Período ----------
const limitesDoMes = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  return [`${mes}-01`, `${mes}-${String(ultimoDia).padStart(2, '0')}`];
};
const mesAnterior = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Período do mês escolhido e o período de comparação ("as mesmas datas do mês passado").
// Mês em andamento: do dia 1 até hoje, comparado com o dia 1 até o mesmo dia do mês anterior
// (se o mês anterior for mais curto, vai até o último dia dele). Mês fechado: mês inteiro x mês inteiro.
export function periodoDoMes(mes, hoje) {
  const [inicio, fimDoMes] = limitesDoMes(mes);
  const [inicioAnterior, fimDoMesAnterior] = limitesDoMes(mesAnterior(mes));
  const emAndamento = mes === hoje.slice(0, 7);
  let fimAnterior = fimDoMesAnterior;
  if (emAndamento) {
    const mesmoDia = `${inicioAnterior.slice(0, 7)}-${hoje.slice(8, 10)}`;
    if (mesmoDia < fimDoMesAnterior) fimAnterior = mesmoDia;
  }
  return { inicio, fim: emAndamento ? hoje : fimDoMes, inicioAnterior, fimAnterior, emAndamento };
}

// ---------- Validações (presença) ----------
export function resumoValidacoes(validacoes = [], inicio, fim) {
  const noPeriodo = deduplicarValidacoes(validacoes.filter((v) => v && v.data >= inicio && v.data <= fim));
  let realizadas = 0;
  let alunos = 0;
  noPeriodo.forEach((v) => {
    if (v.status !== 'realizada') return;
    realizadas += 1;
    alunos += Number(v.alunos) || 0;
  });
  return { realizadas, alunos, media: realizadas > 0 ? Math.round(alunos / realizadas) : 0 };
}

// ▲ / ▼ contra o período anterior. Sem base de comparação (anterior = 0) não mostra nada.
export function variacao(atual, anterior) {
  if (!anterior) return null;
  const percentual = Math.abs(Math.round(((atual - anterior) / anterior) * 100));
  return { direcao: atual > anterior ? 'sobe' : atual < anterior ? 'desce' : 'igual', percentual };
}

// ---------- Grade ----------
// Aulas da unidade que aparecem no Cronograma: fora da lixeira e ainda não encerradas (mesma regra da tela).
export function aulasDaUnidade(aulas = [], unidadeId, hoje) {
  return aulas.filter((a) => String(a.unidadeId) === String(unidadeId)
    && a.excluido !== true
    && !(a.dataFim && a.dataFim < hoje));
}

// Cada aula conta uma vez por dia da semana em que acontece.
export const aulasNaSemana = (aulas = []) => aulas.reduce((total, a) => total + (a.dias?.length || 0), 0);

export function gradePorDia(aulas = []) {
  return DIAS_SEMANA_GRADE
    .map((dia) => ({
      dia,
      aulas: aulas.filter((a) => a.dias?.includes(dia)).sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
    }))
    .filter((d) => d.aulas.length > 0);
}

// ---------- Professores ----------
// Professores com vínculo com a unidade (mesma base da aba Professores das Configurações).
// "ativo" = cadastro ativo E vínculo ativo.
export function professoresDaUnidade({ unidadeId, vinculos = [], professores = [], aulas = [] }) {
  const porId = new Map(professores.map((p) => [String(p.id), p]));
  const vistos = new Set();
  const lista = [];
  vinculos.forEach((v) => {
    if (String(v.unidadeId) !== String(unidadeId)) return;
    const professor = porId.get(String(v.professorId));
    if (!professor || vistos.has(String(professor.id))) return;
    vistos.add(String(professor.id));
    const dele = aulas.filter((a) => String(a.professorId) === String(professor.id));
    lista.push({
      professor,
      ativo: professor.status === 'ativo' && (v.status ?? 'ativo') === 'ativo',
      aulasNaSemana: aulasNaSemana(dele),
      modalidadeIds: [...new Set(dele.map((a) => String(a.modalidadeId)).filter(Boolean))],
    });
  });
  return lista.sort((a, b) => texto(a.professor.nome).localeCompare(texto(b.professor.nome)));
}

// ---------- Pendências de validação ----------
// Aulas que já começaram (ou de dias passados) e ninguém validou, nos últimos 7 dias. Feriado não conta.
// `aulas`: todas as aulas da unidade fora da lixeira (a vigência é conferida dia a dia).
export function pendenciasDaUnidade({ aulas = [], unidade, feriados = [], validacoes = [], hoje, agoraHHMM, dias = DIAS_JANELA_PENDENCIAS }) {
  const inicio = somarDias(hoje, -(dias - 1));
  const porAulaEDia = new Map();
  deduplicarValidacoes(validacoes).forEach((v) => {
    if (v?.aulaId && v.data) porAulaEDia.set(`${v.aulaId}_${v.data}`, v);
  });
  let aValidar = 0;
  let maisAntiga = null;
  datasEntre(inicio, hoje).forEach((dia) => {
    const diaSemana = getDiaSemana(dia);
    aulas.forEach((aula) => {
      if (!aulaNaGradeDoDia(aula, dia, diaSemana)) return;
      const situacao = situacaoDaAula({
        aula, unidade, dataStr: dia, validacao: porAulaEDia.get(`${aula.id}_${dia}`), feriados, hoje, agoraHHMM,
      });
      if (situacao !== SITUACAO.A_VALIDAR) return;
      aValidar += 1;
      if (!maisAntiga || dia < maisAntiga) maisAntiga = dia;
    });
  });
  return { aValidar, maisAntiga, inicio, fim: hoje };
}

// ---------- "Está tudo em dia?" ----------
// Devolve a lista de itens conferidos: { id, ok, nivel ('erro' | 'atencao'), quantidade? }.
// Os textos ficam na tela (traduções em centrais.unidade.emDia.itens.<id>).
// `pendencias` = null enquanto as validações ainda não carregaram (o item só entra quando há resposta).
export function itensEmDia({ unidade, mentor, aulas = [], professores = [], pendencias = null }) {
  const profPorId = new Map(professores.map((p) => [String(p.id), p]));
  const semProfessor = aulas.filter((a) => {
    const prof = a.professorId ? profPorId.get(String(a.professorId)) : null;
    return !prof || prof.status !== 'ativo';
  }).length;
  const temLider = !!unidade?.liderUid;

  return [
    { id: 'lider', ok: temLider, nivel: 'erro' },
    temLider && { id: 'liderConferido', ok: unidade.liderAConferir !== true, nivel: 'atencao' },
    temLider && { id: 'liderTelefone', ok: !!texto(unidade.liderTelefone), nivel: 'atencao' },
    { id: 'mentor', ok: !!mentor, nivel: 'erro' },
    { id: 'telefone', ok: !!texto(unidade?.telefone), nivel: 'atencao' },
    { id: 'endereco', ok: !!(texto(unidade?.enderecoCompleto) || texto(unidade?.linkGoogleMaps)), nivel: 'atencao' },
    { id: 'metragem', ok: Number(unidade?.metragemSalaColetiva) > 0, nivel: 'atencao' },
    { id: 'grade', ok: aulas.length > 0, nivel: 'atencao' },
    aulas.length > 0 && { id: 'aulasSemProfessor', ok: semProfessor === 0, nivel: 'erro', quantidade: semProfessor },
    pendencias && { id: 'validacoes', ok: pendencias.aValidar === 0, nivel: 'erro', quantidade: pendencias.aValidar },
    // Login antigo (um por unidade) que continua funcionando mesmo com líder já cadastrado.
    temLider && { id: 'loginAntigo', ok: !(unidade.uidLogin && !unidade.loginAntigoDesligado), nivel: 'atencao' },
  ].filter(Boolean);
}

// ---------- Indicadores do Relatório (valor investido, ocupação e vacância) ----------
// Reproduz, para UMA unidade, as contas da tela Relatórios (src/app/Relatorios/index.jsx), para o número
// da Central bater com o de lá:
//   - o Relatório monta uma linha por aula da grade (titular), uma por substituto e uma por aulão;
//   - validação de aula que não existe mais no cadastro de aulas fica de fora;
//   - valor investido = soma do valor de cada aula realizada (o valor em vigor no dia: src/utils/valores.js);
//   - ocupação de cada linha = média de alunos ÷ capacidade da sala (metragem ÷ m² por aluno da modalidade);
//     a taxa de ocupação é a média das linhas que tiveram aula realizada (só existe com metragem cadastrada);
//   - vacância = horários vagos de segunda a sexta, das 06h às 22h (intervalos de 1h ou mais, em blocos de
//     40 min) ÷ 24 horários por dia. Como no Relatório, olha a grade cadastrada, não o período.
// `aulasTodas`: todas as aulas da unidade, inclusive as da lixeira (é o que o Relatório usa).
const DIAS_UTEIS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const DURACAO_AULA_PADRAO = 40;
const GAP_MINIMO_OCIOSO = 60;
const SLOTS_POR_DIA = 24;
const ABERTURA = 6 * 60;
const FECHAMENTO = 22 * 60;

const emMinutos = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function horariosVagosNoDia(aulasDoDia = []) {
  const inicios = aulasDoDia.map((a) => emMinutos(a.hora)).filter((i) => i >= ABERTURA && i < FECHAMENTO).sort((a, b) => a - b);
  let vagos = 0;
  let cursor = ABERTURA;
  inicios.forEach((inicio) => {
    if (inicio - cursor >= GAP_MINIMO_OCIOSO) vagos += Math.floor((inicio - cursor) / DURACAO_AULA_PADRAO);
    cursor = Math.max(cursor, inicio + DURACAO_AULA_PADRAO);
  });
  if (FECHAMENTO - cursor >= GAP_MINIMO_OCIOSO) vagos += Math.floor((FECHAMENTO - cursor) / DURACAO_AULA_PADRAO);
  return vagos;
}

export function taxaDeVacancia(aulasTodas = []) {
  const vagos = DIAS_UTEIS.reduce((total, dia) => total + horariosVagosNoDia(aulasTodas.filter((a) => (a.dias || []).includes(dia))), 0);
  return Math.min((vagos / (SLOTS_POR_DIA * DIAS_UTEIS.length)) * 100, 100);
}

export function indicadoresDaUnidade({ validacoes = [], inicio, fim, aulasTodas = [], unidade, modalidades = [] }) {
  const aulaPorId = new Map(aulasTodas.map((a) => [String(a.id), a]));
  const modalidadePorId = new Map(modalidades.map((m) => [String(m.id), m]));
  const metragem = Number(unidade?.metragemSalaColetiva) || 0;

  // Uma "linha" do Relatório: { modalidadeId, aula (para o valor), validacoes }
  const linhas = new Map();
  const naLinha = (chave, modalidadeId, aula) => {
    if (!linhas.has(chave)) linhas.set(chave, { modalidadeId, aula, validacoes: [] });
    return linhas.get(chave).validacoes;
  };
  deduplicarValidacoes(validacoes.filter((v) => v && v.data >= inicio && v.data <= fim)).forEach((v) => {
    if (v.isAulao) { naLinha(`aulao_${v.id}`, v.modalidadeId, null).push(v); return; }
    const aula = aulaPorId.get(String(v.aulaId));
    if (!aula) return;
    const chave = v.substituicao ? `${aula.id}_sub_${v.professorId}` : `titular_${aula.id}`;
    naLinha(chave, aula.modalidadeId, aula).push(v);
  });

  let realizadas = 0;
  let alunos = 0;
  let valor = 0;
  let somaOcupacao = 0;
  let linhasComOcupacao = 0;
  linhas.forEach(({ modalidadeId, aula, validacoes: daLinha }) => {
    const feitas = daLinha.filter((v) => v.status === 'realizada');
    const alunosDaLinha = feitas.reduce((s, v) => s + (Number(v.alunos) || 0), 0);
    realizadas += feitas.length;
    alunos += alunosDaLinha;
    valor += daLinha.reduce((s, v) => s + valorDaValidacao(v, aula), 0);
    if (feitas.length > 0 && metragem > 0) {
      const m2PorAluno = Number(modalidadePorId.get(String(modalidadeId))?.indiceOcupacao) || 3;
      const capacidade = Math.floor(metragem / m2PorAluno);
      const media = Math.round(alunosDaLinha / feitas.length);
      somaOcupacao += capacidade > 0 ? (media / capacidade) * 100 : 0;
      linhasComOcupacao += 1;
    }
  });

  return {
    realizadas,
    alunos,
    media: realizadas > 0 ? Math.round(alunos / realizadas) : 0,
    valor,
    custoMedio: realizadas > 0 ? valor / realizadas : 0,
    ocupacao: linhasComOcupacao > 0 ? somaOcupacao / linhasComOcupacao : null, // null = sem metragem ou sem aula realizada
    vacancia: taxaDeVacancia(aulasTodas),
  };
}

// Central do Mentor: as unidades dele, os líderes, os professores e o que está pendente.
//
// Só leitura. Unidades, líderes, professores e grade vêm da memória do sistema (zero leituras).
// Do banco só vêm as validações dos últimos 7 dias das unidades dele (para as aulas sem validar):
// é a mesma busca que a Página de Início de um mentor já faz.
// VALORES (quanto cada unidade gastou, evolução do trimestre): só são lidos quando a aba "Valores" ou o
// "Ver tudo" é aberto, porque custam mais. Mês já fechado usa o "fechamento do mês" (1 documento); o mês
// em andamento (ou um mês sem fechamento montado) lê as validações só das unidades deste mentor.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2, Users, UserCheck, ListChecks, LayoutGrid, LayoutList, IdCard, Phone, Mail, Eye, Info, Pencil, Globe,
  Wallet, TrendingUp, BarChart3,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { dataLocalStr, somarDias } from '../utils/agendaAulas';
import { formatCurrency, formatNumber } from '../utils/formatters';
import JanelaFicha from './pecas/JanelaFicha';
import CabecalhoFicha from './pecas/CabecalhoFicha';
import Cartao from './pecas/Cartao';
import AbasFicha from './pecas/AbasFicha';
import Contato from './pecas/Contato';
import Quadro from './pecas/Quadro';
import EmBreve from './pecas/EmBreve';
import { Campo, Vazio, EstadoCarga, SeletorDeMes } from './pecas/Basicos';
import { GraficoBarras, EvolucaoMeses } from './pecas/Graficos';
import { BOTAO_PRINCIPAL, BOTAO_BRANCO, TH, TD, SELO_ATIVO, SELO_INATIVO } from './pecas/cores';
import { QuadroEmDia, TabelaProfessores } from './secoes';
import LinkCentral from './LinkCentral';
import { iniciais } from './contato';
import { atalhoTelaCompleta, telasPermitidas, caminhos } from './atalhos';
import { acessoCentral } from './acessos';
import { useValidacoesDasUnidades, useFechamentosMensais } from './useValidacoesDaUnidade';
import { DIAS_JANELA_PENDENCIAS, periodoDoMes } from './contasUnidade';
import { mesesDoTrimestre, limitesDoMes, gastoPorUnidade, gastoPorUnidadeDoResumo, totaisPorMoeda } from './contasValores';
import { linhasDoMentor, professoresDoMentor, aValidarPorUnidade, itensEmDiaMentor } from './contasPessoas';

const doisDigitos = (n) => String(n).padStart(2, '0');
const ABAS_COM_VALORES = ['valores', 'panorama'];
// "R$ 100,00" ou "R$ 100,00 + AR$ 50,00" (moedas nunca se somam).
const textoDosTotais = (totais, paisPadrao) => (totais.length > 0
  ? totais.map((v) => formatCurrency(v.valor, v.pais)).join(' + ')
  : formatCurrency(0, paisPadrao));
// Datas lidas de um mês: o mês em andamento vai só até hoje.
const faixaDoMes = (m, mesDeHoje, hoje) => (m === mesDeHoje ? [`${m}-01`, hoje] : limitesDoMes(m));

export default function CentralMentor({ id: mentorId, z, textoVoltar, onFechar, irPara }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();

  const [aba, setAbaEscolhida] = useState('geral');
  // Os valores só são lidos do banco depois que alguém pede para vê-los (aba "Valores" ou "Ver tudo").
  const [valoresPedidos, setValoresPedidos] = useState(false);
  const setAba = (id) => {
    if (ABAS_COM_VALORES.includes(id)) setValoresPedidos(true);
    setAbaEscolhida(id);
  };
  const [agora] = useState(() => new Date());
  const hoje = dataLocalStr(agora);
  const agoraHHMM = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;
  const mesDeHoje = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesDeHoje);

  const mentor = useMemo(() => catalogs.mentores.find((m) => m.id === mentorId) || null, [catalogs.mentores, mentorId]);
  const acesso = acessoCentral('mentor', mentor, userData, catalogs);

  const linhas = useMemo(
    () => (mentor ? linhasDoMentor({
      mentor, unidades: catalogs.unidades, aulas: catalogs.aulas, vinculos: catalogs.vinculos, professores: catalogs.professores, hoje,
    }) : []),
    [mentor, catalogs.unidades, catalogs.aulas, catalogs.vinculos, catalogs.professores, hoje],
  );
  const professores = useMemo(() => professoresDoMentor(linhas), [linhas]);
  const unidades = useMemo(() => linhas.map((l) => l.unidade), [linhas]);

  // Do banco: validações dos últimos 7 dias, só das unidades dele.
  const inicioPendencias = somarDias(hoje, -(DIAS_JANELA_PENDENCIAS - 1));
  const idsParaBuscar = useMemo(() => (acesso ? unidades.map((u) => u.id) : []), [acesso, unidades]);
  const recentes = useValidacoesDasUnidades(idsParaBuscar, inicioPendencias, hoje);
  const semBusca = idsParaBuscar.length === 0;
  const aValidarMapa = useMemo(() => {
    if (semBusca) return new Map();
    if (!recentes.validacoes || recentes.erro) return null;
    return aValidarPorUnidade({ unidades, aulas: catalogs.aulas, feriados: catalogs.feriados, validacoes: recentes.validacoes, hoje, agoraHHMM });
  }, [semBusca, recentes.validacoes, recentes.erro, unidades, catalogs.aulas, catalogs.feriados, hoje, agoraHHMM]);
  const totalAValidar = useMemo(
    () => (aValidarMapa ? [...aValidarMapa.values()].reduce((s, n) => s + n, 0) : null),
    [aValidarMapa],
  );
  const itens = useMemo(() => (mentor ? itensEmDiaMentor({ mentor, linhas, aValidar: totalAValidar }) : []), [mentor, linhas, totalAValidar]);

  // ----- Valores (só depois de pedidos) -----
  const periodo = useMemo(() => periodoDoMes(mes, hoje), [mes, hoje]);
  const meses = useMemo(() => mesesDoTrimestre(mes), [mes]);
  const idsDosValores = valoresPedidos ? idsParaBuscar : [];
  const mesesFechados = useMemo(() => meses.filter((m) => m < mesDeHoje), [meses, mesDeHoje]);
  const { fechamentos, erro: erroFechamentos } = useFechamentosMensais(idsDosValores.length ? mesesFechados : []);
  // Cada mês do trimestre: o mês em andamento e os meses sem fechamento montado leem as validações
  // (só das unidades deste mentor); os outros usam o fechamento e não leem validação nenhuma.
  const precisaLer = (m) => m === mesDeHoje || (!!fechamentos && !fechamentos[m]);
  const [inicio0, fim0] = faixaDoMes(meses[0], mesDeHoje, hoje);
  const [inicio1, fim1] = faixaDoMes(meses[1], mesDeHoje, hoje);
  const [inicio2, fim2] = faixaDoMes(meses[2], mesDeHoje, hoje);
  const leitura0 = useValidacoesDasUnidades(precisaLer(meses[0]) ? idsDosValores : [], inicio0, fim0);
  const leitura1 = useValidacoesDasUnidades(precisaLer(meses[1]) ? idsDosValores : [], inicio1, fim1);
  const leitura2 = useValidacoesDasUnidades(precisaLer(meses[2]) ? idsDosValores : [], inicio2, fim2);
  const aulasTodas = catalogs.aulasTodas?.length ? catalogs.aulasTodas : catalogs.aulas;
  // gastos[i] = Map unidadeId -> { valor, realizadas, alunos, media } do mês i (null = ainda carregando).
  const gastos = useMemo(() => {
    const leituras = [leitura0.validacoes, leitura1.validacoes, leitura2.validacoes];
    return meses.map((m, i) => {
      if (m !== mesDeHoje && fechamentos?.[m]) return gastoPorUnidadeDoResumo(fechamentos[m], unidades);
      if (!leituras[i]) return null;
      const [inicio, fim] = faixaDoMes(m, mesDeHoje, hoje);
      return gastoPorUnidade({ validacoes: leituras[i], inicio, fim, aulasTodas, unidades });
    });
  }, [meses, mesDeHoje, hoje, fechamentos, leitura0.validacoes, leitura1.validacoes, leitura2.validacoes, aulasTodas, unidades]);
  const erroValores = erroFechamentos || leitura0.erro || leitura1.erro || leitura2.erro;

  if (!mentor || !acesso) return null;

  const pode = telasPermitidas(userData);
  const ativo = mentor.status === 'ativo';
  const faltam = itens.filter((i) => !i.ok).length;
  const comLider = linhas.filter((l) => l.unidade.liderUid);
  const professoresAtivos = professores.filter((p) => p.ativo).length;
  const unidadesComPendencia = aValidarMapa ? unidades.filter((u) => (aValidarMapa.get(String(u.id)) || 0) > 0).map((u) => u.id) : [];

  const selos = [
    { texto: t('centrais.papel.mentor'), cor: 'blue' },
    { texto: ativo ? t('centrais.ativo') : t('centrais.inativo'), cor: ativo ? 'emerald' : 'slate' },
    faltam > 0
      ? { texto: t('centrais.selos.faltam', { n: faltam }), cor: 'amber' }
      : { texto: t('centrais.selos.tudoEmDia'), cor: 'emerald' },
    acesso !== 'editar' && { texto: t('centrais.selos.soConsulta'), cor: 'slate' },
  ].filter(Boolean);

  const infos = [
    mentor.pais && <Contato icone={Globe} classeIcone="text-violet-500" texto={mentor.pais} />,
    <Contato icone={Building2} classeIcone="text-blue-500" texto={t('centrais.mentor.nUnidades', { n: linhas.length })} />,
    mentor.telefone
      ? <Contato icone={Phone} classeIcone="text-emerald-500" texto={mentor.telefone} copiar whatsapp pais={mentor.pais} />
      : <Contato icone={Phone} texto={t('centrais.unidade.info.mentorSemTelefone')} falta />,
    mentor.email && <Contato icone={Mail} classeIcone="text-amber-500" texto={mentor.email} copiar />,
  ].filter(Boolean);

  const acoes = (
    <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAba('panorama')}>
      <Eye className="w-3.5 h-3.5" /> {t('centrais.verTudo')}
    </button>
  );

  // Totais do mês i, separados por moeda.
  const totaisDoMes = (i) => (gastos[i]
    ? totaisPorMoeda(unidades.map((u) => ({ pais: u.pais, valor: gastos[i].get(String(u.id))?.valor || 0 })))
    : null);
  const gastoDoMes = gastos[2]; // o mês escolhido é o último do trimestre
  const totaisDoMesEscolhido = totaisDoMes(2);
  const semUnidades = unidades.length === 0;
  const carregandoValores = !semUnidades && (erroValores || !gastoDoMes);

  const abas = [
    { id: 'geral', nome: t('centrais.abas.geral'), icone: LayoutGrid, contador: faltam },
    { id: 'panorama', nome: t('centrais.abas.panorama'), icone: LayoutList },
    { id: 'valores', nome: t('centrais.abas.valores'), icone: Wallet },
    { id: 'unidades', nome: t('centrais.abas.unidades'), icone: Building2 },
    { id: 'equipe', nome: t('centrais.abas.equipe'), icone: Users },
    { id: 'cadastro', nome: t('centrais.abas.cadastro'), icone: IdCard },
  ];

  const cfgMentores = pode.cfgMentores && caminhos.configuracoes(irPara, 'mentores');
  const destinos = {
    ativo: cfgMentores,
    telefone: cfgMentores,
    loginGoogle: null, // só o próprio mentor troca o login dele
    unidades: pode.cfgUnidades && caminhos.configuracoes(irPara, 'unidades'),
    semLider: pode.cfgLideres && caminhos.configuracoes(irPara, 'lideres'),
    lideresAConferir: pode.cfgLideres && caminhos.configuracoes(irPara, 'lideres'),
    validacoes: pode.validacao && unidadesComPendencia.length > 0
      && caminhos.validacao(irPara, { inicio: inicioPendencias, fim: hoje, unidadeIds: unidadesComPendencia }),
  };

  const principal = (
    <Quadro titulo={t('centrais.infoPrincipais')} icone={Info}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.abas.unidades')}>{formatNumber(linhas.length)}</Campo>
        <Campo rotulo={t('centrais.mentor.cartoes.lideres')}>{t('centrais.mentor.lideresDe', { n: comLider.length, total: linhas.length })}</Campo>
        <Campo rotulo={t('centrais.unidade.cartoes.professores.titulo')}>{formatNumber(professoresAtivos)}</Campo>
        <Campo rotulo={t('centrais.aValidar7dias')} falta={recentes.erro}>
          {recentes.erro ? t('centrais.naoCarregou') : totalAValidar === null ? '…' : formatNumber(totalAValidar)}
        </Campo>
      </div>
    </Quadro>
  );

  const valores = (
    <>
      <SeletorDeMes mes={mes} mesMaximo={mesDeHoje} onTrocar={setMes} periodo={periodo} />
      <Quadro titulo={t('centrais.valores.trimestreTitulo')} icone={TrendingUp}>
        {semUnidades ? <Vazio texto={t('centrais.mentor.semUnidades')} /> : erroValores ? <EstadoCarga erro /> : (
          <EvolucaoMeses
            meses={meses.map((m, i) => {
              const totais = totaisDoMes(i);
              const mapa = gastos[i];
              const aulasDoMes = mapa ? [...mapa.values()].reduce((soma, x) => soma + x.realizadas, 0) : 0;
              const alunosDoMes = mapa ? [...mapa.values()].reduce((soma, x) => soma + x.alunos, 0) : 0;
              return {
                mes: m,
                valor: totais ? totais.reduce((soma, x) => soma + x.valor, 0) : null,
                valorTexto: totais ? textoDosTotais(totais, mentor.pais) : '',
                detalhe: mapa
                  ? t('centrais.valores.aulasEAlunos', { aulas: formatNumber(aulasDoMes), alunos: formatNumber(alunosDoMes) })
                  : t('centrais.carregando'),
                emAndamento: m === mesDeHoje,
              };
            })}
          />
        )}
      </Quadro>
      <Quadro titulo={t('centrais.mentor.gastoPorUnidadeTitulo')} icone={BarChart3}>
        {semUnidades ? <Vazio texto={t('centrais.mentor.semUnidades')} /> : carregandoValores ? <EstadoCarga erro={erroValores} /> : (
          <>
            <p className="mb-4 text-[12px] font-bold text-slate-600 dark:text-slate-300">
              {t('centrais.mentor.totalDoMes')}{' '}
              <span className="text-[15px] font-extrabold text-slate-800 dark:text-white">{textoDosTotais(totaisDoMesEscolhido, mentor.pais)}</span>
            </p>
            <GraficoBarras
              linhas={unidades
                .map((u) => ({ unidade: u, ...(gastoDoMes.get(String(u.id)) || { valor: 0, realizadas: 0, media: 0 }) }))
                .sort((a, b) => b.valor - a.valor)
                .map((g) => ({
                  chave: g.unidade.id,
                  rotulo: <LinkCentral tipo="unidade" alvo={g.unidade}>{g.unidade.nome}</LinkCentral>,
                  valor: g.valor,
                  valorTexto: formatCurrency(g.valor, g.unidade.pais),
                  detalhe: t('centrais.valores.detalheUnidade', {
                    aulas: formatNumber(g.realizadas),
                    media: formatNumber(g.media),
                    porAula: formatCurrency(g.realizadas > 0 ? g.valor / g.realizadas : 0, g.unidade.pais),
                  }),
                }))}
            />
          </>
        )}
      </Quadro>
    </>
  );

  const emDia = <QuadroEmDia itens={itens} prefixo="centrais.mentor.emDia" caminhos={destinos} />;

  const tabelaUnidades = (
    <Quadro
      titulo={t('centrais.mentor.unidadesTitulo')}
      icone={Building2}
      acao={atalhoTelaCompleta(t, pode.cfgUnidades, caminhos.configuracoes(irPara, 'unidades'))}
    >
      {linhas.length === 0 ? <Vazio texto={t('centrais.mentor.semUnidades')} /> : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[680px] text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className={TH}>{t('centrais.papel.unidade')}</th>
                <th className={TH}>{t('centrais.papel.lider')}</th>
                <th className={`${TH} text-center`}>{t('centrais.professores.titulo')}</th>
                <th className={`${TH} text-center`}>{t('centrais.aulasNaSemana')}</th>
                <th className={`${TH} text-center`}>{t('centrais.aValidar7dias')}</th>
                <th className={TH}>{t('centrais.mentor.cadastroDaUnidade')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {linhas.map((linha) => {
                const { unidade } = linha;
                const aValidar = aValidarMapa ? (aValidarMapa.get(String(unidade.id)) || 0) : null;
                return (
                  <tr key={unidade.id}>
                    <td className={`${TD} font-bold text-slate-800 dark:text-white`}>
                      <LinkCentral tipo="unidade" alvo={unidade}>{unidade.nome}</LinkCentral>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {unidade.estado || ''}{unidade.status && unidade.status !== 'ativa' ? ` · ${t('centrais.unidade.selos.inativa')}` : ''}
                      </p>
                    </td>
                    <td className={TD}>
                      {unidade.liderUid ? (
                        <LinkCentral tipo="lider" alvo={unidade} className="font-semibold text-slate-700 dark:text-slate-200">
                          {unidade.liderNome || unidade.liderEmail}
                        </LinkCentral>
                      ) : (
                        <span className="font-bold text-rose-600 dark:text-rose-400">{t('centrais.unidade.info.semLider')}</span>
                      )}
                      {unidade.liderUid && unidade.liderAConferir === true && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{t('centrais.aguardandoConferencia')}</p>
                      )}
                    </td>
                    <td className={`${TD} text-center font-extrabold text-slate-800 dark:text-white`}>{linha.professoresAtivos}</td>
                    <td className={`${TD} text-center font-extrabold ${linha.aulasNaSemana ? 'text-slate-800 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>{linha.aulasNaSemana}</td>
                    <td className={`${TD} text-center font-extrabold ${aValidar ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>
                      {recentes.erro ? '—' : aValidar === null ? '…' : aValidar}
                    </td>
                    <td className={TD}>
                      <span className={linha.faltasCadastro > 0
                        ? 'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        : SELO_ATIVO}
                      >
                        {linha.faltasCadastro > 0 ? t('centrais.selos.faltam', { n: linha.faltasCadastro }) : t('centrais.selos.tudoEmDia')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Quadro>
  );

  const equipe = (
    <>
      <Quadro
        titulo={t('centrais.mentor.lideresTitulo')}
        icone={UserCheck}
        acao={atalhoTelaCompleta(t, pode.cfgLideres, caminhos.configuracoes(irPara, 'lideres'))}
      >
        {comLider.length === 0 ? <Vazio texto={t('centrais.mentor.semLideres')} /> : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className={TH}>{t('centrais.papel.lider')}</th>
                  <th className={TH}>{t('centrais.papel.unidade')}</th>
                  <th className={TH}>{t('centrais.professores.contato')}</th>
                  <th className={TH}>{t('centrais.situacao')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {comLider.map(({ unidade }) => (
                  <tr key={unidade.id}>
                    <td className={`${TD} font-bold text-slate-800 dark:text-white`}>
                      <LinkCentral tipo="lider" alvo={unidade}>{unidade.liderNome || unidade.liderEmail}</LinkCentral>
                    </td>
                    <td className={`${TD} font-semibold text-slate-600 dark:text-slate-300`}>{unidade.nome}</td>
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        {unidade.liderTelefone
                          ? <Contato icone={Phone} texto={unidade.liderTelefone} copiar whatsapp pais={unidade.pais} />
                          : <Contato icone={Phone} texto={t('centrais.unidade.info.liderSemTelefone')} falta />}
                        {unidade.liderEmail && <Contato icone={Mail} texto={unidade.liderEmail} copiar />}
                      </div>
                    </td>
                    <td className={TD}>
                      <span className={unidade.liderAConferir === true ? SELO_INATIVO : SELO_ATIVO}>
                        {unidade.liderAConferir === true ? t('centrais.aguardandoConferencia') : t('centrais.lider.conferido')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Quadro>
      <Quadro
        titulo={t('centrais.mentor.professoresTitulo')}
        icone={Users}
        acao={atalhoTelaCompleta(t, pode.cfgProfessores, caminhos.configuracoes(irPara, 'professores'))}
      >
        <TabelaProfessores linhas={professores} paisPadrao={mentor.pais} textoVazio={t('centrais.mentor.semProfessores')} />
      </Quadro>
    </>
  );

  const cadastro = (
    <Quadro titulo={t('centrais.mentor.cadastroTitulo')} icone={IdCard}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.cadastro.nome')}><Contato texto={mentor.nome} copiar /></Campo>
        <Campo rotulo={t('centrais.cadastro.email')} falta={!mentor.email}>
          {mentor.email ? <Contato icone={Mail} texto={mentor.email} copiar /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.telefone')} falta={!mentor.telefone}>
          {mentor.telefone ? <Contato icone={Phone} texto={mentor.telefone} copiar whatsapp pais={mentor.pais} /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.pais')}>{mentor.pais || t('centrais.naoInformado')}</Campo>
        <Campo rotulo={t('centrais.situacao')} falta={!ativo}>{ativo ? t('centrais.ativo') : t('centrais.inativo')}</Campo>
        <Campo rotulo={t('centrais.cadastro.acesso')} falta={mentor.loginGoogle !== true}>
          {mentor.loginGoogle === true ? t('centrais.acessoGoogle') : t('centrais.mentor.loginAntigo')}
        </Campo>
        <Campo rotulo={t('centrais.ultimoAcessoRotulo')}><EmBreve /></Campo>
      </div>
      {pode.cfgMentores && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" className={BOTAO_BRANCO} onClick={caminhos.configuracoes(irPara, 'mentores')}>
            <Pencil className="w-3.5 h-3.5" /> {t('centrais.editarNasConfiguracoes')}
          </button>
        </div>
      )}
    </Quadro>
  );

  return (
    <JanelaFicha z={z} onFechar={onFechar} textoVoltar={textoVoltar} rotulo={`${t('centrais.mentor.rotulo')}: ${mentor.nome}`}>
      <CabecalhoFicha iniciais={iniciais(mentor.nome)} ativo={ativo} nome={mentor.nome} selos={selos} infos={infos} acoes={acoes} />

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Cartao
          icone={Wallet}
          cor="emerald"
          titulo={t('centrais.mentor.cartoes.gasto')}
          valor={!valoresPedidos || semUnidades || erroValores ? '—' : totaisDoMesEscolhido ? textoDosTotais(totaisDoMesEscolhido, mentor.pais) : '…'}
          frase={semUnidades
            ? t('centrais.mentor.semUnidades')
            : !valoresPedidos
              ? t('centrais.mentor.cartoes.gastoAbrir')
              : erroValores ? t('centrais.naoCarregou') : t('centrais.mentor.cartoes.gastoFrase')}
          alerta={valoresPedidos && erroValores}
          onClick={() => setAba('valores')}
        />
        <Cartao
          icone={Building2}
          cor="violet"
          titulo={t('centrais.abas.unidades')}
          valor={formatNumber(linhas.length)}
          frase={linhas.length > 0 ? t('centrais.mentor.cartoes.unidadesFrase') : t('centrais.mentor.semUnidades')}
          alerta={linhas.length === 0}
          onClick={() => setAba('unidades')}
        />
        <Cartao
          icone={Users}
          cor="blue"
          titulo={t('centrais.mentor.cartoes.professores')}
          valor={formatNumber(professoresAtivos)}
          frase={t('centrais.mentor.cartoes.professoresFrase', { n: professores.length })}
          onClick={() => setAba('equipe')}
        />
        <Cartao
          icone={UserCheck}
          cor="emerald"
          titulo={t('centrais.mentor.cartoes.lideres')}
          valor={formatNumber(comLider.length)}
          frase={linhas.length - comLider.length > 0
            ? t('centrais.mentor.cartoes.semLider', { n: linhas.length - comLider.length })
            : t('centrais.mentor.cartoes.todasComLider')}
          alerta={linhas.length - comLider.length > 0}
          onClick={() => setAba('equipe')}
        />
        <Cartao
          icone={ListChecks}
          cor="emerald"
          titulo={t('centrais.pendencias')}
          valor={formatNumber(faltam)}
          frase={recentes.erro
            ? t('centrais.naoCarregou')
            : totalAValidar === null ? t('centrais.carregando') : t('centrais.aulasAValidar', { n: totalAValidar })}
          alerta={faltam > 0 || recentes.erro}
          onClick={() => setAba('geral')}
        />
      </div>

      <div className="mt-4">
        <AbasFicha abas={abas} ativa={aba} onTrocar={setAba} />
      </div>

      <div className="mt-4 space-y-4">
        {aba === 'geral' && <>{principal}{emDia}</>}
        {aba === 'panorama' && <>{principal}{valores}{emDia}{tabelaUnidades}{equipe}{cadastro}</>}
        {aba === 'valores' && valores}
        {aba === 'unidades' && tabelaUnidades}
        {aba === 'equipe' && equipe}
        {aba === 'cadastro' && cadastro}
      </div>
    </JanelaFicha>
  );
}

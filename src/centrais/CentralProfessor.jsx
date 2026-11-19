// Central do Professor de coletiva: quanto ganhou, aulas dadas, unidades, grade e situação do cadastro.
//
// Só leitura. Cadastro, vínculos e grade vêm da memória do sistema (zero leituras). Do banco vêm só as
// validações DELE no trimestre (mês escolhido + os dois anteriores): aulas que deu e aulas dele dadas
// por substituto. Quem olha só enxerga o que é das unidades que pode ver (mentor: as dele; líder: a própria).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2, CalendarDays, History, BadgeCheck, LayoutGrid, LayoutList, IdCard, Phone, Mail, Eye, Info,
  Pencil, BarChart3, Globe, Wallet, TrendingUp, ListOrdered,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { dataLocalStr } from '../utils/agendaAulas';
import { formatCurrency, formatDate, formatNumber, formatWeekday, getDiaSemana } from '../utils/formatters';
import JanelaFicha from './pecas/JanelaFicha';
import CabecalhoFicha from './pecas/CabecalhoFicha';
import Cartao from './pecas/Cartao';
import AbasFicha from './pecas/AbasFicha';
import Contato from './pecas/Contato';
import Quadro from './pecas/Quadro';
import EmBreve from './pecas/EmBreve';
import Variacao from './pecas/Variacao';
import { Campo, Vazio, Numero, EstadoCarga, SeletorDeMes } from './pecas/Basicos';
import { GraficoBarras, EvolucaoMeses } from './pecas/Graficos';
import { BOTAO_PRINCIPAL, BOTAO_BRANCO, TH, TD, SELO_ATIVO, SELO_INATIVO } from './pecas/cores';
import { QuadroEmDia, GradeSemanal } from './secoes';
import { CampoDocumento, CampoUltimoAcesso } from './CamposDaPessoa';
import { lerDocumento } from '../services/documentoService';
import { lerDocumentoDaFicha } from '../services/documentoFichaService';
import LinkCentral from './LinkCentral';
import { iniciais } from './contato';
import { atalhoTelaCompleta, telasPermitidas, caminhos } from './atalhos';
import { acessoCentral, unidadesVisiveis, ehOProprioProfessor } from './acessos';
import { useValidacoesDoProfessor } from './useValidacoesDaUnidade';
import { aulasNaSemana, gradePorDia, periodoDoMes } from './contasUnidade';
import { unidadesDoProfessor, aulasDoProfessor, resumoDoProfessor, aValidarDoProfessor, itensEmDiaProfessor } from './contasPessoas';
import {
  mesesDoTrimestre, limitesDoMes, ganhoDoProfessorPorMes, ganhoDoProfessorPorUnidade, ultimasAulasDoProfessor,
} from './contasValores';

// "R$ 100,00" ou, para quem dá aula em países diferentes, "R$ 100,00 + AR$ 50,00" (moedas nunca se somam).
const textoDosValores = (valores, paisPadrao) => (valores.length > 0
  ? valores.map((v) => formatCurrency(v.valor, v.pais)).join(' + ')
  : formatCurrency(0, paisPadrao));

export default function CentralProfessor({ id: professorId, z, textoVoltar, onFechar, irPara }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();

  const [aba, setAba] = useState('geral');
  const [agora] = useState(() => new Date());
  const hoje = dataLocalStr(agora);
  const mesDeHoje = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesDeHoje);

  const professor = useMemo(
    () => catalogs.professores.find((p) => String(p.id) === String(professorId)) || null,
    [catalogs.professores, professorId],
  );
  const acesso = acessoCentral('professor', professor, userData, catalogs);
  const ehEle = ehOProprioProfessor(userData, professor);

  // Unidades que quem está olhando enxerga (o próprio professor: as do catálogo dele, já recortado pelos vínculos).
  const visiveis = useMemo(
    () => (ehEle ? catalogs.unidades : unidadesVisiveis(userData, catalogs.unidades)),
    [ehEle, userData, catalogs.unidades],
  );
  const unidades = useMemo(
    () => unidadesDoProfessor({ professorId, vinculos: catalogs.vinculos, unidades: visiveis }),
    [professorId, catalogs.vinculos, visiveis],
  );
  const aulas = useMemo(
    () => aulasDoProfessor({ aulas: catalogs.aulas, professorId, unidades: visiveis, hoje }),
    [catalogs.aulas, professorId, visiveis, hoje],
  );
  const grade = useMemo(() => gradePorDia(aulas), [aulas]);
  const modalidadePorId = useMemo(() => new Map(catalogs.modalidades.map((m) => [String(m.id), m])), [catalogs.modalidades]);
  const unidadePorId = useMemo(() => new Map(visiveis.map((u) => [String(u.id), u])), [visiveis]);
  const modalidades = useMemo(
    () => [...new Set(aulas.map((a) => String(a.modalidadeId)))].map((id) => modalidadePorId.get(id)).filter(Boolean),
    [aulas, modalidadePorId],
  );

  // ----- Do banco: validações dele no trimestre (mês escolhido + os dois anteriores) -----
  const periodo = useMemo(() => periodoDoMes(mes, hoje), [mes, hoje]);
  const meses = useMemo(() => mesesDoTrimestre(mes), [mes]);
  const inicioDoTrimestre = limitesDoMes(meses[0])[0];
  const inicioDoMesAtual = `${mesDeHoje}-01`;
  // No mês atual, a busca do trimestre já cobre o mês até hoje; só em mês antigo é preciso buscar à parte.
  const cobreOMesAtual = inicioDoTrimestre <= inicioDoMesAtual && periodo.fim >= hoje;
  const idParaBuscar = acesso ? professorId : null;
  const doTrimestre = useValidacoesDoProfessor(idParaBuscar, inicioDoTrimestre, periodo.fim);
  const doMes = useValidacoesDoProfessor(cobreOMesAtual ? null : idParaBuscar, inicioDoMesAtual, hoje);
  const validacoes = doTrimestre.validacoes;
  const validacoesDoMes = cobreOMesAtual ? doTrimestre.validacoes : doMes.validacoes;
  const erroDoMes = cobreOMesAtual ? doTrimestre.erro : doMes.erro;
  const erro = doTrimestre.erro;

  const aulasTodas = catalogs.aulasTodas?.length ? catalogs.aulasTodas : catalogs.aulas;
  const base = useMemo(() => ({ professorId, aulasTodas, unidades: visiveis }), [professorId, aulasTodas, visiveis]);
  const resumo = useMemo(
    () => (validacoes ? resumoDoProfessor({ validacoes, inicio: periodo.inicio, fim: periodo.fim, ...base }) : null),
    [validacoes, periodo, base],
  );
  const anterior = useMemo(
    () => (validacoes ? resumoDoProfessor({ validacoes, inicio: periodo.inicioAnterior, fim: periodo.fimAnterior, ...base }) : null),
    [validacoes, periodo, base],
  );
  const porMes = useMemo(() => (validacoes ? ganhoDoProfessorPorMes({ validacoes, meses, ...base }) : null), [validacoes, meses, base]);
  const porUnidade = useMemo(
    () => (validacoes ? ganhoDoProfessorPorUnidade({ validacoes, inicio: periodo.inicio, fim: periodo.fim, ...base }) : null),
    [validacoes, periodo, base],
  );
  // Últimas aulas dadas: as mais recentes dentro do que foi lido (o trimestre).
  const ultimas = useMemo(() => (validacoes ? ultimasAulasDoProfessor({ validacoes, ...base }) : null), [validacoes, base]);
  const aValidar = useMemo(
    () => (validacoesDoMes && !erroDoMes
      ? aValidarDoProfessor({ aulas: catalogs.aulas, unidades: visiveis, feriados: catalogs.feriados, validacoes: validacoesDoMes, professorId, hoje })
      : null),
    [validacoesDoMes, erroDoMes, catalogs.aulas, visiveis, catalogs.feriados, professorId, hoje],
  );
  const itens = useMemo(
    () => (professor ? itensEmDiaProfessor({ professor, unidades, aulas, aValidar }) : []),
    [professor, unidades, aulas, aValidar],
  );

  if (!professor || !acesso) return null;

  const pode = telasPermitidas(userData);
  // CPF/DNI/SSN do professor: só admin e mentor leem a gaveta da ficha (o banco confere).
  const papelDeQuemOlha = String(userData?.role || '').trim().toLowerCase();
  const podeVerDocumento = ['admin', 'administrador', 'master', 'mentor'].includes(papelDeQuemOlha);
  const lerDocumentoDaGrade = async (id) => (await lerDocumentoDaFicha(id)) || (professor.uidLogin ? lerDocumento(professor.uidLogin) : null);
  const ativo = professor.status === 'ativo';
  const faltam = itens.filter((i) => !i.ok).length;
  const totalNaSemana = aulasNaSemana(aulas);
  const paisPadrao = professor.pais || unidades[0]?.unidade.pais;
  const ultimaAula = ultimas?.[0]?.data || null;
  const carregando = erro || !resumo;
  const umaMoeda = (lista) => (lista?.valores.length === 1 ? lista.valores[0].valor : null);

  const selos = [
    { texto: t('centrais.papel.professor'), cor: 'blue' },
    { texto: ativo ? t('centrais.ativo') : t('centrais.inativo'), cor: ativo ? 'emerald' : 'slate' },
    faltam > 0
      ? { texto: t('centrais.selos.faltam', { n: faltam }), cor: 'amber' }
      : { texto: t('centrais.selos.tudoEmDia'), cor: 'emerald' },
    acesso !== 'editar' && { texto: t('centrais.selos.soConsulta'), cor: 'slate' },
  ].filter(Boolean);

  const infos = [
    professor.pais && <Contato icone={Globe} classeIcone="text-violet-500" texto={professor.pais} />,
    unidades.length > 0
      ? <Contato icone={Building2} classeIcone="text-blue-500" texto={unidades.length === 1 ? unidades[0].unidade.nome : t('centrais.professor.nUnidades', { n: unidades.length })} />
      : <Contato icone={Building2} texto={t('centrais.professor.semUnidade')} falta />,
    professor.telefone
      ? <Contato icone={Phone} classeIcone="text-emerald-500" texto={professor.telefone} copiar whatsapp pais={paisPadrao} />
      : <Contato icone={Phone} texto={t('centrais.professor.semTelefone')} falta />,
    professor.email
      ? <Contato icone={Mail} classeIcone="text-amber-500" texto={professor.email} copiar />
      : <Contato icone={Mail} texto={t('centrais.professor.semEmail')} falta />,
  ].filter(Boolean);

  const acoes = (
    <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAba('panorama')}>
      <Eye className="w-3.5 h-3.5" /> {t('centrais.verTudo')}
    </button>
  );

  const abas = [
    { id: 'geral', nome: t('centrais.abas.geral'), icone: LayoutGrid, contador: faltam },
    { id: 'panorama', nome: t('centrais.abas.panorama'), icone: LayoutList },
    { id: 'valores', nome: t('centrais.abas.valores'), icone: Wallet },
    { id: 'aulas', nome: t('centrais.abas.aulas'), icone: CalendarDays },
    { id: 'unidades', nome: t('centrais.abas.unidades'), icone: Building2 },
    { id: 'cadastro', nome: t('centrais.abas.cadastro'), icone: IdCard },
  ];

  const cfgProfessores = pode.cfgProfessores && caminhos.configuracoes(irPara, 'professores');
  const idsDasUnidades = unidades.map((u) => u.unidade.id);
  const abrirCronograma = caminhos.cronograma(irPara, idsDasUnidades.length === 1 ? idsDasUnidades[0] : null);
  const destinos = {
    ativo: cfgProfessores, telefone: cfgProfessores, email: cfgProfessores, login: cfgProfessores, vinculo: cfgProfessores,
    grade: pode.cronograma && abrirCronograma,
    validacoes: pode.validacao && !ehEle && idsDasUnidades.length > 0
      ? caminhos.validacao(irPara, { inicio: inicioDoMesAtual, fim: hoje, unidadeIds: idsDasUnidades })
      : pode.validacao && (() => irPara('/app/validacao-diaria')),
  };

  const principal = (
    <Quadro titulo={t('centrais.infoPrincipais')} icone={Info}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.abas.unidades')} falta={unidades.length === 0}>
          {unidades.length > 0 ? unidades.map((u) => u.unidade.nome).join(', ') : t('centrais.professor.semUnidade')}
        </Campo>
        <Campo rotulo={t('centrais.professor.modalidades')} falta={modalidades.length === 0}>
          {modalidades.length > 0 ? modalidades.map((m) => m.nome).join(', ') : t('centrais.semAulaNaGrade')}
        </Campo>
        <Campo rotulo={t('centrais.aulasNaSemana')}>{formatNumber(totalNaSemana)}</Campo>
        <Campo rotulo={t('centrais.situacao')} falta={!ativo}>{ativo ? t('centrais.ativo') : t('centrais.inativo')}</Campo>
      </div>
    </Quadro>
  );

  const numeros = (
    <Quadro titulo={t('centrais.professor.numerosTitulo')} icone={BarChart3}>
      {carregando ? <EstadoCarga erro={erro} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Numero
            rotulo={t('centrais.professor.aReceber')}
            valor={textoDosValores(resumo.valores, paisPadrao)}
            extra={umaMoeda(resumo) !== null && umaMoeda(anterior) ? <Variacao atual={umaMoeda(resumo)} anterior={umaMoeda(anterior)} /> : null}
            frase={t('centrais.professor.aReceberFrase')}
          />
          <Numero
            rotulo={t('centrais.professor.aulasDadas')}
            valor={formatNumber(resumo.realizadas)}
            extra={<Variacao atual={resumo.realizadas} anterior={anterior?.realizadas} />}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.alunos')}
            valor={formatNumber(resumo.alunos)}
            extra={<Variacao atual={resumo.alunos} anterior={anterior?.alunos} />}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.media')}
            valor={formatNumber(resumo.media)}
            extra={<Variacao atual={resumo.media} anterior={anterior?.media} />}
          />
        </div>
      )}
    </Quadro>
  );

  const evolucao = (
    <Quadro titulo={t('centrais.valores.trimestreTitulo')} icone={TrendingUp}>
      {erro || !porMes ? <EstadoCarga erro={erro} /> : (
        <EvolucaoMeses
          meses={porMes.map((m) => ({
            mes: m.mes,
            valor: m.valores.length <= 1 ? (m.valores[0]?.valor || 0) : m.valores.reduce((s, v) => s + v.valor, 0),
            valorTexto: textoDosValores(m.valores, paisPadrao),
            detalhe: t('centrais.valores.aulasEAlunos', { aulas: formatNumber(m.realizadas), alunos: formatNumber(m.alunos) }),
            emAndamento: m.mes === mesDeHoje,
          }))}
        />
      )}
    </Quadro>
  );

  const quadroPorUnidade = (
    <Quadro titulo={t('centrais.professor.porUnidadeTitulo')} icone={Wallet}>
      {erro || !porUnidade ? <EstadoCarga erro={erro} /> : porUnidade.length === 0 ? <Vazio texto={t('centrais.semAulaNoPeriodo')} /> : (
        <GraficoBarras
          linhas={porUnidade.map((u) => ({
            chave: u.unidade.id,
            rotulo: <LinkCentral tipo="unidade" alvo={u.unidade}>{u.unidade.nome}</LinkCentral>,
            valor: u.valor,
            valorTexto: formatCurrency(u.valor, u.unidade.pais),
            detalhe: t('centrais.valores.detalheProfessor', {
              aulas: formatNumber(u.realizadas),
              media: formatNumber(u.media),
              porAula: formatCurrency(u.realizadas > 0 ? u.valor / u.realizadas : 0, u.unidade.pais),
            }),
          }))}
        />
      )}
    </Quadro>
  );

  const quadroUltimas = (
    <Quadro titulo={t('centrais.professor.ultimasTitulo')} icone={ListOrdered}>
      {erro || !ultimas ? <EstadoCarga erro={erro} /> : ultimas.length === 0 ? (
        <Vazio texto={t('centrais.professor.semAulaRecente', { data: formatDate(inicioDoTrimestre) })} />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className={TH}>{t('centrais.professor.data')}</th>
                <th className={TH}>{t('centrais.papel.unidade')}</th>
                <th className={TH}>{t('centrais.professor.modalidade')}</th>
                <th className={`${TH} text-center`}>{t('centrais.unidade.resumo.alunos')}</th>
                <th className={`${TH} text-right`}>{t('centrais.professor.valor')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ultimas.map((a) => (
                <tr key={a.id}>
                  <td className={`${TD} font-bold text-slate-800 dark:text-white whitespace-nowrap`}>
                    {formatDate(a.data)} <span className="font-semibold text-slate-400">· {formatWeekday(getDiaSemana(a.data), { short: true })} {a.hora}</span>
                  </td>
                  <td className={`${TD} font-semibold text-slate-600 dark:text-slate-300`}>{a.unidade.nome}</td>
                  <td className={`${TD} font-semibold text-slate-600 dark:text-slate-300`}>
                    {modalidadePorId.get(String(a.modalidadeId))?.nome || t('common.unknown.modality')}
                    {a.substituicao && <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{t('centrais.professor.substituicao')}</span>}
                    {a.aulao && <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{t('centrais.professor.aulao')}</span>}
                  </td>
                  <td className={`${TD} text-center font-extrabold text-slate-800 dark:text-white`}>{formatNumber(a.alunos)}</td>
                  <td className={`${TD} text-right font-extrabold text-slate-800 dark:text-white whitespace-nowrap`}>{formatCurrency(a.valor, a.unidade.pais)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Quadro>
  );

  const emDia = <QuadroEmDia itens={itens} prefixo="centrais.professor.emDia" caminhos={destinos} />;

  const quadroGrade = (
    <Quadro titulo={t('centrais.professor.gradeTitulo')} icone={CalendarDays} acao={atalhoTelaCompleta(t, pode.cronograma, abrirCronograma)}>
      <GradeSemanal grade={grade} modalidadePorId={modalidadePorId} unidadePorId={unidadePorId} textoVazio={t('centrais.professor.semAulas')} />
    </Quadro>
  );

  const ganhoNaUnidade = new Map((porUnidade || []).map((u) => [String(u.unidade.id), u]));
  const quadroUnidades = (
    <Quadro titulo={t('centrais.professor.unidadesTitulo')} icone={Building2}>
      {unidades.length === 0 ? <Vazio texto={t('centrais.professor.semUnidade')} /> : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className={TH}>{t('centrais.papel.unidade')}</th>
                <th className={TH}>{t('centrais.unidade.geral.local')}</th>
                <th className={`${TH} text-center`}>{t('centrais.aulasNaSemana')}</th>
                <th className={`${TH} text-center`}>{t('centrais.professores.aulasDadas')}</th>
                <th className={`${TH} text-right`}>{t('centrais.professores.recebeu')}</th>
                <th className={TH}>{t('centrais.professor.vinculo')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unidades.map(({ unidade, ativo: vinculoAtivo }) => {
                const naUnidade = aulasNaSemana(aulas.filter((a) => String(a.unidadeId) === String(unidade.id)));
                const ganho = ganhoNaUnidade.get(String(unidade.id));
                return (
                  <tr key={unidade.id}>
                    <td className={`${TD} font-bold text-slate-800 dark:text-white`}>
                      <LinkCentral tipo="unidade" alvo={unidade}>{unidade.nome}</LinkCentral>
                    </td>
                    <td className={`${TD} font-semibold text-slate-600 dark:text-slate-300`}>{[unidade.estado, unidade.pais].filter(Boolean).join(' · ')}</td>
                    <td className={`${TD} text-center font-extrabold ${naUnidade ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{naUnidade}</td>
                    <td className={`${TD} text-center font-extrabold text-slate-800 dark:text-white`}>{erro ? '—' : !porUnidade ? '…' : formatNumber(ganho?.realizadas || 0)}</td>
                    <td className={`${TD} text-right font-extrabold text-slate-800 dark:text-white whitespace-nowrap`}>{erro ? '—' : !porUnidade ? '…' : formatCurrency(ganho?.valor || 0, unidade.pais)}</td>
                    <td className={TD}>
                      <span className={vinculoAtivo ? SELO_ATIVO : SELO_INATIVO}>{vinculoAtivo ? t('centrais.ativo') : t('centrais.inativo')}</span>
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

  const cadastro = (
    <Quadro titulo={t('centrais.professor.cadastroTitulo')} icone={IdCard}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.cadastro.nome')}><Contato texto={professor.nome} copiar /></Campo>
        <Campo rotulo={t('centrais.cadastro.email')} falta={!professor.email}>
          {professor.email ? <Contato icone={Mail} texto={professor.email} copiar /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.telefone')} falta={!professor.telefone}>
          {professor.telefone ? <Contato icone={Phone} texto={professor.telefone} copiar whatsapp pais={paisPadrao} /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.pais')}>{professor.pais || t('centrais.naoInformado')}</Campo>
        <Campo rotulo={t('centrais.situacao')} falta={!ativo}>{ativo ? t('centrais.ativo') : t('centrais.inativo')}</Campo>
        <Campo rotulo={t('centrais.cadastro.acesso')} falta={!professor.uidLogin}>
          {professor.uidLogin ? t('centrais.professor.loginCriado') : t('centrais.professor.semLogin')}
        </Campo>
        <Campo rotulo={t('centrais.professor.cadastradoEm')}>{professor.createdAt ? formatDate(professor.createdAt) : t('centrais.naoInformado')}</Campo>
        <Campo rotulo={t('centrais.abas.unidades')} falta={unidades.length === 0}>
          {unidades.length > 0 ? unidades.map((u) => u.unidade.nome).join(', ') : t('centrais.professor.semUnidade')}
        </Campo>
        <Campo rotulo={t('centrais.professor.modalidades')}>
          {modalidades.length > 0 ? modalidades.map((m) => m.nome).join(', ') : t('centrais.semAulaNaGrade')}
        </Campo>
        <Campo rotulo={t('centrais.professor.workshops')} falta={!(professor.workshops || []).length}>
          {(professor.workshops || []).length > 0
            ? [...professor.workshops].sort((a, b) => String(b.data).localeCompare(String(a.data))).map((w) => `${w.nome}${w.data ? ` (${formatDate(w.data)})` : ''}`).join(' · ')
            : t('centrais.professor.semWorkshops')}
        </Campo>
        <CampoDocumento pode={podeVerDocumento} chave={String(professor.id)} leitor={lerDocumentoDaGrade} />
        <CampoUltimoAcesso uid={professor.uidLogin} />
      </div>
      {pode.cfgProfessores && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" className={BOTAO_BRANCO} onClick={caminhos.configuracoes(irPara, 'professores')}>
            <Pencil className="w-3.5 h-3.5" /> {t('centrais.editarNasConfiguracoes')}
          </button>
        </div>
      )}
    </Quadro>
  );

  return (
    <JanelaFicha z={z} onFechar={onFechar} textoVoltar={textoVoltar} rotulo={`${t('centrais.professor.rotulo')}: ${professor.nome}`}>
      <CabecalhoFicha iniciais={iniciais(professor.nome)} ativo={ativo} nome={professor.nome} selos={selos} infos={infos} acoes={acoes} />

      <SeletorDeMes mes={mes} mesMaximo={mesDeHoje} onTrocar={setMes} periodo={periodo} />

      <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Cartao
          icone={Wallet}
          cor="emerald"
          titulo={t('centrais.professor.cartoes.aReceber')}
          valor={erro ? '—' : resumo ? textoDosValores(resumo.valores, paisPadrao) : '…'}
          extra={resumo && umaMoeda(resumo) !== null && umaMoeda(anterior) ? <Variacao atual={umaMoeda(resumo)} anterior={umaMoeda(anterior)} /> : null}
          frase={erro ? t('centrais.naoCarregou') : !resumo ? t('centrais.carregando') : t('centrais.professor.cartoes.aulasNoPeriodo', { n: resumo.realizadas })}
          alerta={erro}
          onClick={() => setAba('valores')}
        />
        <Cartao
          icone={Building2}
          cor="violet"
          titulo={t('centrais.abas.unidades')}
          valor={unidades.length === 1 ? unidades[0].unidade.nome : formatNumber(unidades.length)}
          frase={unidades.length === 0
            ? t('centrais.professor.semUnidade')
            : unidades.length === 1 ? t('centrais.professor.cartoes.umaUnidade') : unidades.map((u) => u.unidade.nome).join(', ')}
          alerta={unidades.length === 0}
          onClick={() => setAba('unidades')}
        />
        <Cartao
          icone={CalendarDays}
          cor="blue"
          titulo={t('centrais.aulasNaSemana')}
          valor={formatNumber(totalNaSemana)}
          frase={totalNaSemana > 0
            ? (modalidades.map((m) => m.nome).join(', ') || t('centrais.horariosNaGrade', { n: aulas.length }))
            : t('centrais.semAulaNaGrade')}
          alerta={totalNaSemana === 0}
          onClick={() => setAba('aulas')}
        />
        <Cartao
          icone={History}
          cor="emerald"
          titulo={t('centrais.professor.cartoes.ultimaAula')}
          valor={erro ? '—' : !ultimas ? '…' : ultimaAula ? formatDate(ultimaAula) : '—'}
          frase={erro
            ? t('centrais.naoCarregou')
            : !ultimas
              ? t('centrais.carregando')
              : ultimaAula ? ultimas[0].unidade.nome : t('centrais.professor.semAulaRecente', { data: formatDate(inicioDoTrimestre) })}
          alerta={erro || (!!ultimas && !ultimaAula)}
          onClick={() => setAba('aulas')}
        />
        <Cartao
          icone={BadgeCheck}
          cor="emerald"
          titulo={t('centrais.professor.cartoes.cadastro')}
          valor={faltam > 0 ? t('centrais.selos.faltam', { n: faltam }) : t('centrais.selos.tudoEmDia')}
          frase={aValidar === null ? null : t('centrais.aulasAValidar', { n: aValidar })}
          alerta={faltam > 0}
          onClick={() => setAba('geral')}
        />
      </div>

      <div className="mt-4">
        <AbasFicha abas={abas} ativa={aba} onTrocar={setAba} />
      </div>

      <div className="mt-4 space-y-4">
        {aba === 'geral' && <>{principal}{numeros}{emDia}</>}
        {aba === 'panorama' && <>{numeros}{evolucao}{quadroPorUnidade}{emDia}{quadroUltimas}{quadroGrade}{quadroUnidades}{cadastro}</>}
        {aba === 'valores' && <>{numeros}{evolucao}{quadroPorUnidade}</>}
        {aba === 'aulas' && <>{quadroUltimas}{quadroGrade}</>}
        {aba === 'unidades' && quadroUnidades}
        {aba === 'cadastro' && cadastro}
      </div>
    </JanelaFicha>
  );
}

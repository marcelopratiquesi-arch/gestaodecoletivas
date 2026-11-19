// Quadros da Central da Unidade. Cada quadro é usado na aba dele e também no Panorama ("Ver tudo").
// Só leitura: mostram e levam para a tela certa; quem grava continua sendo a tela original.
//
// Todos recebem `d` (os dados já calculados pela CentralUnidade):
//   unidade, mentor, aulas, professores, grade, periodo, resumo, anterior, pendencias, itens,
//   erro, pode (telasPermitidas), irPara, modalidadePorId, professorPorId
import { useTranslation } from 'react-i18next';
import {
  BarChart3, Users, CalendarDays, ShieldCheck, UserCheck, Settings, MapPin, Phone, Mail, Ruler, Info, Pencil, ExternalLink,
  TrendingUp, Wallet,
} from 'lucide-react';
import Quadro from './pecas/Quadro';
import Contato from './pecas/Contato';
import Variacao from './pecas/Variacao';
import { Campo, Numero, EstadoCarga, Vazio } from './pecas/Basicos';
import { GraficoBarras, EvolucaoMeses } from './pecas/Graficos';
import LinkCentral from './LinkCentral';
import { BOTAO_BRANCO } from './pecas/cores';
import { QuadroEmDia, TabelaProfessores, GradeSemanal, CartaoPessoa, UltimoAcesso } from './secoes';
import { atalhoTelaCompleta, caminhos } from './atalhos';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../utils/formatters';

// ---------- Faixa de informações principais ----------
export function SecaoPrincipal({ d }) {
  const { t } = useTranslation();
  const { unidade } = d;
  const naoInformado = t('centrais.naoInformado');
  const metragem = Number(unidade.metragemSalaColetiva) || 0;
  return (
    <Quadro titulo={t('centrais.infoPrincipais')} icone={Info}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.unidade.geral.local')}>
          {[unidade.estado, unidade.pais].filter(Boolean).join(' · ') || naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.geral.endereco')} falta={!unidade.enderecoCompleto}>
          {unidade.enderecoCompleto || naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.geral.metragem')} falta={!metragem}>
          {metragem ? t('centrais.unidade.geral.m2', { n: formatNumber(metragem) }) : naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.situacao')}>
          {unidade.status === 'ativa' ? t('centrais.unidade.selos.ativa') : t('centrais.unidade.selos.inativa')}
        </Campo>
      </div>
    </Quadro>
  );
}

// ---------- Números do período (as mesmas contas do Relatório) ----------
export function SecaoResumo({ d, comLink = false }) {
  const { t } = useTranslation();
  const { unidade, resumo, anterior, pendencias, periodo } = d;
  const acao = comLink
    ? atalhoTelaCompleta(t, d.pode.relatorio, caminhos.relatorio(d.irPara, unidade.id, periodo.inicio.slice(0, 7)))
    : null;
  const semMetragem = !(Number(unidade.metragemSalaColetiva) > 0);

  return (
    <Quadro titulo={t('centrais.unidade.resumo.titulo')} icone={BarChart3} acao={acao}>
      {d.erro || !resumo ? <EstadoCarga erro={d.erro} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Numero
            rotulo={t('centrais.unidade.resumo.valor')}
            valor={formatCurrency(resumo.valor, unidade.pais)}
            extra={<Variacao atual={resumo.valor} anterior={anterior?.valor} />}
            frase={t('centrais.unidade.resumo.valorFrase')}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.custoMedio')}
            valor={formatCurrency(resumo.custoMedio, unidade.pais)}
            extra={<Variacao atual={resumo.custoMedio} anterior={anterior?.custoMedio} />}
            frase={t('centrais.unidade.resumo.custoMedioFrase')}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.ocupacao')}
            valor={resumo.ocupacao === null ? '—' : formatPercent(resumo.ocupacao, 1)}
            extra={resumo.ocupacao !== null && anterior?.ocupacao ? <Variacao atual={resumo.ocupacao} anterior={anterior.ocupacao} /> : null}
            alerta={semMetragem}
            frase={semMetragem ? t('centrais.unidade.resumo.ocupacaoSemMetragem') : t('centrais.unidade.resumo.ocupacaoFrase')}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.vacancia')}
            valor={formatPercent(resumo.vacancia, 1)}
            frase={t('centrais.unidade.resumo.vacanciaFrase')}
          />
          <Numero
            rotulo={t('centrais.unidade.resumo.realizadas')}
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
          <Numero
            rotulo={t('centrais.aValidar7dias')}
            valor={pendencias ? formatNumber(pendencias.aValidar) : '…'}
            alerta={!!pendencias && pendencias.aValidar > 0}
          />
        </div>
      )}
    </Quadro>
  );
}

// ---------- Está tudo em dia? ----------
export function SecaoEmDia({ d }) {
  const { unidade, pendencias, pode, irPara } = d;
  const lideres = pode.cfgLideres && caminhos.configuracoes(irPara, 'lideres');
  const unidades = pode.cfgUnidades && caminhos.configuracoes(irPara, 'unidades');
  const cronograma = pode.cronograma && caminhos.cronograma(irPara, unidade.id);
  // Para onde cada item leva (só aparece para quem pode entrar naquela tela).
  const destinos = {
    lider: lideres, liderConferido: lideres, liderTelefone: lideres,
    mentor: unidades, telefone: unidades, endereco: unidades, metragem: unidades, loginAntigo: unidades,
    grade: cronograma, aulasSemProfessor: cronograma,
    validacoes: pode.validacao && pendencias && caminhos.validacao(irPara, { inicio: pendencias.inicio, fim: pendencias.fim, unidadeIds: [unidade.id] }),
  };
  return <QuadroEmDia itens={d.itens} prefixo="centrais.unidade.emDia.itens" caminhos={destinos} />;
}

// ---------- Professores ----------
export function SecaoProfessores({ d, comLink = false }) {
  const { t } = useTranslation();
  const acao = comLink ? atalhoTelaCompleta(t, d.pode.cfgProfessores, caminhos.configuracoes(d.irPara, 'professores')) : null;
  return (
    <Quadro titulo={t('centrais.unidade.professores.titulo')} icone={Users} acao={acao}>
      <TabelaProfessores
        linhas={d.professores}
        paisPadrao={d.unidade.pais}
        textoVazio={t('centrais.unidade.professores.vazio')}
        pagamentos={d.erro || !d.porProfessor ? null : new Map(d.porProfessor.map((p) => [p.professorId, p]))}
      />
    </Quadro>
  );
}

// ---------- Grade de aulas ----------
export function SecaoGrade({ d, comLink = false }) {
  const { t } = useTranslation();
  const acao = comLink ? atalhoTelaCompleta(t, d.pode.cronograma, caminhos.cronograma(d.irPara, d.unidade.id)) : null;
  return (
    <Quadro titulo={t('centrais.unidade.grade.titulo')} icone={CalendarDays} acao={acao}>
      <GradeSemanal grade={d.grade} modalidadePorId={d.modalidadePorId} professorPorId={d.professorPorId} textoVazio={t('centrais.unidade.grade.vazio')} />
    </Quadro>
  );
}

// ---------- Mentor e Líder ----------
export function SecaoEquipe({ d, comLink = false }) {
  const { t } = useTranslation();
  const { unidade, mentor } = d;
  const acao = comLink ? atalhoTelaCompleta(t, d.pode.cfgLideres, caminhos.configuracoes(d.irPara, 'lideres')) : null;

  return (
    <Quadro titulo={t('centrais.unidade.equipe.titulo')} icone={UserCheck} acao={acao}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CartaoPessoa icone={ShieldCheck} papel={t('centrais.papel.mentor')} nome={mentor?.nome} vazio={t('centrais.unidade.info.semMentor')} link={mentor ? { tipo: 'mentor', alvo: mentor } : null}>
          {mentor?.telefone
            ? <Contato icone={Phone} texto={mentor.telefone} copiar whatsapp pais={mentor.pais || unidade.pais} />
            : <Contato icone={Phone} texto={t('centrais.unidade.info.mentorSemTelefone')} falta />}
          {mentor?.email && <Contato icone={Mail} texto={mentor.email} copiar />}
          <UltimoAcesso quando={mentor?.ultimoAcesso} />
        </CartaoPessoa>

        <CartaoPessoa
          icone={UserCheck}
          papel={t('centrais.papel.lider')}
          nome={unidade.liderUid ? (unidade.liderNome || unidade.liderEmail) : null}
          vazio={t('centrais.unidade.info.semLider')}
          link={unidade.liderUid ? { tipo: 'lider', alvo: unidade } : null}
        >
          {unidade.liderTelefone
            ? <Contato icone={Phone} texto={unidade.liderTelefone} copiar whatsapp pais={unidade.pais} />
            : <Contato icone={Phone} texto={t('centrais.unidade.info.liderSemTelefone')} falta />}
          {unidade.liderEmail && <Contato icone={Mail} texto={unidade.liderEmail} copiar />}
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {unidade.liderTipo === 'senha' ? t('centrais.acessoSenha') : t('centrais.acessoGoogle')}
            {unidade.liderDesde ? ` · ${t('centrais.desde', { data: formatDate(unidade.liderDesde) })}` : ''}
          </p>
          {unidade.liderAConferir === true && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{t('centrais.aguardandoConferencia')}</p>
          )}
          <UltimoAcesso />
        </CartaoPessoa>

        {unidade.lider2Uid && (
          <CartaoPessoa
            icone={UserCheck}
            papel={t('leadersTab.second.badge')}
            nome={unidade.lider2Nome || unidade.lider2Email}
            link={{ tipo: 'lider2', alvo: unidade }}
          >
            {unidade.lider2Telefone
              ? <Contato icone={Phone} texto={unidade.lider2Telefone} copiar whatsapp pais={unidade.pais} />
              : <Contato icone={Phone} texto={t('centrais.unidade.info.liderSemTelefone')} falta />}
            {unidade.lider2Email && <Contato icone={Mail} texto={unidade.lider2Email} copiar />}
            <UltimoAcesso />
          </CartaoPessoa>
        )}
      </div>
    </Quadro>
  );
}

// ---------- Cadastro (aba Configurações) ----------
export function SecaoCadastro({ d }) {
  const { t } = useTranslation();
  const { unidade } = d;
  const naoInformado = t('centrais.naoInformado');
  const metragem = Number(unidade.metragemSalaColetiva) || 0;
  const loginAntigo = !unidade.uidLogin
    ? t('centrais.unidade.config.loginAntigoNaoTem')
    : unidade.loginAntigoDesligado ? t('centrais.unidade.config.loginAntigoDesligado') : t('centrais.unidade.config.loginAntigoLigado');

  return (
    <Quadro titulo={t('centrais.unidade.config.titulo')} icone={Settings}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.cadastro.nome')}>
          <Contato texto={unidade.nome} copiar />
        </Campo>
        <Campo rotulo={t('centrais.situacao')}>
          {unidade.status === 'ativa' ? t('centrais.unidade.selos.ativa') : t('centrais.unidade.selos.inativa')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.pais')}>{unidade.pais || naoInformado}</Campo>
        <Campo rotulo={t('centrais.unidade.config.estado')}>{unidade.estado || naoInformado}</Campo>
        <Campo rotulo={t('centrais.cadastro.telefone')} falta={!unidade.telefone}>
          {unidade.telefone ? <Contato icone={Phone} texto={unidade.telefone} copiar whatsapp pais={unidade.pais} /> : naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.geral.endereco')} falta={!unidade.enderecoCompleto}>
          {unidade.enderecoCompleto ? <Contato icone={MapPin} texto={unidade.enderecoCompleto} copiar /> : naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.config.mapa')} falta={!unidade.linkGoogleMaps}>
          {unidade.linkGoogleMaps ? (
            <a
              href={/^https?:\/\//.test(unidade.linkGoogleMaps) ? unidade.linkGoogleMaps : `https://${unidade.linkGoogleMaps}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('centrais.unidade.config.abrirMapa')} <ExternalLink className="w-3 h-3" />
            </a>
          ) : naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.geral.metragem')} falta={!metragem}>
          {metragem ? <span className="inline-flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-slate-400" />{t('centrais.unidade.geral.m2', { n: formatNumber(metragem) })}</span> : naoInformado}
        </Campo>
        <Campo rotulo={t('centrais.unidade.config.loginAntigo')}>{loginAntigo}</Campo>
      </div>

      {d.pode.cfgUnidades && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" className={BOTAO_BRANCO} onClick={caminhos.configuracoes(d.irPara, 'unidades')}>
            <Pencil className="w-3.5 h-3.5" /> {t('centrais.editarNasConfiguracoes')}
          </button>
        </div>
      )}
    </Quadro>
  );
}

// ---------- Valores: evolução do trimestre + quanto cada professor recebeu ----------
// Usado na Central da Unidade e na do Líder (as duas olham a mesma unidade).
export function SecaoValores({ d, comLink = false }) {
  const { t } = useTranslation();
  const { unidade, porMes, porProfessor, periodo } = d;
  const acao = comLink
    ? atalhoTelaCompleta(t, d.pode.relatorio, caminhos.relatorio(d.irPara, unidade.id, periodo.inicio.slice(0, 7)))
    : null;
  const carregando = d.erro || !porMes || !porProfessor;

  return (
    <>
      <Quadro titulo={t('centrais.valores.trimestreTitulo')} icone={TrendingUp} acao={acao}>
        {carregando ? <EstadoCarga erro={d.erro} /> : (
          <EvolucaoMeses
            meses={porMes.map((m) => ({
              mes: m.mes,
              valor: m.valor,
              valorTexto: formatCurrency(m.valor, unidade.pais),
              detalhe: t('centrais.valores.aulasEAlunos', { aulas: formatNumber(m.realizadas), alunos: formatNumber(m.alunos) }),
              emAndamento: m.mes === d.mesDeHoje,
            }))}
          />
        )}
      </Quadro>

      <Quadro titulo={t('centrais.valores.professoresTitulo')} icone={Wallet} acao={acao}>
        {carregando ? <EstadoCarga erro={d.erro} /> : porProfessor.length === 0 ? <Vazio texto={t('centrais.semAulaNoPeriodo')} /> : (
          <GraficoBarras
            linhas={porProfessor.map((p) => {
              const professor = d.professorPorId.get(p.professorId);
              return {
                chave: p.professorId || 'sem-professor',
                rotulo: professor
                  ? <LinkCentral tipo="professor" alvo={professor}>{professor.nome}</LinkCentral>
                  : t('common.unknown.teacher'),
                valor: p.valor,
                valorTexto: formatCurrency(p.valor, unidade.pais),
                detalhe: t('centrais.valores.detalheProfessor', {
                  aulas: formatNumber(p.realizadas),
                  media: formatNumber(p.media),
                  porAula: formatCurrency(p.realizadas > 0 ? p.valor / p.realizadas : 0, unidade.pais),
                }),
              };
            })}
          />
        )}
      </Quadro>
    </>
  );
}

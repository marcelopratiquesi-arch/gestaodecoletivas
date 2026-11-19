// Central do Líder: a ficha de quem responde por uma unidade.
//
// O líder fica gravado dentro da unidade (nome, e-mail, telefone, tipo de acesso), então esta ficha é
// identificada pela unidade dele e mostra os MESMOS números da Central da Unidade (useNumerosDaUnidade):
// valor investido, evolução do trimestre, quanto cada professor recebeu e o que está pendente.
// A unidade pode ter 2 líderes: vaga 1 (lider*) e vaga 2 (lider2*). Quem lidera mais de uma unidade
// ganha o quadro "Unidades que lidera", para trocar de unidade sem sair da ficha.
// Só leitura.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2, Users, CalendarDays, ListChecks, LayoutGrid, LayoutList, ShieldCheck, IdCard, Phone, Mail, Eye, Info,
  Pencil, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { dataLocalStr } from '../utils/agendaAulas';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import JanelaFicha from './pecas/JanelaFicha';
import CabecalhoFicha from './pecas/CabecalhoFicha';
import Cartao from './pecas/Cartao';
import AbasFicha from './pecas/AbasFicha';
import Contato from './pecas/Contato';
import Quadro from './pecas/Quadro';
import EmBreve from './pecas/EmBreve';
import Variacao from './pecas/Variacao';
import { Campo, SeletorDeMes } from './pecas/Basicos';
import { BOTAO_PRINCIPAL, BOTAO_BRANCO } from './pecas/cores';
import { QuadroEmDia, CartaoPessoa } from './secoes';
import { CampoDocumento, CampoUltimoAcesso } from './CamposDaPessoa';
import { lerDocumento } from '../services/documentoService';
import { SecaoResumo, SecaoValores, SecaoProfessores, SecaoGrade } from './secoesUnidade';
import LinkCentral from './LinkCentral';
import { iniciais } from './contato';
import { abrirCentral, abrirCentralUnidade } from './abrirCentral';
import { tipoDaVaga } from './acessos';
import { telasPermitidas, caminhos } from './atalhos';
import { useNumerosDaUnidade } from './useNumerosDaUnidade';
import { ehAdmin, acessoUnidade, aulasNaSemana, liderDaVaga, unidadesLideradasPor } from './contasUnidade';
import { itensEmDiaLider } from './contasPessoas';

const doisDigitos = (n) => String(n).padStart(2, '0');

export default function CentralLider({ id: unidadeId, vaga = 1, z, textoVoltar, onFechar, irPara }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();

  const [aba, setAba] = useState('geral');
  const [agora] = useState(() => new Date());
  const hoje = dataLocalStr(agora);
  const agoraHHMM = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;
  const mesDeHoje = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesDeHoje);

  const cadastroDaUnidade = catalogs.unidades.find((u) => String(u.id) === String(unidadeId)) || null;
  const acesso = liderDaVaga(cadastroDaUnidade, vaga) ? acessoUnidade(userData, cadastroDaUnidade) : null;
  const n = useNumerosDaUnidade({ unidadeId, ativo: !!acesso, mes, hoje, agoraHHMM });
  const { unidade, mentor, mentor2, aulas, professores, resumo, anterior, pendencias } = n;

  // Os itens "em dia" olham os dados DESTE líder (o 2º líder usa os campos lider2*).
  const itens = useMemo(() => {
    const l = liderDaVaga(unidade, vaga);
    if (!unidade || !l) return [];
    const unidadeDesteLider = { ...unidade, liderTelefone: l.telefone, liderAConferir: l.aConferir };
    return itensEmDiaLider({ unidade: unidadeDesteLider, aulas, professores: catalogs.professores, pendencias });
  }, [unidade, vaga, aulas, catalogs.professores, pendencias]);

  const lider = liderDaVaga(unidade, vaga);
  if (!unidade || !acesso || !lider) return null;

  // Todas as unidades que esta pessoa lidera (só as que quem está olhando pode abrir).
  const lideradas = unidadesLideradasPor(lider.uid, catalogs.unidades).filter((x) => acessoUnidade(userData, x.unidade));

  const pode = telasPermitidas(userData);
  // CPF/DNI/SSN do líder: ele mesmo, o admin e o mentor da unidade (é o que o banco libera).
  const podeVerDocumento = ehAdmin(userData?.role) || lider.uid === (userData?.id || userData?.uid) || acesso === 'editar';
  const d = { ...n, itens, pode, irPara, mesDeHoje };
  const nome = lider.nome;
  const aConferir = lider.aConferir;
  const faltam = itens.filter((i) => !i.ok).length;
  const professoresAtivos = professores.filter((p) => p.ativo).length;
  const totalNaSemana = aulasNaSemana(aulas);
  const tipoDeAcesso = lider.tipo === 'senha' ? t('centrais.acessoSenha') : t('centrais.acessoGoogle');
  const carregandoTexto = n.erro ? t('centrais.naoCarregou') : t('centrais.carregando');

  const selos = [
    { texto: vaga === 2 ? t('leadersTab.second.badge') : t('centrais.papel.lider'), cor: vaga === 2 ? 'violet' : 'blue' },
    lideradas.length > 1 && { texto: t('centrais.lider.lideraN', { n: lideradas.length }), cor: 'violet' },
    aConferir && { texto: t('centrais.aguardandoConferencia'), cor: 'amber' },
    faltam > 0
      ? { texto: t('centrais.selos.faltam', { n: faltam }), cor: 'amber' }
      : { texto: t('centrais.selos.tudoEmDia'), cor: 'emerald' },
    acesso !== 'editar' && { texto: t('centrais.selos.soConsulta'), cor: 'slate' },
  ].filter(Boolean);

  const infos = [
    <Contato icone={Building2} classeIcone="text-violet-500" texto={unidade.nome} />,
    mentor
      ? <Contato icone={ShieldCheck} classeIcone="text-blue-500" texto={t('centrais.unidade.info.mentor', { nome: mentor.nome })} />
      : <Contato icone={ShieldCheck} texto={t('centrais.unidade.info.semMentor')} falta />,
    lider.telefone
      ? <Contato icone={Phone} classeIcone="text-emerald-500" texto={lider.telefone} copiar whatsapp pais={unidade.pais} />
      : <Contato icone={Phone} texto={t('centrais.unidade.info.liderSemTelefone')} falta />,
    lider.email && <Contato icone={Mail} classeIcone="text-amber-500" texto={lider.email} copiar />,
  ].filter(Boolean);

  const acoes = (
    <>
      <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAba('panorama')}>
        <Eye className="w-3.5 h-3.5" /> {t('centrais.verTudo')}
      </button>
      <button type="button" className={BOTAO_BRANCO} onClick={() => abrirCentralUnidade(unidade)}>
        <Building2 className="w-3.5 h-3.5" /> {t('centrais.lider.abrirUnidade')}
      </button>
    </>
  );

  const abas = [
    { id: 'geral', nome: t('centrais.abas.geral'), icone: LayoutGrid, contador: faltam },
    { id: 'panorama', nome: t('centrais.abas.panorama'), icone: LayoutList },
    { id: 'valores', nome: t('centrais.abas.valores'), icone: Wallet },
    { id: 'equipe', nome: t('centrais.abas.equipe'), icone: Users },
    { id: 'grade', nome: t('centrais.unidade.abas.grade'), icone: CalendarDays },
    { id: 'cadastro', nome: t('centrais.abas.cadastro'), icone: IdCard },
  ];

  const lideres = pode.cfgLideres && caminhos.configuracoes(irPara, 'lideres');
  const destinos = {
    telefone: lideres,
    conferido: lideres,
    loginAntigo: pode.cfgUnidades && caminhos.configuracoes(irPara, 'unidades'),
    aulasSemProfessor: pode.cronograma && caminhos.cronograma(irPara, unidade.id),
    validacoes: pode.validacao && pendencias && caminhos.validacao(irPara, { inicio: pendencias.inicio, fim: pendencias.fim, unidadeIds: [unidade.id] }),
  };

  const principal = (
    <Quadro titulo={t('centrais.infoPrincipais')} icone={Info}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.papel.unidade')}>
          <LinkCentral tipo="unidade" alvo={unidade}>{unidade.nome}</LinkCentral>
        </Campo>
        <Campo rotulo={t('centrais.papel.mentor')} falta={!mentor}>
          {mentor ? <LinkCentral tipo="mentor" alvo={mentor}>{mentor.nome}</LinkCentral> : t('centrais.unidade.info.semMentor')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.acesso')}>{tipoDeAcesso}</Campo>
        <Campo rotulo={t('centrais.lider.liderDesde')}>{lider.desde ? formatDate(lider.desde) : t('centrais.naoInformado')}</Campo>
      </div>
    </Quadro>
  );

  // Quem lidera mais de uma unidade: a lista delas. Clicar em outra abre a ficha do líder naquela unidade.
  const quadroUnidades = lideradas.length > 1 && (
    <Quadro titulo={t('centrais.lider.unidadesQueLidera')} icone={Building2}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {lideradas.map(({ unidade: u, vaga: v }) => {
          const esta = String(u.id) === String(unidade.id);
          const moldura = esta ? 'border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/20' : 'border-slate-200/80 dark:border-slate-800';
          return (
            <div key={u.id} className={'rounded-xl border p-3 flex items-center justify-between gap-3 ' + moldura}>
              <div className="min-w-0">
                <LinkCentral tipo="unidade" alvo={u} className="text-[13px] font-extrabold uppercase text-slate-800 dark:text-white">{u.nome}</LinkCentral>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {[u.estado, v === 2 ? t('leadersTab.second.badge') : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              {esta
                ? <span className="shrink-0 text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">{t('centrais.lider.estaFicha')}</span>
                : (
                  <button type="button" className={BOTAO_BRANCO} onClick={() => abrirCentral(tipoDaVaga(v), u)}>
                    <Eye className="w-3.5 h-3.5" /> {t('centrais.lider.verNumeros')}
                  </button>
                )}
            </div>
          );
        })}
      </div>
    </Quadro>
  );

  const emDia = <QuadroEmDia itens={itens} prefixo="centrais.lider.emDia" caminhos={destinos} />;

  const quadroMentor = (
    <Quadro titulo={t('centrais.papel.mentor')} icone={ShieldCheck}>
      <CartaoPessoa icone={ShieldCheck} papel={t('centrais.papel.mentor')} nome={mentor?.nome} vazio={t('centrais.unidade.info.semMentor')} link={mentor ? { tipo: 'mentor', alvo: mentor } : null}>
        {mentor?.telefone
          ? <Contato icone={Phone} texto={mentor.telefone} copiar whatsapp pais={mentor.pais || unidade.pais} />
          : <Contato icone={Phone} texto={t('centrais.unidade.info.mentorSemTelefone')} falta />}
        {mentor?.email && <Contato icone={Mail} texto={mentor.email} copiar />}
      </CartaoPessoa>
      {mentor2 && (
        <div className="mt-3">
          <CartaoPessoa icone={ShieldCheck} papel={t('centrais.mentor.segundo')} nome={mentor2.nome} link={{ tipo: 'mentor', alvo: mentor2 }}>
            {mentor2.telefone
              ? <Contato icone={Phone} texto={mentor2.telefone} copiar whatsapp pais={mentor2.pais || unidade.pais} />
              : <Contato icone={Phone} texto={t('centrais.unidade.info.mentorSemTelefone')} falta />}
            {mentor2.email && <Contato icone={Mail} texto={mentor2.email} copiar />}
          </CartaoPessoa>
        </div>
      )}
    </Quadro>
  );

  const cadastro = (
    <Quadro titulo={t('centrais.lider.cadastroTitulo')} icone={IdCard}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Campo rotulo={t('centrais.cadastro.nome')}><Contato texto={nome} copiar /></Campo>
        <Campo rotulo={t('centrais.cadastro.email')} falta={!lider.email}>
          {lider.email ? <Contato icone={Mail} texto={lider.email} copiar /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.cadastro.telefone')} falta={!lider.telefone}>
          {lider.telefone ? <Contato icone={Phone} texto={lider.telefone} copiar whatsapp pais={unidade.pais} /> : t('centrais.naoInformado')}
        </Campo>
        <Campo rotulo={t('centrais.papel.unidade')}>
          <LinkCentral tipo="unidade" alvo={unidade}>{unidade.nome}</LinkCentral>
        </Campo>
        <Campo rotulo={t('centrais.cadastro.acesso')}>{tipoDeAcesso}</Campo>
        <Campo rotulo={t('centrais.lider.liderDesde')}>{lider.desde ? formatDate(lider.desde) : t('centrais.naoInformado')}</Campo>
        <Campo rotulo={t('centrais.lider.conferencia')} falta={aConferir}>
          {aConferir ? t('centrais.aguardandoConferencia') : t('centrais.lider.conferido')}
        </Campo>
        <CampoDocumento pode={podeVerDocumento} chave={lider.uid} leitor={lerDocumento} />
        <CampoUltimoAcesso uid={lider.uid} />
      </div>
      {pode.cfgLideres && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" className={BOTAO_BRANCO} onClick={caminhos.configuracoes(irPara, 'lideres')}>
            <Pencil className="w-3.5 h-3.5" /> {t('centrais.editarNasConfiguracoes')}
          </button>
        </div>
      )}
    </Quadro>
  );

  return (
    <JanelaFicha z={z} onFechar={onFechar} textoVoltar={textoVoltar} rotulo={`${t('centrais.lider.rotulo')}: ${nome}`}>
      <CabecalhoFicha iniciais={iniciais(nome)} ativo={!aConferir} nome={nome} selos={selos} infos={infos} acoes={acoes} />

      <SeletorDeMes mes={mes} mesMaximo={mesDeHoje} onTrocar={setMes} periodo={n.periodo} />

      <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Cartao
          icone={Wallet}
          cor="emerald"
          titulo={t('centrais.valores.investidoNoMes')}
          valor={n.erro ? '—' : resumo ? formatCurrency(resumo.valor, unidade.pais) : '…'}
          extra={resumo && <Variacao atual={resumo.valor} anterior={anterior?.valor} />}
          frase={n.erro || !resumo
            ? carregandoTexto
            : t('centrais.valores.porAula', { valor: formatCurrency(resumo.custoMedio, unidade.pais) })}
          alerta={n.erro}
          onClick={() => setAba('valores')}
        />
        <Cartao
          icone={Building2}
          cor="violet"
          titulo={t('centrais.papel.unidade')}
          valor={unidade.nome}
          frase={[unidade.estado, unidade.pais].filter(Boolean).join(' · ') || t('centrais.lider.abrirUnidade')}
          onClick={() => abrirCentralUnidade(unidade)}
        />
        <Cartao
          icone={Users}
          cor="blue"
          titulo={t('centrais.lider.cartoes.professores')}
          valor={formatNumber(professoresAtivos)}
          frase={professoresAtivos > 0
            ? t('centrais.unidade.cartoes.professores.frase', { n: professores.length })
            : t('centrais.unidade.cartoes.professores.vazio')}
          alerta={professoresAtivos === 0}
          onClick={() => setAba('equipe')}
        />
        <Cartao
          icone={CalendarDays}
          cor="violet"
          titulo={t('centrais.aulasNaSemana')}
          valor={formatNumber(totalNaSemana)}
          frase={n.erro || !resumo
            ? (totalNaSemana > 0 ? t('centrais.horariosNaGrade', { n: aulas.length }) : t('centrais.semAulaNaGrade'))
            : t('centrais.valores.realizadasNoMes', { n: formatNumber(resumo.realizadas) })}
          alerta={totalNaSemana === 0}
          onClick={() => setAba('grade')}
        />
        <Cartao
          icone={ListChecks}
          cor="emerald"
          titulo={t('centrais.pendencias')}
          valor={formatNumber(faltam)}
          frase={n.erro ? t('centrais.naoCarregou') : !pendencias ? t('centrais.carregando') : t('centrais.aulasAValidar', { n: pendencias.aValidar })}
          alerta={faltam > 0 || n.erro}
          onClick={() => setAba('geral')}
        />
      </div>

      <div className="mt-4">
        <AbasFicha abas={abas} ativa={aba} onTrocar={setAba} />
      </div>

      <div className="mt-4 space-y-4">
        {aba === 'geral' && <>{principal}{quadroUnidades}<SecaoResumo d={d} />{emDia}</>}
        {aba === 'panorama' && (
          <>
            <SecaoResumo d={d} comLink />
            <SecaoValores d={d} />
            {emDia}
            <SecaoProfessores d={d} comLink />
            <SecaoGrade d={d} comLink />
            {quadroMentor}
            {quadroUnidades}
            {cadastro}
          </>
        )}
        {aba === 'valores' && <><SecaoResumo d={d} comLink /><SecaoValores d={d} comLink /></>}
        {aba === 'equipe' && <><SecaoProfessores d={d} comLink />{quadroMentor}</>}
        {aba === 'grade' && <SecaoGrade d={d} comLink />}
        {aba === 'cadastro' && <>{quadroUnidades}{cadastro}</>}
      </div>
    </JanelaFicha>
  );
}

// Central da Unidade: a ficha que abre ao clicar no nome de uma unidade.
//
// - Só leitura. Mostra e leva para a tela certa; quem grava continua sendo a tela original.
// - Leve: cadastro, professores, grade, mentor e líder vêm do catálogo que o sistema já tem na memória
//   (zero leituras). Do banco só vêm as validações desta unidade no trimestre (useNumerosDaUnidade).
// - As contas ficam em contasUnidade.js e contasValores.js (as mesmas regras do Início, da Validação
//   Diária e do Relatório).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, CalendarDays, GraduationCap, ShieldCheck, UserCheck, LayoutGrid, LayoutList, Settings,
  MapPin, Phone, Mail, Globe, Eye, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { dataLocalStr } from '../utils/agendaAulas';
import { formatCurrency, formatNumber } from '../utils/formatters';
import JanelaFicha from './pecas/JanelaFicha';
import CabecalhoFicha from './pecas/CabecalhoFicha';
import Cartao from './pecas/Cartao';
import AbasFicha from './pecas/AbasFicha';
import Contato from './pecas/Contato';
import Variacao from './pecas/Variacao';
import { SeletorDeMes } from './pecas/Basicos';
import { BOTAO_PRINCIPAL, BOTAO_BRANCO } from './pecas/cores';
import { iniciais } from './contato';
import { telasPermitidas, caminhos } from './atalhos';
import { useNumerosDaUnidade } from './useNumerosDaUnidade';
import { acessoUnidade, aulasNaSemana, itensEmDia } from './contasUnidade';
import {
  SecaoPrincipal, SecaoResumo, SecaoValores, SecaoEmDia, SecaoProfessores, SecaoGrade, SecaoEquipe, SecaoCadastro,
} from './secoesUnidade';

const doisDigitos = (n) => String(n).padStart(2, '0');

export default function CentralUnidade({ id: unidadeId, z, textoVoltar, onFechar, irPara }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();

  const [aba, setAba] = useState('geral');
  // "Agora" fica parado enquanto a ficha está aberta (os números não mudam sozinhos no meio da leitura).
  const [agora] = useState(() => new Date());
  const hoje = dataLocalStr(agora);
  const agoraHHMM = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;
  const mesDeHoje = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesDeHoje); // abre em "este mês"

  const cadastro = catalogs.unidades.find((u) => String(u.id) === String(unidadeId)) || null;
  const acesso = acessoUnidade(userData, cadastro);
  const n = useNumerosDaUnidade({ unidadeId, ativo: !!acesso, mes, hoje, agoraHHMM });
  const { unidade, mentor, aulas, professores, resumo, anterior, pendencias } = n;

  const itens = useMemo(
    () => (unidade ? itensEmDia({ unidade, mentor, aulas, professores: catalogs.professores, pendencias }) : []),
    [unidade, mentor, aulas, catalogs.professores, pendencias],
  );

  if (!unidade || !acesso) return null;

  const podeEditar = acesso === 'editar';
  const pode = telasPermitidas(userData);
  const d = { ...n, itens, pode, irPara, mesDeHoje };

  const ativa = unidade.status === 'ativa';
  const faltam = itens.filter((i) => !i.ok).length;
  const professoresAtivos = professores.filter((p) => p.ativo).length;
  const totalNaSemana = aulasNaSemana(aulas);
  const temLider = !!unidade.liderUid;
  const nomeLider = unidade.liderNome || unidade.liderEmail;

  const selos = [
    { texto: ativa ? t('centrais.unidade.selos.ativa') : t('centrais.unidade.selos.inativa'), cor: ativa ? 'emerald' : 'slate' },
    faltam > 0
      ? { texto: t('centrais.selos.faltam', { n: faltam }), cor: 'amber' }
      : { texto: t('centrais.selos.tudoEmDia'), cor: 'emerald' },
    !podeEditar && { texto: t('centrais.selos.soConsulta'), cor: 'slate' },
  ].filter(Boolean);

  const infos = [
    (unidade.estado || unidade.pais) && (
      <Contato icone={MapPin} classeIcone="text-violet-500" texto={[unidade.estado, unidade.pais].filter(Boolean).join(' · ')} />
    ),
    mentor
      ? <Contato icone={ShieldCheck} classeIcone="text-blue-500" texto={t('centrais.unidade.info.mentor', { nome: mentor.nome })} />
      : <Contato icone={ShieldCheck} texto={t('centrais.unidade.info.semMentor')} falta />,
    temLider
      ? <Contato icone={UserCheck} classeIcone="text-emerald-500" texto={t('centrais.unidade.info.lider', { nome: nomeLider })} />
      : <Contato icone={UserCheck} texto={t('centrais.unidade.info.semLider')} falta />,
    unidade.lider2Uid && (
      <Contato icone={UserCheck} classeIcone="text-violet-500" texto={t('leadersTab.second.badge') + ': ' + (unidade.lider2Nome || unidade.lider2Email)} />
    ),
    unidade.telefone
      ? <Contato icone={Phone} classeIcone="text-emerald-500" texto={unidade.telefone} copiar whatsapp pais={unidade.pais} />
      : <Contato icone={Phone} texto={t('centrais.unidade.info.semTelefone')} falta />,
    temLider && !unidade.liderTelefone && <Contato icone={Phone} texto={t('centrais.unidade.info.liderSemTelefone')} falta />,
    temLider && unidade.liderEmail && <Contato icone={Mail} classeIcone="text-amber-500" texto={unidade.liderEmail} copiar />,
  ].filter(Boolean);

  const acoes = (
    <>
      <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setAba('panorama')}>
        <Eye className="w-3.5 h-3.5" /> {t('centrais.verTudo')}
      </button>
      {pode.cronograma && (
        <button type="button" className={BOTAO_BRANCO} onClick={caminhos.cronograma(irPara, unidade.id)}>
          <CalendarDays className="w-3.5 h-3.5" /> {t('centrais.unidade.acoes.cronograma')}
        </button>
      )}
      <button type="button" className={BOTAO_BRANCO} onClick={() => window.open(`/horarios?unidade=${unidade.id}`, '_blank', 'noopener')}>
        <Globe className="w-3.5 h-3.5" /> {t('centrais.unidade.acoes.linkAluno')}
      </button>
    </>
  );

  const abas = [
    { id: 'geral', nome: t('centrais.abas.geral'), icone: LayoutGrid, contador: faltam },
    { id: 'panorama', nome: t('centrais.abas.panorama'), icone: LayoutList },
    { id: 'valores', nome: t('centrais.abas.valores'), icone: Wallet },
    { id: 'professores', nome: t('centrais.unidade.abas.professores'), icone: Users },
    { id: 'grade', nome: t('centrais.unidade.abas.grade'), icone: CalendarDays },
    { id: 'equipe', nome: t('centrais.unidade.abas.equipe'), icone: UserCheck },
    { id: 'config', nome: t('centrais.unidade.abas.config'), icone: Settings },
  ];

  const carregandoTexto = n.erro ? t('centrais.naoCarregou') : t('centrais.carregando');

  return (
    <JanelaFicha z={z} onFechar={onFechar} textoVoltar={textoVoltar} rotulo={`${t('centrais.unidade.rotulo')}: ${unidade.nome}`}>
      <CabecalhoFicha iniciais={iniciais(unidade.nome)} ativo={ativa} nome={unidade.nome} selos={selos} infos={infos} acoes={acoes} />

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
          icone={GraduationCap}
          cor="blue"
          titulo={t('centrais.unidade.cartoes.alunos.titulo')}
          valor={n.erro ? '—' : resumo ? formatNumber(resumo.alunos) : '…'}
          extra={resumo && <Variacao atual={resumo.alunos} anterior={anterior?.alunos} />}
          frase={n.erro || !resumo
            ? carregandoTexto
            : resumo.realizadas > 0
              ? t('centrais.unidade.cartoes.alunos.frase', { media: formatNumber(resumo.media), n: formatNumber(resumo.realizadas) })
              : t('centrais.semAulaNoPeriodo')}
          alerta={n.erro}
          onClick={() => setAba('grade')}
        />
        <Cartao
          icone={Users}
          cor="blue"
          titulo={t('centrais.unidade.cartoes.professores.titulo')}
          valor={formatNumber(professoresAtivos)}
          frase={professoresAtivos > 0
            ? t('centrais.unidade.cartoes.professores.frase', { n: professores.length })
            : t('centrais.unidade.cartoes.professores.vazio')}
          alerta={professoresAtivos === 0}
          onClick={() => setAba('professores')}
        />
        <Cartao
          icone={CalendarDays}
          cor="violet"
          titulo={t('centrais.aulasNaSemana')}
          valor={formatNumber(totalNaSemana)}
          frase={totalNaSemana > 0 ? t('centrais.horariosNaGrade', { n: aulas.length }) : t('centrais.semAulaNaGrade')}
          alerta={totalNaSemana === 0}
          onClick={() => setAba('grade')}
        />
        <Cartao
          icone={UserCheck}
          cor="emerald"
          titulo={t('centrais.unidade.cartoes.equipe')}
          valor={temLider ? nomeLider : t('centrais.unidade.info.semLider')}
          frase={!temLider
            ? (mentor ? t('centrais.unidade.info.mentor', { nome: mentor.nome }) : t('centrais.unidade.info.semMentor'))
            : unidade.liderAConferir === true
              ? t('centrais.aguardandoConferencia')
              : mentor ? t('centrais.unidade.info.mentor', { nome: mentor.nome }) : t('centrais.unidade.info.semMentor')}
          alerta={!temLider || !mentor || unidade.liderAConferir === true}
          onClick={() => setAba('equipe')}
        />
      </div>

      <div className="mt-4">
        <AbasFicha abas={abas} ativa={aba} onTrocar={setAba} />
      </div>

      <div className="mt-4 space-y-4">
        {aba === 'geral' && (
          <>
            <SecaoPrincipal d={d} />
            <SecaoResumo d={d} />
            <SecaoEmDia d={d} />
          </>
        )}
        {aba === 'panorama' && (
          <>
            <SecaoResumo d={d} comLink />
            <SecaoValores d={d} />
            <SecaoEmDia d={d} />
            <SecaoProfessores d={d} comLink />
            <SecaoGrade d={d} comLink />
            <SecaoEquipe d={d} comLink />
            <SecaoCadastro d={d} />
          </>
        )}
        {aba === 'valores' && (
          <>
            <SecaoResumo d={d} comLink />
            <SecaoValores d={d} comLink />
          </>
        )}
        {aba === 'professores' && <SecaoProfessores d={d} comLink />}
        {aba === 'grade' && <SecaoGrade d={d} comLink />}
        {aba === 'equipe' && <SecaoEquipe d={d} comLink />}
        {aba === 'config' && <SecaoCadastro d={d} />}
      </div>
    </JanelaFicha>
  );
}

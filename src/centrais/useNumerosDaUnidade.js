// Tudo o que as Centrais da Unidade e do Líder mostram sobre UMA unidade (as duas olham a mesma unidade,
// então usam exatamente as mesmas contas e a mesma leitura do banco).
//
// Da memória do sistema (zero leituras): cadastro, mentor, grade, professores.
// Do banco: as validações desta unidade no trimestre (mês escolhido + os dois anteriores), lidas uma vez e
// guardadas por 5 minutos. Com elas saem: números do mês, comparação com as mesmas datas do mês passado,
// evolução do trimestre, quanto cada professor recebeu e as aulas sem validar dos últimos 7 dias.
import { useMemo } from 'react';
import { useCatalogs } from '../contexts/CatalogContext';
import { somarDias } from '../utils/agendaAulas';
import { useValidacoesDaUnidade } from './useValidacoesDaUnidade';
import { useTemporariosDaUnidade } from './useTemporariosDaUnidade';
import {
  aulasDaUnidade, gradePorDia, professoresDaUnidade, periodoDoMes, indicadoresDaUnidade, pendenciasDaUnidade,
  DIAS_JANELA_PENDENCIAS,
} from './contasUnidade';
import { mesesDoTrimestre, limitesDoMes, gastoPorMes, gastoPorProfessor } from './contasValores';

// ativo = false (sem permissão ou unidade não encontrada): não lê nada do banco.
export function useNumerosDaUnidade({ unidadeId, ativo, mes, hoje, agoraHHMM }) {
  const { catalogs } = useCatalogs();

  const unidade = useMemo(
    () => catalogs.unidades.find((u) => String(u.id) === String(unidadeId)) || null,
    [catalogs.unidades, unidadeId],
  );
  const mentorId = unidade?.mentorId || null;
  const mentor = useMemo(
    () => (mentorId ? catalogs.mentores.find((m) => m.id === mentorId) || null : null),
    [catalogs.mentores, mentorId],
  );
  // 2º mentor: crachá de mentor ligado ao mentor da unidade (mesmas unidades).
  const mentor2 = useMemo(
    () => (mentorId ? catalogs.mentores.find((m) => m.mentorPrincipalId === mentorId) || null : null),
    [catalogs.mentores, mentorId],
  );
  const aulasForaDaLixeira = useMemo(
    () => catalogs.aulas.filter((a) => String(a.unidadeId) === String(unidadeId)),
    [catalogs.aulas, unidadeId],
  );
  const aulas = useMemo(() => aulasDaUnidade(aulasForaDaLixeira, unidadeId, hoje), [aulasForaDaLixeira, unidadeId, hoje]);
  // Para as contas do Relatório: todas as aulas da unidade, inclusive as da lixeira (é o que ele usa).
  const aulasTodas = useMemo(
    () => (catalogs.aulasTodas?.length ? catalogs.aulasTodas : catalogs.aulas).filter((a) => String(a.unidadeId) === String(unidadeId)),
    [catalogs.aulasTodas, catalogs.aulas, unidadeId],
  );
  const grade = useMemo(() => gradePorDia(aulas), [aulas]);
  const professores = useMemo(
    () => professoresDaUnidade({ unidadeId, vinculos: catalogs.vinculos, professores: catalogs.professores, aulas }),
    [unidadeId, catalogs.vinculos, catalogs.professores, aulas],
  );
  const modalidadePorId = useMemo(() => new Map(catalogs.modalidades.map((m) => [String(m.id), m])), [catalogs.modalidades]);
  const professorPorId = useMemo(() => new Map(catalogs.professores.map((p) => [String(p.id), p])), [catalogs.professores]);

  // ----- Do banco: validações da unidade no trimestre -----
  const periodo = useMemo(() => periodoDoMes(mes, hoje), [mes, hoje]);
  const meses = useMemo(() => mesesDoTrimestre(mes), [mes]);
  const inicioDoTrimestre = limitesDoMes(meses[0])[0];
  const inicioPendencias = somarDias(hoje, -(DIAS_JANELA_PENDENCIAS - 1));
  // No mês atual, a busca do trimestre já cobre os últimos 7 dias; só em mês antigo é preciso buscar à parte.
  const cobrePendencias = inicioDoTrimestre <= inicioPendencias && periodo.fim >= hoje;
  const idParaBuscar = ativo ? unidadeId : null;
  const temporarios = useTemporariosDaUnidade(unidadeId, ativo);
  const doTrimestre = useValidacoesDaUnidade(idParaBuscar, inicioDoTrimestre, periodo.fim);
  const recentes = useValidacoesDaUnidade(cobrePendencias ? null : idParaBuscar, inicioPendencias, hoje);
  const validacoes = doTrimestre.validacoes;
  const validacoesRecentes = cobrePendencias ? doTrimestre.validacoes : recentes.validacoes;

  const resumo = useMemo(
    () => (validacoes && unidade
      ? indicadoresDaUnidade({ validacoes, inicio: periodo.inicio, fim: periodo.fim, aulasTodas, unidade, modalidades: catalogs.modalidades })
      : null),
    [validacoes, periodo, aulasTodas, unidade, catalogs.modalidades],
  );
  const anterior = useMemo(
    () => (validacoes && unidade
      ? indicadoresDaUnidade({ validacoes, inicio: periodo.inicioAnterior, fim: periodo.fimAnterior, aulasTodas, unidade, modalidades: catalogs.modalidades })
      : null),
    [validacoes, periodo, aulasTodas, unidade, catalogs.modalidades],
  );
  const porMes = useMemo(() => (validacoes ? gastoPorMes({ validacoes, meses, aulasTodas }) : null), [validacoes, meses, aulasTodas]);
  const porProfessor = useMemo(
    () => (validacoes ? gastoPorProfessor({ validacoes, inicio: periodo.inicio, fim: periodo.fim, aulasTodas }) : null),
    [validacoes, periodo, aulasTodas],
  );
  const pendencias = useMemo(
    () => (unidade && validacoesRecentes
      ? pendenciasDaUnidade({ aulas: aulasForaDaLixeira, unidade, feriados: catalogs.feriados, validacoes: validacoesRecentes, hoje, agoraHHMM })
      : null),
    [unidade, validacoesRecentes, aulasForaDaLixeira, catalogs.feriados, hoje, agoraHHMM],
  );

  return {
    unidade, mentor, mentor2, temporarios, aulas, grade, professores, modalidadePorId, professorPorId,
    periodo, meses, resumo, anterior, porMes, porProfessor, pendencias,
    erro: doTrimestre.erro,
  };
}

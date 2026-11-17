// Registro de auditoria de aula criada fora da tela do Cronograma (ex.: Radar de Ociosidade),
// no mesmo formato que o Cronograma grava, para a aba Auditoria mostrar tudo igual.
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/** Devolve [referência, dados] para entrar no mesmo lote que grava a aula. */
export function logDeAulaNova({ usuario, descricao, unidade, modalidade, professor, hora, dias, valor, dataInicio }) {
  const estadoNovo = {
    unidade: unidade || 'Unidade Desconhecida',
    modalidade: modalidade || 'Modalidade Desconhecida',
    professor: professor || 'Professor Desconhecido',
    hora: hora || '',
    dias: [...(dias || [])].sort().join(', '),
    valor: valor ? parseFloat(valor) : 0,
    dataInicio: dataInicio || '',
    dataFim: 'N/A',
  };
  return [doc(collection(db, 'auditoria_cronograma')), {
    tipoAcao: 'NOVA',
    descricao: descricao || 'Aula adicionada na grade.',
    diffExtras: `Dias: ${(dias || []).join(', ')} | Hora: ${hora}`,
    estadoAnterior: null,
    estadoNovo,
    modulo: 'CRONOGRAMA',
    unidadeNome: estadoNovo.unidade,
    modalidadeNome: estadoNovo.modalidade,
    professorNome: estadoNovo.professor,
    dias: dias || [],
    hora: estadoNovo.hora,
    valor: estadoNovo.valor,
    usuarioAcaoNome: usuario?.nome || usuario?.email || 'Administrador do Sistema',
    usuarioAcaoId: usuario?.id || usuario?.uid || null,
    dataAcao: serverTimestamp(),
  }];
}

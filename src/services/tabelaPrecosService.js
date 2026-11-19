// Leitura e gravação da tabela de preços (tabela_precos/atual). Ver src/utils/tabelaPrecos.js.
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { listarDiferencas, mesclarComPadrao } from '../utils/tabelaPrecos';

const COLECAO = 'tabela_precos';
const DOCUMENTO = 'atual';

// Lê 1 documento. Sem documento salvo, devolve os valores padrão (salvo: false).
export async function lerTabelaPrecos() {
  const snap = await getDoc(doc(db, COLECAO, DOCUMENTO));
  const dados = snap.exists() ? snap.data() : null;
  return {
    tabela: mesclarComPadrao(dados),
    salvo: !!dados,
    atualizadoEm: dados?.atualizadoEm?.toMillis?.() || null,
    atualizadoPorNome: dados?.atualizadoPorNome || '',
  };
}

// Só o admin grava (regra do banco). Registra na auditoria o que mudou (de ➔ para).
export async function salvarTabelaPrecos({ tabela, anterior, usuario }) {
  const diferencas = listarDiferencas(anterior, tabela);
  await setDoc(doc(db, COLECAO, DOCUMENTO), {
    modalidades: tabela.modalidades,
    precos: tabela.precos,
    frequenciaPreta: tabela.frequenciaPreta,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: usuario.id || '',
    atualizadoPorNome: usuario.nome || '',
  });
  if (diferencas.length > 0) {
    try {
      await addDoc(collection(db, 'auditoria_cronograma'), {
        tipoAcao: 'ALTERADA',
        descricao: 'Tabela de preços atualizada',
        diffExtras: diferencas.join(' | '),
        modulo: 'CONFIGURACOES',
        unidadeNome: 'Base Global',
        professorNome: '-',
        modalidadeNome: 'Tabela de preços',
        usuarioAcaoNome: usuario.nome || 'Administrador do Sistema',
        usuarioAcaoId: usuario.id || '',
        dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error('Erro ao gerar log de auditoria da tabela de preços', e); }
  }
  return diferencas;
}

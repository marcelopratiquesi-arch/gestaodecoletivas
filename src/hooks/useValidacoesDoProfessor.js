// Validações que interessam a UM professor, em tempo real:
// 1) as que estão no nome dele (ele deu a aula, como titular ou como substituto);
// 2) as das aulas DELE que outro professor deu (substituição: professorOriginalId = ele).
// Sem a 2ª, a aula substituída "voltava" como pendente para o titular e ele podia apagar a substituição.
//
// Consultas idênticas abertas no menu e na página são compartilhadas pelo Firebase (sem leitura em dobro).
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { deduplicarValidacoes } from '../utils/validacoes';

export function meuProfessorId(userData, professores = []) {
  const uid = userData?.id || userData?.uid;
  return userData?.professorId || professores.find(p => p.uidLogin === uid)?.id || null;
}

const VAZIO = { chave: null, proprias: [], substituidas: [], prontoP: false, prontoS: false };

export function useValidacoesDoProfessor(professorId, dataInicio, dataFim) {
  const chave = professorId && dataInicio && dataFim ? `${professorId}|${dataInicio}|${dataFim}` : null;
  const [estado, setEstado] = useState(VAZIO);

  useEffect(() => {
    if (!chave) return;
    // Cada resposta só vale para a consulta atual (chave); respostas de uma consulta antiga são descartadas.
    const gravar = (campos) => setEstado(prev => ({ ...(prev.chave === chave ? prev : { ...VAZIO, chave }), ...campos }));
    const erro = (pronto) => (e) => { console.error('Erro ao ler validações do professor:', e); gravar({ [pronto]: true }); };

    const qProprias = query(collection(db, 'validacoes'),
      where('data', '>=', dataInicio), where('data', '<=', dataFim), where('professorId', '==', String(professorId)));
    // Só igualdade (sem intervalo de datas) para não exigir índice novo; o volume é pequeno (só substituições).
    const qSubstituidas = query(collection(db, 'validacoes'), where('professorOriginalId', '==', String(professorId)));

    const u1 = onSnapshot(qProprias,
      (snap) => gravar({ proprias: snap.docs.map(d => ({ id: d.id, ...d.data() })), prontoP: true }), erro('prontoP'));
    const u2 = onSnapshot(qSubstituidas,
      (snap) => gravar({ substituidas: snap.docs.map(d => ({ id: d.id, ...d.data() })), prontoS: true }), erro('prontoS'));
    return () => { u1(); u2(); };
  }, [chave, professorId, dataInicio, dataFim]);

  const atual = estado.chave === chave;
  const carregando = !!chave && !(atual && estado.prontoP && estado.prontoS);

  const validacoes = useMemo(() => {
    if (!chave || !atual) return [];
    const porId = new Map();
    [...estado.proprias, ...estado.substituidas.filter(v => v.data >= dataInicio && v.data <= dataFim)]
      .forEach(v => porId.set(v.id, v));
    return deduplicarValidacoes([...porId.values()]);
  }, [chave, atual, estado, dataInicio, dataFim]);

  return { validacoes, carregando };
}

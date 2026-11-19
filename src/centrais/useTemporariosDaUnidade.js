// Líderes temporários de UMA unidade (crachás com prazo "temporarioAte" que incluem esta unidade).
// Uma leitura pequena por unidade aberta (só os crachás de líder dessa unidade), guardada por 5 minutos.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { fimDoTemporario } from '../utils/temporario';

const CACHE = new Map(); // unidadeId -> { quando, lista }
const VALIDADE_MS = 5 * 60 * 1000;

export function useTemporariosDaUnidade(unidadeId, ativo) {
  const [buscado, setBuscado] = useState({ id: null, lista: [] });

  useEffect(() => {
    if (!ativo || !unidadeId) return undefined;
    const guardado = CACHE.get(String(unidadeId));
    if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return undefined;
    let vivo = true;
    getDocs(query(collection(db, 'usuarios'), where('unidadeIds', 'array-contains', String(unidadeId))))
      .then((snap) => {
        const itens = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => fimDoTemporario(c))
          .sort((a, b) => fimDoTemporario(a).getTime() - fimDoTemporario(b).getTime());
        CACHE.set(String(unidadeId), { quando: Date.now(), lista: itens });
        if (vivo) setBuscado({ id: String(unidadeId), lista: itens });
      })
      .catch((e) => console.warn('Líderes temporários não carregados:', e?.code));
    return () => { vivo = false; };
  }, [unidadeId, ativo]);

  // Na tela: o que acabou de ser buscado, ou o que já estava guardado desta unidade.
  return buscado.id === String(unidadeId) ? buscado.lista : (CACHE.get(String(unidadeId))?.lista || []);
}

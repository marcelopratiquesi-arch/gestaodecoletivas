// Pessoas que cobrem um mentor (mentor temporário): crachás com coberturaMentorId = este mentor.
// Uma leitura pequena por Central de mentor aberta, guardada por 5 minutos.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const CACHE = new Map(); // mentorId -> { quando, lista }
const VALIDADE_MS = 5 * 60 * 1000;

export function useCoberturasDoMentor(mentorId, ativo) {
  const [buscado, setBuscado] = useState({ id: null, lista: [] });

  useEffect(() => {
    if (!ativo || !mentorId) return undefined;
    const guardado = CACHE.get(String(mentorId));
    if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return undefined;
    let vivo = true;
    getDocs(query(collection(db, 'usuarios'), where('coberturaMentorId', '==', String(mentorId))))
      .then((snap) => {
        const itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        CACHE.set(String(mentorId), { quando: Date.now(), lista: itens });
        if (vivo) setBuscado({ id: String(mentorId), lista: itens });
      })
      .catch((e) => console.warn('Coberturas não carregadas:', e?.code));
    return () => { vivo = false; };
  }, [mentorId, ativo]);

  return buscado.id === String(mentorId) ? buscado.lista : (CACHE.get(String(mentorId))?.lista || []);
}

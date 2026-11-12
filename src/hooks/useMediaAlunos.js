// Média de alunos das últimas aulas de cada horário (aula da grade), para sugerir o número e
// avisar quando o valor digitado foge muito do normal.
//
// Econômico para a cota gratuita: lê só as 6 validações mais recentes de cada aula que aparece na
// tela (consulta aulaId == X, ordenada por data, limite 6), guarda em memória enquanto o sistema
// estiver aberto e nunca busca a mesma aula duas vezes. Teto de aulas buscadas por sessão.
// Precisa do índice (aulaId ↑, data ↓) de firestore.indexes.json; sem ele, só não há sugestão.
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const AMOSTRAS = 4;            // média das últimas 4 aulas realizadas
const LEITURA_POR_AULA = 6;    // lê 6 para sobrar margem para canceladas
const TETO_AULAS_SESSAO = 80;  // no máximo 80 aulas diferentes por sessão (≈ 480 leituras)

const cache = new Map();       // aulaId -> lista de { data, alunos } (mais recente primeiro) | null (sem dados)
const emAndamento = new Set();
let buscadas = 0;

export function mediaDaAula(historico, dataAula) {
  if (!historico) return null;
  const vistas = new Set();
  const amostras = [];
  for (const v of historico) {
    if (v.data >= dataAula || vistas.has(v.data)) continue;
    vistas.add(v.data);
    amostras.push(v.alunos);
    if (amostras.length >= AMOSTRAS) break;
  }
  if (amostras.length === 0) return null;
  return { media: Math.round(amostras.reduce((s, n) => s + n, 0) / amostras.length), amostras: amostras.length };
}

// Número "estranho": bem acima (mais que o dobro e +10) ou bem abaixo (menos de 1/3) da média.
export function numeroEstranho(alunos, mediaInfo) {
  if (!mediaInfo || mediaInfo.amostras < 2) return false;
  const { media } = mediaInfo;
  if (alunos > media * 2 && alunos - media >= 10) return true;
  if (media >= 9 && alunos < media / 3) return true;
  return false;
}

// Quem está na tela é avisado quando uma busca termina (mesmo que tenha sido disparada por outro render).
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(fn => fn(v => v + 1));

export function useMediaAlunos(aulaIds) {
  const [, setVersao] = useState(0);
  const chave = [...new Set(aulaIds.map(String))].sort().join(',');

  useEffect(() => {
    ouvintes.add(setVersao);
    return () => { ouvintes.delete(setVersao); };
  }, []);

  useEffect(() => {
    if (!chave) return;
    const faltando = chave.split(',').filter(id => id && !cache.has(id) && !emAndamento.has(id));
    for (const id of faltando) {
      if (buscadas >= TETO_AULAS_SESSAO) break;
      buscadas += 1;
      emAndamento.add(id);
      const q = query(collection(db, 'validacoes'), where('aulaId', '==', id), orderBy('data', 'desc'), limit(LEITURA_POR_AULA));
      getDocs(q)
        .then(snap => {
          const lista = snap.docs.map(d => d.data())
            .filter(v => v.status === 'realizada' && typeof v.alunos === 'number' && v.alunos >= 0)
            .map(v => ({ data: v.data, alunos: v.alunos }));
          cache.set(id, lista.length ? lista : null);
        })
        .catch(e => { console.warn('Média de alunos indisponível (índice aulaId/data?):', e?.message); cache.set(id, null); })
        .finally(() => { emAndamento.delete(id); avisar(); });
    }
  }, [chave]);

  return (aulaId, dataAula) => mediaDaAula(cache.get(String(aulaId)), dataAula);
}

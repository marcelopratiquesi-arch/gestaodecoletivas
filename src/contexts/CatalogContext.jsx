import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext'; // 🟢 1. Importamos o porteiro (Autenticação)

const CatalogContext = createContext();

export const useCatalogs = () => useContext(CatalogContext);

const CATALOGOS_VAZIOS = {
    unidades: [],
    modalidades: [],
    professores: [],
    vinculos: [],
    feriados: [],
    mentores: [],
    aulas: [],
    aulasTodas: [] // inclui excluídas: usada só para valores de meses passados
};

const BASE_VAZIA = { unidades: [], modalidades: [], professores: [], feriados: [], mentores: [], meusVinculos: [] };
const ESCOPADOS_VAZIOS = { aulas: [], aulasTodas: [], vinculos: [] };

const mapearDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// O Firestore aceita no máximo 30 valores num filtro "in".
const emBlocos = (lista, tamanho = 30) =>
    Array.from({ length: Math.ceil(lista.length / tamanho) }, (_, i) => lista.slice(i * tamanho, i * tamanho + tamanho));

// 🟢 MEMÓRIA AO VIVO: em vez de buscar uma vez no login, escuta o banco.
// Assim uma aula criada no Cronograma (ou uma unidade/professor/feriado alterado nas Configurações)
// aparece na hora em todas as telas, sem precisar apertar F5. Depois da primeira carga, só chegam as mudanças.
//
// ECONOMIA DE COTA (plano gratuito: 50 mil leituras/dia): aulas e vínculos (~2.000 + ~650 documentos)
// são baixados só das unidades que interessam a quem entrou:
//   - unidade:   a própria unidade;
//   - mentor:    as unidades dele;
//   - professor: as unidades onde ele tem vínculo (as mesmas que o Cronograma e a Validação Diária mostram);
//   - admin:     a rede inteira.
// As telas já mostravam só isso para cada papel; agora o filtro acontece ANTES de baixar.
// Unidades, modalidades, professores, feriados e mentores continuam completos (são pequenos e usados em listas).
export const CatalogProvider = ({ children }) => {
    // 🟢 2. Pegamos o crachá e o status de carregamento do Auth
    const { user, userData, loading: authLoading } = useAuth();
    const uid = user?.uid || null;
    const papel = String(userData?.role || "").trim().toLowerCase();
    const meuProfessorId = papel === 'professor' ? (userData?.professorId || null) : null;

    // ---------- 1ª camada: cadastros pequenos (completos) ----------
    const [base, setBase] = useState(BASE_VAZIA);
    const chaveSessao = authLoading ? null : (uid ? `${uid}|${papel}|${meuProfessorId ?? ''}` : 'publico');
    const [baseCarregadaPara, setBaseCarregadaPara] = useState(null);

    useEffect(() => {
        if (chaveSessao === null) return;

        // Sem login não escuta nada: as únicas telas abertas sem login (/login e /horarios) não usam o catálogo.
        if (!uid) {
            setBase(BASE_VAZIA);
            setBaseCarregadaPara(chaveSessao);
            return;
        }

        const fontes = [
            { chave: 'unidades', ref: query(collection(db, 'unidades'), orderBy('nome')) },
            { chave: 'modalidades', ref: query(collection(db, 'modalidades'), orderBy('nome')) },
            { chave: 'professores', ref: query(collection(db, 'professores'), orderBy('nome')) },
            { chave: 'feriados', ref: collection(db, 'feriados') },
            { chave: 'mentores', ref: query(collection(db, 'usuarios'), where('role', '==', 'mentor')) },
        ];
        // Professor: os próprios vínculos dizem de quais unidades baixar as aulas.
        if (meuProfessorId) fontes.push({ chave: 'meusVinculos', ref: query(collection(db, 'vinculos'), where('professorId', '==', meuProfessorId)) });

        const pendentes = new Set(fontes.map(f => f.chave));
        const marcarRespondido = (chave) => {
            if (pendentes.delete(chave) && pendentes.size === 0) setBaseCarregadaPara(chaveSessao);
        };

        const cancelar = fontes.map(({ chave, ref }) => onSnapshot(
            ref,
            (snap) => {
                setBase(prev => ({ ...prev, [chave]: mapearDocs(snap) }));
                marcarRespondido(chave);
            },
            (error) => {
                console.error(`Erro ao escutar catálogo "${chave}" (Memória de Elefante):`, error);
                marcarRespondido(chave);
            }
        ));

        return () => cancelar.forEach(unsub => unsub());
        // uid/papel entram pela chaveSessao; evita reabrir as escutas quando só o objeto do usuário muda
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chaveSessao]);

    // ---------- Quais unidades interessam ('*' = rede inteira; null = ainda não dá para saber) ----------
    const basePronta = chaveSessao !== null && baseCarregadaPara === chaveSessao;
    const escopo = useMemo(() => {
        if (chaveSessao === null) return null;
        if (!uid) return '*';
        if (papel === 'unidade') return userData?.unidadeId ? [String(userData.unidadeId)] : '*';
        if (papel === 'mentor') {
            if (!basePronta) return null;
            return base.unidades.filter(u => u.mentorId === uid).map(u => String(u.id)).sort();
        }
        if (papel === 'professor' && meuProfessorId) {
            if (!basePronta) return null;
            return [...new Set(base.meusVinculos.map(v => String(v.unidadeId)).filter(Boolean))].sort();
        }
        return '*'; // admin (e professor antigo sem professorId no crachá: como antes)
    }, [chaveSessao, uid, papel, userData?.unidadeId, meuProfessorId, basePronta, base.unidades, base.meusVinculos]);

    // Vira texto: as escutas só reabrem quando o conjunto de unidades muda de verdade.
    const chaveEscopo = escopo === null ? null : `${chaveSessao}#${escopo === '*' ? '*' : escopo.join(',')}`;

    // ---------- 2ª camada: aulas e vínculos só do escopo ----------
    const [escopados, setEscopados] = useState(ESCOPADOS_VAZIOS);
    const [escopoCarregadoPara, setEscopoCarregadoPara] = useState(null);

    useEffect(() => {
        if (chaveEscopo === null) return;
        const lista = escopo;

        if (!uid || (lista !== '*' && lista.length === 0)) {
            setEscopados(ESCOPADOS_VAZIOS);
            setEscopoCarregadoPara(chaveEscopo);
            return;
        }

        const consultas = (nome) => (lista === '*'
            ? [collection(db, nome)]
            : emBlocos(lista).map(bloco => query(collection(db, nome), where('unidadeId', 'in', bloco))));

        const grupos = { aulas: consultas('aulas'), vinculos: consultas('vinculos') };
        const resultados = { aulas: grupos.aulas.map(() => null), vinculos: grupos.vinculos.map(() => null) };

        const publicar = () => {
            if (!Object.values(resultados).every(r => r.every(Boolean))) return; // espera todos responderem
            const aulasTodas = resultados.aulas.flat();
            setEscopados({
                // 🟢 LIXEIRA (SOFT DELETE): aulas com 'excluido: true' não entram na memória global
                aulas: aulasTodas.filter(aula => aula.excluido !== true),
                aulasTodas,
                vinculos: resultados.vinculos.flat(),
            });
            setEscopoCarregadoPara(chaveEscopo);
        };

        const cancelar = Object.entries(grupos).flatMap(([nome, refs]) => refs.map((ref, i) => onSnapshot(
            ref,
            (snap) => { resultados[nome][i] = mapearDocs(snap); publicar(); },
            (error) => {
                console.error(`Erro ao escutar catálogo "${nome}" (Memória de Elefante):`, error);
                resultados[nome][i] = resultados[nome][i] || [];
                publicar();
            }
        )));

        return () => cancelar.forEach(unsub => unsub());
        // escopo entra pela chaveEscopo
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chaveEscopo]);

    const loadingCatalogs = !basePronta || chaveEscopo === null || escopoCarregadoPara !== chaveEscopo;

    // Sem login, os dados sigilosos não ficam visíveis (mesmo que tenham sido carregados numa sessão anterior).
    const catalogosVisiveis = useMemo(() => {
        const { meusVinculos: _ignorado, ...cadastros } = base;
        const tudo = { ...CATALOGOS_VAZIOS, ...cadastros, ...escopados };
        return user ? tudo : { ...tudo, vinculos: [], mentores: [] };
    }, [user, base, escopados]);

    // Mantido por compatibilidade: com a escuta ao vivo não é mais preciso recarregar à mão.
    const refreshCatalogs = useCallback(() => Promise.resolve(), []);

    return (
        <CatalogContext.Provider value={{ catalogs: catalogosVisiveis, loadingCatalogs, refreshCatalogs }}>
            {children}
        </CatalogContext.Provider>
    );
};

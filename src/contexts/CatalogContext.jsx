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

const mapearDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

export const CatalogProvider = ({ children }) => {
    // 🟢 2. Pegamos o crachá e o status de carregamento do Auth
    const { user, loading: authLoading } = useAuth();

    const [catalogs, setCatalogs] = useState(CATALOGOS_VAZIOS);
    // "Carregado para quem": o carregamento termina quando todas as escutas do usuário atual responderam.
    const chaveSessao = authLoading ? null : (user?.uid || 'publico');
    const [carregadoPara, setCarregadoPara] = useState(null);
    const loadingCatalogs = chaveSessao === null || carregadoPara !== chaveSessao;

    // 🟢 3. MEMÓRIA AO VIVO: em vez de buscar uma vez no login, escuta o banco.
    // Assim uma aula criada no Cronograma (ou uma unidade/professor/feriado alterado nas Configurações)
    // aparece na hora em todas as telas, sem precisar apertar F5.
    // A primeira carga lê o mesmo que antes; depois só chegam as mudanças.
    useEffect(() => {
        if (chaveSessao === null) return;

        // Sem login não escuta nada: as únicas telas abertas sem login (/login e /horarios) não usam o catálogo.
        // Antes, cada QR Code escaneado e cada abertura da tela de login baixava o banco inteiro
        // (todas as aulas, professores, unidades...) e esgotava a cota diária gratuita de leituras.
        if (!user) {
            setCatalogs(CATALOGOS_VAZIOS);
            setCarregadoPara(chaveSessao);
            return;
        }

        const fontes = [
            { chave: 'unidades', ref: query(collection(db, 'unidades'), orderBy('nome')) },
            { chave: 'modalidades', ref: query(collection(db, 'modalidades'), orderBy('nome')) },
            { chave: 'professores', ref: query(collection(db, 'professores'), orderBy('nome')) },
            { chave: 'feriados', ref: collection(db, 'feriados') },
            // 🟢 LIXEIRA (SOFT DELETE): aulas com 'excluido: true' não entram na memória global
            { chave: 'aulas', ref: collection(db, 'aulas'), filtro: (lista) => lista.filter(aula => aula.excluido !== true), copiaCompleta: 'aulasTodas' },
            { chave: 'vinculos', ref: collection(db, 'vinculos') },
            { chave: 'mentores', ref: query(collection(db, 'usuarios'), where('role', '==', 'mentor')) },
        ];

        const pendentes = new Set(fontes.map(f => f.chave));
        const marcarRespondido = (chave) => {
            if (pendentes.delete(chave) && pendentes.size === 0) setCarregadoPara(chaveSessao);
        };

        const cancelar = fontes.map(({ chave, ref, filtro, copiaCompleta }) => onSnapshot(
            ref,
            (snap) => {
                const lista = mapearDocs(snap);
                setCatalogs(prev => ({ ...prev, [chave]: filtro ? filtro(lista) : lista, ...(copiaCompleta ? { [copiaCompleta]: lista } : {}) }));
                marcarRespondido(chave);
            },
            (error) => {
                console.error(`Erro ao escutar catálogo "${chave}" (Memória de Elefante):`, error);
                marcarRespondido(chave);
            }
        ));

        return () => cancelar.forEach(unsub => unsub());
        // user entra pela chaveSessao (uid); evita reabrir as escutas quando só o objeto do usuário muda
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chaveSessao]);

    // Sem login, os dados sigilosos não ficam visíveis (mesmo que tenham sido carregados numa sessão anterior).
    const catalogosVisiveis = useMemo(
        () => (user ? catalogs : { ...catalogs, vinculos: [], mentores: [] }),
        [user, catalogs]
    );

    // Mantido por compatibilidade: com a escuta ao vivo não é mais preciso recarregar à mão.
    const refreshCatalogs = useCallback(() => Promise.resolve(), []);

    return (
        <CatalogContext.Provider value={{ catalogs: catalogosVisiveis, loadingCatalogs, refreshCatalogs }}>
            {children}
        </CatalogContext.Provider>
    );
};

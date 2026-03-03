import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext'; // 🟢 1. Importamos o porteiro (Autenticação)

const CatalogContext = createContext();

export const useCatalogs = () => useContext(CatalogContext);

export const CatalogProvider = ({ children }) => {
    // 🟢 2. Pegamos o crachá e o status de carregamento do Auth
    const { user, loading: authLoading } = useAuth(); 

    const [catalogs, setCatalogs] = useState({
        unidades: [],
        modalidades: [],
        professores: [],
        vinculos: [],
        feriados: [],
        mentores: [],
        aulas: [] 
    });
    
    const [loadingCatalogs, setLoadingCatalogs] = useState(true);

    const fetchCatalogs = async () => {
        setLoadingCatalogs(true);
        try {
            // 🟢 3A. Catálogos Públicos (Qualquer um pode ler, mesmo sem login - para o Cronograma)
            const publicPromises = Promise.all([
                getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
                getDocs(query(collection(db, 'modalidades'), orderBy('nome'))),
                getDocs(query(collection(db, 'professores'), orderBy('nome'))),
                getDocs(collection(db, 'feriados')),
                getDocs(collection(db, 'aulas'))
            ]);

            let unitsSnap, modsSnap, profsSnap, feriadosSnap, aulasSnap;
            let linksSnap = { docs: [] };
            let usersSnap = { docs: [] };

            // 🟢 3B. Só tenta baixar dados sigilosos se o usuário JÁ TIVER LOGADO
            if (user) {
                const [pubRes, privRes] = await Promise.all([
                    publicPromises,
                    Promise.all([
                        getDocs(collection(db, 'vinculos')),
                        getDocs(query(collection(db, 'usuarios'), where('role', '==', 'mentor')))
                    ])
                ]);
                [unitsSnap, modsSnap, profsSnap, feriadosSnap, aulasSnap] = pubRes;
                [linksSnap, usersSnap] = privRes;
            } else {
                [unitsSnap, modsSnap, profsSnap, feriadosSnap, aulasSnap] = await publicPromises;
            }

            setCatalogs({
                unidades: unitsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                modalidades: modsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                professores: profsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                feriados: feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                aulas: aulasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                vinculos: linksSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                mentores: usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) {
            console.error("Erro ao buscar catálogos globais (Memória de Elefante):", error);
        } finally {
            setLoadingCatalogs(false);
        }
    };

    // 🟢 4. A MÁGICA: Só dispara a busca quando a autenticação disser "Terminei de carregar!"
    useEffect(() => {
        if (!authLoading) {
            fetchCatalogs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading]);

    const refreshCatalogs = () => {
        return fetchCatalogs();
    };

    return (
        <CatalogContext.Provider value={{ catalogs, loadingCatalogs, refreshCatalogs }}>
            {children}
        </CatalogContext.Provider>
    );
};
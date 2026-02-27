import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const CatalogContext = createContext();

export const useCatalogs = () => useContext(CatalogContext);

export const CatalogProvider = ({ children }) => {
    // 🟢 O CACHE GLOBAL ("OS OSSOS")
    const [catalogs, setCatalogs] = useState({
        unidades: [],
        modalidades: [],
        professores: [],
        vinculos: [],
        feriados: [],
        mentores: []
    });
    
    const [loadingCatalogs, setLoadingCatalogs] = useState(true);

    const fetchCatalogs = async () => {
        setLoadingCatalogs(true);
        try {
            const [unitsSnap, modsSnap, profsSnap, linksSnap, feriadosSnap, usersSnap] = await Promise.all([
                getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
                getDocs(query(collection(db, 'modalidades'), orderBy('nome'))),
                getDocs(query(collection(db, 'professores'), orderBy('nome'))),
                getDocs(collection(db, 'vinculos')),
                getDocs(collection(db, 'feriados')),
                getDocs(query(collection(db, 'usuarios'), where('role', '==', 'mentor')))
            ]);

            setCatalogs({
                unidades: unitsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                modalidades: modsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                professores: profsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                vinculos: linksSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                feriados: feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                mentores: usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) {
            console.error("Erro ao buscar catálogos globais (Memória de Elefante):", error);
        } finally {
            setLoadingCatalogs(false);
        }
    };

    // Baixa tudo ao inicializar o sistema
    useEffect(() => {
        fetchCatalogs();
    }, []);

    // Permite forçar uma atualização ("Ping" manual)
    const refreshCatalogs = () => {
        return fetchCatalogs();
    };

    return (
        <CatalogContext.Provider value={{ catalogs, loadingCatalogs, refreshCatalogs }}>
            {children}
        </CatalogContext.Provider>
    );
};
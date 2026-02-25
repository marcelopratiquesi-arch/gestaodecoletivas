import React, { createContext, useContext, useState, useRef } from 'react';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
    const [faixaAtual, setFaixaAtual] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [fila, setFila] = useState([]);
    const playerRef = useRef(null); // Aqui fica guardado o motor do Vimeo

    const tocarFaixa = (faixa, novaFila = []) => {
        if (faixaAtual?.id === faixa.id) {
            togglePlay();
            return;
        }
        setFaixaAtual(faixa);
        if (novaFila.length > 0) setFila(novaFila);
        setIsPlaying(true);
    };

    const togglePlay = () => {
        if (!playerRef.current) return;
        if (isPlaying) {
            playerRef.current.pause();
            setIsPlaying(false);
        } else {
            playerRef.current.play();
            setIsPlaying(true);
        }
    };

    const tocarProxima = () => {
        if (!faixaAtual || fila.length === 0) return;
        const indexAtual = fila.findIndex(f => f.id === faixaAtual.id);
        if (indexAtual >= 0 && indexAtual < fila.length - 1) {
            tocarFaixa(fila[indexAtual + 1], fila);
        } else {
            setIsPlaying(false);
        }
    };

    const tocarAnterior = () => {
        if (!faixaAtual || fila.length === 0) return;
        const indexAtual = fila.findIndex(f => f.id === faixaAtual.id);
        if (indexAtual > 0) {
            tocarFaixa(fila[indexAtual - 1], fila);
        }
    };

    return (
        <PlayerContext.Provider value={{ faixaAtual, isPlaying, setIsPlaying, tocarFaixa, togglePlay, tocarProxima, tocarAnterior, playerRef, fila }}>
            {children}
        </PlayerContext.Provider>
    );
}

export const usePlayer = () => useContext(PlayerContext);
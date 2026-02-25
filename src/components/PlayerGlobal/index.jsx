import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Music, ChevronDown, Heart } from 'lucide-react';
import Player from '@vimeo/player';

export default function PlayerGlobal() {
    const { userData } = useAuth();
    const { faixaAtual, isPlaying, setIsPlaying, togglePlay, tocarProxima, tocarAnterior, playerRef } = usePlayer();
    const containerRef = useRef(null);
    const location = useLocation();

    const [tempoAtual, setTempoAtual] = useState(0);
    const [duracaoTotal, setDuracaoTotal] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFavorito, setIsFavorito] = useState(false);

    // Regra: Mostrar a barra APENAS se estiver na página do Play
    const isPratiquePlayPage = location.pathname.includes('/pratique-play');
    const userId = userData?.uid || userData?.id;

    useEffect(() => {
        if (!userId || !faixaAtual) return;
        const ref = doc(db, `usuarios/${userId}/favoritos_play`, faixaAtual.id);
        const unsub = onSnapshot(ref, (docSnap) => {
            setIsFavorito(docSnap.exists());
        });
        return () => unsub();
    }, [faixaAtual, userId]);

    const toggleFavorito = async (e) => {
        if (e) e.stopPropagation();
        if (!userId || !faixaAtual) return;
        const ref = doc(db, `usuarios/${userId}/favoritos_play`, faixaAtual.id);
        if (isFavorito) await deleteDoc(ref);
        else await setDoc(ref, { adicionadoEm: new Date().toISOString() });
    };

    useEffect(() => {
        if (!faixaAtual || !containerRef.current) return;

        if (!playerRef.current) {
            playerRef.current = new Player(containerRef.current, {
                url: faixaAtual.vimeoUrl, 
                autopause: false, 
                controls: false,
                playsinline: true,
                dnt: true
            });

            playerRef.current.on('ended', () => tocarProxima());
            playerRef.current.on('pause', () => setIsPlaying(false));
            playerRef.current.on('play', () => setIsPlaying(true));
            playerRef.current.on('timeupdate', (data) => setTempoAtual(data.seconds));
            playerRef.current.on('loaded', (data) => {
                setDuracaoTotal(data.duration);
                playerRef.current.setVolume(1);
            });

            playerRef.current.play().catch(() => setIsPlaying(false));
        } else {
            playerRef.current.loadVideo(faixaAtual.vimeoUrl).then(() => {
                setTempoAtual(0);
                playerRef.current.setVolume(1);
                playerRef.current.play();
                setIsPlaying(true);
            });
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: faixaAtual.titulo,
                artist: 'Pratique Play',
                album: faixaAtual.bpm !== "N/A" ? `${faixaAtual.bpm} BPM` : 'Pratique'
            });
            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', tocarAnterior);
            navigator.mediaSession.setActionHandler('nexttrack', tocarProxima);
        }
    }, [faixaAtual]);

    const formatarTempo = (segundos) => {
        if (!segundos || isNaN(segundos)) return '00:00';
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = Math.floor(segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const mudarTempo = (e) => {
        const novoTempo = parseFloat(e.target.value);
        setTempoAtual(novoTempo);
        if (playerRef.current) playerRef.current.setCurrentTime(novoTempo);
    };

    // Se não tem música carregada, encerra tudo.
    if (!faixaAtual) return null;

    return (
        <>
            {/* O MOTOR DO VIMEO FICA SEMPRE RENDERIZADO (Para a música não parar se você mudar de tela) */}
            <div ref={containerRef} className="fixed bottom-0 left-0 w-[10px] h-[10px] opacity-0 z-[-1] pointer-events-none"></div>

            {/* A BARRA VISUAL SÓ APARECE NA PÁGINA DO PRATIQUE PLAY */}
            {isPratiquePlayPage && (
                <>
                    {/* MODO BARRA MINIMIZADA (Design Preto Puro Spotify) */}
                    {!isExpanded && (
                        <div 
                            onClick={() => setIsExpanded(true)}
                            className="absolute bottom-0 left-0 w-full bg-black border-t border-[#282828] text-white z-[90] px-4 md:px-6 py-2.5 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#111] transition-colors"
                        >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <div className="w-10 h-10 bg-[#282828] rounded-md flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
                                    <Music className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="overflow-hidden pr-2 flex-1">
                                    <h4 className="text-sm font-bold truncate leading-tight text-white">{faixaAtual.titulo}</h4>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate mt-0.5">{faixaAtual.bpm !== "N/A" ? `${faixaAtual.bpm} BPM` : 'Pratique Play'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button onClick={toggleFavorito} className="p-2 hidden md:block">
                                    <Heart className={`w-5 h-5 transition-colors ${isFavorito ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                </button>
                                <button onClick={togglePlay} className="w-10 h-10 bg-transparent text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                                </button>
                            </div>

                            {/* Barra de progresso colada no topo do mini-player */}
                            <div className="absolute top-0 left-0 h-[2px] bg-[#1DB954] transition-all duration-300" style={{ width: `${(tempoAtual / (duracaoTotal || 1)) * 100}%` }}></div>
                        </div>
                    )}

                    {/* MODO TELA CHEIA */}
                    {isExpanded && (
                        <div className="fixed inset-0 bg-gradient-to-b from-[#2a2a2a] to-[#121212] z-[9999] flex flex-col animate-in slide-in-from-bottom-full duration-300">
                            
                            <div className="flex items-center justify-between p-6">
                                <button onClick={() => setIsExpanded(false)} className="text-white hover:text-gray-300 p-2 -ml-2">
                                    <ChevronDown className="w-8 h-8" />
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Playlist Atual</span>
                                <div className="w-8"></div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8">
                                <div className="w-full max-w-[320px] aspect-square bg-[#181818] shadow-2xl flex items-center justify-center mb-10 border border-[#282828] shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
                                    <Music className="w-32 h-32 text-gray-600" />
                                </div>
                                
                                <div className="w-full max-w-[350px] flex items-center justify-between mb-4">
                                    <div className="overflow-hidden pr-4 text-left">
                                        <h2 className="text-2xl font-black text-white truncate">{faixaAtual.titulo}</h2>
                                        <p className="text-sm text-gray-400 font-medium uppercase tracking-widest mt-1">Pratique Play</p>
                                    </div>
                                    <button onClick={toggleFavorito} className="flex-shrink-0 p-2">
                                        <Heart className={`w-7 h-7 transition-colors ${isFavorito ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="w-full max-w-[400px] mx-auto p-6 pb-16">
                                <div className="flex flex-col gap-2 mb-8">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={duracaoTotal || 100} 
                                        value={tempoAtual} 
                                        onChange={mudarTempo}
                                        className="w-full h-1 bg-[#4d4d4d] rounded-lg appearance-none cursor-pointer accent-white hover:accent-[#1DB954] transition-all"
                                    />
                                    <div className="flex justify-between text-[11px] font-medium text-gray-400">
                                        <span>{formatarTempo(tempoAtual)}</span>
                                        <span>{formatarTempo(duracaoTotal)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between px-2">
                                    <button onClick={tocarAnterior} className="text-white hover:text-[#1DB954] transition-colors p-2">
                                        <SkipBack className="w-10 h-10 fill-current" />
                                    </button>
                                    <button onClick={togglePlay} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl">
                                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-2" />}
                                    </button>
                                    <button onClick={tocarProxima} className="text-white hover:text-[#1DB954] transition-colors p-2">
                                        <SkipForward className="w-10 h-10 fill-current" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
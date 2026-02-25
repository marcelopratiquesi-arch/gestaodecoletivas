import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Music, ChevronDown, Heart, AlertCircle, X, Loader2 } from 'lucide-react';
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
    const [erroVimeo, setErroVimeo] = useState(""); 
    
    // 🟢 NOVO: ESTADO DE CARREGAMENTO INSTANTÂNEO
    const [isBuffering, setIsBuffering] = useState(false);

    const isPratiquePlayPage = location.pathname.includes('/pratique-play');
    const userId = userData?.uid || userData?.id;

    useEffect(() => {
        if (!userId || !faixaAtual) return;
        const ref = doc(db, `usuarios/${userId}/favoritos_play`, faixaAtual.id);
        const unsub = onSnapshot(ref, (docSnap) => setIsFavorito(docSnap.exists()));
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
        
        setErroVimeo(""); 
        // 🟢 Assim que clica na faixa, a UI já avisa que está carregando!
        setIsBuffering(true); 

        const handleVimeoError = (error) => {
            console.error("Erro no Vimeo:", error);
            if (error.name === 'PrivacyError') {
                setErroVimeo("O Vimeo bloqueou! Libere o domínio nas configurações do vídeo.");
            } else {
                setErroVimeo("O celular exigiu um toque manual. Aperte o Play!");
            }
            setIsPlaying(false);
            setIsBuffering(false);
        };

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
            
            // 🟢 Escutando o Vimeo para saber quando ele parou para pensar
            playerRef.current.on('bufferstart', () => setIsBuffering(true));
            playerRef.current.on('bufferend', () => setIsBuffering(false));
            
            playerRef.current.on('play', () => {
                setIsPlaying(true);
                setIsBuffering(false); // Quando a música sai, o loading some
            });
            
            playerRef.current.on('timeupdate', (data) => setTempoAtual(data.seconds));
            playerRef.current.on('loaded', () => {
                playerRef.current.getDuration().then(d => setDuracaoTotal(d));
                playerRef.current.setVolume(1);
            });

            playerRef.current.play().catch(handleVimeoError);
        } else {
            // Se já tem música, troca e mostra o loading
            playerRef.current.loadVideo(faixaAtual.vimeoUrl).then(() => {
                setTempoAtual(0);
                playerRef.current.getDuration().then(d => setDuracaoTotal(d));
                playerRef.current.setVolume(1);
                
                playerRef.current.play().then(() => {
                    setIsPlaying(true);
                    setIsBuffering(false); // 🟢 Sucesso! Tira o loading.
                }).catch(handleVimeoError);
            }).catch(handleVimeoError);
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: faixaAtual.titulo,
                artist: 'Pratique Play',
                album: faixaAtual.bpm !== "N/A" ? `${faixaAtual.bpm} BPM` : 'Aulas Coletivas'
            });
            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', tocarAnterior);
            navigator.mediaSession.setActionHandler('nexttrack', tocarProxima);
        }
    }, [faixaAtual]);

    const formatarTempo = (segundos) => {
        if (!segundos || isNaN(segundos) || segundos === Infinity) return '00:00';
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = Math.floor(segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const mudarTempo = (e) => {
        const novoTempo = parseFloat(e.target.value);
        setTempoAtual(novoTempo);
        if (playerRef.current) playerRef.current.setCurrentTime(novoTempo);
    };

    if (!faixaAtual) return null;

    return (
        <>
            <div className="fixed top-0 left-0 w-screen h-screen z-[-100] pointer-events-none overflow-hidden" style={{ opacity: 0.01 }}>
                <div ref={containerRef} className="w-full h-full"></div>
            </div>

            {erroVimeo && (
                <div className="fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[400px] bg-red-600 text-white p-3 rounded-xl shadow-2xl z-[10000] flex items-center justify-between animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-xs font-bold leading-tight">{erroVimeo}</p>
                    </div>
                    <button onClick={() => setErroVimeo("")} className="p-1 hover:bg-red-700 rounded-lg"><X className="w-4 h-4"/></button>
                </div>
            )}

            {isPratiquePlayPage && (
                <>
                    {/* BARRA MINIMIZADA NO RODAPÉ */}
                    {!isExpanded && (
                        <div 
                            onClick={() => setIsExpanded(true)}
                            className="absolute bottom-0 left-0 w-full bg-[#121212] border-t border-[#282828] text-white z-[90] px-4 md:px-6 py-2.5 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.8)] cursor-pointer active:bg-[#181818] transition-colors pb-[calc(env(safe-area-inset-bottom)+10px)]"
                        >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <div className="w-10 h-10 bg-[#282828] rounded-md flex items-center justify-center shadow-lg flex-shrink-0">
                                    <Music className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="overflow-hidden pr-2 flex-1">
                                    <h4 className="text-sm font-bold truncate leading-tight text-white">{faixaAtual.titulo}</h4>
                                    <p className="text-[10px] text-[#1DB954] uppercase tracking-widest truncate mt-0.5">
                                        {isBuffering ? "Carregando faixa..." : "Clique para expandir"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button onClick={toggleFavorito} className="p-2 hidden md:block">
                                    <Heart className={`w-5 h-5 transition-colors ${isFavorito ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                </button>
                                
                                {/* 🟢 O BOTÃO MÁGICO: Mostra o Spinner enquanto o Vimeo pensa */}
                                <button onClick={togglePlay} disabled={isBuffering} className="w-12 h-12 bg-transparent text-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50">
                                    {isBuffering ? (
                                        <Loader2 className="w-6 h-6 animate-spin text-[#1DB954]" />
                                    ) : isPlaying ? (
                                        <Pause className="w-7 h-7 fill-current" />
                                    ) : (
                                        <Play className="w-7 h-7 fill-current ml-1" />
                                    )}
                                </button>
                            </div>

                            <div className="absolute top-0 left-0 h-[2px] bg-[#1DB954] transition-all duration-300" style={{ width: `${(tempoAtual / (duracaoTotal || 1)) * 100}%` }}></div>
                        </div>
                    )}

                    {/* TELA CHEIA (Spotify Mobile) */}
                    {isExpanded && (
                        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-gradient-to-b from-[#2a2a2a] to-[#121212] z-[9999] flex flex-col animate-in slide-in-from-bottom-full duration-300 pb-[env(safe-area-inset-bottom)]">
                            
                            <div className="flex items-center justify-between px-6 pt-10 pb-4 md:pt-6 shrink-0">
                                <button onClick={() => setIsExpanded(false)} className="text-white hover:text-gray-300 p-2 -ml-2">
                                    <ChevronDown className="w-8 h-8" />
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                                    {isBuffering ? "CARREGANDO..." : "TOCANDO AGORA"}
                                </span>
                                <div className="w-8"></div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
                                <div className={`w-full max-w-[320px] aspect-square bg-[#181818] shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center justify-center mb-6 border border-[#282828] shrink transition-opacity duration-300 ${isBuffering ? 'opacity-50' : 'opacity-100'}`}>
                                    {isBuffering ? (
                                        <Loader2 className="w-16 h-16 animate-spin text-[#1DB954]" />
                                    ) : (
                                        <Music className="w-32 h-32 text-gray-600" />
                                    )}
                                </div>
                                
                                <div className="w-full max-w-[350px] flex items-center justify-between mb-2">
                                    <div className="overflow-hidden pr-4 text-left">
                                        <h2 className="text-2xl md:text-3xl font-black text-white truncate">{faixaAtual.titulo}</h2>
                                        <p className="text-sm text-gray-400 font-medium uppercase tracking-widest mt-1">Pratique Play</p>
                                    </div>
                                    <button onClick={toggleFavorito} className="flex-shrink-0 p-2 active:scale-90 transition-transform">
                                        <Heart className={`w-8 h-8 transition-colors ${isFavorito ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="w-full max-w-[400px] mx-auto px-6 pb-12 shrink-0">
                                <div className="flex flex-col gap-2 mb-8">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={duracaoTotal || 100} 
                                        value={tempoAtual} 
                                        onChange={mudarTempo}
                                        disabled={isBuffering}
                                        className="w-full h-2 bg-[#4d4d4d] rounded-lg appearance-none cursor-pointer accent-white active:accent-[#1DB954] transition-all disabled:opacity-50"
                                    />
                                    <div className="flex justify-between text-[11px] font-bold text-gray-400">
                                        <span>{formatarTempo(tempoAtual)}</span>
                                        <span>{formatarTempo(duracaoTotal)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between px-2">
                                    <button onClick={tocarAnterior} disabled={isBuffering} className="text-white active:text-[#1DB954] transition-colors p-2 disabled:opacity-50">
                                        <SkipBack className="w-10 h-10 fill-current" />
                                    </button>
                                    
                                    {/* 🟢 O BOTÃO GIGANTE MÁGICO */}
                                    <button onClick={(e) => togglePlay(e)} disabled={isBuffering} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center active:scale-95 transition-all shadow-xl disabled:opacity-80">
                                        {isBuffering ? (
                                            <Loader2 className="w-8 h-8 animate-spin text-black" />
                                        ) : isPlaying ? (
                                            <Pause className="w-8 h-8 fill-current" />
                                        ) : (
                                            <Play className="w-8 h-8 fill-current ml-2" />
                                        )}
                                    </button>
                                    
                                    <button onClick={tocarProxima} disabled={isBuffering} className="text-white active:text-[#1DB954] transition-colors p-2 disabled:opacity-50">
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
import React, { useState, useEffect } from 'react';
import { db } from "../../services/firebase";
import { collection, getDocs, query, orderBy, onSnapshot, setDoc, deleteDoc, doc } from "firebase/firestore";
import { usePlayer } from "../../contexts/PlayerContext";
import { useAuth } from "../../contexts/AuthContext";
import { Play, Pause, Headphones, ChevronLeft, Music, Loader2, Heart } from 'lucide-react';

export default function PratiquePlay() {
    const { userData } = useAuth();
    const { faixaAtual, isPlaying, tocarFaixa } = usePlayer();
    
    const [modalidades, setModalidades] = useState([]);
    const [faixasGlobais, setFaixasGlobais] = useState([]);
    const [favoritos, setFavoritos] = useState([]); // IDs das faixas favoritas
    const [abaAtiva, setAbaAtiva] = useState('explorar'); // explorar | favoritas
    const [modalidadeAtiva, setModalidadeAtiva] = useState(null);
    const [loading, setLoading] = useState(true);

    const userId = userData?.uid || userData?.id;

    useEffect(() => {
        const fetchData = async () => {
            const snap = await getDocs(collection(db, "modalidades"));
            setModalidades(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.nome.localeCompare(b.nome)));
        };
        fetchData();

        const qFaixas = query(collection(db, "pratique_play_faixas"), orderBy("createdAt", "desc"));
        const unsubFaixas = onSnapshot(qFaixas, (snap) => {
            setFaixasGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Puxa os favoritos deste usuário
        if (userId) {
            const qFavs = query(collection(db, `usuarios/${userId}/favoritos_play`));
            const unsubFavs = onSnapshot(qFavs, (snap) => {
                setFavoritos(snap.docs.map(d => d.id));
                setLoading(false);
            });
            return () => { unsubFaixas(); unsubFavs(); };
        } else {
            setLoading(false);
            return () => unsubFaixas();
        }
    }, [userId]);

    const toggleFavorito = async (faixaId, e) => {
        if (e) e.stopPropagation();
        if (!userId) return;

        const ref = doc(db, `usuarios/${userId}/favoritos_play`, faixaId);
        if (favoritos.includes(faixaId)) {
            await deleteDoc(ref);
        } else {
            await setDoc(ref, { adicionadoEm: new Date().toISOString() });
        }
    };

    const modalidadesComMusica = modalidades.filter(mod => 
        faixasGlobais.some(f => f.modalidadeId === mod.id)
    );

    const faixasDaModalidade = faixasGlobais.filter(f => f.modalidadeId === modalidadeAtiva?.id);
    const faixasFavoritas = faixasGlobais.filter(f => favoritos.includes(f.id));

    const playPlaylistCompleta = (faixas) => {
        if (faixas.length > 0) tocarFaixa(faixas[0], faixas);
    };

    if (loading) return <div className="flex h-[80vh] items-center justify-center bg-[#121212]"><Loader2 className="w-10 h-10 animate-spin text-[#1DB954]"/></div>;

    // TELA 1: HOME (Explorar ou Favoritas)
    if (!modalidadeAtiva) {
        return (
            <div className="min-h-screen bg-[#121212] p-4 md:p-8 animate-fade-in pb-32">
                
                {/* Header Mobile-Friendly */}
                <div className="flex items-center gap-3 mb-6 mt-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#1DB954] to-emerald-700 rounded-full flex items-center justify-center shadow-lg">
                        <Headphones className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Pratique Play</h1>
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">A biblioteca da rede</p>
                    </div>
                </div>

                {/* ABAS ESTILO SPOTIFY */}
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setAbaAtiva('explorar')}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${abaAtiva === 'explorar' ? 'bg-[#1DB954] text-black' : 'bg-[#282828] text-white hover:bg-[#333]'}`}
                    >
                        Álbuns
                    </button>
                    <button 
                        onClick={() => setAbaAtiva('favoritas')}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${abaAtiva === 'favoritas' ? 'bg-[#1DB954] text-black' : 'bg-[#282828] text-white hover:bg-[#333]'}`}
                    >
                        Favoritas
                    </button>
                </div>

                {/* CONTEÚDO: ÁLBUNS */}
                {abaAtiva === 'explorar' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {modalidadesComMusica.map(mod => {
                            const qtdFaixas = faixasGlobais.filter(f => f.modalidadeId === mod.id).length;
                            return (
                                <div 
                                    key={mod.id} 
                                    onClick={() => setModalidadeAtiva(mod)}
                                    className="bg-[#181818] p-4 md:p-5 rounded-2xl shadow-xl cursor-pointer hover:bg-[#282828] active:scale-95 transition-all duration-200 group flex flex-col"
                                >
                                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-4 shadow-[0_8px_24px_rgba(0,0,0,0.5)] bg-gradient-to-br from-slate-800 to-black relative">
                                        {mod.capaUrl ? (
                                            <img src={mod.capaUrl} alt={mod.nome} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Music className="w-12 h-12 text-slate-700 group-hover:scale-110 transition-transform" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-black text-white uppercase tracking-tight text-sm md:text-base w-full truncate">{mod.nome}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{qtdFaixas} Aulas</p>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* CONTEÚDO: FAVORITAS */}
                {abaAtiva === 'favoritas' && (
                    <div>
                        {faixasFavoritas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                <Heart className="w-16 h-16 text-gray-500 mb-4" />
                                <h2 className="text-white font-bold text-lg">Nenhuma favorita ainda</h2>
                                <p className="text-gray-400 text-sm mt-1">Navegue pelos álbuns e clique no coração.</p>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={() => playPlaylistCompleta(faixasFavoritas)}
                                    className="mb-6 w-14 h-14 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
                                >
                                    <Play className="w-7 h-7 fill-current ml-1" />
                                </button>
                                <div className="space-y-1">
                                    {faixasFavoritas.map((faixa) => {
                                        const isTocandoEssa = faixaAtual?.id === faixa.id;
                                        return (
                                            <div key={faixa.id} onClick={() => tocarFaixa(faixa, faixasFavoritas)} className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${isTocandoEssa ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                                <div className="w-10 h-10 bg-[#282828] rounded-md flex items-center justify-center flex-shrink-0">
                                                    {isTocandoEssa && isPlaying ? <Music className="w-5 h-5 text-[#1DB954] animate-pulse" /> : <Play className="w-5 h-5 text-gray-400 ml-1" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-bold text-sm md:text-base uppercase tracking-tight truncate ${isTocandoEssa ? 'text-[#1DB954]' : 'text-white'}`}>{faixa.titulo}</h4>
                                                    {faixa.bpm !== "N/A" && <div className="text-[10px] text-gray-500 uppercase">{faixa.bpm} BPM</div>}
                                                </div>
                                                <button onClick={(e) => toggleFavorito(faixa.id, e)} className="p-2">
                                                    <Heart className={`w-5 h-5 transition-colors ${favoritos.includes(faixa.id) ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // TELA 2: DENTRO DO ÁLBUM
    return (
        <div className="min-h-screen bg-[#121212] animate-fade-in pb-32">
            <div className="bg-gradient-to-b from-[#2a2a2a] to-[#121212] pt-8 pb-10 px-4 md:px-8 relative shadow-2xl">
                <button onClick={() => setModalidadeAtiva(null)} className="flex items-center gap-2 text-xs font-black text-white/70 hover:text-white transition-colors uppercase tracking-widest mb-6 bg-black/40 px-3 py-1.5 rounded-full w-fit">
                    <ChevronLeft className="w-4 h-4"/> Álbuns
                </button>

                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 relative z-10 text-center md:text-left">
                    <div className="w-48 h-48 md:w-56 md:h-56 bg-gradient-to-br from-slate-800 to-black rounded-sm shadow-[0_16px_40px_rgba(0,0,0,0.7)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                         {modalidadeAtiva.capaUrl ? <img src={modalidadeAtiva.capaUrl} alt="Capa" className="w-full h-full object-cover" /> : <Music className="w-20 h-20 text-slate-700" />}
                    </div>
                    <div>
                        <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Playlist</p>
                        <h1 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-md leading-none mb-2">{modalidadeAtiva.nome}</h1>
                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">{faixasDaModalidade.length} músicas</p>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-8 mt-6 relative z-20 flex justify-between items-center">
                <button onClick={() => playPlaylistCompleta(faixasDaModalidade)} className="w-14 h-14 md:w-16 md:h-16 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#1ed760] transition-all shadow-xl">
                    <Play className="w-7 h-7 md:w-8 md:h-8 fill-current ml-1" />
                </button>
            </div>

            <div className="px-2 md:px-8 mt-6">
                <div className="space-y-1">
                    {faixasDaModalidade.map((faixa, index) => {
                        const isTocandoEssa = faixaAtual?.id === faixa.id;
                        const isFav = favoritos.includes(faixa.id);
                        
                        return (
                            <div key={faixa.id} onClick={() => tocarFaixa(faixa, faixasDaModalidade)} className={`flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-lg cursor-pointer transition-colors group ${isTocandoEssa ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                <div className="w-6 text-center text-gray-400 font-bold text-sm hidden md:block">
                                    {isTocandoEssa && isPlaying ? <Music className="w-4 h-4 text-[#1DB954] animate-pulse mx-auto" /> : index + 1}
                                </div>

                                <div className="flex-1 min-w-0 px-2 md:px-0">
                                    <h4 className={`font-bold text-sm md:text-base uppercase tracking-tight truncate ${isTocandoEssa ? 'text-[#1DB954]' : 'text-white'}`}>{faixa.titulo}</h4>
                                    {faixa.bpm !== "N/A" && <div className="text-[10px] text-gray-500 uppercase">{faixa.bpm} BPM</div>}
                                </div>
                                
                                <button onClick={(e) => toggleFavorito(faixa.id, e)} className="p-3">
                                    <Heart className={`w-5 h-5 transition-colors ${isFav ? 'text-[#1DB954] fill-[#1DB954]' : 'text-gray-400 hover:text-white'}`} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
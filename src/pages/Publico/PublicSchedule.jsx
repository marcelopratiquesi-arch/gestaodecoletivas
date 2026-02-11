import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../services/firebase'; 
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { 
  Search, Clock, ChevronRight, Loader2, 
  Printer, ArrowLeft, Dumbbell, Sun, Moon
} from 'lucide-react';

// --- CONFIGURAÇÃO DAS IMAGENS ---
const LOGOS = {
    'jump': '/logos/energyjump.png', 
    'dance': '/logos/powerdance.png',
    'bumbum': '/logos/powerbumbum.png',
    'training': '/logos/powertraining.png',
    'core': '/logos/powercore.png',
    'fight': '/logos/powerfight.png',
    'pratique': '/logos/pratique.png'
};

const formatProfessorName = (name) => {
    if (!name) return "Instrutor";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

// --- COMPONENTE SKELETON (IMPLEMENTADO) ---
const SkeletonItem = ({ isDark }) => (
    <div className={`p-4 rounded-xl border flex justify-between items-center ${isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="space-y-2 w-full">
            <div className={`h-4 rounded w-1/3 animate-pulse ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
            <div className={`h-3 rounded w-1/4 animate-pulse ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}></div>
        </div>
        <div className={`w-5 h-5 rounded-full animate-pulse ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
    </div>
);

export default function PublicSchedule() {
  const [unidades, setUnidades] = useState([]);
  const [modalidadesMap, setModalidadesMap] = useState({});
  const [professoresMap, setProfessoresMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  const [gradeUnidade, setGradeUnidade] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [termoDebounce, setTermoDebounce] = useState(""); 
  
  const [resultadosUnidade, setResultadosUnidade] = useState([]);
  const [resultadosModalidade, setResultadosModalidade] = useState(null);

  // 1. Inicialização
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const [uSnap, mSnap, pSnap] = await Promise.all([
                getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
                getDocs(collection(db, 'modalidades')),
                getDocs(collection(db, 'professores'))
            ]);
            
            const uList = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const mAbs = {}; mSnap.docs.forEach(d => mAbs[d.id] = d.data());
            const pAbs = {}; pSnap.docs.forEach(d => pAbs[d.id] = d.data().nome);
            
            setUnidades(uList);
            setModalidadesMap(mAbs);
            setProfessoresMap(pAbs);
        } catch (e) { 
            console.error("Erro ao carregar dados:", e); 
        } finally { 
            setLoading(false); 
        }
    };
    init();
  }, []);

  // 2. Debounce
  useEffect(() => {
      const timer = setTimeout(() => { setTermoDebounce(busca); }, 300); 
      return () => clearTimeout(timer);
  }, [busca]);

  // 3. Busca (Lógica Restaurada)
  useEffect(() => {
      if (!termoDebounce.trim()) { 
          setResultadosUnidade([]); 
          setResultadosModalidade(null); 
          return; 
      }
      const termo = termoDebounce.toLowerCase();
      
      // Busca Unidades
      setResultadosUnidade(unidades.filter(u => u.nome.toLowerCase().includes(termo) || u.cidade?.toLowerCase().includes(termo)));
      
      // Busca Modalidades
      const modIds = Object.keys(modalidadesMap).filter(id => modalidadesMap[id].nome.toLowerCase().includes(termo));
      if (modIds.length > 0) { 
          buscarOndeTemModalidade(modIds); 
      } else { 
          setResultadosModalidade(null); 
      }
  }, [termoDebounce, unidades, modalidadesMap]);

  const buscarOndeTemModalidade = async (modIds) => {
      try {
          const q = query(collection(db, 'aulas'), where('modalidadeId', 'in', modIds.slice(0, 10)));
          const snap = await getDocs(q);
          const agrupado = {};
          snap.docs.forEach(doc => {
              const aula = doc.data();
              if (!agrupado[aula.unidadeId]) {
                  const unit = unidades.find(u => u.id === aula.unidadeId);
                  if (unit) agrupado[aula.unidadeId] = { unidade: unit, aulas: [] };
              }
              if (agrupado[aula.unidadeId]) {
                  agrupado[aula.unidadeId].aulas.push({
                      ...aula,
                      modalidadeNome: modalidadesMap[aula.modalidadeId]?.nome,
                      dias: aula.dias || []
                  });
              }
          });
          setResultadosModalidade(Object.values(agrupado));
      } catch (e) { console.error(e); }
  };

  // 4. Carregar Grade
  useEffect(() => {
      if (!unidadeSelecionada) return;
      const loadGrade = async () => {
          setLoadingGrade(true);
          try {
              const q = query(collection(db, 'aulas'), where('unidadeId', '==', unidadeSelecionada.id));
              const snap = await getDocs(q);
              const data = snap.docs.map(d => {
                  const a = d.data();
                  const mod = modalidadesMap[a.modalidadeId];
                  if(!mod) return null;
                  return {
                      ...a,
                      modalidadeNome: mod.nome,
                      modalidadeCor: mod.cor || '#333',
                      professorNome: formatProfessorName(professoresMap[a.professorId])
                  };
              }).filter(Boolean);
              setGradeUnidade(data);
          } catch (e) { console.error("Erro grade:", e); } finally { setLoadingGrade(false); }
      };
      loadGrade();
  }, [unidadeSelecionada, modalidadesMap, professoresMap]);

  // --- LÓGICA INTELIGENTE DE COLUNAS ---
  const gradeOrganizada = useMemo(() => {
      if (!gradeUnidade.length) return { dias: [], horarios: [] };
      const diasFinais = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
      const temSabado = gradeUnidade.some(aula => aula.dias && aula.dias.includes('Sábado'));
      const temDomingo = gradeUnidade.some(aula => aula.dias && aula.dias.includes('Domingo'));
      if (temSabado) diasFinais.push('Sábado');
      if (temDomingo) diasFinais.push('Domingo');
      const horarios = [...new Set(gradeUnidade.map(a => a.hora))].sort();
      return { dias: diasFinais, horarios };
  }, [gradeUnidade]);

  const getAulaCell = (dia, hora) => gradeUnidade.find(a => a.hora === hora && a.dias.includes(dia));

  // --- CÁLCULO DE ZOOM PARA IMPRESSÃO ---
  const printZoomStyle = useMemo(() => {
      const linhas = gradeOrganizada.horarios.length;
      if (linhas <= 6) return 1;
      if (linhas <= 9) return 0.9;
      if (linhas <= 12) return 0.8;
      if (linhas <= 15) return 0.7;
      return 0.6;
  }, [gradeOrganizada.horarios.length]);

  const themeClasses = isDarkMode ? "bg-[#101010] text-white" : "bg-[#f5f5f5] text-[#1f1f1f]";
  const cardClasses = isDarkMode ? "bg-[#1a1a1a] border-white/10" : "bg-white border-gray-200 shadow-sm";
  const inputClasses = isDarkMode ? "bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-600 focus:border-red-600" : "bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-red-600";

  // TELA 1: BUSCA
  if (!unidadeSelecionada) {
      return (
        <div className={`min-h-screen ${themeClasses} transition-colors duration-300 p-4 flex flex-col items-center justify-start pt-12 md:pt-24 relative`}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`absolute top-4 right-4 p-2 rounded-full border ${isDarkMode ? 'bg-[#222] text-yellow-400 border-gray-700' : 'bg-white text-gray-400 border-gray-200'}`}>{isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
            <div className={`w-full max-w-lg md:max-w-3xl ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-3xl shadow-xl p-8 md:p-12 space-y-10 border ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                <div className="flex flex-col items-center gap-6">
                    <img src={LOGOS['pratique']} alt="Pratique" className={`h-24 md:h-64 object-contain ${isDarkMode ? 'brightness-0 invert' : ''}`} />
                    <div className="text-center">
                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none flex justify-center gap-2"><span className="text-[#ed1c24]">HAPPY</span><span className="text-[#00adef]">ZONE</span></h2>
                        <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.5em] mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Quadro de Horários Oficial</p>
                    </div>
                </div>
                <div className="space-y-4 w-full">
                    <div className="relative">
                        <input type="text" placeholder="DIGITE A UNIDADE OU AULA..." className={`w-full h-12 md:h-16 pl-12 md:pl-14 pr-4 rounded-xl border-2 outline-none font-bold text-[15px] uppercase shadow-sm ${inputClasses}`} value={busca} onChange={e => setBusca(e.target.value)} autoFocus />
                        <Search className={`absolute left-4 top-3.5 md:top-5 w-5 h-5 md:w-6 md:h-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}/>
                        {busca && busca !== termoDebounce && <Loader2 className="absolute right-4 top-3.5 md:top-5 w-5 h-5 animate-spin text-red-500"/>}
                    </div>
                    <div className={`max-h-[300px] overflow-y-auto custom-scrollbar pr-1 transition-opacity duration-300 ${busca ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        
                        {/* RESULTADOS MODALIDADES (RESTAURADO E VISÍVEL) */}
                        {termoDebounce.length > 0 && resultadosModalidade && resultadosModalidade.length > 0 && (
                            <div className="space-y-2 mb-6">
                                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                                    <Dumbbell className="w-3 h-3"/> Aulas Encontradas
                                </h3>
                                {resultadosModalidade.map((item) => (
                                    <div key={item.unidade.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${cardClasses}`}>
                                        <div className="flex justify-between items-center">
                                            <span className={`font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.unidade.nome}</span>
                                            <button onClick={() => setUnidadeSelecionada(item.unidade)} className="text-[10px] font-bold text-blue-500 hover:underline flex items-center bg-blue-50 px-2 py-1 rounded">VER GRADE <ChevronRight className="w-3 h-3 ml-1"/></button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {item.aulas.slice(0, 4).map((aula, idx) => (
                                                <span key={idx} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                    {aula.dias[0]?.substring(0,3)} {aula.hora}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* RESULTADOS UNIDADES */}
                        {termoDebounce.length > 0 && resultadosUnidade.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 mt-4">Unidades</h3>
                                {resultadosUnidade.map(u => (
                                    <button key={u.id} onClick={() => setUnidadeSelecionada(u)} className={`w-full p-3 rounded-lg border flex justify-between items-center group transition-all text-left hover:border-red-500 hover:shadow-sm ${cardClasses}`}>
                                        <div><span className={`block font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{u.nome}</span><span className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{u.cidade}</span></div>
                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500"/>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* SEM RESULTADOS */}
                        {termoDebounce.length > 0 && !resultadosUnidade.length && !resultadosModalidade && <div className="text-center py-8 text-gray-500 text-sm">Nenhuma unidade ou aula encontrada.</div>}
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // TELA 2: GRADE DEFINITIVA
  return (
    <div className={`min-h-screen ${themeClasses} pb-10 print:bg-black print:text-white print:p-0 print:h-screen print:overflow-hidden`}>
        
        <style>{`
            /* ESTILOS DE IMPRESSÃO (AUTO-FIT + BLACK PIANO) */
            @media print {
                @page { size: landscape; margin: 0; }
                
                body, #root, html {
                    background-color: #000000 !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    width: 100vw; height: 100vh; margin: 0; padding: 0;
                    overflow: hidden;
                }
                
                body > *:not(#root) { display: none; }

                .print-container {
                    width: 100vw !important;
                    height: 100vh !important;
                    display: flex !important;
                    flex-direction: column !important;
                    padding: 20px !important;
                    box-sizing: border-box !important;
                    zoom: ${printZoomStyle} !important; 
                }

                .print-header {
                    display: flex !important;
                    flex-direction: row !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    width: 100% !important;
                    height: 100px !important; 
                    border-bottom: 2px solid rgba(255,255,255,0.3) !important;
                    margin-bottom: 15px !important;
                    flex-shrink: 0;
                }
                .ph-left { width: 25%; display: flex; justify-content: flex-start; }
                .ph-center { width: 50%; text-align: center; }
                .ph-right { width: 25%; display: flex; justify-content: flex-end; }

                .ph-title { font-size: 36px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1; font-style: italic; }
                .ph-sub { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #ccc; margin-top: 5px; letter-spacing: 4px; }

                .print-grid-wrapper {
                    flex: 1; 
                    width: 100% !important;
                    display: flex !important;
                    flex-direction: column !important;
                    border: 1px solid rgba(255,255,255,0.3) !important;
                }

                .print-grid-header {
                    display: grid;
                    grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, 1fr);
                    border-bottom: 1px solid rgba(255,255,255,0.3);
                    background-color: #111 !important;
                }

                .print-grid-body {
                    display: grid;
                    grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, 1fr);
                    grid-auto-rows: minmax(60px, auto); 
                }

                .print-cell {
                    border-right: 1px solid rgba(255,255,255,0.2) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.2) !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 5px !important;
                    min-height: 60px;
                }

                .print-card {
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 50px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    border-radius: 6px !important;
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important;
                    background-blend-mode: normal !important; 
                    box-shadow: none !important;
                    padding: 5px !important;
                }

                .pc-title { font-size: 14px !important; font-weight: 900 !important; color: white !important; text-transform: uppercase; text-align: center; line-height: 1.1 !important; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); }
                .pc-sub { font-size: 10px !important; font-weight: 700 !important; color: white !important; opacity: 0.9; text-transform: uppercase; margin-top: 2px !important; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); }

                .screen-only { display: none !important; }
            }

            /* ESTILOS DE TELA (CARDS QUADRADOS E BONITOS) */
            @media screen {
                .screen-grid {
                    display: grid;
                    /* MANTÉM OS CARDS COM TAMANHO FIXO BONITO */
                    grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, minmax(180px, 1fr)); 
                }
                .print-header { display: none; }
            }
        `}</style>

        {/* HEADER TELA */}
        <div className="sticky top-0 z-50 shadow-md print:hidden bg-[#111] border-b border-white/10">
            <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button onClick={() => setUnidadeSelecionada(null)} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors">
                        <ArrowLeft className="w-6 h-6"/> <span className="text-sm font-bold uppercase hidden md:inline">Voltar</span>
                    </button>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white">{unidadeSelecionada.nome}</h2>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{unidadeSelecionada.cidade}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.print()} className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all"><Printer className="w-5 h-5"/></button>
                </div>
            </div>
        </div>

        {/* CONTAINER GERAL */}
        <div className="print-container max-w-[1920px] mx-auto p-4 md:p-8 print:p-0">
            
            {/* HEADER DE IMPRESSÃO */}
            <div className="hidden print:flex print-header">
                <div className="ph-left"><img src={LOGOS['pratique']} alt="Logo" className="h-16 brightness-0 invert object-contain"/></div>
                <div className="ph-center"><h1 className="ph-title">{unidadeSelecionada.nome}</h1><p className="ph-sub">Quadro Happy Zone</p></div>
                <div className="ph-right"><div className="bg-white p-1 rounded"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.href)}`} alt="QR" className="w-16 h-16"/></div></div>
            </div>

            {loadingGrade ? <div className="flex justify-center h-[50vh] items-center screen-only"><Loader2 className="w-12 h-12 animate-spin text-red-600"/></div> : 
            gradeUnidade.length === 0 ? <div className="text-center py-20 opacity-50 screen-only"><p className="font-bold text-xl">Grade vazia.</p></div> : 
            (
                /* A GRADE MÁGICA - SEPARAÇÃO TELA vs PRINT */
                <div className={`print-grid-wrapper overflow-x-auto rounded-2xl border ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} print:bg-black print:border-0 print:rounded-none`}>
                    
                    {/* CABEÇALHO DA GRADE */}
                    <div className={`screen-grid print-grid-header ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-50 border-gray-200'} border-b flex`}>
                        <div className={`p-4 flex items-center justify-center border-r print-cell-header ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                            <Clock className="w-6 h-6 opacity-40"/>
                        </div>
                        {gradeOrganizada.dias.map(dia => (
                            <div key={dia} className={`p-4 flex items-center justify-center font-black text-lg uppercase border-r print-cell-header ${isDarkMode ? 'text-white border-white/10' : 'text-slate-800 border-slate-200'}`}>
                                {dia.substring(0,3)}
                            </div>
                        ))}
                    </div>

                    {/* CORPO DA GRADE */}
                    <div className="screen-grid print-grid-body">
                        {gradeOrganizada.horarios.map((hora, idx) => (
                            <React.Fragment key={hora}>
                                {/* Coluna Hora */}
                                <div className={`print-cell border-r border-b font-mono font-bold text-xl ${isDarkMode ? 'border-white/10 text-[#00adef]' : 'border-gray-200 text-blue-600'} print:text-[#00adef] print:font-black p-4 flex items-center justify-center`}>
                                    {hora}
                                </div>
                                {/* Células */}
                                {gradeOrganizada.dias.map(dia => {
                                    const aula = getAulaCell(dia, hora);
                                    const borderClass = `border-r border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'} print:border-[#222]`;
                                    
                                    if (!aula) return <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}></div>;
                                    
                                    const cor = aula.modalidadeCor || '#333';
                                    
                                    return (
                                        <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} p-1`}>
                                            <div 
                                                className="print-card w-full h-full rounded-xl p-2 flex flex-col justify-center items-center text-center shadow-sm hover:scale-105 transition-transform cursor-default"
                                                style={{ backgroundColor: cor }}
                                            >
                                                <p className="pc-title font-black text-[13px] md:text-[15px] uppercase leading-tight line-clamp-2 text-white drop-shadow-md">
                                                    {aula.modalidadeNome}
                                                </p>
                                                <p className="pc-sub text-[10px] md:text-[11px] font-bold uppercase opacity-90 truncate w-full text-white drop-shadow-md">
                                                    {aula.professorNome}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-10 text-center opacity-40 screen-only">
                <img src={LOGOS['pratique']} alt="Pratique" className={`h-8 mx-auto ${isDarkMode ? 'invert' : ''}`}/>
            </div>
        </div>
    </div>
  );
}
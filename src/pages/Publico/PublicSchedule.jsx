import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase'; 
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { 
  Search, MapPin, Calendar, Clock, ChevronRight, Loader2, 
  Printer, ArrowLeft, Dumbbell, Sun, Moon, Map as MapIcon, QrCode
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

// --- CORES & ESTILOS ---
const MODALITY_COLORS = {
    'dance': { bg: '#ff007f', text: '#fff' },   
    'bumbum': { bg: '#ff007f', text: '#fff' },  
    'jump': { bg: '#00adef', text: '#fff' },    
    'core': { bg: '#00adef', text: '#fff' },    
    'training': { bg: '#d6df23', text: '#000' },
    'fight': { bg: '#f15a24', text: '#fff' },   
    'default': { bg: '#333333', text: '#fff' }
};

const getStyleForModality = (name) => {
    if (!name) return MODALITY_COLORS['default'];
    const n = name.toLowerCase();
    if (n.includes('dance')) return MODALITY_COLORS['dance'];
    if (n.includes('bumbum')) return MODALITY_COLORS['bumbum'];
    if (n.includes('jump')) return MODALITY_COLORS['jump'];
    if (n.includes('core')) return MODALITY_COLORS['core'];
    if (n.includes('training')) return MODALITY_COLORS['training'];
    if (n.includes('fight')) return MODALITY_COLORS['fight'];
    return MODALITY_COLORS['default'];
};

const formatProfessorName = (name) => {
    if (!name) return "Instrutor";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

// --- COMPONENTE SKELETON ---
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [busca, setBusca] = useState("");
  const [termoDebounce, setTermoDebounce] = useState(""); 
  
  const [resultadosUnidade, setResultadosUnidade] = useState([]);
  const [resultadosModalidade, setResultadosModalidade] = useState(null);

  // 1. Inicialização (SEM CACHE - SEMPRE ATUALIZADO)
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            // Busca dados frescos do Firebase sempre
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
            console.error("Erro ao carregar dados iniciais:", e); 
        } finally { 
            setLoading(false); 
        }
    };
    init();
  }, []);

  // 2. Debounce na Busca
  useEffect(() => {
      const timer = setTimeout(() => {
          setTermoDebounce(busca);
      }, 300); 
      return () => clearTimeout(timer);
  }, [busca]);

  // 3. Busca Inteligente
  useEffect(() => {
      if (!termoDebounce.trim()) {
          setResultadosUnidade([]);
          setResultadosModalidade(null);
          return;
      }
      const termo = termoDebounce.toLowerCase();
      const unitsFound = unidades.filter(u => u.nome.toLowerCase().includes(termo) || u.cidade?.toLowerCase().includes(termo));
      setResultadosUnidade(unitsFound);

      const modIds = Object.keys(modalidadesMap).filter(id => modalidadesMap[id].nome.toLowerCase().includes(termo));
      if (modIds.length > 0) {
          buscarOndeTemModalidade(modIds);
      } else {
          setResultadosModalidade(null);
      }
  }, [termoDebounce, unidades, modalidadesMap]);

  const buscarOndeTemModalidade = async (modIds) => {
      try {
          // Busca direto do banco para garantir precisão
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

  // 4. Carregar Grade da Unidade (SEM CACHE)
  useEffect(() => {
      if (!unidadeSelecionada) return;
      const loadGrade = async () => {
          setLoadingGrade(true);
          try {
              // Busca direta no banco de dados
              const q = query(collection(db, 'aulas'), where('unidadeId', '==', unidadeSelecionada.id));
              const snap = await getDocs(q);
              const data = snap.docs.map(d => {
                  const a = d.data();
                  return {
                      ...a,
                      modalidadeNome: modalidadesMap[a.modalidadeId]?.nome || 'Coletiva',
                      modalidadeCor: modalidadesMap[a.modalidadeId]?.cor || '#333',
                      professorNome: formatProfessorName(professoresMap[a.professorId])
                  };
              });
              setGradeUnidade(data);
          } catch (e) {
              console.error("Erro ao carregar grade:", e);
          } finally {
              setLoadingGrade(false);
          }
      };
      loadGrade();
  }, [unidadeSelecionada, modalidadesMap, professoresMap]);

  const gradeOrganizada = useMemo(() => {
      if (!gradeUnidade.length) return { dias: [], horarios: [] };
      const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const horarios = [...new Set(gradeUnidade.map(a => a.hora))].sort();
      return { dias, horarios };
  }, [gradeUnidade]);

  const getAulaCell = (dia, hora) => gradeUnidade.find(a => a.hora === hora && a.dias.includes(dia));

  // --- RENDER ---
  const themeClasses = isDarkMode 
    ? "bg-[#101010] text-white" 
    : "bg-[#f5f5f5] text-[#1f1f1f]";
  
  const cardClasses = isDarkMode 
    ? "bg-[#1a1a1a] border-white/10" 
    : "bg-white border-gray-200 shadow-sm";

  const inputClasses = isDarkMode
    ? "bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-600 focus:border-red-600"
    : "bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600";

  // TELA 1: BUSCA
  if (!unidadeSelecionada) {
      return (
        <div className={`min-h-screen ${themeClasses} transition-colors duration-300 p-4 flex flex-col items-center justify-start pt-12 md:pt-24 relative`}>
            
            <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`absolute top-4 right-4 p-2 rounded-full transition-all ${isDarkMode ? 'bg-[#222] text-yellow-400' : 'bg-white text-gray-400 border border-gray-200 hover:text-gray-600'}`}
            >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            <div className={`w-full max-w-lg md:max-w-3xl ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-3xl shadow-xl p-8 md:p-12 space-y-10 animate-in fade-in zoom-in duration-300 border ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                
                <div className="flex flex-col items-center gap-6">
                    <img 
                        src={LOGOS['pratique']} 
                        alt="Pratique" 
                        className={`h-24 md:h-72 object-contain transition-all duration-500 ${isDarkMode ? 'brightness-0 invert' : ''}`} 
                    />
                    
                    <div className="text-center">
                        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none flex justify-center gap-2">
                            <span className="text-[#ed1c24]">HAPPY</span>
                            <span className="text-[#00adef]">ZONE</span>
                        </h2>
                        <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.3em] md:tracking-[0.5em] mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Quadro de Horários Oficial
                        </p>
                    </div>
                </div>

                <div className="space-y-4 w-full">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="DIGITE A UNIDADE OU AULA..." 
                            className={`w-full h-12 md:h-16 pl-12 md:pl-14 pr-4 rounded-xl border-2 outline-none font-bold text-[15px] transition-all uppercase tracking-wide shadow-sm hover:shadow-md focus:shadow-lg ${inputClasses}`}
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            autoFocus
                        />
                        <Search className={`absolute left-4 top-3.5 md:top-5 w-5 h-5 md:w-6 md:h-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}/>
                        {busca && busca !== termoDebounce && (
                            <Loader2 className="absolute right-4 top-3.5 md:top-5 w-5 h-5 animate-spin text-red-500"/>
                        )}
                    </div>

                    <div className={`max-h-[300px] overflow-y-auto custom-scrollbar pr-1 transition-opacity duration-300 ${busca ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        {termoDebounce.length > 0 ? (
                            <div className="space-y-3">
                                {resultadosModalidade && resultadosModalidade.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                                            <Dumbbell className="w-3 h-3"/> Aulas Encontradas
                                        </h3>
                                        {resultadosModalidade.map((item) => (
                                            <div key={item.unidade.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${cardClasses}`}>
                                                <div className="flex justify-between items-center">
                                                    <span className={`font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.unidade.nome}</span>
                                                    <button onClick={() => setUnidadeSelecionada(item.unidade)} className="text-[10px] font-bold text-blue-500 hover:underline flex items-center bg-blue-50 px-2 py-1 rounded">
                                                        VER GRADE <ChevronRight className="w-3 h-3 ml-1"/>
                                                    </button>
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

                                {resultadosUnidade.length > 0 ? (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 mt-4">Unidades</h3>
                                        {resultadosUnidade.map(u => (
                                            <button 
                                                key={u.id} 
                                                onClick={() => setUnidadeSelecionada(u)} 
                                                className={`w-full p-3 rounded-lg border flex justify-between items-center group transition-all text-left ${cardClasses} hover:border-red-500 hover:shadow-sm`}
                                            >
                                                <div>
                                                    <span className={`block font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{u.nome}</span>
                                                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{u.cidade}</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500"/>
                                            </button>
                                        ))}
                                    </div>
                                ) : !resultadosModalidade && (
                                    <div className="text-center py-8 text-gray-500 text-sm">Nenhuma unidade encontrada.</div>
                                )}
                            </div>
                        ) : (
                            busca.length > 0 && <div className="space-y-2">
                                <SkeletonItem isDark={isDarkMode} />
                                <SkeletonItem isDark={isDarkMode} />
                                <SkeletonItem isDark={isDarkMode} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-4 text-center w-full">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">© Pratique Fitness</p>
            </div>
        </div>
      );
  }

  // TELA 2: GRADE
  return (
    <div className={`min-h-screen ${themeClasses} pb-10 print:bg-black print:text-white print:p-0 print:h-screen print:overflow-hidden`}>
        
        {/* ESTILOS DE IMPRESSÃO */}
        <style>{`
            @media print {
                @page { size: landscape; margin: 0; }
                body, #root {
                    background-color: #000 !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print\\:bg-black { background-color: #000 !important; }
                .print\\:text-white { color: white !important; }
                .print\\:border-white\\/20 { border-color: rgba(255,255,255,0.2) !important; }
                .no-print { display: none !important; }
            }
        `}</style>

        {/* HEADER */}
        <div className={`sticky top-0 z-50 shadow-md print:hidden ${isDarkMode ? 'bg-[#111] border-b border-white/10' : 'bg-white border-b border-gray-200'}`}>
            <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button onClick={() => setUnidadeSelecionada(null)} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors">
                        <ArrowLeft className="w-6 h-6"/>
                        <span className="text-sm font-bold uppercase hidden md:inline">Voltar</span>
                    </button>
                    <div>
                        <h2 className={`text-2xl md:text-3xl font-black italic tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {unidadeSelecionada.nome}
                        </h2>
                        <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {unidadeSelecionada.cidade} - {unidadeSelecionada.estado}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-full border transition-all ${isDarkMode ? 'bg-[#222] border-white/10 text-yellow-400' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                        {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                    </button>
                    <button onClick={() => window.print()} className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all">
                        <Printer className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        </div>

        {/* HEADER IMPRESSÃO (COM QR CODE) */}
        <div className="hidden print:flex justify-between items-start p-6 border-b border-white/20 mb-4 bg-black">
            <div className="flex flex-col gap-2">
                <img src={LOGOS['pratique']} alt="Pratique" className="h-16 brightness-0 invert object-contain left"/>
                <div>
                    <h1 className="text-3xl font-black uppercase text-white italic">{unidadeSelecionada.nome}</h1>
                    <p className="text-sm font-bold uppercase text-gray-400 tracking-widest">Quadro Happy Zone</p>
                </div>
            </div>
            {/* QR CODE GERADO AUTOMATICAMENTE */}
            <div className="flex flex-col items-center bg-white p-2 rounded">
                <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${window.location.href}?unidade=${unidadeSelecionada.id}`} 
                    alt="QR Code" 
                    className="w-20 h-20"
                />
                <p className="text-[8px] font-bold text-black mt-1 uppercase">Acesse no Celular</p>
            </div>
        </div>

        {/* CONTEÚDO DA GRADE */}
        <div className="max-w-[1920px] mx-auto p-4 md:p-8 print:p-0 print:w-full">
            {loadingGrade ? (
                <div className="flex justify-center h-[50vh] items-center"><Loader2 className="w-12 h-12 animate-spin text-red-600"/></div>
            ) : gradeUnidade.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <p className="font-bold text-xl">Grade em montagem.</p>
                </div>
            ) : (
                <div className="print:scale-[0.60] print:origin-top-left print:w-[160%] bg-black"> 
                    <div className={`overflow-hidden rounded-2xl border shadow-xl print:shadow-none print:border print:border-white/20 print:rounded-none ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1000px] print:min-w-full">
                                {/* Cabeçalho Dias */}
                                <div className={`grid grid-cols-8 border-b print:bg-[#111] print:border-white/20 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className={`p-4 flex items-center justify-center border-r print:border-white/20 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                        <Clock className="w-6 h-6 opacity-40"/>
                                    </div>
                                    {gradeOrganizada.dias.map(dia => (
                                        <div key={dia} className={`p-4 text-center font-black text-lg uppercase border-r last:border-0 print:border-white/20 print:text-white ${isDarkMode ? 'text-white border-white/10' : 'text-slate-800 border-slate-200'}`}>
                                            {dia.substring(0,3)}
                                        </div>
                                    ))}
                                </div>
                                {/* Linhas Horários */}
                                {gradeOrganizada.horarios.map((hora, idx) => (
                                    <div key={hora} className={`grid grid-cols-8 border-b transition-colors print:border-white/20 ${idx % 2 === 0 ? (isDarkMode ? 'bg-transparent' : 'bg-white') : (isDarkMode ? 'bg-white/5' : 'bg-slate-50')} print:bg-black`}>
                                        <div className={`p-6 flex items-center justify-center border-r font-mono font-bold text-xl print:border-white/20 print:text-[#00adef] ${isDarkMode ? 'border-white/10 text-[#00adef]' : 'border-gray-200 text-blue-600'}`}>{hora}</div>
                                        {gradeOrganizada.dias.map(dia => {
                                            const aula = getAulaCell(dia, hora);
                                            if (!aula) return <div key={`${dia}-${hora}`} className={`border-r print:border-white/10 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}></div>;
                                            
                                            const cor = aula.modalidadeCor || '#333';
                                            const isLight = parseInt(cor.replace('#',''), 16) > 0xffffff/1.5;
                                            const textColor = isLight ? '#000' : '#fff';

                                            return (
                                                <div key={`${dia}-${hora}`} className={`border-r p-1 print:border-white/20 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                    <div 
                                                        className="h-full w-full rounded-xl p-3 flex flex-col justify-center items-center text-center gap-2 shadow-sm hover:scale-105 transition-transform cursor-default print:shadow-none print:border print:border-black"
                                                        style={{ backgroundColor: cor }}
                                                    >
                                                        {/* NOME DA AULA (SÓ TEXTO, GRANDE) */}
                                                        <p className="font-black text-[13px] md:text-[15px] uppercase leading-tight line-clamp-2 print:text-[14px]" style={{ color: textColor }}>
                                                            {aula.modalidadeNome}
                                                        </p>
                                                        
                                                        {/* NOME DO PROFESSOR (PEQUENO) */}
                                                        <p className="text-[10px] md:text-[11px] font-bold uppercase opacity-90 truncate w-full print:text-[10px]" style={{ color: textColor }}>
                                                            {aula.professorNome}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RODAPÉ LOGOS */}
            <div className={`mt-10 pt-8 border-t print:border-white/20 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                <h3 className={`text-center text-sm font-bold uppercase mb-6 tracking-widest print:text-white ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Metodologia Happy Zone</h3>
                <div className="flex flex-wrap justify-center gap-8 md:gap-16 grayscale hover:grayscale-0 transition-all duration-500 print:grayscale-0">
                    <img src={LOGOS['jump']} alt="Jump" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                    <img src={LOGOS['dance']} alt="Dance" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                    <img src={LOGOS['bumbum']} alt="Bumbum" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                    <img src={LOGOS['training']} alt="Training" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                    <img src={LOGOS['core']} alt="Core" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                    <img src={LOGOS['fight']} alt="Fight" className="h-12 md:h-16 object-contain opacity-80 hover:opacity-100 print:opacity-100"/>
                </div>
                <div className="mt-10 text-center opacity-40 print:hidden">
                    <img src={LOGOS['pratique']} alt="Pratique" className={`h-8 mx-auto ${isDarkMode ? 'invert' : ''}`}/>
                </div>
            </div>
        </div>
    </div>
  );
}
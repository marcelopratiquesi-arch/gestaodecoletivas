import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase'; 
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  Search, Clock, ChevronRight, Loader2, 
  Printer, ArrowLeft, Dumbbell, Sun, Moon, ChevronDown, MapPin
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

const getTodayStr = () => new Date().toLocaleDateString('en-CA');

const formatProfessorName = (name) => {
    if (!name) return "Instrutor";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

export default function PublicSchedule() {
  // CATÁLOGOS BASE
  const [unidades, setUnidades] = useState([]);
  const [modalidadesMap, setModalidadesMap] = useState({});
  const [professoresMap, setProfessoresMap] = useState({});
  
  // ESTADOS DE TELA
  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  const [gradeUnidade, setGradeUnidade] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // FILTROS
  const [busca, setBusca] = useState("");
  const [termoDebounce, setTermoDebounce] = useState(""); 
  const [filtroEstado, setFiltroEstado] = useState(""); 
  
  const [resultadosUnidade, setResultadosUnidade] = useState([]);
  const [resultadosModalidade, setResultadosModalidade] = useState(null);

  // CONTROLE DE IMPRESSÃO
  const [printDensity, setPrintDensity] = useState('auto');
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  // 1. Inicialização (Catálogos Fixos)
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
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    init();
  }, []);

  const estadosDisponiveis = useMemo(() => {
      const estados = unidades.map(u => u.estado).filter(Boolean);
      return [...new Set(estados)].sort(); 
  }, [unidades]);

  // 2. Debounce para a busca
  useEffect(() => {
      const timer = setTimeout(() => { setTermoDebounce(busca); }, 300); 
      return () => clearTimeout(timer);
  }, [busca]);

  // 3. Busca e Filtragem (Tela 1)
  useEffect(() => {
      let unidadesFiltradas = unidades;
      if (filtroEstado) {
          unidadesFiltradas = unidades.filter(u => u.estado === filtroEstado);
      }

      if (!termoDebounce.trim()) { 
          if (filtroEstado) {
              setResultadosUnidade(unidadesFiltradas);
          } else {
              setResultadosUnidade([]); 
          }
          setResultadosModalidade(null); 
          return; 
      }

      const termo = termoDebounce.toLowerCase();
      setResultadosUnidade(unidadesFiltradas.filter(u => u.nome.toLowerCase().includes(termo) || u.cidade?.toLowerCase().includes(termo)));
      
      const modIds = Object.keys(modalidadesMap).filter(id => modalidadesMap[id].nome.toLowerCase().includes(termo));
      if (modIds.length > 0) { 
          buscarOndeTemModalidade(modIds, filtroEstado); 
      } else { 
          setResultadosModalidade(null); 
      }
  }, [termoDebounce, unidades, modalidadesMap, filtroEstado]);

  const buscarOndeTemModalidade = async (modIds, estadoFilter) => {
      try {
          const q = query(collection(db, 'aulas'), where('modalidadeId', 'in', modIds.slice(0, 10)));
          const snap = await getDocs(q);
          const agrupado = {};
          const todayStr = getTodayStr(); // Trava de tempo para a busca geral
          
          snap.docs.forEach(doc => {
              const aula = doc.data();
              
              // MÁGICA 1: BLINDAGEM DO PASSADO NA BUSCA DA TELA INICIAL
              if (aula.dataFim && aula.dataFim < todayStr) return;
              if (aula.dataInicio && aula.dataInicio > todayStr) return;

              const unit = unidades.find(u => u.id === aula.unidadeId);
              
              if (unit && (!estadoFilter || unit.estado === estadoFilter)) {
                  if (!agrupado[aula.unidadeId]) {
                      agrupado[aula.unidadeId] = { unidade: unit, aulas: [] };
                  }
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

  // 4. Carregar Grade ao Vivo (MÁGICA DA VELOCIDADE DA LUZ E VIGÊNCIA)
  useEffect(() => {
      if (!unidadeSelecionada) return;
      setLoadingGrade(true);
      
      const q = query(collection(db, 'aulas'), where('unidadeId', '==', unidadeSelecionada.id));
      
      const unsubscribe = onSnapshot(q, (snap) => {
          const todayStr = getTodayStr();

          const data = snap.docs.map(d => {
              const a = d.data();
              
              // MÁGICA 2: BLOQUEIO DE AULAS OCULTAS/ENCERRADAS/FUTURAS
              if (a.dataFim && a.dataFim < todayStr) return null; 
              if (a.dataInicio && a.dataInicio > todayStr) return null;

              const mod = modalidadesMap[a.modalidadeId];
              if(!mod) return null;
              
              return {
                  ...a,
                  modalidadeNome: mod.nome,
                  modalidadeCor: mod.cor || '#333',
                  professorNome: formatProfessorName(professoresMap[a.professorId])
              };
          }).filter(Boolean); // Remove os nulls (aulas ocultas)
          
          setGradeUnidade(data);
          setLoadingGrade(false);
      }, (error) => {
          console.error("Erro na grade tempo real:", error);
          setLoadingGrade(false);
      });

      return () => unsubscribe();
  }, [unidadeSelecionada, modalidadesMap, professoresMap]);

  // --- LÓGICA DE MÚLTIPLAS AULAS NO MESMO HORÁRIO ---
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

  // MÁGICA 3: AO INVÉS DE .FIND, USAMOS .FILTER PARA EMPILHAR AULAS
  const getAulasCell = (dia, hora) => gradeUnidade.filter(a => a.hora === hora && a.dias?.includes(dia));

  // --- CÁLCULO DE DENSIDADE (IMPRESSÃO) ---
  const appliedDensity = useMemo(() => {
      if (printDensity !== 'auto') return printDensity;
      const linhas = gradeOrganizada.horarios.length;
      if (linhas > 14) return 'ultra-compact';
      if (linhas > 10) return 'compact';
      return 'comfortable';
  }, [printDensity, gradeOrganizada]);

  const handlePrint = (mode) => {
      setPrintDensity(mode);
      setShowPrintMenu(false);
      setTimeout(() => window.print(), 100);
  };

  // ESTILOS DINÂMICOS (BACKGROUND PREMIUM)
  const bgGradient = isDarkMode 
    ? "bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0f0f0f]" 
    : "bg-gradient-to-br from-gray-50 via-white to-gray-100";
    
  const cardGlass = isDarkMode 
    ? "bg-[#1a1a1a]/80 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/50" 
    : "bg-white/80 backdrop-blur-xl border-white/40 shadow-2xl shadow-gray-200/50";

  const inputGlass = isDarkMode
    ? "bg-black/30 border-white/10 text-white placeholder:text-white/30 focus:border-red-500/50 focus:bg-black/50"
    : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-red-500/50 focus:bg-white";

  // TELA 1: BUSCA E FILTROS (DESIGN PREMIUM REDESENHADO)
  if (!unidadeSelecionada) {
      return (
        <div className={`min-h-screen ${bgGradient} transition-colors duration-500 p-4 flex flex-col items-center justify-start pt-8 relative overflow-hidden`}>
            
            {/* ELEMENTOS DE FUNDO (DECORAÇÃO) */}
            <div className={`absolute top-0 left-0 w-full h-96 ${isDarkMode ? 'opacity-20' : 'opacity-10'} pointer-events-none`}>
                <div className="absolute top-[-50%] left-[-10%] w-[50%] h-[100%] rounded-full bg-red-600 blur-[120px]"></div>
                <div className="absolute top-[-50%] right-[-10%] w-[50%] h-[100%] rounded-full bg-blue-600 blur-[120px]"></div>
            </div>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`absolute top-6 right-6 p-3 rounded-full border z-20 transition-all hover:scale-110 ${isDarkMode ? 'bg-black/40 border-white/10 text-yellow-400 hover:bg-black/60' : 'bg-white/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>
            
            {/* CARD PRINCIPAL FLUTUANTE */}
            <div className={`w-full max-w-2xl relative z-10 rounded-3xl p-8 md:p-10 border ${cardGlass} transition-all duration-500 animate-in fade-in slide-in-from-bottom-8`}>
                
                {/* CABEÇALHO DA MARCA */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-2 group">
                        <img src={LOGOS['pratique']} alt="Pratique" className={`h-24 md:h-32 object-contain transition-transform duration-500 group-hover:scale-105 ${isDarkMode ? 'brightness-0 invert' : ''}`} />
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-red-600 rounded-full blur-sm opacity-50`}></div>
                    </div>
                    
                    <div className="text-center space-y-1">
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter flex justify-center gap-2 drop-shadow-sm">
                            <span className="text-[#ed1c24]">HAPPY</span>
                            <span className="text-[#00adef]">ZONE</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2 opacity-60">
                            <div className={`h-[1px] w-8 ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
                            <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-black'}`}>Quadro de Horários</p>
                            <div className={`h-[1px] w-8 ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    
                    {/* FILTRO DE ESTADOS */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <MapPin className="w-3 h-3 inline mr-1 mb-0.5"/> Localização
                            </span>
                            {filtroEstado && (
                                <button onClick={() => setFiltroEstado("")} className="text-[10px] font-bold text-red-500 hover:underline">Limpar Filtro</button>
                            )}
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-gradient-right">
                            <button 
                                onClick={() => setFiltroEstado("")}
                                className={`px-5 py-2.5 rounded-2xl font-bold text-xs uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 border ${!filtroEstado 
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white border-transparent shadow-lg shadow-red-500/20 translate-y-[-2px]' 
                                    : `${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}`}
                            >
                                Todas
                            </button>
                            {estadosDisponiveis.map(uf => (
                                <button 
                                    key={uf}
                                    onClick={() => setFiltroEstado(uf)}
                                    className={`px-5 py-2.5 rounded-2xl font-bold text-xs uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 border ${filtroEstado === uf 
                                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent shadow-lg shadow-blue-500/20 translate-y-[-2px]' 
                                        : `${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}`}
                                >
                                    {uf}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CAMPO DE BUSCA */}
                    <div className="relative group">
                        <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 to-blue-500 opacity-0 group-focus-within:opacity-50 blur transition duration-500`}></div>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder={filtroEstado ? `Buscar em ${filtroEstado}...` : "Buscar unidade ou modalidade..."} 
                                className={`w-full h-14 pl-12 pr-4 rounded-2xl border outline-none font-semibold text-sm shadow-inner transition-all ${inputGlass}`} 
                                value={busca} 
                                onChange={e => setBusca(e.target.value)} 
                                autoFocus 
                            />
                            <Search className={`absolute left-4 top-4 w-6 h-6 transition-colors ${isDarkMode ? 'text-white/30 group-focus-within:text-white' : 'text-gray-400 group-focus-within:text-gray-600'}`}/>
                            {busca && busca !== termoDebounce && <Loader2 className="absolute right-4 top-4 w-6 h-6 animate-spin text-red-500"/>}
                        </div>
                    </div>

                    {/* ÁREA DE RESULTADOS */}
                    <div className={`max-h-[350px] overflow-y-auto custom-scrollbar pr-2 transition-all duration-500 ${(busca || filtroEstado) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                        
                        {/* AULAS ENCONTRADAS */}
                        {termoDebounce.length > 0 && resultadosModalidade && resultadosModalidade.length > 0 && (
                            <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                                    <span className="p-1 bg-blue-500/10 rounded"><Dumbbell className="w-3 h-3"/></span> 
                                    Aulas Encontradas
                                </h3>
                                <div className="grid gap-2">
                                    {resultadosModalidade.map((item) => (
                                        <div key={item.unidade.id} className={`p-4 rounded-2xl border flex flex-col gap-3 group transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-md'}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className={`font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{item.unidade.nome}</span>
                                                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{item.unidade.cidade} • {item.unidade.estado}</span>
                                                </div>
                                                <button onClick={() => setUnidadeSelecionada(item.unidade)} className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors flex items-center shadow-lg shadow-blue-900/20">
                                                    VER GRADE <ChevronRight className="w-3 h-3 ml-1"/>
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.aulas.slice(0, 4).map((aula, idx) => (
                                                    <span key={idx} className={`text-[10px] font-bold px-2 py-1 rounded-md border ${isDarkMode ? 'bg-black/20 border-white/10 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
                                                        {aula.dias[0]?.substring(0,3)} {aula.hora}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* UNIDADES ENCONTRADAS */}
                        {resultadosUnidade.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                                    <span className="p-1 bg-red-500/10 rounded"><MapPin className="w-3 h-3"/></span>
                                    Unidades Disponíveis
                                </h3>
                                <div className="grid gap-2">
                                    {resultadosUnidade.map(u => (
                                        <button key={u.id} onClick={() => setUnidadeSelecionada(u)} className={`w-full p-4 rounded-2xl border flex justify-between items-center group transition-all text-left hover:scale-[1.01] ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-red-500/30' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-md hover:border-red-100'}`}>
                                            <div>
                                                <span className={`block font-black text-sm uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{u.nome}</span>
                                                <span className={`text-[10px] font-bold flex items-center gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {u.cidade} <span className="w-1 h-1 rounded-full bg-gray-600"></span> {u.estado}
                                                </span>
                                            </div>
                                            <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-red-600 group-hover:text-white text-gray-500' : 'bg-white group-hover:bg-red-100 group-hover:text-red-600 text-gray-300'}`}>
                                                <ChevronRight className="w-4 h-4"/>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* EMPTY STATE */}
                        {(termoDebounce.length > 0 || filtroEstado) && !resultadosUnidade.length && !resultadosModalidade && (
                            <div className="text-center py-12 opacity-50 animate-in fade-in zoom-in-95">
                                <div className="mb-3 inline-flex p-4 rounded-full bg-white/5"><Search className="w-6 h-6"/></div>
                                <p className="text-sm font-medium">Nenhuma unidade ou aula encontrada.</p>
                                <p className="text-xs mt-1">Tente mudar o termo de busca.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className={`absolute bottom-4 text-[10px] font-medium tracking-widest uppercase opacity-30 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Desenvolvido por Pratique Fitness
            </div>
        </div>
      );
  }

  // TELA 2: GRADE COM IMPRESSÃO
  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-[#101010] text-white" : "bg-[#f5f5f5] text-[#1f1f1f]"} pb-10 print:bg-black print:text-white print:p-0 print:h-screen print:overflow-hidden`}>
        
        <style>{`
            /* ESTILOS DE IMPRESSÃO PROFISSIONAL (MELHORADOS) */
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
                    width: 100vw !important; height: 100vh !important;
                    display: flex !important; flex-direction: column !important;
                    padding: 10px !important; box-sizing: border-box !important;
                }

                /* MÁGICA 2: FONTE MAIOR NA IMPRESSÃO PORQUE O NOME DO PROFESSOR SOME */
                .density-ultra-compact .print-header { height: 60px !important; margin-bottom: 5px !important; }
                .density-ultra-compact .ph-title { font-size: 24px !important; }
                .density-ultra-compact .print-card-title { font-size: 11px !important; line-height: 1.1 !important; }
                .density-ultra-compact .print-card { padding: 1px !important; border-radius: 4px !important; }
                .density-ultra-compact .print-cell-header { font-size: 10px !important; padding: 2px !important; }
                .density-ultra-compact .print-time { font-size: 12px !important; }

                .density-compact .print-header { height: 80px !important; margin-bottom: 10px !important; }
                .density-compact .ph-title { font-size: 30px !important; }
                .density-compact .print-card-title { font-size: 14px !important; }
                .density-compact .print-card { padding: 3px !important; }

                .density-comfortable .print-header { height: 100px !important; margin-bottom: 15px !important; }
                .density-comfortable .ph-title { font-size: 36px !important; }
                .density-comfortable .print-card-title { font-size: 18px !important; }
                .density-comfortable .print-card { padding: 6px !important; }

                /* ESTRUTURA GERAL */
                .print-header {
                    display: flex !important; justify-content: space-between !important;
                    align-items: center !important; width: 100% !important;
                    border-bottom: 2px solid rgba(255,255,255,0.3) !important; flex-shrink: 0;
                }
                .ph-left { width: 25%; display: flex; justify-content: flex-start; }
                .ph-center { width: 50%; text-align: center; }
                .ph-right { width: 25%; display: flex; justify-content: flex-end; }
                .ph-title { font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1; font-style: italic; color: white; }
                .ph-sub { font-weight: bold; text-transform: uppercase; color: #ccc; margin-top: 5px; }

                .print-grid-wrapper {
                    flex: 1; width: 100% !important; display: flex !important;
                    flex-direction: column !important; border: 1px solid rgba(255,255,255,0.3) !important;
                    overflow: visible !important;
                }
                .print-grid-header, .print-grid-body {
                    display: grid; grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, 1fr);
                }
                .print-grid-header { border-bottom: 1px solid rgba(255,255,255,0.3); background-color: #111 !important; }
                .print-grid-body { grid-auto-rows: 1fr; height: 100%; }
                .print-cell {
                    border-right: 1px solid rgba(255,255,255,0.2) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.2) !important;
                    display: flex; align-items: stretch; justify-content: center; padding: 2px !important;
                }
                .print-card {
                    width: 100% !important; display: flex; flex: 1;
                    flex-direction: column; justify-content: center; align-items: center;
                    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
                    background-blend-mode: normal !important; box-shadow: none !important;
                }
                .print-card-title { color: white !important; font-weight: 900 !important; text-transform: uppercase; text-align: center; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); }
                .screen-only { display: none !important; }
            }

            /* ESTILOS DE TELA */
            @media screen {
                .screen-grid { display: grid; grid-template-columns: 80px repeat(${gradeOrganizada.dias.length}, minmax(180px, 1fr)); }
                .print-header { display: none; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
                
                <div className="flex gap-3 relative">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-full border transition-all ${isDarkMode ? 'bg-[#222] border-white/10 text-yellow-400' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>{isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
                    
                    <div className="relative">
                        <button onClick={() => setShowPrintMenu(!showPrintMenu)} className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all flex items-center gap-2">
                            <Printer className="w-5 h-5"/> <ChevronDown className="w-3 h-3"/>
                        </button>
                        
                        {showPrintMenu && (
                            <div className="absolute right-0 top-14 bg-white rounded-xl shadow-2xl border border-gray-200 w-64 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                <div className="p-3 border-b border-gray-100 bg-gray-50"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Ajuste de Impressão</p></div>
                                <button onClick={() => handlePrint('auto')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs">✨</span> 
                                    <div><span className="block">Automático</span><span className="text-[10px] text-gray-400 font-normal">O sistema decide</span></div>
                                </button>
                                <button onClick={() => handlePrint('ultra-compact')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-3 border-b border-gray-100">
                                    <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-xs">📉</span> 
                                    <div><span className="block">Compactar</span><span className="text-[10px] text-gray-400 font-normal">Para grades grandes</span></div>
                                </button>
                                <button onClick={() => handlePrint('comfortable')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">📈</span> 
                                    <div><span className="block">Expandir</span><span className="text-[10px] text-gray-400 font-normal">Para grades pequenas</span></div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* CONTAINER GERAL */}
        <div className={`print-container max-w-[1920px] mx-auto p-4 md:p-8 print:p-0 density-${appliedDensity}`}>
            
            {/* HEADER DE IMPRESSÃO */}
            <div className="hidden print:flex print-header">
                <div className="ph-left"><img src={LOGOS['pratique']} alt="Logo" className="h-16 brightness-0 invert object-contain"/></div>
                <div className="ph-center"><h1 className="ph-title">{unidadeSelecionada.nome}</h1><p className="ph-sub">Quadro Happy Zone</p></div>
                <div className="ph-right"><div className="bg-white p-1 rounded"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://gestaodecoletivas.vercel.app/horarios")}`} alt="QR" className="w-16 h-16"/></div></div>
            </div>

            {loadingGrade ? <div className="flex justify-center h-[50vh] items-center screen-only"><Loader2 className="w-12 h-12 animate-spin text-red-600"/></div> : 
            gradeUnidade.length === 0 ? <div className="text-center py-20 opacity-50 screen-only"><p className="font-bold text-xl">Grade vazia.</p></div> : 
            (
                <div className={`print-grid-wrapper overflow-x-auto rounded-2xl border ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} print:bg-black print:border-0 print:rounded-none`}>
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

                    <div className="screen-grid print-grid-body">
                        {gradeOrganizada.horarios.map((hora, idx) => (
                            <React.Fragment key={hora}>
                                <div className={`print-cell border-r border-b font-mono font-bold text-xl ${isDarkMode ? 'border-white/10 text-[#00adef]' : 'border-gray-200 text-blue-600'} print:text-[#00adef] print:font-black print-time p-4 flex items-center justify-center`}>
                                    {hora}
                                </div>
                                {gradeOrganizada.dias.map(dia => {
                                    // MÁGICA 3: Usar FILTER ao invés de FIND. Traz todas as aulas do mesmo dia e hora.
                                    const aulasNoHorario = getAulasCell(dia, hora);
                                    const borderClass = `border-r border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'} print:border-[#222]`;
                                    
                                    if (aulasNoHorario.length === 0) return <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}></div>;
                                    
                                    return (
                                        <div key={`${dia}-${hora}`} className={`print-cell ${borderClass} p-1 flex flex-col gap-1`}>
                                            {/* Faz um map para renderizar cada aula em um card próprio dentro da mesma célula */}
                                            {aulasNoHorario.map((aula, i) => {
                                                const cor = aula.modalidadeCor || '#333';
                                                return (
                                                    <div 
                                                        key={i}
                                                        className="print-card w-full rounded-xl p-2 flex flex-col justify-center items-center text-center shadow-sm hover:scale-105 transition-transform cursor-default flex-1"
                                                        style={{ backgroundColor: cor }}
                                                    >
                                                        <p className="print-card-title font-black text-[13px] md:text-[15px] uppercase leading-tight line-clamp-2 text-white drop-shadow-md">
                                                            {aula.modalidadeNome}
                                                        </p>
                                                        {/* print:hidden oculta o nome do professor no PDF/Papel */}
                                                        <p className="print-card-sub text-[10px] md:text-[11px] font-bold uppercase opacity-90 truncate w-full text-white drop-shadow-md print:hidden mt-1">
                                                            {aula.professorNome}
                                                        </p>
                                                    </div>
                                                )
                                            })}
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
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

// FIX: Removido Download e CheckCircle2 (Não utilizados)
import { 
  Megaphone, Search, Users, MapPin, CheckSquare, Square, 
  Copy, Smartphone, FileSpreadsheet, Loader2, AlertCircle, 
  Tags, ChevronDown, Filter, Building2, Clock, MessageSquare, 
  Check, UserCog, Eraser, RefreshCw
} from 'lucide-react';

// --- HELPERS E CONSTANTES GLOBAIS (Estáticas - Não mudam no render) ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

const TURNOS_OPTIONS = [
    { id: 'manha', nome: 'Manhã (05:00 as 11:59)' },
    { id: 'tarde', nome: 'Tarde (12:00 as 17:59)' },
    { id: 'noite', nome: 'Noite (18:00 as 23:59)' }
];

const getFirstLast = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

const getPrimeiroNome = (fullName) => {
    if (!fullName) return '';
    return fullName.trim().split(' ')[0];
};

const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
};

// Componente de Dropdown Multi-Select Turbinado
const MultiSelect = ({ label, options, selected, onChange, icon: Icon, searchable = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTxt, setSearchTxt] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTxt(''); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id) => {
        if (selected.includes(id)) onChange(selected.filter(item => item !== id));
        else onChange([...selected, id]);
    };

    const filteredOptions = searchable && searchTxt
        ? options.filter(opt => opt.nome.toLowerCase().includes(searchTxt.toLowerCase()))
        : options;

    const isAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt.id));
    
    const toggleAll = () => {
        if (isAllFilteredSelected) {
            const filteredIds = filteredOptions.map(o => o.id);
            onChange(selected.filter(id => !filteredIds.includes(id)));
        } else {
            const newSelected = [...selected];
            filteredOptions.forEach(opt => {
                if (!newSelected.includes(opt.id)) newSelected.push(opt.id);
            });
            onChange(newSelected);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Icon className="w-3 h-3"/> {label}
            </label>
            <div 
                className="w-full min-h-[48px] p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-white cursor-pointer flex justify-between items-center shadow-sm"
                onClick={() => {
                    if (isOpen) {
                        setIsOpen(false);
                        setSearchTxt('');
                    } else {
                        setIsOpen(true);
                    }
                }}
            >
                <span className="truncate pr-4">
                    {selected.length === 0 ? "Todos selecionados" : `${selected.length} selecionado(s)`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 flex flex-col">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Buscar ${label.toLowerCase()}...`}
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 dark:text-white transition-colors"
                                    value={searchTxt}
                                    onChange={(e) => setSearchTxt(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="p-2 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10 shrink-0">
                        <button 
                            type="button"
                            onClick={toggleAll}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            {isAllFilteredSelected ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>} 
                            Marcar / Desmarcar Visíveis
                        </button>
                    </div>
                    
                    <div className="p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center text-xs text-slate-400 py-3">Nenhum resultado.</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = selected.includes(opt.id);
                                return (
                                    <div 
                                        key={opt.id} 
                                        onClick={() => toggleOption(opt.id)}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                                    >
                                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate uppercase">{opt.nome}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function CentralComunicacao() {
    const { userData } = useAuth();
    
    // --- CONTROLE DE ACESSO E PERMISSÕES ---
    const role = String(userData?.role || "").trim().toLowerCase();
    const userId = userData?.id || userData?.uid;

    // --- ESTADOS BASE ---
    const [loadingDb, setLoadingDb] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [catalogs, setCatalogs] = useState({ unidades: [], modalidades: [], mentores: [] });
    const [professoresFiltrados, setProfessoresFiltrados] = useState([]);
    const [buscaRealizada, setBuscaRealizada] = useState(false);

    // --- CACHE E CONTROLE DE REQUISIÇÃO ---
    const cacheRef = useRef({ professores: null, aulas: null, timestamp: 0 });
    const buscaRef = useRef(0);

    // --- ESTADOS DE UX ---
    const [copiado, setCopiado] = useState(false);
    const [filtrosNaBusca, setFiltrosNaBusca] = useState(null);
    const textareaRef = useRef(null);

    // --- FILTROS ---
    const [filtros, setFiltros] = useState({
        estados: [], mentores: [], unidades: [], modalidades: [], turnos: []
    });

    const { estados, mentores } = filtros;
    useEffect(() => {
        setFiltros(prev => ({ ...prev, unidades: [] }));
    }, [estados, mentores]);

    const resultadoDesatualizado = buscaRealizada && filtrosNaBusca !== JSON.stringify(filtros);

    const [mensagem, setMensagem] = useState("Olá [PRIMEIRO_NOME], tudo bem?\n\nAqui é da gestão Pratique.");

    // ==========================================
    // 1. CARREGAMENTO INICIAL SILENCIOSO
    // ==========================================
    useEffect(() => {
        if (role !== 'admin' && role !== 'mentor') return;
        let isMounted = true; 

        const fetchCatalogs = async () => {
            setLoadingDb(true);
            try {
                const [uniSnap, modSnap, userSnap] = await Promise.all([
                    getDocs(collection(db, 'unidades')),
                    getDocs(collection(db, 'modalidades')),
                    getDocs(collection(db, 'usuarios'))
                ]);
                
                if (!isMounted) return;

                let unidadesData = uniSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                if (role === 'mentor') {
                    unidadesData = unidadesData.filter(u => u.mentorId === userId);
                }

                const mentoresData = userSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => u.role === 'mentor');

                setCatalogs({
                    unidades: unidadesData,
                    modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    mentores: mentoresData
                });
            } catch (error) {
                console.error("Erro ao carregar dicionários:", error);
            } finally {
                if (isMounted) setLoadingDb(false);
            }
        };
        fetchCatalogs();
        
        return () => { isMounted = false; };
    }, [role, userId]);

    const estadosOptions = useMemo(() => {
        const states = [...new Set(catalogs.unidades.map(u => u.estado).filter(Boolean))].sort();
        return states.map(s => ({ id: s, nome: s }));
    }, [catalogs.unidades]);

    const mentoresOptions = useMemo(() => {
        return catalogs.mentores.map(m => ({ id: m.id, nome: m.nome })).sort((a,b) => a.nome.localeCompare(b.nome));
    }, [catalogs.mentores]);

    const unidadesOptions = useMemo(() => {
        let filtradas = catalogs.unidades;
        if (filtros.estados.length > 0) filtradas = filtradas.filter(u => filtros.estados.includes(u.estado));
        if (filtros.mentores.length > 0) filtradas = filtradas.filter(u => filtros.mentores.includes(u.mentorId));
        return filtradas.map(u => ({ id: u.id, nome: u.nome })).sort((a,b) => a.nome.localeCompare(b.nome));
    }, [catalogs.unidades, filtros.estados, filtros.mentores]);

    const modalidadesOptions = useMemo(() => {
        return catalogs.modalidades.map(m => ({ id: m.id, nome: m.nome })).sort((a,b) => a.nome.localeCompare(b.nome));
    }, [catalogs.modalidades]);

    // ==========================================
    // 2. FUNÇÕES DE AÇÃO E MOTOR DE BUSCA
    // ==========================================
    const limparFiltros = (forcarRefresh = false) => {
        if (forcarRefresh) {
            cacheRef.current = { professores: null, aulas: null, timestamp: 0 };
        }
        setFiltros({ estados: [], mentores: [], unidades: [], modalidades: [], turnos: [] });
        setBuscaRealizada(false);
        setProfessoresFiltrados([]);
        setFiltrosNaBusca(null);
    };

    const buscarPublico = async () => {
        const currentBuscaId = ++buscaRef.current; 
        setProcessing(true);

        try {
            const agora = Date.now();
            const cacheValido = (agora - cacheRef.current.timestamp) < CACHE_TTL;
            
            let todosProfessores, todasAulas;

            if (cacheValido && cacheRef.current.professores && cacheRef.current.aulas) {
                todosProfessores = cacheRef.current.professores;
                todasAulas = cacheRef.current.aulas;
            } else {
                const [profsSnap, aulasSnap] = await Promise.all([
                    getDocs(collection(db, 'professores')),
                    getDocs(collection(db, 'aulas'))
                ]);
                todosProfessores = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                todasAulas = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                cacheRef.current = { professores: todosProfessores, aulas: todasAulas, timestamp: agora };
            }

            if (currentBuscaId !== buscaRef.current) return;

            const modMap = {}; catalogs.modalidades.forEach(m => modMap[m.id] = m.nome);
            const uniMap = {}; catalogs.unidades.forEach(u => uniMap[u.id] = u);

            const relacaoProfessor = {};

            todasAulas.forEach(aula => {
                let turnoAula = 'manha';
                const horaInt = parseInt(aula.hora?.split(':')[0] || '0', 10); 
                if (horaInt >= 12 && horaInt < 18) turnoAula = 'tarde';
                if (horaInt >= 18) turnoAula = 'noite';

                const unidade = uniMap[aula.unidadeId];
                if (!unidade) return;

                const passaEstado = filtros.estados.length === 0 || filtros.estados.includes(unidade.estado);
                const passaMentor = filtros.mentores.length === 0 || filtros.mentores.includes(unidade.mentorId);
                const passaUnidade = filtros.unidades.length === 0 || filtros.unidades.includes(aula.unidadeId);
                const passaModalidade = filtros.modalidades.length === 0 || filtros.modalidades.includes(aula.modalidadeId);
                const passaTurno = filtros.turnos.length === 0 || filtros.turnos.includes(turnoAula);

                if (passaEstado && passaMentor && passaUnidade && passaModalidade && passaTurno) {
                    if (!relacaoProfessor[aula.professorId]) {
                        relacaoProfessor[aula.professorId] = { modalidades: new Set(), unidades: new Set() };
                    }
                    if (aula.modalidadeId) relacaoProfessor[aula.professorId].modalidades.add(modMap[aula.modalidadeId] || 'Geral');
                    if (unidade.nome) relacaoProfessor[aula.professorId].unidades.add(unidade.nome);
                }
            });

            const profMap = new Map(todosProfessores.map(p => [String(p.id), p]));
            const resultados = [];

            Object.keys(relacaoProfessor).forEach(profId => {
                const profData = profMap.get(profId); 
                
                if (profData && profData.telefone) {
                    const numeroLimpo = profData.telefone.replace(/\D/g, '');
                    const phoneFinal = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
                    
                    if (phoneFinal.length >= 12) {
                        resultados.push({
                            ...profData,
                            telefoneFormatado: phoneFinal,
                            modalidadesLecionadas: Array.from(relacaoProfessor[profId].modalidades).join(', '),
                            unidadesLecionadas: Array.from(relacaoProfessor[profId].unidades).join(', ')
                        });
                    }
                }
            });

            setProfessoresFiltrados(resultados.sort((a, b) => a.nome.localeCompare(b.nome)));
            setBuscaRealizada(true);
            setFiltrosNaBusca(JSON.stringify(filtros)); 

        } catch (error) {
            console.error("Erro ao cruzar dados:", error);
            alert("Erro ao buscar dados no servidor.");
        } finally {
            if (currentBuscaId === buscaRef.current) setProcessing(false);
        }
    };

    // ==========================================
    // 3. COMPOSIÇÃO DE MENSAGEM DINÂMICA
    // ==========================================
    const gerarMensagemFinal = (prof, template) => {
        let msg = template;
        msg = msg.replace(/\[NOME_COMPLETO\]/g, getFirstLast(prof.nome).toUpperCase());
        msg = msg.replace(/\[PRIMEIRO_NOME\]/g, getPrimeiroNome(prof.nome).toUpperCase());
        msg = msg.replace(/\[SAUDACAO\]/g, getSaudacao().toUpperCase());
        msg = msg.replace(/\[MODALIDADES\]/g, prof.modalidadesLecionadas.toUpperCase());
        msg = msg.replace(/\[UNIDADES\]/g, prof.unidadesLecionadas.toUpperCase());
        return msg;
    };

    const addTag = (tag) => {
        const el = textareaRef.current;
        if (!el) {
            setMensagem(prev => prev + ` ${tag} `);
            return;
        }

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = mensagem;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        setMensagem(before + ` ${tag} ` + after);

        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
        }, 0);
    };

    // ==========================================
    // 4. EXPORTADORES
    // ==========================================
    const copiarParaDisparador = async () => {
        if (professoresFiltrados.length === 0) return;
        
        const text = professoresFiltrados.map(p => {
            return `${p.telefoneFormatado}\t${getPrimeiroNome(p.nome)}`;
        }).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch (err) {
            alert("❌ Permissão negada pelo navegador. Tente copiar manualmente.");
        }
    };

    const exportarCSV = () => {
        if (professoresFiltrados.length === 0) return;
        
        const headers = "Telefone,Nome\n";
        const rows = professoresFiltrados.map(p => {
            return `"${p.telefoneFormatado}","${p.nome.toUpperCase()}"`;
        }).join("\n");

        const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.href = url;
        link.setAttribute('download', `Contatos_WaSeller.csv`);
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const dispararIndividual = (prof) => {
        const msg = gerarMensagemFinal(prof, mensagem);
        window.open(`https://api.whatsapp.com/send?phone=${prof.telefoneFormatado}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    if (role !== 'admin' && role !== 'mentor') {
        return <div className="p-10 text-center text-slate-500 font-bold uppercase">Acesso Restrito: Apenas Gestão.</div>;
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <span className="bg-gradient-to-tr from-green-500 to-emerald-600 text-white p-2 rounded-lg shadow-lg shadow-green-500/20">
                            <Megaphone className="w-7 h-7" />
                        </span>
                        Central de Comunicação
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm uppercase">Filtre seu público e extraia os contatos para o WaSeller</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* COLUNA ESQUERDA: FILTROS E MENSAGEM */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* BLOCO DE SEGMENTAÇÃO */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                        <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <Filter className="w-5 h-5 text-blue-500"/> 1. Quem vai receber?
                        </h2>
                        
                        {loadingDb ? (
                            <div className="flex justify-center p-5 text-slate-400"><Loader2 className="w-6 h-6 animate-spin"/></div>
                        ) : (
                            <div className="space-y-4">
                                <MultiSelect label="ESTADOS" options={estadosOptions} selected={filtros.estados} onChange={v => setFiltros({...filtros, estados: v})} icon={MapPin} />
                                
                                {role === 'admin' && (
                                    <MultiSelect label="MENTORES" options={mentoresOptions} selected={filtros.mentores} onChange={v => setFiltros({...filtros, mentores: v})} icon={UserCog} searchable={true} />
                                )}

                                <MultiSelect label="UNIDADES" options={unidadesOptions} selected={filtros.unidades} onChange={v => setFiltros({...filtros, unidades: v})} icon={Building2} searchable={true} />
                                <MultiSelect label="MODALIDADES" options={modalidadesOptions} selected={filtros.modalidades} onChange={v => setFiltros({...filtros, modalidades: v})} icon={Users} searchable={true} />
                                
                                <MultiSelect label="TURNOS" options={TURNOS_OPTIONS} selected={filtros.turnos} onChange={v => setFiltros({...filtros, turnos: v})} icon={Clock} />

                                <div className="flex gap-2 pt-2">
                                    <button 
                                        onClick={() => limparFiltros(false)}
                                        className="w-[28%] px-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-[10px] sm:text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-transparent shadow-sm"
                                        title="Limpar todos os filtros da tela"
                                    >
                                        <Eraser className="w-4 h-4"/> Limpar
                                    </button>

                                    <button 
                                        onClick={() => limparFiltros(true)}
                                        className="w-[28%] px-1 py-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-500 font-bold text-[10px] sm:text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-transparent shadow-sm"
                                        title="Zerar os filtros e forçar a busca mais recente do banco de dados"
                                    >
                                        <RefreshCw className="w-4 h-4"/> Atualizar
                                    </button>
                                    
                                    <button 
                                        onClick={buscarPublico}
                                        disabled={processing}
                                        className="w-[44%] bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
                                        Buscar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* COLUNA DIREITA: MENSAGEM E RESULTADOS */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* BLOCO DA MENSAGEM */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                            <MessageSquare className="w-5 h-5 text-green-500"/> 2. Rascunho da Mensagem
                        </h2>
                        
                        <div className="mb-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Use para envios individuais aqui no site:</span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { tag: '[PRIMEIRO_NOME]', label: '1º Nome' },
                                    { tag: '[NOME_COMPLETO]', label: 'Nome Todo' },
                                    { tag: '[SAUDACAO]', label: 'Bom dia/tarde' },
                                    { tag: '[MODALIDADES]', label: 'Modalidades' },
                                    { tag: '[UNIDADES]', label: 'Unidades' }
                                ].map(t => (
                                    <button 
                                        key={t.tag} onClick={() => addTag(t.tag)}
                                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-600"
                                    >
                                        <Tags className="w-3 h-3 text-blue-500"/> {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            ref={textareaRef}
                            className="w-full h-40 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-green-500 outline-none resize-none custom-scrollbar"
                            value={mensagem}
                            onChange={(e) => setMensagem(e.target.value)}
                            placeholder="Digite sua mensagem aqui..."
                        ></textarea>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3 flex-shrink-0"/> Dica WaSeller: Copie o texto acima e cole na tela de envio do WaSeller substituindo as nossas tags pelas do robô.
                        </p>
                    </div>

                    {/* AVISO DE BUSCA DESATUALIZADA */}
                    {resultadoDesatualizado && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-start gap-3 shadow-sm animate-in fade-in">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-800 uppercase">Filtros Alterados</h3>
                                <p className="text-xs text-amber-700 mt-1 font-medium">Os filtros foram modificados. Clique novamente em "Buscar" para atualizar a lista abaixo.</p>
                            </div>
                        </div>
                    )}

                    {/* BLOCO DE RESULTADOS */}
                    {buscaRealizada && (
                        <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 transition-colors ${resultadoDesatualizado ? 'border-amber-300 opacity-70' : 'border-slate-200 dark:border-slate-700'}`}>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                                <div>
                                    <h2 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-500"/> 3. Exportar para WaSeller
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                                        {professoresFiltrados.length} PROFESSORES ENCONTRADOS
                                    </p>
                                </div>
                                
                                <div className="flex gap-2 w-full xl:w-auto">
                                    <button 
                                        onClick={exportarCSV}
                                        disabled={resultadoDesatualizado}
                                        className="flex-1 xl:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        title="Baixa a planilha de contatos limpa pronta para subir no WaSeller"
                                    >
                                        <FileSpreadsheet className="w-4 h-4"/> CSV WASELLER
                                    </button>
                                    <button 
                                        onClick={copiarParaDisparador}
                                        disabled={resultadoDesatualizado}
                                        className={`flex-1 xl:flex-none px-5 py-2.5 text-white rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${copiado ? 'bg-green-500 shadow-green-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                                        title="Copia os contatos para você colar na importação manual do WaSeller"
                                    >
                                        {copiado ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>} 
                                        {copiado ? 'COPIADO! ✅' : 'COPIAR PARA WASELLER'}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4">Professor</th>
                                            <th className="p-4">Modalidades (Filtro)</th>
                                            <th className="p-4">WhatsApp</th>
                                            <th className="p-4 text-center">Envio Individual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {professoresFiltrados.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-10 text-center text-slate-400 font-bold uppercase">
                                                    Nenhum professor válido encontrado com estes filtros.
                                                </td>
                                            </tr>
                                        ) : (
                                            professoresFiltrados.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase">{p.nome}</div>
                                                        <div className="text-[10px] text-slate-400 uppercase mt-0.5">{p.unidadesLecionadas}</div>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{p.modalidadesLecionadas}</td>
                                                    <td className="p-4 font-mono text-xs text-slate-500">{p.telefoneFormatado}</td>
                                                    <td className="p-4 text-center">
                                                        <button 
                                                            onClick={() => dispararIndividual(p)}
                                                            className="p-2 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
                                                            title="Envia a mensagem criada no painel direto para o WhatsApp desta pessoa"
                                                        >
                                                            <Smartphone className="w-4 h-4"/> Enviar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
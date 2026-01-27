import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, Plus, Filter, 
  Search, Trash2, Edit2, X, Check, 
  MapPin, Loader2, AlertTriangle, Users,
  DollarSign 
} from 'lucide-react';

// Integrações
import { useAuth } from '../../contexts/AuthContext'; 
import { db } from '../../services/firebase'; 
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp 
} from 'firebase/firestore';

// --- FUNÇÕES UTILITÁRIAS ---

const formatFirstLastName = (fullName) => {
  if (!fullName) return "Instrutor";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const getContrastColor = (hexColor) => {
  if (!hexColor) return '#000000';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return '#000000';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#1e293b' : '#ffffff';
};

// --- COMPONENTE CARD ---
const ClassCard = ({ data, onClick, isReadOnly }) => {
  const textColor = getContrastColor(data.modalidadeCor || '#E6332A');

  return (
    <div 
      onClick={!isReadOnly ? onClick : undefined}
      style={{ backgroundColor: data.modalidadeCor || '#E6332A' }}
      className={`group relative mb-2 p-2 rounded-lg shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 overflow-hidden flex flex-col items-center justify-center min-h-[70px] text-center w-full ${!isReadOnly ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <h4 style={{ color: textColor }} className="font-black text-[11px] uppercase tracking-wide leading-tight w-full break-words">
        {data.modalidadeNome}
      </h4>
      <div className="flex items-center gap-1 mt-1 opacity-90">
        <Users className="w-3 h-3" style={{ color: textColor }} />
        <span style={{ color: textColor }} className="text-[9px] font-bold uppercase truncate max-w-[120px]">
          {formatFirstLastName(data.professorNome)}
        </span>
      </div>
      {!isReadOnly && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/30 backdrop-blur-md p-1 rounded hover:bg-white/50" style={{ color: textColor }}>
            <Edit2 className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
};

export default function CronogramaPage() {
  const { userData } = useAuth();
  
  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const isReadOnly = role === 'professor';

  // --- DADOS GLOBAIS ---
  const [catalogs, setCatalogs] = useState({
    unidades: [],
    modalidades: [],
    professores: [],
    vinculos: [] 
  });
  
  const [aulas, setAulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // Estado para evitar duplo clique
  const [errorMsg, setErrorMsg] = useState("");

  // --- CONTROLES ---
  const [availableUnits, setAvailableUnits] = useState([]); 
  const [selectedUnit, setSelectedUnit] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  // --- FORMULÁRIO ---
  const [formData, setFormData] = useState({
    unidadeId: '', modalidadeId: '', professorId: '', hora: '07:00', valor: '', dias: []
  });

  const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // --- 1. CARREGAMENTO INICIAL ---
  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        // Busca simultânea
        const [unitsSnap, modsSnap, profsSnap, vinculosSnap] = await Promise.all([
          getDocs(collection(db, 'unidades')),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'professores')),
          // 🔴 CORREÇÃO CRÍTICA: Lendo da coleção correta 'vinculos' (antes estava 'professorVinculos')
          getDocs(collection(db, 'vinculos')) 
        ]);

        let finalUnidades = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const todosProfessores = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // 🔴 CORREÇÃO CRÍTICA: Normalizando dados dos vínculos
        const todosVinculos = vinculosSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                professorId: String(data.professorId), // Garante String
                unidadeId: String(data.unidadeId),     // Garante String
                status: data.status || 'ativo'
            };
        }).filter(v => v.status === 'ativo');

        // === FILTRO DE UNIDADES (ACL) ===
        let unitsToShow = [];

        if (role === 'admin') {
            unitsToShow = finalUnidades;
        } 
        else if (role === 'mentor') {
            unitsToShow = finalUnidades.filter(u => u.mentorId === userId);
        } 
        else if (role === 'unidade') {
            unitsToShow = finalUnidades.filter(u => u.id === userData.unidadeId);
        } 
        else if (role === 'professor') {
            const meuPerfil = todosProfessores.find(p => p.uidLogin === userId);
            if (meuPerfil) {
                const meusLinks = todosVinculos.filter(v => v.professorId === String(meuPerfil.id));
                const minhasUnidadesIds = meusLinks.map(v => v.unidadeId);
                unitsToShow = finalUnidades.filter(u => minhasUnidadesIds.includes(String(u.id)));
            } else {
                unitsToShow = [];
            }
        }

        setCatalogs({
          unidades: finalUnidades,
          modalidades: modsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          professores: todosProfessores,
          vinculos: todosVinculos 
        });

        setAvailableUnits(unitsToShow);

        // Auto-seleção de unidade
        if (unitsToShow.length > 0 && !selectedUnit) {
            setSelectedUnit(unitsToShow[0].id);
        }

      } catch (error) {
        console.error("Erro no load inicial:", error);
        setErrorMsg("Erro de conexão. Verifique sua internet.");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogs();
  }, [role, userId, userData]); 

  // --- 2. BUSCA DE AULAS ---
  const fetchAulas = useCallback(async () => {
    if (!selectedUnit) {
      setAulas([]);
      return;
    }
    try {
      const qAulas = query(collection(db, 'aulas'), where('unidadeId', '==', selectedUnit));
      const aulasSnap = await getDocs(qAulas);
      const aulasData = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAulas(aulasData);
    } catch (err) { console.error(err); }
  }, [selectedUnit]);

  useEffect(() => {
    fetchAulas();
  }, [fetchAulas]);

  // --- 3. CÁLCULO INTELIGENTE DE PROFESSORES (CORREÇÃO DO VÍNCULO) ---
  const professoresDoModal = useMemo(() => {
    if (!formData.unidadeId) return [];
    
    // 1. Pega os vínculos da unidade selecionada no modal
    // 🔴 Uso de String() para garantir a comparação
    const linksDaUnidade = catalogs.vinculos.filter(v => String(v.unidadeId) === String(formData.unidadeId));
    
    // 2. Extrai os IDs dos professores permitidos
    const idsPermitidos = linksDaUnidade.map(v => String(v.professorId));
    
    // 3. Retorna os objetos completos dos professores
    return catalogs.professores.filter(p => idsPermitidos.includes(String(p.id)));
  }, [formData.unidadeId, catalogs.vinculos, catalogs.professores]);


  // --- 4. PREPARAÇÃO VISUAL ---
  const filteredClasses = useMemo(() => {
    if (!selectedUnit) return [];
    
    let classes = aulas.filter(h => String(h.unidadeId) === String(selectedUnit));

    return classes.map(c => {
      const mod = catalogs.modalidades.find(m => String(m.id) === String(c.modalidadeId));
      const prof = catalogs.professores.find(p => String(p.id) === String(c.professorId));
      return {
        ...c,
        modalidadeNome: mod?.nome || 'Desconhecido',
        modalidadeCor: mod?.cor || '#9ca3af',
        professorNome: prof?.nome || 'Sem Professor'
      };
    }).filter(c => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.modalidadeNome.toLowerCase().includes(term) || 
        c.professorNome.toLowerCase().includes(term)
      );
    });
  }, [selectedUnit, searchTerm, aulas, catalogs]);

  const activeTimeSlots = useMemo(() => {
    const times = new Set(filteredClasses.map(c => c.hora));
    return Array.from(times).sort();
  }, [filteredClasses]);

  // --- AÇÕES ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly || saving) return; 

    if (formData.dias.length === 0) return alert("Selecione pelo menos um dia.");

    try {
      setSaving(true);
      const payload = {
        unidadeId: formData.unidadeId,
        modalidadeId: formData.modalidadeId,
        professorId: formData.professorId,
        hora: formData.hora,
        valor: formData.valor ? parseFloat(formData.valor) : 0, 
        dias: formData.dias
      };

      if (editingClass) {
        await updateDoc(doc(db, "aulas", editingClass.id), { ...payload, updatedAt: serverTimestamp() });
        
        // Atualização Otimista
        if (selectedUnit === formData.unidadeId) {
            setAulas(prev => prev.map(a => a.id === editingClass.id ? { ...payload, id: a.id } : a));
        } else {
            setAulas(prev => prev.filter(a => a.id !== editingClass.id));
        }
      } else {
        const docRef = await addDoc(collection(db, "aulas"), { ...payload, createdAt: serverTimestamp() });
        if (selectedUnit === formData.unidadeId) {
            setAulas(prev => [...prev, { ...payload, id: docRef.id }]);
        }
      }
      setShowModal(false);
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isReadOnly) return;
    if (confirm("Excluir esta aula?")) {
      try {
        setSaving(true);
        await deleteDoc(doc(db, "aulas", editingClass.id));
        setAulas(prev => prev.filter(a => a.id !== editingClass.id));
        setShowModal(false);
      } catch (error) { 
        alert("Erro ao excluir"); 
      } finally {
        setSaving(false);
      }
    }
  };

  const toggleDay = (day) => {
    setFormData(prev => {
      const exists = prev.dias.includes(day);
      return exists 
        ? { ...prev, dias: prev.dias.filter(d => d !== day) }
        : { ...prev, dias: [...prev.dias, day] };
    });
  };

  const openNewModal = () => {
    if (isReadOnly) return;
    setFormData({ 
      unidadeId: selectedUnit, modalidadeId: '', professorId: '', 
      hora: '07:00', valor: '', dias: [] 
    });
    setEditingClass(null);
    setShowModal(true);
  };

  const openEditModal = (cls) => {
    if (isReadOnly) return;
    setEditingClass(cls);
    setFormData({ ...cls, dias: cls.dias || [] });
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-400 dark:text-slate-500 gap-2"><Loader2 className="w-6 h-6 animate-spin text-red-600" /> Carregando Cronograma...</div>;
  }

  if (errorMsg) {
    return <div className="flex h-screen items-center justify-center text-red-500 gap-2"><AlertTriangle className="w-6 h-6" /> {errorMsg}</div>;
  }

  return (
    <div className="p-8 max-w-[1800px] mx-auto animate-fade-in space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-red-200 dark:shadow-none shadow-lg">
              <Calendar className="w-6 h-6" />
            </span>
            Cronograma de Aulas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {isReadOnly ? "Visualização de Grade" : "Gerenciamento de Grade e Horário"}
          </p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2 border border-slate-200 dark:border-slate-700">
          <div className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`} />
          {role}
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-6">
        <div className="flex flex-col xl:flex-row gap-6 items-end">
          
          <div className="w-full xl:w-1/3 space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Unidade
            </label>
            <div className="relative group">
              <select 
                className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:border-red-500 outline-none transition-all appearance-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={availableUnits.length <= 1 && (role === 'unidade' || role === 'professor')}
              >
                <option value="">{availableUnits.length === 0 ? "Nenhuma unidade disponível" : "Selecione..."}</option>
                {availableUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3" /> Pesquisar na Grade
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Busque por modalidade ou professor..."
                className="w-full h-12 pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-white focus:border-red-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {!isReadOnly && (
            <button 
                onClick={openNewModal}
                disabled={!selectedUnit}
                className={`
                h-12 px-8 rounded-xl font-bold text-sm uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap
                ${selectedUnit 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:to-red-800 shadow-red-200 dark:shadow-none' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-600'}
                `}
            >
                <Plus className="w-5 h-5" /> Criar Aula
            </button>
          )}
        </div>
      </div>

      {/* GRADE VISUAL */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] relative">
        {!selectedUnit ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
            <MapPin className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">Selecione uma Unidade</h3>
          </div>
        ) : filteredClasses.length === 0 && !searchTerm ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Calendar className="w-12 h-12 mb-3 opacity-20" />
            <p>Nenhuma aula cadastrada nesta unidade.</p>
            {!isReadOnly && (
                <button onClick={openNewModal} className="mt-2 text-red-600 hover:underline font-bold text-sm">
                Criar primeira aula
                </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-6">
            <div className="grid grid-cols-[80px_repeat(7,minmax(180px,1fr))] w-full min-w-[1400px]">
              
              <div className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 p-4 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 left-0 z-20">
                Horário
              </div>
              
              {daysOfWeek.map(day => (
                <div key={day} className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 border-l border-slate-100 dark:border-slate-800 p-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky top-0 z-10">
                  {day}
                </div>
              ))}

              {activeTimeSlots.map(time => (
                <React.Fragment key={time}>
                  <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 flex items-start justify-end pt-5 sticky left-0 z-10">
                    {time}
                  </div>
                  {daysOfWeek.map(day => {
                    const classesInSlot = filteredClasses.filter(c => c.dias.includes(day) && c.hora === time);
                    return (
                      <div 
                        key={`${day}-${time}`} 
                        className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 border-l border-slate-100 dark:border-slate-700 p-2 min-h-[110px] h-auto hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors flex flex-col gap-1"
                      >
                        {classesInSlot.map(cls => (
                          <ClassCard key={cls.id} data={cls} onClick={() => openEditModal(cls)} isReadOnly={isReadOnly} />
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL (FORM) */}
      {showModal && !isReadOnly && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">
                {editingClass ? 'Editar Aula' : 'Criar Nova Aula'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-5">
              
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Unidade</label>
                <select 
                  className="w-full p-3 bg-slate-100 dark:bg-slate-900 border-transparent rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                  value={formData.unidadeId}
                  onChange={e => setFormData({...formData, unidadeId: e.target.value})}
                  disabled={userData?.role === 'unidade'}
                >
                  {availableUnits.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Modalidade</label>
                  <select 
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none"
                    value={formData.modalidadeId}
                    onChange={e => setFormData({...formData, modalidadeId: e.target.value})}
                    required
                  >
                    <option value="">Selecione...</option>
                    {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                
                {/* 🔴 VÍNCULO CORRIGIDO AQUI (Lê da coleção 'vinculos' que vem do hook) */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Professor</label>
                  <select 
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none"
                    value={formData.professorId}
                    onChange={e => setFormData({...formData, professorId: e.target.value})}
                    required
                    disabled={!formData.unidadeId}
                  >
                    <option value="">
                      {!formData.unidadeId ? "Selecione a unidade" : (professoresDoModal.length === 0 ? "Nenhum vinculado" : "Selecione...")}
                    </option>
                    {professoresDoModal.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {formData.unidadeId && professoresDoModal.length === 0 && (
                    <span className="text-[10px] text-red-500 mt-1 block font-bold">
                      * Nenhum professor vinculado. Vá em Configurações &rarr; Professores.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3"/> Horário
                  </label>
                  <input 
                    type="time" 
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl text-sm focus:border-red-500 outline-none"
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-green-600"/> Valor Hora/Aula
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl text-sm focus:border-green-500 outline-none font-bold text-slate-700 dark:text-white"
                    value={formData.valor}
                    onChange={e => setFormData({...formData, valor: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Dias da Semana</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`
                        flex-1 min-w-[70px] py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all
                        ${formData.dias.includes(day) 
                          ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200 dark:shadow-none transform scale-105' 
                          : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-500'}
                      `}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                {editingClass && (
                  <button 
                    type="button" 
                    onClick={handleDelete}
                    disabled={saving}
                    className="mr-auto text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-3 rounded-xl text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4"/> Excluir
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
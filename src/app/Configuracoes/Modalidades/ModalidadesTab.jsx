import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
// Novos Ícones para dar vida
import { 
  Dumbbell, Plus, Search, Edit2, Trash2, Power, 
  CheckCircle2, AlertTriangle, Loader2, Palette 
} from "lucide-react";

export function ModalidadesTab() {
  const { userData } = useAuth();

  // ========== BLINDAGENS ==========
  const role = useMemo(
    () => String(userData?.role || "").trim().toLowerCase(),
    [userData?.role]
  );

  const userId = useMemo(
    () => userData?.id || userData?.uid || null,
    [userData?.id, userData?.uid]
  );

  const podeVer = ["admin", "mentor", "unidade"].includes(role);
  const podeEditar = role === "admin"; // Só admin cria/edita modalidades

  // ========== STATE ==========
  const [loading, setLoading] = useState(true);
  const [modalidades, setModalidades] = useState([]);
  const [busca, setBusca] = useState(""); // Filtro de busca

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Modal/Form
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(null);

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#EC1C24"); // Vermelho Pratique Padrão
  const [status, setStatus] = useState("ativa");

  useEffect(() => {
    if (podeVer) carregar();
  }, [podeVer]);

  async function carregar() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "modalidades"));
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Ordenação alfabética
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      setModalidades(lista);
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  // Filtro de Busca
  const modalidadesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return modalidades.filter(m => m.nome.toLowerCase().includes(termo));
  }, [modalidades, busca]);

  // ========== UI HELPERS ==========
  function abrirNova() {
    if (!podeEditar) return;
    setEditando(null); 
    setNome(""); 
    setCor("#EC1C24"); // Reseta para vermelho padrão
    setStatus("ativa");
    setErro(""); setSucesso(""); setModalAberto(true);
  }

  function abrirEditar(m) {
    if (!podeEditar) return;
    setEditando(m); 
    setNome(m.nome); 
    setCor(m.cor || "#EC1C24"); // Carrega cor existente ou padrão
    setStatus(m.status);
    setErro(""); setSucesso(""); setModalAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!podeEditar || !nome.trim()) return setErro("Nome obrigatório.");

    try {
      setSalvando(true);
      setErro("");
      
      const payload = {
        nome: nome.trim(),
        cor: cor, // Salva a cor escolhida
        status,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: userId,
      };

      if (editando) {
        await updateDoc(doc(db, "modalidades", editando.id), payload);
        setSucesso("Modalidade atualizada!");
      } else {
        await addDoc(collection(db, "modalidades"), {
          ...payload,
          criadoEm: serverTimestamp(),
          criadoPor: userId,
        });
        setSucesso("Modalidade criada!");
      }

      await carregar();
      setTimeout(() => { setModalAberto(false); setSucesso(""); }, 1000);
    } catch (e) { setErro("Erro ao salvar."); } finally { setSalvando(false); }
  }

  async function alternarStatus(m) {
    if (!podeEditar) return;
    try {
      const novo = m.status === "ativa" ? "inativa" : "ativa";
      await updateDoc(doc(db, "modalidades", m.id), { status: novo });
      // Atualização Otimista (Local)
      setModalidades(prev => prev.map(item => item.id === m.id ? {...item, status: novo} : item));
    } catch (e) { alert("Erro ao mudar status"); }
  }

  async function excluir(m) {
    if (!podeEditar || !window.confirm(`Excluir ${m.nome}?`)) return;
    try {
      await deleteDoc(doc(db, "modalidades", m.id));
      setModalidades(prev => prev.filter(item => item.id !== m.id));
    } catch (e) { alert("Erro ao excluir"); }
  }

  if (!podeVer) return <div className="p-8 text-center text-slate-400">Sem acesso.</div>;

  return (
    <div className="p-6 animate-fade-in">
      
      {/* === HEADER === */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-red-600"/> Gestão de Modalidades
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {modalidadesFiltradas.length} aulas cadastradas
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Busca */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-9 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          
          {podeEditar && (
            <button 
              onClick={abrirNova}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-200 hover:bg-red-700 text-sm flex items-center gap-2 whitespace-nowrap transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4"/> Nova
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{erro}</div>}
      {sucesso && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{sucesso}</div>}

      {/* === GRID DE CARDS COMPACTOS === */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {modalidadesFiltradas.map((m) => (
            <div 
              key={m.id} 
              className={`
                group relative bg-white dark:bg-slate-800 border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between
                ${m.status === 'inativa' ? 'opacity-60 grayscale' : ''}
              `}
              // A Borda Colorida é definida aqui dinamicamente
              style={{ borderLeft: `5px solid ${m.cor || '#EC1C24'}` }}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 dark:text-white text-base truncate pr-2" title={m.nome}>
                  {m.nome}
                </h3>
                
                {/* Indicador de Status */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${m.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {m.status}
                </span>
              </div>

              {/* Linha da Cor (Visual) */}
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-3 h-3 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: m.cor || '#EC1C24' }}></div>
                 <span className="text-xs text-slate-400 font-mono">{m.cor || '#EC1C24'}</span>
              </div>

              {podeEditar && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button 
                    onClick={() => abrirEditar(m)} 
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  
                  <button 
                    onClick={() => alternarStatus(m)} 
                    className={`p-1.5 rounded-md transition-colors ${m.status === 'ativa' ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                    title={m.status === 'ativa' ? "Desativar" : "Ativar"}
                  >
                    <Power className="w-4 h-4"/>
                  </button>

                  <button 
                    onClick={() => excluir(m)} 
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {modalidadesFiltradas.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-20"/>
              <p className="text-sm">Nenhuma modalidade encontrada.</p>
            </div>
          )}
        </div>
      )}

      {/* === MODAL DE CADASTRO === */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700">
            
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                <Dumbbell className="w-6 h-6"/>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                    {editando ? "Editar Modalidade" : "Nova Modalidade"}
                </h3>
                <p className="text-xs text-slate-500">Defina o nome e a cor da aula.</p>
              </div>
            </div>

            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Nome da Modalidade</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none transition-all text-sm font-medium"
                  placeholder="Ex: Musculação, Pilates..."
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Palette className="w-3 h-3"/> Cor no Cronograma
                </label>
                <div className="flex items-center gap-3 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900">
                    <input 
                        type="color" 
                        value={cor} 
                        onChange={(e) => setCor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <span className="text-sm font-mono text-slate-600 dark:text-slate-300 uppercase">{cor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none text-sm"
                >
                  <option value="ativa">Ativa (Disponível)</option>
                  <option value="inativa">Inativa (Oculta)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
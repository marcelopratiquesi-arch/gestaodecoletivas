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
import { 
  Dumbbell, Plus, Search, Edit2, Trash2, Power, 
  CheckCircle2, AlertTriangle, Loader2, Palette, Maximize,
  X, Check, GripHorizontal
} from "lucide-react";

// ==========================================
// MOTOR DE POSICIONAMENTO E CORES (HSL Contínuo)
// ==========================================
const getCenterPos = (modalWidth, modalHeight) => {
    if (typeof window === 'undefined') return { x: 50, y: 50 };
    return { x: Math.max(10, (window.innerWidth - modalWidth) / 2), y: Math.max(10, (window.innerHeight - modalHeight) / 2) };
};

const getHSL = (hex) => {
    if (!hex) return { h: 0, s: 0, l: 0 };
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = parseInt(hex[1]+hex[1], 16); g = parseInt(hex[2]+hex[2], 16); b = parseInt(hex[3]+hex[3], 16); }
    else if (hex.length === 7) { r = parseInt(hex.substring(1,3), 16); g = parseInt(hex.substring(3,5), 16); b = parseInt(hex.substring(5,7), 16); }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s, l };
};

// ==========================================
// COMPONENTE: MODAL ARRASTÁVEL E REDIMENSIONÁVEL
// ==========================================
const ResizableModal = ({ isOpen, onClose, title, icon: Icon, pos, setPos, size, setSize, children, minW = 320, minH = 300, headerColor = "bg-[#1e293b] text-white border-slate-800" }) => {
    if (!isOpen) return null;

    const startTransform = (e, dir) => {
        e.stopPropagation(); e.preventDefault();
        const startX = e.clientX || e.touches?.[0].clientX;
        const startY = e.clientY || e.touches?.[0].clientY;
        const startW = size.w; const startH = size.h;
        const startPosX = pos.x; const startPosY = pos.y;

        const onMove = (moveEvent) => {
            const currentX = moveEvent.clientX || moveEvent.touches?.[0].clientX;
            const currentY = moveEvent.clientY || moveEvent.touches?.[0].clientY;
            const dx = currentX - startX; const dy = currentY - startY;

            let newW = startW, newH = startH, newX = startPosX, newY = startPosY;

            if (dir === 'drag') {
                newX = startPosX + dx; 
                newY = Math.max(0, startPosY + dy); 
            } else {
                if (dir.includes('e')) newW = startW + dx;
                if (dir.includes('s')) newH = startH + dy;
                if (dir.includes('w')) { newW = startW - dx; newX = startPosX + dx; }
                if (dir.includes('n')) { newH = startH - dy; newY = startPosY + dy; }
                if (newW < minW) { if (dir.includes('w')) newX = startPosX + (startW - minW); newW = minW; }
                if (newH < minH) { if (dir.includes('n')) newY = startPosY + (startH - minH); newH = minH; }
            }
            setPos({ x: newX, y: newY });
            if (dir !== 'drag') setSize({ w: newW, h: newH });
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        };

        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
    };

    return (
        <div className="fixed z-[300] bg-white dark:bg-slate-800 rounded-3xl shadow-[0_40px_100px_-15px_rgba(0,0,0,0.8)] border border-slate-300 dark:border-slate-700 flex flex-col uppercase" style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, position: 'fixed' }}>
            <div className={`p-4 border-b flex items-center justify-between cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-3xl ${headerColor}`} onMouseDown={(e) => startTransform(e, 'drag')} onTouchStart={(e) => startTransform(e, 'drag')}>
                <div className="flex items-center gap-3">
                    <GripHorizontal className="w-5 h-5 opacity-40"/>
                    <h3 className="text-xs font-black tracking-widest flex items-center gap-2">{Icon && <Icon className="w-4 h-4"/>} {title}</h3>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-black/20 rounded-full transition-colors" onMouseDown={e => e.stopPropagation()}><X className="w-4 h-4 text-white"/></button>
            </div>
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-3xl">
                {children}
            </div>
            <div className="absolute top-0 left-0 w-full h-2 cursor-n-resize" onMouseDown={(e) => startTransform(e, 'n')} />
            <div className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize" onMouseDown={(e) => startTransform(e, 's')} />
            <div className="absolute top-0 left-0 w-2 h-full cursor-w-resize" onMouseDown={(e) => startTransform(e, 'w')} />
            <div className="absolute top-0 right-0 w-2 h-full cursor-e-resize" onMouseDown={(e) => startTransform(e, 'e')} />
            <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10" onMouseDown={(e) => startTransform(e, 'nw')} />
            <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10" onMouseDown={(e) => startTransform(e, 'ne')} />
            <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10" onMouseDown={(e) => startTransform(e, 'sw')} />
            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" onMouseDown={(e) => startTransform(e, 'se')} />
        </div>
    );
};

export function ModalidadesTab() {
  const { userData } = useAuth();

  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid || null, [userData?.id, userData?.uid]);

  const podeVer = ["admin", "mentor", "unidade"].includes(role);
  const podeEditar = role === "admin"; 

  const [loading, setLoading] = useState(true);
  const [modalidades, setModalidades] = useState([]);
  const [busca, setBusca] = useState(""); 

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // ESTADOS DO MODAL ARRASTÁVEL
  const [modalAberto, setModalAberto] = useState(false);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ w: 400, h: 500 });
  
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(null);

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#EC1C24"); 
  const [status, setStatus] = useState("ativa");
  const [indiceOcupacao, setIndiceOcupacao] = useState(3);

  // ESTADOS DA EDIÇÃO INLINE
  const [editandoIndiceId, setEditandoIndiceId] = useState(null);
  const [indiceInline, setIndiceInline] = useState("");

  const registrarLogAuditoria = async (tipoAcao, descricao, nomeMod, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao, descricao: `Modalidade: ${descricao}`, diffExtras: detalhes, modulo: 'CONFIGURACOES',
              unidadeNome: 'Base Global', professorNome: '-', modalidadeNome: nomeMod || '-', 
              usuarioAcaoNome: nomeUsuario, usuarioAcaoId: userId, dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  useEffect(() => {
    if (podeVer) carregar();
  }, [podeVer]);

  async function carregar() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "modalidades"));
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // 🟢 NOVO MOTOR DE CORES: Correção do vermelho (0 e 360) e agrupamento perfeito HSL
      lista.sort((a, b) => {
        let hslA = getHSL(a.cor || '#EC1C24');
        let hslB = getHSL(b.cor || '#EC1C24');
        
        let hA = hslA.h; let hB = hslB.h;
        if (hA > 330) hA -= 360; 
        if (hB > 330) hB -= 360; 

        if (Math.abs(hA - hB) > 15) return hA - hB;
        return hslB.l - hslA.l; // Se o tom for parecido, ordena pelo mais claro/escuro
      });

      setModalidades(lista);
    } catch (e) { setErro("Erro ao carregar dados."); } finally { setLoading(false); }
  }

  const modalidadesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return modalidades.filter(m => m.nome.toLowerCase().includes(termo));
  }, [modalidades, busca]);

  function abrirNova() {
    if (!podeEditar) return;
    setEditando(null); setNome(""); setCor("#EC1C24"); setStatus("ativa"); setIndiceOcupacao(3);
    setModalPos(getCenterPos(400, 500));
    setModalSize({ w: 400, h: 500 });
    setErro(""); setSucesso(""); setModalAberto(true);
  }

  function abrirEditar(m) {
    if (!podeEditar) return;
    setEditando(m); setNome(m.nome); setCor(m.cor || "#EC1C24"); setStatus(m.status); 
    setIndiceOcupacao(m.indiceOcupacao || 3); 
    setModalPos(getCenterPos(400, 500));
    setModalSize({ w: 400, h: 500 });
    setErro(""); setSucesso(""); setModalAberto(true);
  }

  // 🟢 SALVAMENTO INLINE DO ÍNDICE DE OCUPAÇÃO
  async function salvarIndiceInline(m) {
      if (!indiceInline) return;
      const novoValor = Number(indiceInline);
      try {
          await updateDoc(doc(db, "modalidades", m.id), { indiceOcupacao: novoValor });
          await registrarLogAuditoria('ALTERADA', 'Edição inline de Metragem M²', m.nome, `${m.indiceOcupacao || 3} ➔ ${novoValor}`);
          setModalidades(prev => prev.map(item => item.id === m.id ? {...item, indiceOcupacao: novoValor} : item));
          setEditandoIndiceId(null);
      } catch (e) { alert("Erro ao salvar m²"); }
  }

  async function salvar(e) {
    e.preventDefault();
    if (!podeEditar || !nome.trim()) return setErro("Nome obrigatório.");

    try {
      setSalvando(true);
      setErro("");
      
      const payload = {
        nome: nome.trim(), cor, status, indiceOcupacao: Number(indiceOcupacao), 
        atualizadoEm: serverTimestamp(), atualizadoPor: userId,
      };

      if (editando) {
        let mudancas = [];
        if (editando.nome !== nome.trim()) mudancas.push(`Nome: ${editando.nome} ➔ ${nome.trim()}`);
        if (editando.cor !== cor) mudancas.push(`Cor: ${editando.cor || '#EC1C24'} ➔ ${cor}`);
        if (editando.status !== status) mudancas.push(`Status: ${editando.status} ➔ ${status}`);
        if (Number(editando.indiceOcupacao) !== Number(indiceOcupacao)) mudancas.push(`Espaço m²: ${editando.indiceOcupacao || 3} ➔ ${indiceOcupacao}`);

        await updateDoc(doc(db, "modalidades", editando.id), payload);
        if (mudancas.length > 0) await registrarLogAuditoria('ALTERADA', 'Dados da modalidade atualizados.', nome.trim(), mudancas.join(' | '));
        setSucesso("Modalidade atualizada!");
      } else {
        await addDoc(collection(db, "modalidades"), { ...payload, criadoEm: serverTimestamp(), criadoPor: userId });
        await registrarLogAuditoria('NOVA', 'Nova modalidade cadastrada.', nome.trim(), `Cor definida: ${cor} | Espaço: ${indiceOcupacao}m²`);
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
      await registrarLogAuditoria('ALTERADA', `Status modificado para ${novo.toUpperCase()}`, m.nome, `Alteração rápida de visibilidade na grade`);
      setModalidades(prev => prev.map(item => item.id === m.id ? {...item, status: novo} : item));
    } catch (e) { alert("Erro ao mudar status"); }
  }

  async function excluir(m) {
    if (!podeEditar || !window.confirm(`Excluir ${m.nome}?`)) return;
    try {
      await deleteDoc(doc(db, "modalidades", m.id));
      await registrarLogAuditoria('EXCLUÍDA', 'Modalidade apagada do sistema.', m.nome, 'Ação definitiva.');
      setModalidades(prev => prev.filter(item => item.id !== m.id));
    } catch (e) { alert("Erro ao excluir"); }
  }

  if (!podeVer) return <div className="p-8 text-center text-slate-400">Sem acesso.</div>;

  return (
    <div className="p-6 animate-fade-in max-w-[1200px] mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20"><Dumbbell className="w-6 h-6"/></span>
            Gestão de Modalidades
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            Catálogo global de aulas coletivas ordenado por espectro de cores.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar modalidade..." 
              className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none shadow-sm transition-all uppercase"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          
          {podeEditar && (
            <button onClick={abrirNova} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold uppercase tracking-wide shadow-lg shadow-red-500/20 hover:bg-red-700 text-xs flex items-center gap-2 whitespace-nowrap transition-transform active:scale-95 h-full">
              <Plus className="w-4 h-4"/> Nova
            </button>
          )}
        </div>
      </div>

      {erro && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5"/>{erro}</div>}
      {sucesso && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/>{sucesso}</div>}

      {loading ? (
        <div className="flex flex-col gap-3">
           {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"/>)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {modalidadesFiltradas.map((m) => (
            <div 
              key={m.id} 
              className={`
                group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4
                ${m.status === 'inativa' ? 'opacity-60 grayscale' : ''}
              `}
              style={{ borderLeft: `6px solid ${m.cor || '#EC1C24'}` }}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-full shadow-inner border border-black/10 shrink-0" style={{ backgroundColor: m.cor || '#EC1C24' }}></div>
                
                <div className="flex flex-col">
                    <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight truncate pr-2">
                        {m.nome}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">{m.cor || '#EC1C24'}</span>
                    </div>
                </div>
              </div>

              {/* 🟢 EDIÇÃO INLINE DA METRAGEM COLOCADA EM DESTAQUE */}
              <div className="flex items-center mx-auto md:mx-0">
                  {editandoIndiceId === m.id ? (
                      <div className="flex items-center gap-1 animate-in fade-in bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                          <Maximize className="w-4 h-4 text-blue-500 ml-1"/>
                          <input 
                              autoFocus type="number" step="0.5" 
                              className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded text-sm font-black outline-none w-20 text-slate-800 dark:text-white" 
                              value={indiceInline} onChange={(e) => setIndiceInline(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && salvarDadoInline(m)} placeholder="m²" 
                          />
                          <button onClick={() => salvarDadoInline(m)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"><Check className="w-4 h-4"/></button>
                          <button onClick={() => setEditandoIndiceId(null)} className="p-1.5 bg-slate-300 text-slate-600 rounded hover:bg-slate-400 transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                  ) : (
                      <div 
                          onClick={() => { if(!podeEditar) return; setEditandoIndiceId(m.id); setIndiceInline(m.indiceOcupacao || 3); }} 
                          className={`flex items-center gap-2 p-2 rounded-lg w-fit group/edit text-blue-600 dark:text-blue-400 transition-colors ${podeEditar ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800' : ''}`}
                          title={podeEditar ? "Clique para editar o espaço por aluno" : ""}
                      >
                          <Maximize className="w-4 h-4 opacity-70"/>
                          <span className="text-sm font-black uppercase tracking-widest">{m.indiceOcupacao || 3} <span className="text-[10px] font-bold">m²/aluno</span></span>
                          {podeEditar && <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 ml-1 transition-opacity"/>}
                      </div>
                  )}
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-700 md:border-t-0">
                  <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${m.status === 'ativa' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                      {m.status}
                  </span>

                  {podeEditar && (
                    <div className="flex items-center gap-1.5 md:border-l border-slate-200 dark:border-slate-700 md:pl-5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEditar(m)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors" title="Editar Completo">
                            <Edit2 className="w-4 h-4"/>
                        </button>
                        <button onClick={() => alternarStatus(m)} className={`p-2 rounded-xl transition-colors ${m.status === 'ativa' ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'}`} title={m.status === 'ativa' ? "Desativar" : "Ativar"}>
                            <Power className="w-4 h-4"/>
                        </button>
                        <button onClick={() => excluir(m)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors" title="Excluir Definitivamente">
                            <Trash2 className="w-4 h-4"/>
                        </button>
                    </div>
                  )}
              </div>
            </div>
          ))}
          
          {modalidadesFiltradas.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20"/>
              <p className="text-sm font-bold uppercase tracking-widest">Nenhuma modalidade encontrada.</p>
            </div>
          )}
        </div>
      )}

      {/* 🟢 O MODAL REDIMENSIONÁVEL */}
      <ResizableModal 
          isOpen={modalAberto} onClose={() => setModalAberto(false)} 
          title={editando ? "Editar Modalidade" : "Nova Modalidade"} icon={Dumbbell} headerColor="bg-red-50 dark:bg-slate-900 text-red-600 dark:text-red-500 border-red-100 dark:border-slate-800"
          pos={modalPos} setPos={setModalPos} size={modalSize} setSize={setModalSize} minW={320} minH={450}
      >
        <form onSubmit={salvar} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-800">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nome da Modalidade</label>
            <input
              type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm font-bold uppercase"
              placeholder="Ex: FIT DANCE..." autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Maximize className="w-3 h-3"/> Espaço (m²/aluno)
                </label>
                <input 
                    type="number" step="0.5" min="1" 
                    value={indiceOcupacao} onChange={(e) => setIndiceOcupacao(e.target.value)} 
                    className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm font-black" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3"/> Cor no Radar
                </label>
                <div className="flex items-center justify-between px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 h-[50px]">
                    <input 
                        type="color" value={cor} onChange={(e) => setCor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase">{cor}</span>
                </div>
              </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Status Inicial</label>
            <select
              value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none text-sm font-bold uppercase appearance-none"
            >
              <option value="ativa">🟢 ATIVA (VISÍVEL)</option>
              <option value="inativa">🔴 INATIVA (OCULTA)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs uppercase tracking-widest">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="flex-[1.5] py-3.5 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest shadow-lg shadow-red-500/30 hover:bg-red-700 transition-transform active:scale-95 flex items-center justify-center gap-2 text-xs">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Salvar Modalidade"}
            </button>
          </div>
        </form>
      </ResizableModal>
    </div>
  );
}
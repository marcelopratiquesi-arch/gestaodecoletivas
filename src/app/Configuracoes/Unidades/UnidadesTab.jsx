import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc, writeBatch, onSnapshot, getDocs
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut, signInWithEmailAndPassword, updateEmail } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db } from "../../../services/firebase";
import { useTranslation } from "react-i18next"; 

import { 
    Building2, MapPin, Edit2, Trash2, AlertTriangle, CheckCircle2, 
    Loader2, User, Search, Mail, Lock, Globe, Key, ChevronDown, ChevronUp, Ban, PowerOff, Plus, X, Phone, Check,
    Map, Maximize, GripHorizontal, Upload, FileSpreadsheet, ShieldAlert
} from "lucide-react";

// 🌍 PADRÃO OURO INTERNACIONAL
const PAIS_CONFIG = {
  BR: {
    id: "BR", nome: "Brasil", ddi: "+55",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
  },
  AR: {
    id: "AR", nome: "Argentina", ddi: "+54",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800"
  },
  US: {
    id: "US", nome: "Estados Unidos", ddi: "+1",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800"
  },
};

const PAISES = Object.values(PAIS_CONFIG);
const DDI_MAP = Object.fromEntries(PAISES.map(p => [p.id, p.ddi]));
const PAIS_DEFAULT = "BR";

/* ================= LOCALIZAÇÕES (Mapeadas para as Siglas) ================= */
const LOCATIONS = {
  "BR": [
    "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
    "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
    "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
    "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
    "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"
  ],
  "AR": [
    "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
    "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", 
    "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", 
    "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
  ],
  "US": [
    "Florida (Miami)", "California", "New York", "Texas", "Nevada", "Illinois", 
    "Pennsylvania", "Ohio", "Georgia", "North Carolina", "Michigan", "New Jersey"
  ]
};

// 🟢 ÍCONES DE BANDEIRA EM SVG PURO
function FlagIcon({ pais, className = "w-4 h-3" }) {
  const wrapClass = `${className} rounded-[2px] ring-1 ring-black/10 shrink-0 overflow-hidden inline-block align-middle`;

  if (pais === "BR") {
    return (
      <svg viewBox="0 0 20 14" className={wrapClass} preserveAspectRatio="xMidYMid slice">
        <rect width="20" height="14" fill="#009739"/>
        <polygon points="10,2 18,7 10,12 2,7" fill="#FEDD00"/>
        <circle cx="10" cy="7" r="3.1" fill="#012169"/>
      </svg>
    );
  }
  if (pais === "AR") {
    return (
      <svg viewBox="0 0 20 14" className={wrapClass} preserveAspectRatio="xMidYMid slice">
        <rect width="20" height="14" fill="#ffffff"/>
        <rect width="20" height="4.66" y="0" fill="#75AADB"/>
        <rect width="20" height="4.66" y="9.34" fill="#75AADB"/>
        <circle cx="10" cy="7" r="1.5" fill="#F6B40E" stroke="#85340A" strokeWidth="0.15"/>
      </svg>
    );
  }
  if (pais === "US") {
    return (
      <svg viewBox="0 0 20 14" className={wrapClass} preserveAspectRatio="xMidYMid slice">
        <rect width="20" height="14" fill="#B22234"/>
        <rect y="1.077" width="20" height="1.077" fill="#fff"/>
        <rect y="3.231" width="20" height="1.077" fill="#fff"/>
        <rect y="5.385" width="20" height="1.077" fill="#fff"/>
        <rect y="7.538" width="20" height="1.077" fill="#fff"/>
        <rect y="9.692" width="20" height="1.077" fill="#fff"/>
        <rect y="11.846" width="20" height="1.077" fill="#fff"/>
        <rect width="8" height="7.538" fill="#3C3B6E"/>
      </svg>
    );
  }
  return null;
}

// ==========================================
// 🟢 MÁSCARAS INTELIGENTES DE TELEFONE
// ==========================================
const formatarTelefone = (valor, pais = PAIS_DEFAULT) => {
    if (!valor) return "";
    let v = valor.replace(/\D/g, ''); 
    
    if (pais === 'BR') {
        if (v.startsWith('55')) v = v.slice(2);
        v = v.slice(0, 11); 
        if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        if (v.length > 7) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        return v;
    } 
    
    if (pais === 'US') {
        if (v.startsWith('1') && v.length > 10) v = v.slice(1);
        v = v.slice(0, 10);
        if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, '($1) $2');
        if (v.length > 6) v = v.replace(/^(\(\d{3}\)\s\d{3})(\d)/, '$1-$2');
        return v;
    }

    if (pais === 'AR') {
        if (v.startsWith('54')) v = v.slice(2);
        v = v.slice(0, 11); 
        if (v.length > 1) v = v.replace(/^(\d{1})(\d)/, '$1 $2');
        if (v.length > 3) v = v.replace(/^(\d{1})\s(\d{2})(\d)/, '$1 $2 $3');
        if (v.length > 7) v = v.replace(/^(\d{1})\s(\d{2})\s(\d{4})(\d)/, '$1 $2 $3-$4');
        return v;
    }

    return v;
};

const getPhonePlaceholder = (pais = PAIS_DEFAULT) => {
    if (pais === 'US') return "(000) 000-0000";
    if (pais === 'AR') return "9 11 0000-0000";
    return "(00) 00000-0000";
};

const getCenterPos = (modalWidth, modalHeight) => {
    if (typeof window === 'undefined') return { x: 50, y: 50 };
    return { 
        x: Math.max(10, (window.innerWidth - modalWidth) / 2), 
        y: Math.max(10, (window.innerHeight - modalHeight) / 2) 
    };
};

const getValidUrl = (url) => {
    if (!url) return "#";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
};

// ==========================================
// JANELA FLUTUANTE
// ==========================================
const ResizableModal = ({ isOpen, onClose, title, icon: Icon, pos, setPos, size, setSize, children, minW = 400, minH = 400, headerColor = "bg-[#1e293b] text-white border-slate-800" }) => {
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
        <div className="fixed z-[300] bg-white dark:bg-slate-800 rounded-3xl shadow-[0_40px_100px_-15px_rgba(0,0,0,0.8)] border border-slate-300 dark:border-slate-700 flex flex-col" style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, position: 'fixed' }}>
            <div className={`p-4 border-b flex items-center justify-between cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-3xl ${headerColor}`} onMouseDown={(e) => startTransform(e, 'drag')} onTouchStart={(e) => startTransform(e, 'drag')}>
                <div className="flex items-center gap-3">
                    <GripHorizontal className="w-5 h-5 opacity-40"/>
                    <h3 className="text-sm font-black tracking-widest flex items-center gap-2 uppercase">
                        {Icon && <Icon className="w-4 h-4"/>} {title}
                    </h3>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-black/20 rounded-full transition-colors" onMouseDown={e => e.stopPropagation()}>
                    <X className="w-5 h-5 text-white"/>
                </button>
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

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export function UnidadesTab() {
  const { userData } = useAuth();
  const { t } = useTranslation(); 
  
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userName = useMemo(() => userData?.nome || t('home.roles.mentor', 'Mentor'), [userData, t]);
  const podeAcessar = role === "admin" || role === "mentor";

  const [unidadesBase, setUnidadesBase] = useState([]);
  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [mentorFiltro, setMentorFiltro] = useState("");
  const [paisFiltro, setPaisFiltro] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: 'nome', direction: 'asc' });
  
  const [modalUnidadeAberto, setModalUnidadeAberto] = useState(false);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ w: 800, h: 720 }); // Aumentado um pouco para comportar os 3 cards
  
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [editando, setEditando] = useState(null);
  const [pais, setPais] = useState(PAIS_DEFAULT);
  const [estado, setEstado] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativa");
  
  // 🟢 NOVOS ESTADOS PARA O MODAL DE ESTRUTURA
  const [linkMaps, setLinkMaps] = useState("");
  const [metragem, setMetragem] = useState("");
  const [endereco, setEndereco] = useState(""); 

  const [editandoTelefoneId, setEditandoTelefoneId] = useState(null);
  const [telefoneInline, setTelefoneInline] = useState("");
  const [editandoMetragemId, setEditandoMetragemId] = useState(null);
  const [metragemInline, setMetragemInline] = useState("");
  const [editandoEnderecoId, setEditandoEnderecoId] = useState(null);
  const [enderecoInline, setEnderecoInline] = useState("");
  const [editandoMapaId, setEditandoMapaId] = useState(null);
  const [mapaInline, setMapaInline] = useState("");

  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("123456");

  const fileInputRef = useRef(null);
  const [importModalAberto, setImportModalAberto] = useState(false);
  const [importData, setImportData] = useState({ matches: [], unmatches: [] });
  const [importPos, setImportPos] = useState({ x: 0, y: 0 });
  const [importSize, setImportSize] = useState({ w: 1000, h: 700 });
  const [importando, setImportando] = useState(false);

  const estadosDisponiveis = pais ? LOCATIONS[pais] || [] : [];

  const registrarLogAuditoria = async (tipoAcao, descricao, nomeUnidade, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao, descricao, diffExtras: detalhes, modulo: 'CONFIGURACOES', 
              unidadeNome: nomeUnidade || '-', professorNome: '-', modalidadeNome: '-', 
              usuarioAcaoNome: nomeUsuario, usuarioAcaoId: userId, dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  useEffect(() => { 
    if (!podeAcessar) return;
    setLoading(true);
    
    const ref = collection(db, "unidades");
    const qUnidades = role === "admin" ? ref : query(ref, where("mentorId", "==", userId));
    
    const unsubUnidades = onSnapshot(qUnidades, (snap) => {
        setUnidadesBase(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });

    let unsubMentores = () => {};
    if (role === "admin") {
        const qm = query(collection(db, "usuarios"), where("role", "==", "mentor"));
        unsubMentores = onSnapshot(qm, (snap) => {
            setMentores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }
    return () => { unsubUnidades(); unsubMentores(); };
  }, [role, userId, podeAcessar]);

  useEffect(() => {
    if (!editando && modalUnidadeAberto && nome) {
      try {
        const slug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); 
        if (slug.length > 0) setEmailLogin(`${slug}@pratique.com`);
        else setEmailLogin("");
      } catch (error) {}
    }
  }, [nome, editando, modalUnidadeAberto]);

  const unidadesProcessadas = useMemo(() => {
      let resultado = unidadesBase;
      if (estadoFiltro) resultado = resultado.filter(u => u.estado === estadoFiltro);
      if (mentorFiltro) resultado = resultado.filter(u => u.mentorId === mentorFiltro);
      
      if (paisFiltro) {
          resultado = resultado.filter(u => {
              const uPais = u.pais || PAIS_DEFAULT;
              if (uPais === "Brasil" && paisFiltro === "BR") return true;
              if (uPais === "Argentina" && paisFiltro === "AR") return true;
              if (uPais === "Estados Unidos" && paisFiltro === "US") return true;
              return uPais === paisFiltro;
          });
      }

      if (busca.trim()) {
          const termo = busca.toLowerCase();
          resultado = resultado.filter(u => 
              (u.nome || "").toLowerCase().includes(termo) || (u.email || "").toLowerCase().includes(termo) ||
              (u.estado || "").toLowerCase().includes(termo) || (u.telefone || "").toLowerCase().includes(termo)
          );
      }
      return resultado.sort((a, b) => {
          let valA = (a[sortConfig.field] || "").toLowerCase(); let valB = (b[sortConfig.field] || "").toLowerCase();
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [unidadesBase, busca, estadoFiltro, mentorFiltro, paisFiltro, sortConfig]);

  const handleSort = (field) => { setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' })); };
  const SortIcon = ({ field }) => {
      if (sortConfig.field !== field) return <div className="w-4 h-4 opacity-20"><ChevronDown className="w-3 h-3"/></div>;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-red-500"/> : <ChevronDown className="w-3 h-3 text-red-500"/>;
  };

  const kpis = useMemo(() => {
      const ativas = unidadesBase.filter(u => u.status === 'ativa').length;
      return { total: unidadesBase.length, ativas, inativas: unidadesBase.length - ativas };
  }, [unidadesBase]);

  async function salvarDadoInline(unidade, campo, valorNovo, labelAuditoria) {
      if (valorNovo === null || valorNovo === undefined) return;
      try {
          const valorAntigo = unidade[campo] || "Vazio";
          await updateDoc(doc(db, "unidades", unidade.id), { [campo]: valorNovo });
          if (campo === 'telefone' && unidade.uidLogin) {
              await updateDoc(doc(db, "usuarios", unidade.uidLogin), { telefone: valorNovo }).catch(()=>{});
          }
          if (String(valorAntigo) !== String(valorNovo)) {
              await registrarLogAuditoria('ALTERADA', `Edição inline de ${labelAuditoria}`, unidade.nome, `${valorAntigo} ➔ ${valorNovo}`);
          }
          return true;
      } catch (error) { alert(`Erro ao salvar ${labelAuditoria}.`); return false; }
  }

  const normalizarNome = (str) => {
      if (!str) return "";
      return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target.result;
          const lines = text.split('\n');
          if (lines.length < 2) return alert("Arquivo CSV vazio ou inválido.");

          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const matches = [];
          const unmatches = [];

          for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const rowRaw = lines[i].split(regex).map(v => v.replace(/^"|"$/g, '').trim());
              
              const csvNome = rowRaw[1]; 
              const csvEndereco = rowRaw[4] && rowRaw[4] !== 'NULL' ? rowRaw[4] : ""; 
              const lat = rowRaw[8]; 
              const lng = rowRaw[9]; 
              
              if (!csvNome) continue;

              const normCsv = normalizarNome(csvNome);
              
              let matchDb = unidadesBase.find(u => {
                  const normDb = normalizarNome(u.nome);
                  return normCsv.includes(normDb) || normDb.includes(normCsv);
              });

              let linkMaps = "";
              if (lat && lng && lat !== 'NULL' && lng !== 'NULL') {
                  linkMaps = `http://googleusercontent.com/maps.google.com/?q=${lat},${lng}`; 
              }
              
              if (!csvEndereco && !linkMaps) continue;

              if (matchDb) {
                  if (matchDb.enderecoCompleto === csvEndereco && matchDb.linkGoogleMaps === linkMaps) {
                      continue;
                  }

                  matches.push({
                      dbId: matchDb.id,
                      dbNome: matchDb.nome,
                      csvNome: csvNome,
                      novoEndereco: csvEndereco,
                      novoLinkMaps: linkMaps,
                      enderecoAtual: matchDb.enderecoCompleto || "",
                      mapaAtual: matchDb.linkGoogleMaps || "",
                      status: 'pendente' 
                  });
              } else {
                  unmatches.push({ csvNome, novoEndereco: csvEndereco, novoLinkMaps: linkMaps });
              }
          }

          setImportData({ matches, unmatches });
          setImportPos(getCenterPos(1000, 700));
          setImportSize({ w: 1000, h: 700 });
          setImportModalAberto(true);
      };
      reader.readAsText(file);
      e.target.value = ''; 
  };

  const handleRematch = (index, novoDbId) => {
      const newMatches = [...importData.matches];
      const selectedDbUnit = unidadesBase.find(u => u.id === novoDbId);
      if (selectedDbUnit) {
          newMatches[index].dbId = selectedDbUnit.id;
          newMatches[index].dbNome = selectedDbUnit.nome;
          newMatches[index].enderecoAtual = selectedDbUnit.enderecoCompleto || "";
          newMatches[index].mapaAtual = selectedDbUnit.linkGoogleMaps || "";
      }
      setImportData({...importData, matches: newMatches});
  };

  const aprovarItem = async (item, index) => {
      if (!item.dbId) return alert("Selecione uma unidade do sistema para vincular primeiro.");
      try {
          const ref = doc(db, "unidades", item.dbId);
          let updateData = {};
          
          if (item.novoEndereco) updateData.enderecoCompleto = item.novoEndereco;
          if (item.novoLinkMaps) updateData.linkGoogleMaps = item.novoLinkMaps;

          await updateDoc(ref, updateData);
          await registrarLogAuditoria('IMPORTAÇÃO', 'Endereço/Mapa injetado via CSV.', item.dbNome, `Endereço Injetado: ${item.novoEndereco}`);

          const newMatches = [...importData.matches];
          newMatches[index].status = 'aprovado';
          setImportData({...importData, matches: newMatches});
      } catch (error) { alert("Erro ao injetar na unidade " + item.dbNome); }
  };

  const descartarItem = (index) => {
      const newMatches = [...importData.matches];
      newMatches[index].status = 'descartado';
      setImportData({...importData, matches: newMatches});
  };

  const aprovarTodosPendentes = async () => {
      setImportando(true);
      try {
          const pendentes = importData.matches.filter(m => m.status === 'pendente' && m.dbId);
          if (pendentes.length === 0) return setImportando(false);

          const batch = writeBatch(db);
          let count = 0;

          pendentes.forEach(item => {
              const ref = doc(db, "unidades", item.dbId);
              let updateData = {};
              if (item.novoEndereco) updateData.enderecoCompleto = item.novoEndereco;
              if (item.novoLinkMaps) updateData.linkGoogleMaps = item.novoLinkMaps;
              batch.update(ref, updateData);
              count++;
          });

          await batch.commit();
          await registrarLogAuditoria('IMPORTAÇÃO', 'Injeção em Lote via CSV aprovada.', 'Várias', `${count} unidades atualizadas.`);
          
          const newMatches = importData.matches.map(m => (m.status === 'pendente' && m.dbId) ? {...m, status: 'aprovado'} : m);
          setImportData({...importData, matches: newMatches});
      } catch (e) { alert("Erro ao processar lote."); } finally { setImportando(false); }
  };

  function abrirNovaUnidade() {
    setEditando(null); setPais(PAIS_DEFAULT); setEstado(""); setNome(""); setTelefone(""); setStatus("ativa");
    setLinkMaps(""); setMetragem(""); setEndereco(""); 
    setEmailLogin(""); setSenhaLogin("123456");
    if (role === 'mentor') setMentorId(userId); else setMentorId("");
    setErro(""); setSucesso("");
    setModalPos(getCenterPos(800, 700)); setModalSize({ w: 800, h: 700 }); 
    setModalUnidadeAberto(true);
  }

  function abrirEditarUnidade(u) {
    let uPaisCorrigido = u.pais || PAIS_DEFAULT;
    if (uPaisCorrigido === "Brasil") uPaisCorrigido = "BR";
    if (uPaisCorrigido === "Argentina") uPaisCorrigido = "AR";
    if (uPaisCorrigido === "Estados Unidos") uPaisCorrigido = "US";

    setEditando(u); setPais(uPaisCorrigido); setEstado(u.estado || ""); setNome(u.nome || ""); 
    setTelefone(formatarTelefone(u.telefone || "", uPaisCorrigido)); setStatus(u.status || "ativa"); setMentorId(u.mentorId || "");
    setLinkMaps(u.linkGoogleMaps || ""); 
    setMetragem(u.metragemSalaColetiva || ""); 
    setEndereco(u.enderecoCompleto || ""); 
    
    setEmailLogin(u.email || ""); setSenhaLogin("");
    
    setErro(""); setSucesso("");
    setModalPos(getCenterPos(800, 700)); setModalSize({ w: 800, h: 700 }); 
    setModalUnidadeAberto(true);
  }

  async function salvarUnidade(e) {
    e.preventDefault();
    setErro(""); setSucesso(""); setSalvando(true);

    if (!nome.trim() || !telefone.trim() || !estado || !mentorId) { 
        setSalvando(false); return setErro(t('unitsTab.messages.nameRequired', 'Preencha os campos obrigatórios.')); 
    }
    if (!emailLogin.includes("@")) { 
        setSalvando(false); return setErro(t('unitsTab.messages.invalidEmail', 'E-mail inválido.')); 
    }
    if (!editando && senhaLogin.length < 6) { 
        setSalvando(false); return setErro(t('unitsTab.messages.weakPassword', 'Senha mín. 6 dígitos.')); 
    }

    let telParaSalvar = telefone.trim();
    if (pais === 'BR' && !telParaSalvar.startsWith('+')) telParaSalvar = `+55 ${telParaSalvar}`;
    if (pais === 'AR' && !telParaSalvar.startsWith('+')) telParaSalvar = `+54 ${telParaSalvar}`;
    if (pais === 'US' && !telParaSalvar.startsWith('+')) telParaSalvar = `+1 ${telParaSalvar}`;

    let secondaryApp = null;
    try {
      if (editando) {
        let mudancas = [];
        let emailAlteradoFirebase = false;
        const novoEmail = emailLogin.trim().toLowerCase();
        const emailAntigo = editando.email || "";

        if (novoEmail !== emailAntigo) {
            try {
                if (editando.uidLogin && editando.senhaPainel) {
                    secondaryApp = initializeApp(getApp().options, "SecondaryAppEmailUpdate");
                    const secondaryAuth = getAuth(secondaryApp);
                    await signInWithEmailAndPassword(secondaryAuth, emailAntigo, editando.senhaPainel);
                    await updateEmail(secondaryAuth.currentUser, novoEmail);
                    await signOut(secondaryAuth);
                    emailAlteradoFirebase = true;
                }
                mudancas.push(`Login E-mail: ${emailAntigo} ➔ ${novoEmail}`);
            } catch (authErr) {
                console.error(authErr);
                mudancas.push(`Aviso: E-mail alterado só no BD. Erro Auth: ${authErr.message}`);
            }
        }

        if (editando.nome !== nome.trim()) mudancas.push(`Nome: ${editando.nome} ➔ ${nome.trim()}`);
        if (editando.telefone !== telParaSalvar) mudancas.push(`WhatsApp: ${editando.telefone || 'Sem tel'} ➔ ${telParaSalvar}`);
        if (editando.estado !== estado) mudancas.push(`Estado: ${editando.estado || '-'} ➔ ${estado}`);
        if (editando.pais !== pais) mudancas.push(`País: ${editando.pais || '-'} ➔ ${pais}`);
        if (editando.status !== status) mudancas.push(`Status: ${editando.status} ➔ ${status}`);
        
        if ((editando.linkGoogleMaps || "") !== linkMaps.trim()) mudancas.push(`Link Maps: ${editando.linkGoogleMaps || 'Vazio'} ➔ ${linkMaps.trim() || 'Vazio'}`);
        if (String(editando.metragemSalaColetiva || '') !== String(metragem).trim()) mudancas.push(`Metragem: ${editando.metragemSalaColetiva || 'Vazia'} ➔ ${metragem || 'Vazia'}`);
        if ((editando.enderecoCompleto || "") !== endereco.trim()) mudancas.push(`Endereço: ${editando.enderecoCompleto || 'Vazio'} ➔ ${endereco.trim() || 'Vazio'}`);

        if (editando.mentorId !== mentorId) {
            const mAntigo = mentores.find(m => m.id === editando.mentorId)?.nome || 'Sem Mentor';
            const mNovo = mentores.find(m => m.id === mentorId)?.nome || 'Sem Mentor';
            mudancas.push(`Mentor: ${mAntigo} ➔ ${mNovo}`);
        }

        await updateDoc(doc(db, "unidades", editando.id), { 
            pais, estado, nome: nome.trim(), telefone: telParaSalvar, status, mentorId, 
            email: novoEmail, 
            linkGoogleMaps: linkMaps.trim(), 
            metragemSalaColetiva: metragem ? Number(metragem) : null,
            enderecoCompleto: endereco.trim(),
            atualizadoEm: serverTimestamp() 
        });
        
        if(editando.uidLogin) { 
            try { 
                await updateDoc(doc(db, "usuarios", editando.uidLogin), { 
                    telefone: telParaSalvar,
                    email: novoEmail 
                }); 
            } catch(err){} 
        }
        
        if (mudancas.length > 0) await registrarLogAuditoria('ALTERADA', 'Dados cadastrais atualizados.', nome.trim(), mudancas.join('\n'));
        
        setSucesso(emailAlteradoFirebase ? "Unidade e Login Google Atualizados!" : t('unitsTab.messages.updated', "Unidade atualizada!"));

      } else {
        secondaryApp = initializeApp(getApp().options, "SecondaryAppUnitCreate");
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(secondaryAuth, emailLogin.trim().toLowerCase(), senhaLogin);
        const newUid = userCred.user.uid;

        const unidadeRef = await addDoc(collection(db, "unidades"), {
          pais, estado, nome: nome.trim(), telefone: telParaSalvar, status, mentorId, 
          uidLogin: newUid, email: emailLogin.trim().toLowerCase(), 
          linkGoogleMaps: linkMaps.trim(), 
          metragemSalaColetiva: metragem ? Number(metragem) : null, 
          enderecoCompleto: endereco.trim(), 
          senhaPainel: senhaLogin, 
          criadoPor: userId, criadoEm: serverTimestamp()
        });

        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome.trim(), email: emailLogin.trim().toLowerCase(), telefone: telParaSalvar,
          role: "unidade", unidadeId: unidadeRef.id, status: "ativo", criadoPor: userId, criadoEm: serverTimestamp()
        });

        await signOut(secondaryAuth);
        const mNome = mentores.find(m => m.id === mentorId)?.nome || 'Sem Mentor';
        await registrarLogAuditoria('NOVA', 'Nova unidade e credenciais criadas.', nome.trim(), `Local: ${estado} | Mentor: ${mNome}`);
        setSucesso(t('unitsTab.messages.created', "Unidade e Acesso criados!"));
      }
      setTimeout(() => { setModalUnidadeAberto(false); setSucesso(""); }, 1500);
    } catch (e) { 
      if (e.code === 'auth/email-already-in-use') setErro(t('unitsTab.messages.emailExists', "E-mail já existe."));
      else setErro("Erro: " + e.message); 
    } finally { 
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setSalvando(false); 
    }
  }

  async function alternarStatus(u) {
    const novoStatus = u.status === 'ativa' ? 'inativa' : 'ativa';
    try { await updateDoc(doc(db, "unidades", u.id), { status: novoStatus }); await registrarLogAuditoria('ALTERADA', `Status modificado para ${novoStatus.toUpperCase()}`, u.nome, `Bloqueio de acesso rápido.`); } catch (e) { alert("Erro ao mudar status"); }
  }

  async function excluir(u) {
    if(!window.confirm(t('unitsTab.messages.deleteWarning', { name: u.nome }))) return;
    try {
        setSalvando(true);
        const qVinculos = query(collection(db, "vinculos"), where("unidadeId", "==", u.id));
        const snapVinculos = await getDocs(qVinculos);
        const qUsers = query(collection(db, "usuarios"), where("unidadeId", "==", u.id));
        const snapUsers = await getDocs(qUsers);
        
        const batch = writeBatch(db);
        batch.delete(doc(db, "unidades", u.id));
        snapVinculos.forEach((v) => batch.delete(v.ref));
        snapUsers.forEach((userDoc) => batch.delete(userDoc.ref));
        
        await batch.commit();
        await registrarLogAuditoria('EXCLUÍDA', 'Unidade excluída do sistema.', u.nome, `Auditoria: ${snapVinculos.size} vínculo(s) invalidados.`);
    } catch (e) { alert(t('unitsTab.messages.deleteError', "Erro ao excluir:") + " " + e.message); } finally { setSalvando(false); }
  }

  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 font-bold">Acesso Restrito.</div>;

  return (
    <>
      <div className="p-6 animate-fade-in max-w-[1600px] mx-auto space-y-6 uppercase">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20"><Building2 className="w-6 h-6"/></span>
              {t('unitsTab.title', 'Gestão de Unidades')}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{t('unitsTab.subtitle', { count: kpis.total })}</p>
          </div>

          <div className="flex gap-3 w-full md:w-auto h-[48px]">
              <div className="flex items-center gap-4 bg-white dark:bg-slate-800 px-4 h-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                      <p className="text-lg font-black text-slate-700 dark:text-white leading-none">{kpis.total}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                  <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativas</p>
                      <p className="text-lg font-black text-green-600 leading-none">{kpis.ativas}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                  <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inativas</p>
                      <p className="text-lg font-black text-red-500 leading-none">{kpis.inativas}</p>
                  </div>
              </div>
              
              {role === 'admin' && (
                  <>
                      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                      <button onClick={() => fileInputRef.current.click()} className="px-5 h-full bg-slate-800 dark:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-slate-700 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 border dark:border-slate-700 whitespace-nowrap">
                          <Upload className="w-4 h-4"/> Importar Infra (CSV)
                      </button>
                  </>
              )}

              <button onClick={abrirNovaUnidade} className="px-5 h-full bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
                  <Plus className="w-4 h-4"/> {t('unitsTab.newUnit', 'Nova Unidade')}
              </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors"/>
                <input 
                    type="text" placeholder={t('unitsTab.searchPlaceholder', "Buscar unidade, estado...")} 
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm transition-all dark:text-white"
                    value={busca} onChange={(e) => setBusca(e.target.value)}
                />
            </div>
            
            {role === 'admin' && (
                <div className="flex w-full lg:w-auto gap-4 flex-col sm:flex-row">
                    <div className="relative w-full sm:w-56">
                        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase outline-none appearance-none shadow-sm dark:text-white">
                            <option value="">TODOS OS ESTADOS</option>
                            {[...new Set(unidadesBase.map(u => u.estado).filter(Boolean))].sort().map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                    
                    <div className="relative w-full sm:w-56">
                        <select 
                            value={paisFiltro} 
                            onChange={e => setPaisFiltro(e.target.value)} 
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase outline-none appearance-none shadow-sm dark:text-white"
                        >
                            <option value="">TODOS OS PAÍSES</option>
                            {PAISES.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <select value={mentorFiltro} onChange={e => setMentorFiltro(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase outline-none appearance-none shadow-sm dark:text-white">
                            <option value="">TODOS OS MENTORES</option>
                            {mentores.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                </div>
            )}
        </div>

        {/* === TABELA DE ALTA DENSIDADE === */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer w-24" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1.5">{t('unitsTab.table.status', 'Status')} <SortIcon field="status"/></div>
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('nome')}>
                      <div className="flex items-center gap-1.5">{t('unitsTab.table.unit', 'Unidade')} <SortIcon field="nome"/></div>
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-80">
                      {t('unitsTab.table.location', 'Local')}
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('estado')}>
                      <div className="flex items-center gap-1.5">Região <SortIcon field="estado"/></div>
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('mentorId')}>
                      <div className="flex items-center gap-1.5">{t('unitsTab.table.responsible', 'Responsável')} <SortIcon field="mentorId"/></div>
                  </th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">{t('unitsTab.table.actions', 'Ações')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {loading ? (
                    <tr><td colSpan="6" className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-red-500 mx-auto mb-2"/><p className="text-slate-400 font-bold text-xs uppercase">Sincronizando...</p></td></tr>
                ) : unidadesProcessadas.length === 0 ? (
                    <tr><td colSpan="6" className="py-8 text-center text-slate-400 font-bold text-xs uppercase"><Building2 className="w-6 h-6 mx-auto mb-2 opacity-20"/> {t('unitsTab.emptyState', 'Nenhuma unidade encontrada.')}</td></tr>
                ) : (
                  unidadesProcessadas.map(u => {
                    let paisAtual = u.pais || PAIS_DEFAULT;
                    if (paisAtual === "Brasil") paisAtual = "BR";
                    if (paisAtual === "Argentina") paisAtual = "AR";
                    if (paisAtual === "Estados Unidos") paisAtual = "US";
                    
                    const paisDDI = DDI_MAP[paisAtual]; 
                    const telefoneExibicao = u.telefone && !u.telefone.startsWith('+') && paisDDI ? `${paisDDI} ${u.telefone}` : (u.telefone || "");

                    return (
                    <tr key={u.id} className={`transition-colors group ${u.status === 'inativa' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-70' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      
                      <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${u.status === 'ativa' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-slate-400'}`}></div>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'ativa' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{u.status === 'ativa' ? t('unitsTab.table.active') : t('unitsTab.table.inactive')}</span>
                          </div>
                      </td>

                      <td className="px-3 py-2">
                        <div className="font-black text-slate-800 dark:text-white text-sm uppercase">{u.nome}</div>
                        <div className="mt-0.5 mb-0.5">
                          {editandoTelefoneId === u.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                  <input 
                                      autoFocus 
                                      className="px-2 py-1 border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 rounded text-[10px] font-mono font-bold outline-none w-32 dark:text-white" 
                                      value={telefoneInline} 
                                      onChange={(e) => setTelefoneInline(formatarTelefone(e.target.value, paisAtual))} 
                                      onKeyDown={(e) => e.key === 'Enter' && salvarDadoInline(u, 'telefone', telefoneInline, 'WhatsApp').then(()=>setEditandoTelefoneId(null))} 
                                      placeholder={getPhonePlaceholder(paisAtual)} 
                                  />
                                  <button onClick={() => salvarDadoInline(u, 'telefone', telefoneInline, 'WhatsApp').then(()=>setEditandoTelefoneId(null))} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-600 hover:text-white transition-colors"><Check className="w-3 h-3"/></button>
                                  <button onClick={() => setEditandoTelefoneId(null)} className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-400 transition-colors"><X className="w-3 h-3"/></button>
                              </div>
                          ) : (
                              <div className="flex items-center gap-1 group/edit w-fit">
                                  <Phone className={`w-3 h-3 ${u.telefone ? 'text-green-500 dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}/>
                                  <span className={`font-mono text-xs font-bold flex items-center gap-1 ${u.telefone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic text-[10px]'}`}>
                                    {u.telefone ? (
                                        <>
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border ${PAIS_CONFIG[paisAtual]?.badgeClass}`}>
                                                <FlagIcon pais={paisAtual} /> {paisAtual}
                                            </span>
                                            {telefoneExibicao}
                                        </>
                                    ) : t('unitsTab.table.notInformed', "Add Whatsapp")}
                                  </span>
                                  <Edit2 onClick={() => { setEditandoTelefoneId(u.id); setTelefoneInline(u.telefone ? u.telefone.replace(paisDDI, '').trim() : ""); }} className="w-3 h-3 text-blue-500 opacity-0 group-hover/edit:opacity-100 cursor-pointer transition-opacity ml-1"/>
                              </div>
                          )}
                        </div>
                        {u.email && <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 opacity-80"><Mail className="w-3 h-3"/> {u.email}</div>}
                      </td>

                      <td className="px-3 py-2 space-y-1">
                          
                          {/* METRAGEM */}
                          {editandoMetragemId === u.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                  <input autoFocus type="number" className="px-2 py-1 border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 rounded text-[10px] font-bold outline-none w-20 dark:text-white" value={metragemInline} onChange={(e) => setMetragemInline(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarDadoInline(u, 'metragemSalaColetiva', Number(metragemInline), 'M² da Sala').then(()=>setEditandoMetragemId(null))} placeholder="m²" />
                                  <button onClick={() => salvarDadoInline(u, 'metragemSalaColetiva', Number(metragemInline), 'M² da Sala').then(()=>setEditandoMetragemId(null))} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-3 h-3"/></button>
                                  <button onClick={() => setEditandoMetragemId(null)} className="p-1 bg-slate-200 text-slate-600 rounded"><X className="w-3 h-3"/></button>
                              </div>
                          ) : (
                              <div className="flex items-center gap-1.5 group/edit w-fit">
                                  <Maximize className="w-3 h-3 text-slate-400"/>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${u.metragemSalaColetiva ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 italic opacity-50'}`}>{u.metragemSalaColetiva ? `${u.metragemSalaColetiva} m² LIVRE` : "Add Metragem"}</span>
                                  <Edit2 onClick={() => { setEditandoMetragemId(u.id); setMetragemInline(u.metragemSalaColetiva || ""); }} className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 cursor-pointer text-blue-500 ml-1"/>
                              </div>
                          )}

                          {/* ENDEREÇO (LINK MAPS CONSOLIDADO) */}
                          {editandoEnderecoId === u.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                  <input autoFocus type="text" className="px-2 py-1 border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 rounded text-[10px] font-bold outline-none w-48 dark:text-white" value={enderecoInline} onChange={(e) => setEnderecoInline(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarDadoInline(u, 'enderecoCompleto', enderecoInline, 'Endereço').then(()=>setEditandoEnderecoId(null))} placeholder="Av. Afonso Pena, 1200..." />
                                  <button onClick={() => salvarDadoInline(u, 'enderecoCompleto', enderecoInline, 'Endereço').then(()=>setEditandoEnderecoId(null))} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-3 h-3"/></button>
                                  <button onClick={() => setEditandoEnderecoId(null)} className="p-1 bg-slate-200 text-slate-600 rounded"><X className="w-3 h-3"/></button>
                              </div>
                          ) : (
                              <div className="flex items-start gap-1.5 group/edit w-fit">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400"/>
                                  <div className="flex flex-col">
                                      {u.linkGoogleMaps ? (
                                          <a href={getValidUrl(u.linkGoogleMaps)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[250px] leading-tight" title="Abrir no Google Maps" onClick={e => e.stopPropagation()}>
                                              {u.enderecoCompleto || "Ver no Mapa"}
                                          </a>
                                      ) : (
                                          <span className={`text-[10px] font-bold uppercase truncate max-w-[250px] leading-tight ${u.enderecoCompleto ? 'text-slate-600 dark:text-slate-300' : 'italic opacity-50'}`}>
                                              {u.enderecoCompleto || "Adicionar Endereço"}
                                          </span>
                                      )}
                                  </div>
                                  <Edit2 onClick={() => { setEditandoEnderecoId(u.id); setEnderecoInline(u.enderecoCompleto || ""); }} className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 cursor-pointer text-blue-500 shrink-0 ml-1 mt-0.5"/>
                              </div>
                          )}

                          {/* EDITAR LINK DO MAPS */}
                          {editandoMapaId === u.id && (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                  <input autoFocus type="text" className="px-2 py-1 border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 rounded text-[10px] font-mono outline-none w-48 dark:text-white" value={mapaInline} onChange={(e) => setMapaInline(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarDadoInline(u, 'linkGoogleMaps', mapaInline, 'Link do Maps').then(()=>setEditandoMapaId(null))} placeholder="http://maps..." />
                                  <button onClick={() => salvarDadoInline(u, 'linkGoogleMaps', mapaInline, 'Link do Maps').then(()=>setEditandoMapaId(null))} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-3 h-3"/></button>
                                  <button onClick={() => setEditandoMapaId(null)} className="p-1 bg-slate-200 text-slate-600 rounded"><X className="w-3 h-3"/></button>
                              </div>
                          )}
                          {!editandoMapaId && !u.linkGoogleMaps && (
                              <div className="flex items-center gap-1.5 group/edit w-fit">
                                  <Map className="w-3 h-3 shrink-0 text-slate-300"/>
                                  <span className="text-[9px] font-bold uppercase text-slate-400 italic">Sem Link Maps</span>
                                  <Edit2 onClick={() => { setEditandoMapaId(u.id); setMapaInline(u.linkGoogleMaps || ""); }} className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 cursor-pointer text-blue-500 ml-1"/>
                              </div>
                          )}
                          {!editandoMapaId && u.linkGoogleMaps && (
                               <div className="flex items-center gap-1.5 group/edit w-fit opacity-0 group-hover:opacity-100 transition-opacity">
                                   <span className="text-[9px] font-bold uppercase text-slate-400">Alterar Link URL</span>
                                   <Edit2 onClick={() => { setEditandoMapaId(u.id); setMapaInline(u.linkGoogleMaps || ""); }} className="w-3 h-3 cursor-pointer text-blue-500 ml-1"/>
                               </div>
                          )}
                      </td>

                      <td className="px-3 py-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{u.estado}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <FlagIcon pais={paisAtual} className="w-3 h-2" /> {PAIS_CONFIG[paisAtual]?.nome || u.pais}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-xs font-bold bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md w-fit">
                          <User className="w-3 h-3 text-blue-500"/>
                          {role === "admin" ? (mentores.find(m=>m.id===u.mentorId)?.nome?.split(' ')[0] || t('unitsTab.table.notInformed', "N/A")) : t('unitsTab.table.you', "Você")}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => abrirEditarUnidade(u)} className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-600 transition-colors" title={t('unitsTab.table.edit', "Editar Unidade")}>
                                  <Edit2 className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={() => alternarStatus(u)} className={`p-1.5 rounded-md transition-colors ${u.status === "ativa" ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400"}`} title={u.status === "ativa" ? "Suspender" : "Reativar"}>
                                  {u.status === "ativa" ? <PowerOff className="w-3.5 h-3.5"/> : <CheckCircle2 className="w-3.5 h-3.5"/>}
                              </button>
                              <button onClick={() => excluir(u)} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 transition-colors" title={t('unitsTab.table.delete', "Excluir")}>
                                  <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                          </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* === 🟢 MODAL FLUTUANTE DE RECONCILIAÇÃO (COMPARADOR DE CONFLITOS) === */}
      <ResizableModal 
          isOpen={importModalAberto} onClose={() => setImportModalAberto(false)} 
          title="FILA DE INJEÇÃO DE DADOS (CSV)" icon={ShieldAlert} headerColor="bg-slate-900 text-white border-slate-800"
          pos={importPos} setPos={setImportPos} size={importSize} setSize={setImportSize} minW={700} minH={600}
      >
        <div className="p-6 flex flex-col h-full bg-white dark:bg-slate-800">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/50 mb-6 shrink-0 flex justify-between items-center">
                <div>
                    <h4 className="font-black text-blue-800 dark:text-blue-400 mb-1 text-sm">Resumo da Varredura (Raio-X)</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Compare os dados atuais com os novos do CSV antes de aprovar.</p>
                </div>
                {importData.matches.some(m => m.status === 'pendente') && (
                    <button onClick={aprovarTodosPendentes} disabled={importando} className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                        {importando ? <Loader2 className="w-3 h-3 animate-spin"/> : <><CheckCircle2 className="w-3 h-3"/> Aprovar Todos os Pendentes</>}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 pb-4">
                {importData.matches.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum dado novo para atualizar. O banco já está idêntico ao CSV.</div>
                ) : (
                    importData.matches.map((m, i) => {
                        const conflito = (m.enderecoAtual && m.novoEndereco && m.enderecoAtual !== m.novoEndereco) || (m.mapaAtual && m.novoLinkMaps && m.mapaAtual !== m.novoLinkMaps);
                        return (
                            <div key={i} className={`p-5 border-2 rounded-2xl transition-all ${m.status === 'aprovado' ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/50' : m.status === 'descartado' ? 'bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 grayscale opacity-50' : conflito ? 'bg-amber-50/30 border-amber-300 dark:bg-amber-900/10 dark:border-amber-700/50 shadow-md' : 'bg-white border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 shadow-sm'}`}>
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-start gap-4 border-b border-slate-100 dark:border-slate-700/50 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileSpreadsheet className="w-4 h-4 text-slate-400"/>
                                                <p className="font-black text-slate-700 dark:text-slate-300 text-sm">CSV: <span className="text-blue-600 dark:text-blue-400">{m.csvNome}</span></p>
                                            </div>
                                            {conflito && m.status === 'pendente' && <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-1 mt-2"><AlertTriangle className="w-3 h-3"/> Alerta de Substituição de Dados</p>}
                                        </div>
                                        <div className="text-right">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vincular à Unidade no Sistema:</label>
                                            <select value={m.dbId || ""} onChange={(e) => handleRematch(i, e.target.value)} disabled={m.status !== 'pendente'} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-white outline-none w-64 uppercase">
                                                <option value="">-- Ignorar (Não Vincular) --</option>
                                                {unidadesBase.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {m.dbId && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Atual no Sistema</h5>
                                                <div className="space-y-2">
                                                    <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Endereço</span><span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate block">{m.enderecoAtual || "Vazio"}</span></div>
                                                    <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Link Maps</span><span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate block">{m.mapaAtual ? "Link Existe" : "Vazio"}</span></div>
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-900/50">
                                                <h5 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 border-b border-blue-200 dark:border-blue-900/50 pb-1">Novo do Arquivo</h5>
                                                <div className="space-y-2">
                                                    <div><span className="text-[9px] font-bold text-blue-400 dark:text-blue-500 uppercase block">Endereço</span><span className={`text-xs font-black truncate block ${m.enderecoAtual !== m.novoEndereco && m.novoEndereco ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{m.novoEndereco || "Nenhuma alteração"}</span></div>
                                                    <div><span className="text-[9px] font-bold text-blue-400 dark:text-blue-500 uppercase block">Link Maps</span><span className={`text-xs font-black truncate block ${m.mapaAtual !== m.novoLinkMaps && m.novoLinkMaps ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{m.novoLinkMaps ? "Injetar Novo Link" : "Nenhuma alteração"}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-2 mt-2">
                                        {m.status === 'pendente' ? (
                                            <>
                                                <button onClick={() => descartarItem(i)} className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:border-red-800 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"><Ban className="w-3 h-3"/> Descartar</button>
                                                <button onClick={() => aprovarItem(m, i)} disabled={!m.dbId} className="px-5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-300 disabled:opacity-50 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"><Check className="w-3 h-3"/> {conflito ? "Aprovar Substituição" : "Aprovar Injeção"}</button>
                                            </>
                                        ) : (
                                            <div className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 ${m.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{m.status === 'aprovado' ? <><CheckCircle2 className="w-3 h-3"/> Aprovado no Banco</> : <><Ban className="w-3 h-3"/> Descartado</>}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
                <button onClick={() => setImportModalAberto(false)} className="px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-all flex items-center gap-2"><Check className="w-4 h-4"/> Finalizar Operação</button>
            </div>
        </div>
      </ResizableModal>

      {/* === 🟢 MODAL CADASTRAR/EDITAR UNIDADE REESTRUTURADO (3 BLOCOS VERTICAIS ESPAÇOSOS) === */}
      <ResizableModal 
          isOpen={modalUnidadeAberto} onClose={() => setModalUnidadeAberto(false)} 
          title={editando ? t('unitsTab.modal.editTitle', "Editar Unidade") : t('unitsTab.modal.newTitle', "Nova Unidade")} icon={Building2} headerColor="bg-red-600 dark:bg-slate-900 text-white border-red-700 dark:border-slate-800"
          pos={modalPos} setPos={setModalPos} size={modalSize} setSize={setModalSize} minW={600} minH={500}
      >
        <form onSubmit={salvarUnidade} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-[#0b1120] flex flex-col gap-6">
          
          {erro && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2 shadow-sm"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
          {sucesso && <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 text-sm rounded-lg border border-green-100 dark:border-green-800 flex items-center gap-2 shadow-sm"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}

          {/* CARD 1: DADOS PRINCIPAIS */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                <Building2 className="w-3 h-3"/> Dados Principais
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">{t('unitsTab.modal.country', 'País')}</label>
                      <div className="relative">
                          <select value={pais} onChange={e=>{setPais(e.target.value); setEstado(""); setTelefone("");}} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                              {PAISES.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">{t('unitsTab.modal.state', 'Estado')}</label>
                      <div className="relative">
                          <select value={estado} onChange={e=>setEstado(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                              <option value="">{t('unitsTab.modal.select', 'Selecione...')}</option>
                              {estadosDisponiveis.map(e=><option key={e} value={e}>{e}</option>)}
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">{t('unitsTab.modal.unitName', 'Nome da Unidade')}</label>
                      <input value={nome} onChange={e=>setNome(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" placeholder={t('unitsTab.modal.unitNamePlaceholder', 'Ex: Barreiro')} />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 flex items-center justify-between">
                          <span>{t('unitsTab.modal.phone', 'WhatsApp')} <span className="text-red-500">*</span></span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-black ${PAIS_CONFIG[pais]?.badgeClass}`}>
                              <FlagIcon pais={pais} /> {DDI_MAP[pais]}
                          </span>
                      </label>
                      <div className="relative">
                          <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                          <input 
                              value={telefone} 
                              onChange={e=>setTelefone(formatarTelefone(e.target.value, pais))} 
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                              placeholder={getPhonePlaceholder(pais)} 
                              maxLength={15}
                          />
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">{t('unitsTab.modal.mentor', 'Mentor Responsável')}</label>
                      {role === 'admin' ? (
                          <div className="relative">
                              <select value={mentorId} onChange={e=>setMentorId(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                                  <option value="">{t('unitsTab.modal.select', 'Selecione...')}</option>
                                  {mentores.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                              </select>
                              <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                          </div>
                      ) : (
                          <div className="w-full py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-slate-600 flex items-center gap-2 font-bold text-sm cursor-not-allowed">
                              <User className="w-4 h-4"/> {userName}
                          </div>
                      )}
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">{t('unitsTab.modal.status', 'Status Inicial')}</label>
                      <div className="relative">
                          <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                              <option value="ativa">✅ {t('unitsTab.modal.statusActive', 'ATIVA')}</option>
                              <option value="inativa">🚫 {t('unitsTab.modal.statusInactive', 'INATIVA')}</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
              </div>
          </div>

          {/* CARD 2: DADOS DE ACESSO */}
          <div className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h4 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <Key className="w-3 h-3"/> {editando ? t('unitsTab.modal.access', "Dados de Acesso") : t('unitsTab.modal.generatedCreds', "Geração de Acesso")}
              </h4>
              
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/50 space-y-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed text-center mb-2">
                      {editando ? "Atualize o e-mail de contato e login da unidade." : t('unitsTab.modal.accessWarning', "O sistema gera automaticamente um painel de controle e login exclusivo.")}
                  </div>
                  <div className={`grid grid-cols-1 ${!editando ? 'md:grid-cols-2' : ''} gap-4`}>
                      <div className="w-full">
                          <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1 pl-1"><Mail className="w-3 h-3"/> {t('unitsTab.modal.login', 'Login (E-mail)')}</label>
                          <input 
                              value={emailLogin} 
                              onChange={(e) => setEmailLogin(e.target.value)}
                              className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-mono font-bold shadow-sm focus:border-blue-500 outline-none transition-colors" 
                              placeholder={t('unitsTab.modal.loginWaiting', "E-mail da unidade...")} 
                          />
                      </div>
                      {!editando && (
                          <div className="w-full">
                              <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1 pl-1"><Lock className="w-3 h-3"/> {t('unitsTab.modal.password', 'Senha Padrão')}</label>
                              <input disabled value={senhaLogin} className="w-full px-4 py-3 text-sm border-none bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-mono font-bold shadow-sm text-center tracking-widest" />
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* CARD 3: ESTRUTURA E LOCALIZAÇÃO */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
              <h4 className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <MapPin className="w-3 h-3"/> Estrutura e Localização
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Endereço ocupa a linha inteira no mobile, ou 3 colunas no desktop */}
                  <div className="md:col-span-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Endereço Completo</label>
                      <div className="relative">
                          <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                          <input 
                              value={endereco} 
                              onChange={e=>setEndereco(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                              placeholder="Ex: Av. Afonso Pena, 1200 - Centro, Belo Horizonte - MG, 30130-003" 
                          />
                      </div>
                  </div>

                  <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Link do Google Maps</label>
                      <div className="relative">
                          <Map className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                          <input 
                              value={linkMaps} 
                              onChange={e=>setLinkMaps(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                              placeholder="https://maps.app.goo.gl/..." 
                          />
                      </div>
                  </div>
                  
                  <div className="md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Metragem da Sala (m²)</label>
                      <div className="relative">
                          <Maximize className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                          <input 
                              type="number" 
                              value={metragem} 
                              onChange={e=>setMetragem(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                              placeholder="Ex: 80" 
                          />
                      </div>
                  </div>
              </div>
          </div>

          {/* === BOTÕES DO MODAL === */}
          <div className="flex justify-end gap-3 shrink-0 pt-2">
            <button type="button" onClick={()=>setModalUnidadeAberto(false)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors bg-slate-100 dark:bg-slate-800">{t('unitsTab.modal.cancel', 'Cancelar')}</button>
            <button type="submit" disabled={salvando} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-red-500/30 hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (editando ? t('unitsTab.modal.saveEdit', "Salvar Alterações") : <><Plus className="w-4 h-4"/> {t('unitsTab.modal.saveNew', "Criar Unidade")}</>)}
            </button>
          </div>
        </form>
      </ResizableModal>
    </>
  );
}
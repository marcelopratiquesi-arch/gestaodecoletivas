import { useEffect, useMemo, useState } from "react";
// Importações de contexto e serviços
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../services/firebase";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, query, where, setDoc
} from "firebase/firestore";

// Auth Imports (Instância Secundária)
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 

// TODOS OS ÍCONES IMPORTADOS CORRETAMENTE
import { 
  UserPlus, Edit2, Trash2, Link as LinkIcon, Loader2, Search, CheckCircle2, 
  X, Mail, Phone, PlusCircle, User, AlertTriangle, ChevronDown, 
  ChevronUp, ArrowDown, DownloadCloud, Layers, Ban, ShieldCheck, MapPin
} from "lucide-react";

// --- MÁSCARA INTELIGENTE DE TELEFONE ---
const mascaraTelefone = (valor) => {
    if (!valor) return "";
    let v = valor.replace(/\D/g, ""); // Tira tudo que não é número
    if (v.length > 11) v = v.substring(0, 11); // Limita a 11 dígitos
    
    if (v.length > 10) {
        return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (v.length > 5) {
        return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (v.length > 2) {
        return v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    } else {
        return v.replace(/^(\d*)/, "($1");
    }
};

export function ProfessoresTab() {
  const { userData } = useAuth();
  
  // ===== PERMISSÕES E ESCOPO =====
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userUnidadeId = useMemo(() => userData?.unidadeId, [userData]);

  const podeVer = ["admin", "mentor", "unidade"].includes(role);
  const podeEditar = ["admin", "mentor", "unidade"].includes(role);
  const podeExcluir = role === "admin"; // Apenas admin exclui do banco geral

  // ===== STATES DE DADOS EM TEMPO REAL =====
  const [professoresTotais, setProfessoresTotais] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX: Paginação e Ordenação
  const [itensVisiveis, setItensVisiveis] = useState(20);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

  // Modais
  const [modalVerificacaoAberto, setModalVerificacaoAberto] = useState(false);
  const [modalFormAberto, setModalFormAberto] = useState(false);
  
  // Fluxo de Cadastro
  const [emailVerificacao, setEmailVerificacao] = useState("");
  const [professorEncontrado, setProfessorEncontrado] = useState(null);
  const [profEditando, setProfEditando] = useState(null);
  
  // Forms
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativo");
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState("");
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [corrigindoBase, setCorrigindoBase] = useState(false);

  const senhaPadrao = "123456";

  // ==========================================
  // 0. MOTOR DE AUDITORIA (CÂMERA INVISÍVEL)
  // ==========================================
  const registrarLogAuditoria = async (tipoAcao, descricao, nomeProfessor, detalhes = "", nomeUnidade = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao,
              descricao,
              diffExtras: detalhes,
              modulo: 'CONFIGURACOES', // Chave exata para o filtro da nova tela
              professorNome: nomeProfessor || '-',
              unidadeNome: nomeUnidade || '-',
              modalidadeNome: '-', // Não se aplica a professores
              usuarioAcaoNome: nomeUsuario,
              usuarioAcaoId: userId,
              dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  // ==========================================
  // 1. MOTOR DE TEMPO REAL (Velocidade da Luz)
  // ==========================================
  useEffect(() => { 
      if (!podeVer) return;
      setLoading(true);

      const unsubUnidades = onSnapshot(collection(db, "unidades"), snap => {
          setUnidades(snap.docs.map(d => ({id: d.id, ...d.data()})));
      });

      const unsubVinculos = onSnapshot(collection(db, "vinculos"), snap => {
          setVinculos(snap.docs.map(d => ({id: d.id, ...d.data()})));
      });

      const unsubProfs = onSnapshot(collection(db, "professores"), snap => {
          setProfessoresTotais(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
      });

      return () => { unsubUnidades(); unsubVinculos(); unsubProfs(); };
  }, [podeVer]);

  // ==========================================
  // 2. FILTROS DE PERMISSÃO (ACL)
  // ==========================================
  const minhasUnidades = useMemo(() => {
      if (role === 'admin') return unidades;
      if (role === 'mentor') return unidades.filter(u => u.mentorId === userId);
      if (role === 'unidade') return unidades.filter(u => u.id === userUnidadeId);
      return [];
  }, [unidades, role, userId, userUnidadeId]);

  const meusVinculos = useMemo(() => {
      const idsUnidades = minhasUnidades.map(u => u.id);
      return vinculos.filter(v => idsUnidades.includes(String(v.unidadeId)));
  }, [vinculos, minhasUnidades]);

  const meusProfessores = useMemo(() => {
      if (role === 'admin') return professoresTotais;
      
      const idsProfsVinculados = [...new Set(meusVinculos.map(v => v.professorId))];
      return professoresTotais.filter(p => idsProfsVinculados.includes(p.id));
  }, [professoresTotais, meusVinculos, role]);

  // ==========================================
  // 3. PROCESSADOR VISUAL (BUSCA E ORDENAÇÃO)
  // ==========================================
  const professoresProcessados = useMemo(() => {
    const termo = busca.toLowerCase();
    
    let lista = meusProfessores.filter(p => 
        (p.nome || "").toLowerCase().includes(termo) || 
        (p.email || "").toLowerCase().includes(termo) ||
        (p.telefone || "").includes(termo)
    );

    return lista.sort((a, b) => {
        let valA, valB;
        if (ordenacao.campo === 'unidades') {
            valA = vinculos.filter(v => v.professorId === a.id).length;
            valB = vinculos.filter(v => v.professorId === b.id).length;
        } else {
            valA = (a[ordenacao.campo] || "").toString().toLowerCase();
            valB = (b[ordenacao.campo] || "").toString().toLowerCase();
        }

        if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
    });
  }, [meusProfessores, vinculos, busca, ordenacao]);

  const professoresVisiveis = useMemo(() => {
      return professoresProcessados.slice(0, itensVisiveis);
  }, [professoresProcessados, itensVisiveis]);

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(professoresProcessados.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  const handleOrdenar = (campo) => {
      setOrdenacao(prev => ({
          campo,
          direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
      }));
  };

  const SortIcon = ({ campo }) => {
      if (ordenacao.campo !== campo) return <div className="w-4 h-4 opacity-20"><ChevronDown className="w-3 h-3"/></div>;
      return ordenacao.direcao === 'asc' ? <ChevronUp className="w-3 h-3 text-red-500"/> : <ChevronDown className="w-3 h-3 text-red-500"/>;
  };

  const kpis = useMemo(() => {
      const ativos = meusProfessores.filter(p => p.status === 'ativo').length;
      const inativos = meusProfessores.filter(p => p.status !== 'ativo').length;
      return { total: meusProfessores.length, ativos, inativos };
  }, [meusProfessores]);

  const getUnidadesVinculadas = (profId) => {
      const links = vinculos.filter(v => v.professorId === profId);
      return links.map(v => {
          const u = unidades.find(uni => String(uni.id) === String(v.unidadeId));
          const podeMexer = role === 'admin' || minhasUnidades.some(mu => String(mu.id) === String(u?.id));
          return u ? { id: v.id, nome: u.nome, vinculoId: v.id, podeMexer } : null;
      }).filter(Boolean);
  };

  // ==========================================
  // 4. AÇÕES E FLUXOS (COM AUDITORIA INJETADA)
  // ==========================================
  function abrirFluxoNovo() {
      setEmailVerificacao("");
      setProfessorEncontrado(null);
      setErro("");
      setUnidadeSelecionadaId(minhasUnidades.length === 1 ? minhasUnidades[0].id : "");
      setModalVerificacaoAberto(true);
  }

  function verificarEmail(e) {
      e.preventDefault(); 
      if (!emailVerificacao.includes("@")) return setErro("E-mail inválido.");
      
      setErro("");
      const emailBusca = emailVerificacao.trim().toLowerCase(); 

      const prof = professoresTotais.find(p => p.email.toLowerCase() === emailBusca);

      if (prof) {
          setProfessorEncontrado(prof);
      } else {
          abrirCadastroCompleto(emailBusca);
      }
  }

  async function vincularExistente(e) {
      e.preventDefault(); 
      if (!unidadeSelecionadaId) return setErro("Selecione uma unidade.");
      setSalvando(true);

      try {
          const jaVinculado = vinculos.some(v => 
              String(v.professorId) === String(professorEncontrado.id) && 
              String(v.unidadeId) === String(unidadeSelecionadaId)
          );

          if (jaVinculado) {
              setSalvando(false);
              return setErro("Este professor já está vinculado a esta unidade.");
          }

          await addDoc(collection(db, "vinculos"), {
              professorId: professorEncontrado.id,
              unidadeId: String(unidadeSelecionadaId),
              status: "ativo",
              createdAt: serverTimestamp()
          });

          // 🟢 AUDITORIA: Novo Vínculo
          const uniNome = unidades.find(u => String(u.id) === String(unidadeSelecionadaId))?.nome || 'Unidade';
          await registrarLogAuditoria('ALTERADA', 'Professor vinculado a nova unidade.', professorEncontrado.nome, `Vinculado à: ${uniNome}`, uniNome);

          setSucesso("Vinculado com sucesso!");
          setTimeout(() => {
              setModalVerificacaoAberto(false);
              setSucesso("");
              setSalvando(false);
          }, 1000);

      } catch (err) {
          setErro("Erro ao vincular.");
          setSalvando(false);
      } 
  }

  function abrirCadastroCompleto(emailPreenchido) {
      setModalVerificacaoAberto(false);
      setProfEditando(null);
      setNome("");
      setEmail(emailPreenchido || "");
      setTelefone("");
      setStatus("ativo");
      setErro("");
      setModalFormAberto(true);
  }

  function abrirEdicao(p) {
      setProfEditando(p);
      setNome(p.nome);
      setEmail(p.email);
      setTelefone(mascaraTelefone(p.telefone || "")); 
      setStatus(p.status || "ativo");
      setErro("");
      setModalFormAberto(true);
  }

  async function salvarProfessor(e) {
    e.preventDefault(); 
    setSalvando(true);
    setErro("");
    setSucesso("");
    
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase(); 
    const telLimpo = telefone.replace(/\D/g, ''); 

    if (!nomeLimpo) { 
        setSalvando(false); 
        return setErro("Nome obrigatório"); 
    }

    if (telefone && telLimpo.length < 10) {
        setSalvando(false);
        return setErro("WhatsApp inválido. Digite o número completo com DDD (Ex: 31 99999-8888).");
    }

    let secondaryApp = null;

    try {
      const duplicados = professoresTotais.filter(p => 
          p.nome.toLowerCase() === nomeLimpo.toLowerCase() && p.id !== (profEditando?.id || 'new')
      );

      if (duplicados.length > 0) {
          const listaEmails = duplicados.map(d => d.email).join(", ");
          const msg = `⚠️ ATENÇÃO: Já existe professor com o nome "${nomeLimpo}".\n\nE-mail(s): ${listaEmails}\n\nTem certeza que é outra pessoa?`;
          if (!window.confirm(msg)) {
              setSalvando(false);
              return; 
          }
      }

      if (profEditando) { 
          // 🟢 AUDITORIA: Descobrir o que mudou na edição
          let mudancas = [];
          if (profEditando.nome !== nomeLimpo) mudancas.push(`Nome: ${profEditando.nome} ➔ ${nomeLimpo}`);
          if (profEditando.telefone !== telefone) mudancas.push(`Telefone: ${profEditando.telefone || 'Sem tel'} ➔ ${telefone}`);
          if (profEditando.status !== status) mudancas.push(`Status: ${profEditando.status} ➔ ${status}`);
          
          await updateDoc(doc(db, "professores", profEditando.id), { 
            nome: nomeLimpo, telefone, status, updatedAt: serverTimestamp() 
          });
          
          if (profEditando.uidLogin) {
             try { await updateDoc(doc(db, "usuarios", profEditando.uidLogin), { nome: nomeLimpo }); } catch(err) {}
          }

          if (mudancas.length > 0) {
              await registrarLogAuditoria('ALTERADA', 'Dados cadastrais do professor atualizados.', nomeLimpo, mudancas.join(' | '));
          }

          setSucesso("Dados atualizados!");
      } else { 
          // 🟢 AUDITORIA: Criação de novo professor
          secondaryApp = initializeApp(getApp().options, "SecondaryAppProfCreate");
          const secondaryAuth = getAuth(secondaryApp);
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, emailLimpo, senhaPadrao);
          const newUid = userCred.user.uid;

          const docRef = await addDoc(collection(db, "professores"), { 
              nome: nomeLimpo, email: emailLimpo, telefone, status, uidLogin: newUid, 
              createdAt: serverTimestamp(), createdBy: userId, roleCreator: role 
          });

          await setDoc(doc(db, "usuarios", newUid), {
            nome: nomeLimpo, email: emailLimpo, role: "professor", professorId: docRef.id,
            status: "ativo", criadoPor: userId
          });

          await signOut(secondaryAuth);

          let logDetalhe = `Email: ${emailLimpo}`;
          let nomeUnidadeAudit = "";

          if (unidadeSelecionadaId) {
              await addDoc(collection(db, "vinculos"), {
                  professorId: docRef.id,
                  unidadeId: String(unidadeSelecionadaId),
                  status: "ativo",
                  createdAt: serverTimestamp()
              });
              const uniNome = unidades.find(u => String(u.id) === String(unidadeSelecionadaId))?.nome;
              if(uniNome) {
                  logDetalhe += ` | Vinculado à: ${uniNome}`;
                  nomeUnidadeAudit = uniNome;
              }
          }
          
          await registrarLogAuditoria('NOVA', 'Novo professor cadastrado na rede.', nomeLimpo, logDetalhe, nomeUnidadeAudit);
          
          setSucesso("Professor criado com sucesso!");
      }
      
      setTimeout(() => {
          setModalFormAberto(false);
          setSucesso("");
          setSalvando(false);
      }, 1000);

    } catch (e) { 
        if (e.code === 'auth/email-already-in-use') setErro("E-mail já cadastrado no sistema.");
        else setErro("Erro: " + e.message); 
        setSalvando(false);
    } finally { 
        if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
    }
  }

  async function alternarStatusProf(p) {
      const novoStatus = p.status === 'ativo' ? 'inativo' : 'ativo';
      try {
          await updateDoc(doc(db, "professores", p.id), { status: novoStatus });
          // 🟢 AUDITORIA: Mudança Rápida de Status
          await registrarLogAuditoria('ALTERADA', `Status modificado para ${novoStatus.toUpperCase()}`, p.nome, `Alteração rápida de status`);
      } catch (e) { alert("Erro ao mudar status"); }
  }

  async function removerVinculo(idVinculo, nomeUnidade, nomeProfessor) {
      if (!confirm(`Remover o professor ${nomeProfessor} da unidade ${nomeUnidade}?`)) return;
      try { 
          await deleteDoc(doc(db, "vinculos", idVinculo)); 
          // 🟢 AUDITORIA: Desvinculação
          await registrarLogAuditoria('ALTERADA', 'Vínculo removido.', nomeProfessor, `Desvinculado da unidade: ${nomeUnidade}`, nomeUnidade);
      } catch (e) { console.error(e); }
  }

  async function excluirProfessorTotal(p) {
      if (!confirm(`ATENÇÃO: Excluir ${p.nome}?\nIsso removerá ele de TODAS as unidades da rede.\n\nConfirmar exclusão definitiva?`)) return;
      try {
          await deleteDoc(doc(db, "professores", p.id));
          const vinculadosDoProf = vinculos.filter(v => v.professorId === p.id);
          vinculadosDoProf.forEach(v => deleteDoc(doc(db, "vinculos", v.id)));
          
          // 🟢 AUDITORIA: Morte do Professor
          await registrarLogAuditoria('EXCLUÍDA', 'Professor excluído do sistema.', p.nome, `Exclusão definitiva de toda a rede.`);
      } catch (e) { alert("Erro ao excluir"); }
  }

  const corrigirEmailsAntigos = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso vai varrer todo o banco e converter os e-mails para minúsculo.\nDeseja continuar?")) return;
    setCorrigindoBase(true);
    let contador = 0;
    try {
        const updates = professoresTotais.map(async (p) => {
            const emailNovo = (p.email || "").toLowerCase().trim();
            if (p.email !== emailNovo) {
                contador++;
                await updateDoc(doc(db, "professores", p.id), { email: emailNovo });
                if (p.uidLogin) {
                    try { await updateDoc(doc(db, "usuarios", p.uidLogin), { email: emailNovo }); } catch(e) {}
                }
            }
        });
        await Promise.all(updates);
        // 🟢 AUDITORIA: Correção em massa
        await registrarLogAuditoria('ALTERADA', 'Correção em massa de e-mails', '-', `${contador} e-mails convertidos para letras minúsculas.`);
        alert(`SUCESSO! ${contador} e-mails corrigidos.`);
    } catch (e) { alert("Erro na correção."); } finally { setCorrigindoBase(false); }
  };

  if (!podeVer) return null;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      {/* HEADER E KPIS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20">
                <UserPlus className="w-6 h-6"/>
            </span>
            Gestão de Professores
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              Controle de base e vínculos com as unidades.
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                    <p className="text-lg font-black text-slate-700 dark:text-white leading-none">{kpis.total}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativos</p>
                    <p className="text-lg font-black text-green-600 leading-none">{kpis.ativos}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inativos</p>
                    <p className="text-lg font-black text-red-500 leading-none">{kpis.inativos}</p>
                </div>
            </div>
            
            {podeEditar && (
                <button 
                    type="button"
                    onClick={abrirFluxoNovo} 
                    className="px-5 py-2 h-full bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap"
                >
                    <PlusCircle className="w-4 h-4"/> Novo Vínculo
                </button>
            )}
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS E BUSCA */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors"/>
              <input 
                  type="text" 
                  placeholder="Buscar por nome, telefone ou e-mail..." 
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 shadow-sm transition-all text-slate-700 dark:text-white"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>

          {role === "admin" && (
              <button 
                  type="button"
                  onClick={corrigirEmailsAntigos} 
                  disabled={corrigindoBase}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-xs uppercase shadow-sm transition-colors flex items-center gap-2"
              >
                  {corrigindoBase ? <Loader2 className="w-4 h-4 animate-spin"/> : <Layers className="w-4 h-4" />} 
                  Corrigir E-mails
              </button>
          )}
      </div>

      {/* TABELA DE DADOS */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm relative">
        {loading && <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex items-center justify-center backdrop-blur-sm"><Loader2 className="w-8 h-8 animate-spin text-red-600"/></div>}
        
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-24 select-none" onClick={() => handleOrdenar('status')}>
                            <div className="flex items-center gap-2">Status <SortIcon campo="status" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('nome')}>
                            <div className="flex items-center gap-2">Professor <SortIcon campo="nome" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('email')}>
                            <div className="flex items-center gap-2">Contato <SortIcon campo="email" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('unidades')}>
                            <div className="flex items-center gap-2">Unidades Vinculadas <SortIcon campo="unidades" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                    {professoresVisiveis.map(p => {
                        const units = getUnidadesVinculadas(p.id);
                        
                        // LÓGICA DE AUDITORIA DE TELEFONE (Acha os errados para envio de WaSeller)
                        const isTelefoneValido = p.telefone && p.telefone.replace(/\D/g, '').length >= 10;
                        
                        return (
                            <tr key={p.id} className={`transition-colors group ${p.status === 'inativo' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${p.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                        {p.status === 'ativo' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {p.status}
                                    </span>
                                </td>
                                <td className="p-4 font-black text-slate-800 dark:text-white text-base">
                                    {p.nome}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-blue-500"/> {p.email}</span>
                                        
                                        {/* A ETIQUETA VISUAL DO TELEFONE */}
                                        {isTelefoneValido ? (
                                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                                <Phone className="w-3.5 h-3.5 text-green-500"/> {p.telefone}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-0.5 rounded-md w-fit" title="Telefone ausente ou inválido para envios do WaSeller. Edite o cadastro.">
                                                <AlertTriangle className="w-3.5 h-3.5"/> {p.telefone || "Sem Telefone"}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {units.length > 0 ? units.map(u => (
                                            <span key={u.vinculoId} className="pl-3 pr-1 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                                                <MapPin className="w-3 h-3 text-red-500"/> {u.nome}
                                                {u.podeMexer && (
                                                    <button type="button" onClick={() => removerVinculo(u.vinculoId, u.nome, p.nome)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md text-slate-400 hover:text-red-600 transition-colors" title="Remover Desta Unidade">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        )) : <span className="text-slate-400 text-xs italic font-medium">Nenhum vínculo.</span>}
                                        
                                        {podeEditar && (
                                            <button type="button" onClick={() => { setEmailVerificacao(p.email); setProfessorEncontrado(p); setUnidadeSelecionadaId(""); setModalVerificacaoAberto(true); }} className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="Vincular a outra unidade">
                                                <PlusCircle className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                        {podeEditar && (
                                            <>
                                                <button type="button" onClick={() => abrirEdicao(p)} className={`p-2 rounded-lg transition-colors title="Editar Dados" ${!isTelefoneValido ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                    <Edit2 className="w-4 h-4"/>
                                                </button>
                                                <button type="button" onClick={() => alternarStatusProf(p)} className={`p-2 rounded-lg transition-colors ${p.status === "ativo" ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400"}`} title={p.status === "ativo" ? "Desativar Perfil" : "Ativar Perfil"}>
                                                    {p.status === "ativo" ? <Ban className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                                                </button>
                                            </>
                                        )}
                                        {podeExcluir && (
                                            <button type="button" onClick={() => excluirProfessorTotal(p)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-colors" title="Excluir Definitivamente de Toda a Rede">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {professoresProcessados.length === 0 && !loading && (
                        <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold"><User className="w-12 h-12 mx-auto mb-3 opacity-20"/> Nenhum professor encontrado.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* BOTÕES DE CARREGAMENTO VISUAL */}
      {itensVisiveis < professoresProcessados.length && (
          <div className="flex flex-wrap justify-center gap-3 pt-2 pb-4 animate-fade-in">
              <button 
                  type="button"
                  onClick={() => handleCarregarMais(20)} 
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"
              >
                  <ArrowDown className="w-4 h-4"/> Carregar +20
              </button>
              <button 
                  type="button"
                  onClick={() => handleCarregarMais('todos')} 
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"
              >
                  <DownloadCloud className="w-4 h-4"/> Ver Todos ({professoresProcessados.length})
              </button>
          </div>
      )}

      {/* MODAL 1: FLUXO DE VERIFICAÇÃO */}
      {modalVerificacaoAberto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-black text-slate-800 dark:text-white text-xl">Novo Vínculo</h3>
                          <p className="text-xs font-medium text-slate-500 mt-1">Digite o e-mail para verificar a base.</p>
                      </div>
                      <button type="button" onClick={() => setModalVerificacaoAberto(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-6 space-y-5">
                      {!professorEncontrado ? (
                          <form onSubmit={verificarEmail} className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block pl-1">E-mail do Professor</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="email" 
                                          className="w-full pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-semibold outline-none transition-all dark:text-white" 
                                          placeholder="exemplo@email.com"
                                          value={emailVerificacao}
                                          onChange={e => setEmailVerificacao(e.target.value)}
                                          autoFocus
                                      />
                                      <button type="submit" className="bg-red-600 text-white px-5 rounded-xl font-bold hover:bg-red-700 shadow-md shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center">
                                          <Search className="w-5 h-5"/>
                                      </button>
                                  </div>
                              </div>
                              {erro && <p className="text-red-600 text-xs font-bold bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3 rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {erro}</p>}
                          </form>
                      ) : (
                          <form onSubmit={vincularExistente} className="space-y-5">
                              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl flex items-start gap-4">
                                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                                  <div>
                                      <h4 className="font-black text-green-800 dark:text-green-300 text-lg">Localizado!</h4>
                                      <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">{professorEncontrado.nome}</p>
                                      <p className="text-xs text-green-600 dark:text-green-500">{professorEncontrado.email}</p>
                                  </div>
                              </div>
                              
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block pl-1">Vincular a qual unidade?</label>
                                  <div className="relative">
                                      <select 
                                          className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white"
                                          value={unidadeSelecionadaId}
                                          onChange={e => setUnidadeSelecionadaId(e.target.value)}
                                      >
                                          {minhasUnidades.length > 1 && <option value="">Selecione...</option>}
                                          {minhasUnidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                                  </div>
                              </div>

                              {erro && <p className="text-red-600 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">{erro}</p>}
                              {sucesso && <p className="text-green-600 text-xs font-bold bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">{sucesso}</p>}

                              <button 
                                  type="submit"
                                  disabled={salvando || !unidadeSelecionadaId}
                                  className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-500/20 transition-transform active:scale-95 disabled:opacity-50 disabled:transform-none flex justify-center items-center gap-2"
                              >
                                  {salvando ? <Loader2 className="w-5 h-5 animate-spin"/> : <> <LinkIcon className="w-5 h-5"/> Confirmar Vínculo </>}
                              </button>
                          </form>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL 2: FORMULÁRIO COMPLETO COM MÁSCARA E AUDITORIA */}
      {modalFormAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                <div>
                    <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-red-600"/>
                        {profEditando ? "Editar Professor" : "Novo Cadastro"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Preencha os dados e clique em salvar.</p>
                </div>
                <button type="button" onClick={() => setModalFormAberto(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500">
                    <X className="w-5 h-5"/>
                </button>
            </div>

            <form onSubmit={salvarProfessor} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {erro && <div className="text-red-600 text-sm font-bold bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
                {sucesso && <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 text-sm rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}
                
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">E-mail (Login Fixo)</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                        <input className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none text-slate-500 cursor-not-allowed" value={email} disabled={true} />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Nome Completo</label>
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                        <input className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" value={nome} onChange={e => setNome(e.target.value)} autoFocus placeholder="Nome do Professor" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">WhatsApp <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                            <input 
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                                value={telefone} 
                                onChange={e => setTelefone(mascaraTelefone(e.target.value))} 
                                placeholder="(00) 00000-0000" 
                                maxLength={15}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Status</label>
                        <div className="relative">
                            <select className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="ativo">✅ ATIVO</option>
                                <option value="inativo">🚫 INATIVO</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                </div>

                {!profEditando && (
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-xl border border-blue-200 dark:border-blue-800">
                            <strong>Acesso Inicial:</strong> A senha padrão para este professor será <code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold ml-1 text-slate-800 dark:text-white shadow-sm">{senhaPadrao}</code>.
                        </div>
                        {minhasUnidades.length > 0 && (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Vincular Automaticamente a:</label>
                                <div className="relative">
                                    <select 
                                        className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white"
                                        value={unidadeSelecionadaId} 
                                        onChange={e => setUnidadeSelecionadaId(e.target.value)}
                                    >
                                        {minhasUnidades.length > 1 && <option value="">Selecione a unidade...</option>}
                                        {minhasUnidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 shrink-0 mt-6">
                    <button type="button" onClick={() => setModalFormAberto(false)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" disabled={salvando} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-red-500/30 hover:bg-red-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : (profEditando ? "Salvar Alterações" : <><CheckCircle2 className="w-4 h-4"/> Concluir Cadastro</>)}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
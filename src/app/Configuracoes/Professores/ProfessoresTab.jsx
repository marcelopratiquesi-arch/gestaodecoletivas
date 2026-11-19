import { useCallback, useEffect, useMemo, useState } from "react";
// Importações de contexto e serviços
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { db } from "../../../services/firebase";
import { publicarProfessor, removerProfessorDaVitrine } from "../../../services/vitrinePublica";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, query, where, writeBatch
} from "firebase/firestore";
import NovoVinculoModal from "./NovoVinculoModal";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoValido, formatarDocumento, limparDocumento, tipoDocumentoPadrao } from "../../../utils/documento";
import { apagarDocumentoDaFichaNoLote, documentoDaFichaNoLote, lerDocumentoDaFicha } from "../../../services/documentoFichaService";
import { ERRO_DOCUMENTO_EM_USO, gravarComAviso } from "../../../services/documentoService";
import { chaveTelefone, emailDeMentira, emailFormatoValido, fichasParecidas, limparNome, normalizarEmail } from "../../../utils/repetidos";

// TODOS OS ÍCONES IMPORTADOS CORRETAMENTE
import { 
  UserPlus, Edit2, Trash2, Link as LinkIcon, Loader2, Search, ScanSearch, CheckCircle2, 
  X, Mail, Phone, PlusCircle, User, AlertTriangle, ChevronDown, 
  ChevronUp, ArrowDown, ArrowRight, DownloadCloud, Layers, Ban, ShieldCheck, MapPin, IdCard
} from "lucide-react";
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO
import LinkCentral from "../../../centrais/LinkCentral";
import { ehLider, unidadesDoLider, escopoMentor } from '../../../permissions';
import PedidosProfessor from "../Pendencias/PedidosProfessor";
import { BuscaDocumento } from "../Documento/DocumentoModal";
import { FiltroPadrao } from "../ui/FiltroPadrao";
import { CabecalhoDoModal } from "../ui/CabecalhoDoModal";
import { BotaoDeLinha } from "../ui/BotaoDeLinha";
import { CabecalhoDaAba, CaixaDeNumeros, BotaoPrincipal, BotaoSecundario } from "../ui/CabecalhoDaAba";
import { useFiltroCascata } from "../ui/useFiltroCascata";
import SeloRepetido from "../ui/SeloRepetido";
import { useSelosRepetidos } from "../ui/useSelosRepetidos";
import JuntarFichasModal from "../Backup/JuntarFichasModal";
import { liberarContatos, sincronizarEAvisar } from "../../../services/contatoService";

// 🌍 PADRÃO OURO INTERNACIONAL — mesma identidade visual usada em MentoresTab
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

// 🟢 ÍCONES DE BANDEIRA EM SVG PURO (idêntico ao usado em MentoresTab — não depende de fonte de emoji)
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

// --- MÁSCARA INTELIGENTE DE TELEFONE POR PAÍS (mesmo padrão de MentoresTab) ---
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

export function ProfessoresTab() {
  const { userData } = useAuth();
  const { t, i18n } = useTranslation(); // 🟢 TRADUTOR CONECTADO
  
  // ===== PERMISSÕES E ESCOPO =====
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const escopoId = escopoMentor(userData); // id que vale como "mentor das unidades" (2º mentor usa o do 1º)

  const podeVer = ["admin", "mentor", "lider", "unidade"].includes(role);
  const podeEditar = ["admin", "mentor", "lider", "unidade"].includes(role);
  const podeExcluir = role === "admin"; // Apenas admin exclui do banco geral
  const veDocumento = role === "admin" || role === "mentor"; // número do documento da ficha: só admin e mentor

  // ===== STATES DE DADOS EM TEMPO REAL =====
  // ECONOMIA DE COTA: unidades, professores e vínculos vêm da memória ao vivo (CatalogContext), que já está
  // carregada e atualizada em tempo real. Antes esta aba baixava tudo de novo (~1.300 leituras) a cada abertura.
  // Exceção: unidade e mentor têm na memória só os vínculos das próprias unidades, e esta aba mostra em quais
  // outras unidades cada professor dá aula; por isso, para eles, os vínculos da rede são escutados aqui.
  const { catalogs: catalogosGlobais, loadingCatalogs } = useCatalogs();
  const professoresTotais = catalogosGlobais.professores || [];
  const unidades = catalogosGlobais.unidades || [];
  const [vinculosDaRede, setVinculosDaRede] = useState(null);
  const vinculos = role !== 'admin' ? (vinculosDaRede || []) : (catalogosGlobais.vinculos || []);
  const loading = loadingCatalogs || (role !== 'admin' && vinculosDaRede === null);
  
  // UX: Paginação e Ordenação
  const [itensVisiveis, setItensVisiveis] = useState(20);
  const [mostrarBuscaDoc, setMostrarBuscaDoc] = useState(false); // busca por CPF/DNI/SSN (admin e mentor; o banco limita o mentor às unidades dele)
  const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

  // Modais
  const [novoVinculo, setNovoVinculo] = useState(null); // { profInicial } = janela "Adicionar professor" (pelo documento)
  const [modalFormAberto, setModalFormAberto] = useState(false);

  // Fluxo de Cadastro
  const [profEditando, setProfEditando] = useState(null);
  // Documento (CPF/DNI/SSN) no formulário: o número nunca vai para a ficha, só para a gaveta privada.
  const [docForm, setDocForm] = useState({ tipo: "cpf", numero: "" });
  const [docAnterior, setDocAnterior] = useState(null); // documento já gravado (admin/mentor veem e corrigem)
  const [avisoTelefoneNovo, setAvisoTelefoneNovo] = useState("");
  const [uidLoginNovo, setUidLoginNovo] = useState(""); // cadastro novo de quem já tem login (documento achado no crachá)
  
  // Forms
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pais, setPais] = useState(PAIS_DEFAULT); // 🟢 CAMPO INTERNACIONAL
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativo");
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState("");
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [corrigindoBase, setCorrigindoBase] = useState(false);


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
              modulo: 'CONFIGURACOES', 
              professorNome: nomeProfessor || '-',
              unidadeNome: nomeUnidade || '-',
              modalidadeNome: '-', 
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
      if (!podeVer || role === 'admin') return;
      const unsubVinculos = onSnapshot(collection(db, "vinculos"), snap => {
          setVinculosDaRede(snap.docs.map(d => ({id: d.id, ...d.data()})));
      });
      return () => unsubVinculos();
  }, [podeVer, role]);

  // ==========================================
  // 2. FILTROS DE PERMISSÃO (ACL)
  // ==========================================
  const minhasUnidades = useMemo(() => {
      if (role === 'admin') return unidades;
      if (role === 'mentor') return unidades.filter(u => u.mentorId === escopoId);
      if (ehLider(role)) { const minhas = unidadesDoLider(userData); return unidades.filter(u => minhas.includes(String(u.id))); }
      return [];
  }, [unidades, role, userData, escopoId]);

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
  // 2b. FILTRO PADRÃO (busca + país → estado → mentor → líder), no navegador
  // ==========================================
  // Estado, mentor e líder do professor vêm das unidades onde ele dá aula — só as que a pessoa logada enxerga
  // (o mentor não descobre unidades nem mentores de outros). Nenhuma leitura nova.
  const unidadesDoProf = useMemo(() => {
      const porId = new Map(minhasUnidades.map(u => [String(u.id), u]));
      const mapa = {};
      meusVinculos.forEach(v => { const u = porId.get(String(v.unidadeId)); if (u) (mapa[v.professorId] ||= []).push(u); });
      return mapa;
  }, [meusVinculos, minhasUnidades]);
  const nomeMentor = useCallback((id) => (catalogosGlobais.mentores || []).find(m => m.id === id)?.nome, [catalogosGlobais.mentores]);
  const nomeUnidade = useCallback((id) => minhasUnidades.find(u => String(u.id) === id)?.nome, [minhasUnidades]);
  // Os números do topo são botões: a aba SEMPRE abre só com os ativos ("ativo"); "" = todos; "inativo" = só inativos.
  const [statusFiltro, setStatusFiltro] = useState("ativo");
  // "semDocumento" = fichas ativas ainda sem CPF/DNI/SSN (para irem sendo completadas).
  const soDoStatus = useCallback((p) => {
      if (!statusFiltro) return true;
      if (statusFiltro === "semDocumento") return p.status === "ativo" && !p.documentoOk;
      return (statusFiltro === "ativo") === (p.status === "ativo");
  }, [statusFiltro]);
  const filtro = useFiltroCascata(meusProfessores, {
      extra: soDoStatus,
      getPais: (p) => p.pais || PAIS_DEFAULT,
      getEstados: (p) => (unidadesDoProf[p.id] || []).map(u => u.estado),
      getMentorIds: (p) => (unidadesDoProf[p.id] || []).map(u => u.mentorId),
      getUnidadeIds: (p) => (unidadesDoProf[p.id] || []).map(u => String(u.id)),
      textoBusca: (p) => [p.nome, p.email, p.telefone],
      nomeMentor, nomeUnidade,
  });

  // ==========================================
  // 3. PROCESSADOR VISUAL (BUSCA, PAÍS E ORDENAÇÃO)
  // ==========================================
  const professoresProcessados = useMemo(() => {
    return [...filtro.resultado].sort((a, b) => {
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
  }, [filtro.resultado, vinculos, ordenacao]);

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
      return ordenacao.direcao === 'asc' ? <ChevronUp className="w-3 h-3 text-green-500"/> : <ChevronDown className="w-3 h-3 text-green-500"/>;
  };

  const kpis = useMemo(() => {
      const ativos = meusProfessores.filter(p => p.status === 'ativo').length;
      const inativos = meusProfessores.filter(p => p.status !== 'ativo').length;
      const semDocumento = meusProfessores.filter(p => p.status === 'ativo' && !p.documentoOk).length;
      return { total: meusProfessores.length, ativos, inativos, semDocumento };
  }, [meusProfessores]);

  // Selo "possível repetido": compara as fichas que esta tela já tem (0 leituras novas).
  const registrosRepetidos = useMemo(() => meusProfessores.map(p => ({
      origem: 'professor', id: String(p.id), nome: p.nome, email: p.email, telefone: p.telefone,
      pais: p.pais || PAIS_DEFAULT, uidLogin: p.uidLogin || '',
  })), [meusProfessores]);
  const selosRepetidos = useSelosRepetidos(registrosRepetidos);
  const [juntandoFichas, setJuntandoFichas] = useState(null);

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
  // "Adicionar professor": a janela procura pelo documento, depois por e-mail/telefone (NovoVinculoModal).
  function abrirFluxoNovo() { setNovoVinculo({ profInicial: null }); }

  // Documento, e-mail e telefone já conferidos na janela "Adicionar professor".
  function abrirCadastroCompleto(dados) {
      setNovoVinculo(null);
      setProfEditando(null);
      setNome(dados.nome || "");
      setUidLoginNovo(dados.uidLogin || "");
      setEmail(dados.email || "");
      setPais(dados.pais || PAIS_DEFAULT);
      setTelefone(formatarTelefone(dados.telefone || "", dados.pais || PAIS_DEFAULT));
      setDocForm({ tipo: dados.tipo, numero: formatarDocumento(dados.tipo, dados.numero) });
      setDocAnterior(null);
      setAvisoTelefoneNovo(dados.avisoTelefone || "");
      setUnidadeSelecionadaId(minhasUnidades.length === 1 ? minhasUnidades[0].id : "");
      setStatus("ativo");
      setErro("");
      setModalFormAberto(true);
  }

  function abrirEdicao(p) {
      setProfEditando(p);
      setNome(p.nome);
      setEmail(p.email);
      setPais(p.pais || PAIS_DEFAULT); // 🟢 CARREGA O PAÍS
      setTelefone(formatarTelefone(p.telefone || "", p.pais || PAIS_DEFAULT));
      setStatus(p.status || "ativo");
      setDocForm({ tipo: tipoDocumentoPadrao(i18n.language), numero: "" });
      setDocAnterior(null);
      setAvisoTelefoneNovo("");
      // Admin e mentor veem (e corrigem) o número já gravado: 1 leitura, só ao abrir a edição.
      if (p.documentoOk && veDocumento) {
          lerDocumentoDaFicha(p.id).then(d => {
              if (!d) return;
              setDocAnterior(d);
              setDocForm({ tipo: d.tipo, numero: formatarDocumento(d.tipo, d.numero) });
          }).catch(err => console.error("Ler documento da ficha:", err));
      }
      setErro("");
      setModalFormAberto(true);
  }

  // Avisos na hora (o mesmo é conferido de novo ao salvar): quem mais tem este e-mail, telefone ou nome.
  const parecidasNoForm = useMemo(() => (modalFormAberto
      ? fichasParecidas(professoresTotais, { email, telefone, pais, nome }, profEditando?.id)
      : []), [modalFormAberto, professoresTotais, email, telefone, pais, nome, profEditando]);

  async function salvarProfessor(e) {
    e.preventDefault(); 
    setSalvando(true);
    setErro("");
    setSucesso("");
    
    // Modelo de cadastro: nome sem espaços sobrando e em MAIÚSCULAS; e-mail minúsculo e sem espaço.
    const nomeLimpo = limparNome(nome);
    const emailLimpo = normalizarEmail(email);
    const parar = (msg) => { setSalvando(false); setErro(msg); };

    if (!nomeLimpo) return parar(t('teachersTab.messages.nameRequired', 'Nome obrigatório'));
    // E-mail: conferido no cadastro novo e sempre que for trocado na edição.
    const emailMudou = !!profEditando && emailLimpo !== normalizarEmail(profEditando.email);
    if (!profEditando || emailMudou) {
        if (!emailFormatoValido(emailLimpo)) return parar(t('teachersTab.cpf.emailInvalid'));
        if (emailDeMentira(emailLimpo)) return parar(t('teachersTab.cpf.emailFake'));
    }
    // Telefone: obrigatório no cadastro novo; se preenchido, com DDD válido e sem números todos iguais.
    if ((!profEditando || telefone) && !chaveTelefone(telefone, pais)) return parar(t('teachersTab.cpf.phoneInvalid'));

    // Documento: obrigatório no cadastro novo; ao editar, opcional (fichas antigas vão sendo completadas).
    const docNumero = limparDocumento(docForm.numero);
    if ((!profEditando || docNumero) && !documentoValido(docForm.tipo, docNumero)) return parar(t('document.errors.invalid'));
    const docMudou = !!docNumero && (!docAnterior || docAnterior.tipo !== docForm.tipo || docAnterior.numero !== docNumero);
    // O líder só informa o documento de ficha que ainda não tem; corrigir é com admin e mentor.
    const gravarDoc = docMudou && (!profEditando?.documentoOk || (veDocumento && !!docAnterior));

    // De novo ao salvar: e-mail de outra ficha barra (é a mesma pessoa ou o e-mail está errado).
    const mesmoEmail = (!profEditando || emailMudou)
        && fichasParecidas(professoresTotais, { email: emailLimpo }, profEditando?.id).find(a => a.campos.includes('email'));
    if (mesmoEmail) return parar(t('teachersTab.cpf.emailTaken', { name: mesmoEmail.ficha.nome }));

    try {
      if (profEditando) {
          // 🟢 AUDITORIA: Descobrir o que mudou na edição
          let mudancas = [];
          if (profEditando.nome !== nomeLimpo) mudancas.push(`Nome: ${profEditando.nome} ➔ ${nomeLimpo}`);
          if (profEditando.telefone !== telefone) mudancas.push(`Telefone: ${profEditando.telefone || 'Sem tel'} ➔ ${telefone}`);
          if (profEditando.pais !== pais) mudancas.push(`País: ${profEditando.pais || PAIS_DEFAULT} ➔ ${pais}`);
          if (profEditando.status !== status) mudancas.push(`Status: ${profEditando.status} ➔ ${status}`);
          
          if (emailMudou) mudancas.push(`E-mail: ${profEditando.email || 'Sem e-mail'} ➔ ${emailLimpo}`);
          if (gravarDoc) mudancas.push(docAnterior ? 'Documento de identificação corrigido' : 'Documento de identificação informado');
          const lote = writeBatch(db);
          lote.update(doc(db, "professores", profEditando.id), {
            nome: nomeLimpo, pais, telefone, status, updatedAt: serverTimestamp(),
            ...(emailMudou ? { email: emailLimpo } : {}),
            ...(gravarDoc ? { documentoOk: true } : {}),
          });
          if (gravarDoc) documentoDaFichaNoLote(lote, { professorId: profEditando.id, tipo: docForm.tipo, numero: docNumero, anterior: docAnterior, marcarFicha: false });
          await (gravarDoc ? gravarComAviso(lote) : lote.commit());
          // Reserva de e-mail/telefone (F3 parte A): depois de salvo; se já é de outra pessoa, só avisa.
          await sincronizarEAvisar({
            dono: { professorId: profEditando.id, uid: profEditando.uidLogin },
            antes: { email: profEditando.email, telefone: profEditando.telefone, pais: profEditando.pais },
            depois: { email: emailMudou ? emailLimpo : profEditando.email, telefone, pais },
          }, t);
          if (profEditando.nome !== nomeLimpo) await publicarProfessor(profEditando.id, nomeLimpo);
          
          if (profEditando.uidLogin) {
             try { await updateDoc(doc(db, "usuarios", profEditando.uidLogin), { nome: nomeLimpo }); } catch(err) {}
          }

          if (mudancas.length > 0) {
              await registrarLogAuditoria('ALTERADA', 'Dados cadastrais do professor atualizados.', nomeLimpo, mudancas.join(' | '));
          }

          setSucesso(t('teachersTab.messages.updated', 'Dados atualizados!'));
      } else { 
          // 🟢 AUDITORIA: Criação de novo professor
          // Só o cadastro da grade: NÃO cria login nem senha. O professor entra pelo Google e pede acesso;
          // líder, mentor ou admin aprovam em Pendências.
          // Ficha + documento (gaveta e reserva) + vínculo num lote só: o banco recusa documento repetido.
          const docRef = doc(collection(db, "professores"));
          const lote = writeBatch(db);
          lote.set(docRef, {
              nome: nomeLimpo, email: emailLimpo, pais, telefone, status, documentoOk: true,
              ...(uidLoginNovo ? { uidLogin: uidLoginNovo } : {}),
              createdAt: serverTimestamp(), createdBy: userId, roleCreator: role
          });
          documentoDaFichaNoLote(lote, { professorId: docRef.id, tipo: docForm.tipo, numero: docNumero, marcarFicha: false });
          if (unidadeSelecionadaId) {
              lote.set(doc(collection(db, "vinculos")), {
                  professorId: docRef.id,
                  unidadeId: String(unidadeSelecionadaId),
                  status: "ativo",
                  createdAt: serverTimestamp()
              });
          }
          await gravarComAviso(lote);
          await sincronizarEAvisar({
            dono: { professorId: docRef.id, uid: uidLoginNovo },
            depois: { email: emailLimpo, telefone, pais },
          }, t);
          await publicarProfessor(docRef.id, nomeLimpo);

          let logDetalhe = `Email: ${emailLimpo} | Documento de identificação informado`;
          let nomeUnidadeAudit = "";

          if (unidadeSelecionadaId) {
              const uniNome = unidades.find(u => String(u.id) === String(unidadeSelecionadaId))?.nome;
              if(uniNome) {
                  logDetalhe += ` | Vinculado à: ${uniNome}`;
                  nomeUnidadeAudit = uniNome;
              }
          }
          
          await registrarLogAuditoria('NOVA', 'Novo professor cadastrado na rede.', nomeLimpo, logDetalhe, nomeUnidadeAudit);
          
          setSucesso(t('teachersTab.messages.created', 'Professor criado com sucesso!'));
      }
      
      setTimeout(() => {
          setModalFormAberto(false);
          setSucesso("");
          setSalvando(false);
      }, 1000);

    } catch (e) {
        setErro(e?.message === ERRO_DOCUMENTO_EM_USO ? t('teachersTab.cpf.inUse') : t('teachersTab.messages.saveError', 'Erro: ') + e.message);
        setSalvando(false);
    }
  }

  async function alternarStatusProf(p) {
      const novoStatus = p.status === 'ativo' ? 'inativo' : 'ativo';
      try {
          await updateDoc(doc(db, "professores", p.id), { status: novoStatus });
          // 🟢 AUDITORIA: Mudança Rápida de Status
          await registrarLogAuditoria('ALTERADA', `Status modificado para ${novoStatus.toUpperCase()}`, p.nome, `Alteração rápida de status`);
      } catch (e) { alert(t('teachersTab.extra.statusError')); }
  }

  async function removerVinculo(idVinculo, nomeUnidade, nomeProfessor) {
      if (!window.confirm(t('teachersTab.messages.removeLinkConfirm', 'Remover o professor desta unidade?'))) return;
      try { 
          await deleteDoc(doc(db, "vinculos", idVinculo)); 
          // 🟢 AUDITORIA: Desvinculação
          await registrarLogAuditoria('ALTERADA', 'Vínculo removido.', nomeProfessor, `Desvinculado da unidade: ${nomeUnidade}`, nomeUnidade);
      } catch (e) { console.error(e); }
  }

  async function excluirProfessorTotal(p) {
      if (!window.confirm(t('teachersTab.messages.deleteConfirm', { name: p.nome }))) return;
      try {
          // Documento da ficha sai junto (gaveta e reserva), para poder ser usado de novo.
          const docDaFicha = p.documentoOk ? await lerDocumentoDaFicha(p.id) : null;
          const lote = writeBatch(db);
          if (docDaFicha) apagarDocumentoDaFichaNoLote(lote, p.id, docDaFicha);
          lote.delete(doc(db, "professores", p.id));
          await lote.commit();
          await liberarContatos({ professorId: p.id }, { email: p.email, telefone: p.telefone, pais: p.pais });
          await removerProfessorDaVitrine(p.id);
          const vinculadosDoProf = vinculos.filter(v => v.professorId === p.id);
          vinculadosDoProf.forEach(v => deleteDoc(doc(db, "vinculos", v.id)));
          
          // 🟢 AUDITORIA: Morte do Professor
          await registrarLogAuditoria('EXCLUÍDA', 'Professor excluído do sistema.', p.nome, `Exclusão definitiva de toda a rede.`);
      } catch (e) { alert(t('teachersTab.messages.deleteError', 'Erro ao excluir')); }
  }

  const corrigirEmailsAntigos = async () => {
    if (!window.confirm(t('teachersTab.messages.fixConfirm', 'Deseja continuar?'))) return;
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
        alert(t('teachersTab.messages.fixSuccess', { count: contador }));
    } catch (e) { alert(t('teachersTab.messages.fixError', 'Erro na correção.')); } finally { setCorrigindoBase(false); }
  };

  if (!podeVer) return null;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6 uppercase">
      {/* PEDIDOS DE ACESSO DE PROFESSORES (login pessoal pelo Google) */}
      <PedidosProfessor />
      {/* HEADER E KPIS */}
      <CabecalhoDaAba abaId="professores" icone={UserPlus} titulo={t('teachersTab.title', 'Gestão de Professores')} subtitulo={t('teachersTab.subtitle', 'Controle de base e vínculos com as unidades.')}
        numeros={<CaixaDeNumeros abaId="professores" itens={[
          { id: "total", rotulo: t('teachersTab.stats.total', 'Total'), valor: kpis.total, onClick: () => setStatusFiltro(""), ativo: statusFiltro === "" },
          { id: "ativo", rotulo: t('teachersTab.stats.active', 'Ativos'), valor: kpis.ativos, cor: "text-green-600", onClick: () => setStatusFiltro("ativo"), ativo: statusFiltro === "ativo" },
          { id: "inativo", rotulo: t('teachersTab.stats.inactive', 'Inativos'), valor: kpis.inativos, cor: "text-red-500", onClick: () => setStatusFiltro("inativo"), ativo: statusFiltro === "inativo" },
          { id: "semDocumento", rotulo: t('teachersTab.stats.noDocument'), valor: kpis.semDocumento, cor: "text-amber-600", onClick: () => setStatusFiltro("semDocumento"), ativo: statusFiltro === "semDocumento" },
        ]} />}>
        {role === "admin" && (
          <BotaoSecundario icone={corrigindoBase ? Loader2 : Layers} onClick={corrigirEmailsAntigos} disabled={corrigindoBase} girar={corrigindoBase}>
            {t('teachersTab.fixEmailsBtn', 'Corrigir E-mails')}
          </BotaoSecundario>
        )}
        {podeEditar && <BotaoPrincipal abaId="professores" icone={PlusCircle} onClick={abrirFluxoNovo}>{t('teachersTab.newLinkBtn', 'Novo Vínculo')}</BotaoPrincipal>}
      </CabecalhoDaAba>

      {/* BUSCA + FILTROS (filtro padrão das Configurações) */}
      <FiltroPadrao abaId="professores" filtro={filtro}
          mostrar={["pais", "estado", ...(role === "admin" ? ["mentor"] : []), ...(role === "admin" || role === "mentor" ? ["unidade"] : [])]}
          placeholder={t('teachersTab.searchPlaceholder', 'Buscar por nome, telefone ou e-mail...')}
          ativoExtra={statusFiltro !== "ativo"} aoLimpar={() => setStatusFiltro("ativo")}
          acoes={(role === "admin" || role === "mentor") && (
              <button type="button" onClick={() => setMostrarBuscaDoc(v => !v)} aria-expanded={mostrarBuscaDoc}
                  className={`px-4 py-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${mostrarBuscaDoc
                      ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                      : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-green-500 hover:text-green-600"}`}>
                  <ScanSearch className="w-4 h-4"/> {t("document.search.title")}
              </button>
          )}>
          {(role === "admin" || role === "mentor") && mostrarBuscaDoc && <BuscaDocumento aoResolverNaGrade={(d) => setNovoVinculo({ profInicial: null, documento: d })} />}
      </FiltroPadrao>
      {/* TABELA DE DADOS */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm relative">
        {loading && <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex items-center justify-center backdrop-blur-sm"><Loader2 className="w-8 h-8 animate-spin text-green-600"/></div>}
        
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-24 select-none" onClick={() => handleOrdenar('status')}>
                            <div className="flex items-center gap-2">{t('teachersTab.table.status', 'Status')} <SortIcon campo="status" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('nome')}>
                            <div className="flex items-center gap-2">{t('teachersTab.table.teacher', 'Professor')} <SortIcon campo="nome" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('email')}>
                            <div className="flex items-center gap-2">{t('teachersTab.table.contact', 'Contato')} <SortIcon campo="email" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('unidades')}>
                            <div className="flex items-center gap-2">{t('teachersTab.table.units', 'Unidades Vinculadas')} <SortIcon campo="unidades" /></div>
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">{t('teachersTab.table.actions', 'Ações')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                    {professoresVisiveis.map(p => {
                        const units = getUnidadesVinculadas(p.id);
                        
                        // LÓGICA DE AUDITORIA DE TELEFONE (Acha os errados para envio de WaSeller)
                        const isTelefoneValido = p.telefone && p.telefone.replace(/\D/g, '').length >= 10;
                        const paisAtual = p.pais || PAIS_DEFAULT; // 🟢 Fallback: Brasil se o professor não tiver país definido
                        const paisDDI = DDI_MAP[paisAtual];
                        
                        return (
                            <tr key={p.id} className={`transition-colors group ${p.status === 'inativo' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${p.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                        {p.status === 'ativo' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {p.status === 'ativo' ? t('teachersTab.table.active', 'ATIVO') : t('teachersTab.table.inactive', 'INATIVO')}
                                    </span>
                                </td>
                                <td className="p-4 font-black text-slate-800 dark:text-white text-base">
                                    <LinkCentral tipo="professor" alvo={p}>{p.nome}</LinkCentral>
                                    <SeloRepetido
                                        selo={selosRepetidos.get(`professor:${p.id}`)}
                                        detalheDe={(o) => getUnidadesVinculadas(o.id).map(u => u.nome).join(', ') || o.email || ''}
                                        onJuntar={role === 'admin' ? () => {
                                            const s = selosRepetidos.get(`professor:${p.id}`);
                                            const ids = new Set([String(p.id), ...(s?.mesma || []).map(o => String(o.id))]);
                                            setJuntandoFichas(meusProfessores.filter(x => ids.has(String(x.id))).map(x => ({ ...x, id: String(x.id) })));
                                        } : undefined}
                                    />
                                    {p.documentoOk && (
                                        <span className="ml-2 inline-flex items-center gap-1 align-middle text-[9px] font-black px-1.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" title={t('teachersTab.cpf.hasDocument')}>
                                            <IdCard className="w-3 h-3" /> {t('teachersTab.cpf.badge')}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-blue-500"/> {p.email}</span>
                                        
                                        {/* 🟢 A ETIQUETA VISUAL DO TELEFONE COM BANDEIRA + PAÍS + DDI */}
                                        {isTelefoneValido ? (
                                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                                <Phone className="w-3.5 h-3.5 text-green-500"/> 
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border ${PAIS_CONFIG[paisAtual]?.badgeClass}`}>
                                                    <FlagIcon pais={paisAtual} /> {paisAtual}
                                                </span>
                                                {paisDDI} {p.telefone}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-0.5 rounded-md w-fit" title={t('teachersTab.extra.phoneInvalidHint')}>
                                                <AlertTriangle className="w-3.5 h-3.5"/> {p.telefone || t('teachersTab.table.notInformed', 'Sem Telefone')}
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
                                                    <button type="button" onClick={() => removerVinculo(u.vinculoId, u.nome, p.nome)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md text-slate-400 hover:text-red-600 transition-colors" title={t('teachersTab.messages.removeLinkConfirm', 'Remover Desta Unidade')}>
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        )) : <span className="text-slate-400 text-xs italic font-medium">{t('teachersTab.table.noLinks', 'Nenhum vínculo.')}</span>}
                                        
                                        {podeEditar && (
                                            <button type="button" onClick={() => setNovoVinculo({ profInicial: p })} className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title={t('teachersTab.extra.linkOtherUnit')}>
                                                <PlusCircle className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                        {podeEditar && (
                                            <>
                                                <BotaoDeLinha abaId="professores" tipo={!isTelefoneValido ? "perigo" : "editar"} className={!isTelefoneValido ? "animate-pulse" : ""} icone={Edit2} onClick={() => abrirEdicao(p)} title={t('teachersTab.extra.editData')} />
                                                <BotaoDeLinha abaId="professores" tipo={p.status === "ativo" ? "desativar" : "ativar"} icone={p.status === "ativo" ? Ban : CheckCircle2} onClick={() => alternarStatusProf(p)}
                                                    title={p.status === "ativo" ? t('teachersTab.extra.deactivateProfile') : t('teachersTab.extra.activateProfile')} />
                                            </>
                                        )}
                                        {podeExcluir && (
                                            <BotaoDeLinha abaId="professores" tipo="perigo" icone={Trash2} onClick={() => excluirProfessorTotal(p)} title={t('teachersTab.extra.deleteNetwork')} />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {professoresProcessados.length === 0 && !loading && (
                        <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold"><User className="w-12 h-12 mx-auto mb-3 opacity-20"/> {t('teachersTab.emptyState', 'Nenhum professor encontrado.')}</td></tr>
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
                  <ArrowDown className="w-4 h-4"/> {t('teachersTab.load10', 'Carregar +20')}
              </button>
              <button 
                  type="button"
                  onClick={() => handleCarregarMais('todos')} 
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"
              >
                  <DownloadCloud className="w-4 h-4"/> {t('teachersTab.loadAll', 'Ver Todos')} ({professoresProcessados.length})
              </button>
          </div>
      )}

      {juntandoFichas && (
          <JuntarFichasModal fichas={juntandoFichas} aoJuntar={() => {}} aoFechar={() => setJuntandoFichas(null)} />
      )}

      {/* MODAL 1: FLUXO DE VERIFICAÇÃO */}
      {novoVinculo && (
          <NovoVinculoModal
              professores={professoresTotais}
              vinculos={vinculos}
              unidades={unidades}
              minhasUnidades={minhasUnidades}
              profInicial={novoVinculo.profInicial}
              documentoInicial={novoVinculo.documento || null}
              podeLimparReserva={veDocumento}
              formatarTelefone={formatarTelefone}
              placeholderTelefone={getPhonePlaceholder}
              aoNovoCadastro={abrirCadastroCompleto}
              aoFechar={() => setNovoVinculo(null)}
              registrarLog={registrarLogAuditoria}
          />
      )}

      {/* MODAL 2: FORMULÁRIO COMPLETO COM BANDEIRA, MÁSCARA E AUDITORIA */}
      {modalFormAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <CabecalhoDoModal abaId="professores" icone={Edit2}
              titulo={profEditando ? t('teachersTab.formModal.editTitle', 'Editar Professor') : t('teachersTab.formModal.newTitle', 'Novo Cadastro')}
              subtitulo={t('teachersTab.formModal.desc', 'Preencha os dados e clique em salvar.')}
              onFechar={() => setModalFormAberto(false)} />

            <form onSubmit={salvarProfessor} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {erro && <div className="text-red-600 text-sm font-bold bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
                {sucesso && <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 text-sm rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}
                
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">{t('teachersTab.formModal.loginEmail', 'E-mail (Login Fixo)')}</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                        <input type="email" className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-green-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white normal-case" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('teachersTab.verifyModal.emailPlaceholder')} />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">{t('teachersTab.formModal.fullName', 'Nome Completo')}</label>
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                        <input className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-green-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" value={nome} onChange={e => setNome(e.target.value)} autoFocus placeholder={t('teachersTab.formModal.namePlaceholder', 'Nome do Professor')} />
                    </div>
                </div>

                {/* DOCUMENTO (CPF/DNI/SSN): chave única do professor. O número fica em área protegida, nunca na ficha. */}
                {!profEditando ? (
                    <div className="p-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-xs font-bold text-green-700 dark:text-green-300 flex items-center gap-2 normal-case">
                        <IdCard className="w-4 h-4 shrink-0" /> {t(`document.short.${docForm.tipo}`)} {docForm.numero} · {t('teachersTab.cpf.checked')}
                    </div>
                ) : profEditando.documentoOk && !docAnterior ? (
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 normal-case">
                        <IdCard className="w-4 h-4 shrink-0 text-green-600" /> {veDocumento ? t('teachersTab.cpf.loading') : t('teachersTab.cpf.onlyStaffSees')}
                    </div>
                ) : (
                    <div className="space-y-1 normal-case">
                        <CampoDocumento claro tipo={docForm.tipo} onTipo={(tp) => setDocForm(d => ({ ...d, tipo: tp }))}
                            valor={docForm.numero} onValor={(v) => setDocForm(d => ({ ...d, numero: v }))} id="docFicha" />
                        <p className="text-[11px] text-slate-500 pl-1">{docAnterior ? t('teachersTab.cpf.fixHint') : t('teachersTab.cpf.optionalHint')}</p>
                    </div>
                )}

                {/* Avisos na hora: quem mais tem este e-mail, telefone ou nome */}
                {(parecidasNoForm.length > 0 || avisoTelefoneNovo) && (
                    <div className="space-y-1.5 normal-case">
                        {parecidasNoForm.map(({ ficha, campos }) => (
                            <p key={ficha.id} className={`text-xs font-bold border p-2.5 rounded-lg flex items-start gap-2 ${campos.includes('email')
                                ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
                                : 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{t('teachersTab.cpf.alsoIn', { fields: campos.map(c => t(`teachersTab.cpf.fields.${c}`)).join(', '), name: ficha.nome })}</span>
                            </p>
                        ))}
                        {avisoTelefoneNovo && !parecidasNoForm.some(a => a.campos.includes('telefone')) && (
                            <p className="text-xs font-bold border p-2.5 rounded-lg text-amber-700 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {t('teachersTab.cpf.alsoIn', { fields: t('teachersTab.cpf.fields.telefone'), name: avisoTelefoneNovo })}
                            </p>
                        )}
                    </div>
                )}

                {/* 🟢 PAÍS COM NOME COMPLETO + BANDEIRA E DDI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex gap-2">
                        <div className="w-2/5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">{t('teachersTab.formModal.country', 'País')}</label>
                            <div className="relative">
                                <select 
                                    value={pais} 
                                    onChange={e => { setPais(e.target.value); setTelefone(formatarTelefone(telefone, e.target.value)); }}
                                    className="w-full pl-3 pr-7 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-green-500 rounded-xl text-xs font-bold outline-none transition-all dark:text-white appearance-none"
                                >
                                    {PAISES.map(p => <option key={p.id} value={p.id}>{t(`common.countries.${p.id}`, p.nome)}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                        <div className="w-3/5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 flex items-center justify-between">
                                <span>{t('teachersTab.formModal.whatsapp', 'WhatsApp')} <span className="text-red-500">*</span></span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-black ${PAIS_CONFIG[pais]?.badgeClass}`}>
                                    <FlagIcon pais={pais} /> {DDI_MAP[pais]}
                                </span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input 
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-green-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                                    value={telefone} 
                                    onChange={e => setTelefone(formatarTelefone(e.target.value, pais))} 
                                    placeholder={getPhonePlaceholder(pais)} 
                                    maxLength={15}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">{t('teachersTab.formModal.status', 'Status')}</label>
                        <div className="relative">
                            <select className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-green-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="ativo">✅ {t('teachersTab.formModal.statusActive', 'ATIVO')}</option>
                                <option value="inativo">🚫 {t('teachersTab.formModal.statusInactive', 'INATIVO')}</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                </div>

                {!profEditando && (
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-xl border border-blue-200 dark:border-blue-800">
                            <strong>{t('teachersTab.formModal.noLoginNote', 'Isto cria só o cadastro do professor.')}</strong> {t('teachersTab.formModal.noLoginNoteHint', 'Para acessar o sistema, ele entra pelo Google e pede acesso; o líder, o mentor ou o admin aprovam em Pendências.')}
                        </div>
                        {minhasUnidades.length > 0 && (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">{t('teachersTab.formModal.autoLink', 'Vincular Automaticamente a:')}</label>
                                <div className="relative">
                                    <select 
                                        className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-green-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white"
                                        value={unidadeSelecionadaId} 
                                        onChange={e => setUnidadeSelecionadaId(e.target.value)}
                                    >
                                        {minhasUnidades.length > 1 && <option value="">{t('teachersTab.formModal.select', 'Selecione a unidade...')}</option>}
                                        {minhasUnidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 shrink-0 mt-6">
                    <button type="button" onClick={() => setModalFormAberto(false)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        {t('teachersTab.formModal.cancel', 'Cancelar')}
                    </button>
                    <button type="submit" disabled={salvando} className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-green-500/30 hover:bg-green-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : (profEditando ? t('teachersTab.formModal.saveEdit', 'Salvar Alterações') : <><CheckCircle2 className="w-4 h-4"/> {t('teachersTab.formModal.saveNew', 'Concluir Cadastro')}</>)}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
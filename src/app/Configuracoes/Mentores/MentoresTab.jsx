import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc, onSnapshot, getDocs, limit, Timestamp
} from "firebase/firestore";

// Mentor novo NÃO tem senha: o admin cadastra o e-mail do Google (convite em convites_acesso/{e-mail}).
// No 1º acesso pelo Google com esse e-mail, a pessoa entra direto como mentor (pages/SolicitarAcesso).
import { db } from "../../../services/firebase";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { DocumentoModal, BuscaDocumento } from "../Documento/DocumentoModal";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoValido, limparDocumento, tipoDocumentoPadrao, tipoDocumentoDoPais, formatarDocumento } from "../../../utils/documento";

import { 
    ShieldCheck, Edit2, Trash2, AlertTriangle, CheckCircle2, 
    Loader2, User, Mail, Ban, IdCard, CalendarClock, PowerOff, Plus, X, Phone, Check, Clock, Link2, ScanSearch, Users, ArrowUpCircle, UserMinus, Timer, ChevronDown
} from "lucide-react";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO
import LinkCentral from "../../../centrais/LinkCentral";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { UnidadesVinculadasModal } from "./UnidadesVinculadasModal";
import { SegundoMentorModal } from "./SegundoMentorModal";
import { segundoDe, principalDe, conviteDe, coberturasDe } from "./segundoMentor";
import { sairDeSegundo, promoverASegundo, prorrogarCobertura, encerrarCobertura } from "./acoesSegundoMentor";
import { SeloDoPrazo, PrazoModal } from "../Lideres/TemporariosSecao";
import { ATALHOS_COBERTURA, diaDoFim } from "../../../utils/temporario";
import { FiltroPadrao } from "../ui/FiltroPadrao";
import PopupFlutuante from "../../../components/PopupFlutuante";
import { BotaoDeLinha } from "../ui/BotaoDeLinha";
import { CabecalhoDaAba, CaixaDeNumeros, BotaoPrincipal, BotaoSecundario } from "../ui/CabecalhoDaAba";
import { useFiltroCascata } from "../ui/useFiltroCascata";
import SeloRepetido from "../ui/SeloRepetido";
import { useSelosRepetidos } from "../ui/useSelosRepetidos";
import { mensagemSeContatoEmUso, sincronizarEAvisar } from "../../../services/contatoService";
import { CelulaContato } from "../ui/CelulaContato";
import { CelulaAcesso } from "../ui/CelulaAcesso";
import { ColunaOrdenavel, CLASSE_TITULO } from "../ui/ColunaOrdenavel";
import { MenuDeAcoes } from "../ui/MenuDeAcoes";
import { Selo } from "../ui/Selo";
import { useOrdenacao } from "../ui/useOrdenacao";
import { FlagIcon } from "../ui/Bandeira";
import { PAIS_CONFIG, PAISES, DDI_MAP, PAIS_PADRAO as PAIS_DEFAULT, formatarTelefone, exemploDeTelefone as getPhonePlaceholder } from "../ui/telefone";

export function MentoresTab() {
  const { userData } = useAuth();
  const { catalogs } = useCatalogs(); // admin recebe a rede inteira, sem leitura extra
  const todasUnidades = useMemo(() => catalogs?.unidades || [], [catalogs?.unidades]);
  const [vinculoAlvo, setVinculoAlvo] = useState(null);
  const [segundoAlvo, setSegundoAlvo] = useState(null); // mentor que vai ganhar (ou trocar) o 2º mentor
  const [temporarioAlvo, setTemporarioAlvo] = useState(null); // mentor que vai ganhar um mentor temporário (cobertura)
  const [prazoAlvo, setPrazoAlvo] = useState(null); // pessoa em cobertura que está tendo o prazo mudado
  const [coberturas, setCoberturas] = useState([]); // pessoas (de qualquer papel) com cobertura de algum mentor
  const { t, i18n } = useTranslation(); // 🟢 TRADUTOR CONECTADO
  
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);

  // Cadeado de Permissão (Só Admin acessa Mentores)
  const podeAcessar = role === "admin";

  // Dados
  const [mentores, setMentores] = useState([]);
  const [convites, setConvites] = useState([]); // mentores cadastrados que ainda não fizeram o 1º acesso
  const [loading, setLoading] = useState(true);
  
  // UX
  const [situacao, setSituacao] = useState("todos"); // todos | com | sem | segundo | parado | nunca (filtro próprio da aba, ao lado do status)
  const [statusFiltro, setStatusFiltro] = useState("ativo"); // abre SEMPRE com os ativos; "" = todos | ativo | inativo (clique nos números do topo)
  const [mostrarBuscaDoc, setMostrarBuscaDoc] = useState(false); // busca por CPF/DNI/SSN (esta aba já é só admin)
  const [modalAberto, setModalAberto] = useState(false);
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Forms Modal
  const [mentorEditando, setMentorEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pais, setPais] = useState(PAIS_DEFAULT); // 🟢 CAMPO INTERNACIONAL
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativo");
  const [docTipo, setDocTipo] = useState("cpf"); // documento opcional no convite de mentor novo
  const [docNumero, setDocNumero] = useState("");
  const [docAlvo, setDocAlvo] = useState(null); // { id, nome, email }: documento de um mentor em edição

  // Edição Inline do Telefone na Tabela
  const [editandoTelefoneId, setEditandoTelefoneId] = useState(null);
  const [telefoneInline, setTelefoneInline] = useState("");

  // ==========================================
  // 0. MOTOR DE AUDITORIA (CÂMERA INVISÍVEL)
  // ==========================================
  // Vai para a auditoria única de acessos (quem fez + quem recebeu, com o e-mail do Google).
  const registrarLogAuditoria = (tipoAcao, descricao, mentor, detalhes = "") =>
      registrarAuditoriaAcesso({
          tipoAcao,
          descricao: `Mentor(a) ${mentor?.nome || '-'}: ${descricao}`,
          quem: userData,
          alvo: mentor,
          papelNovo: tipoAcao === 'NOVA' ? 'mentor' : undefined,
          papelAnterior: tipoAcao === 'EXCLUÍDA' ? 'mentor' : undefined,
          detalhes,
          unidadeNome: 'Gestão/Diretoria',
      });

  // ==========================================
  // 1. MOTOR DE TEMPO REAL
  // ==========================================
  useEffect(() => { 
    if (!podeAcessar) return;

    setLoading(true);
    
    const q = query(collection(db, "usuarios"), where("role", "==", "mentor"));
    const unsub = onSnapshot(q, (snap) => {
        setMentores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Erro no tempo real de mentores:", error);
        setLoading(false);
    });

    // Convites pendentes (lista pequena, só o admin lê).
    const unsubConvites = onSnapshot(
        query(collection(db, "convites_acesso"), where("status", "==", "pendente")),
        (snap) => setConvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (error) => console.error("Erro ao ler convites de mentor:", error)
    );

    // Coberturas (mentor temporário): quem tem acesso extra às unidades de outro mentor, de qualquer papel.
    const unsubCoberturas = onSnapshot(
        query(collection(db, "usuarios"), where("coberturaAte", ">", Timestamp.fromMillis(0))),
        (snap) => setCoberturas(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (error) => console.error("Erro ao ler coberturas:", error)
    );

    return () => { unsub(); unsubConvites(); unsubCoberturas(); };
  }, [podeAcessar]);

  // ==========================================
  // 2. PROCESSADOR DE BUSCA E ORDENAÇÃO
  // ==========================================
  // Filtro padrão (busca + país → estado), no navegador sobre o que já está carregado.
  // O mentor não tem estado no cadastro: vale o estado das unidades dele (catálogo já carregado).
  const estadosDoMentor = useMemo(() => {
      const mapa = {};
      todasUnidades.forEach(u => { if (u.mentorId && u.estado) (mapa[u.mentorId] ||= []).push(u.estado); });
      return mapa;
  }, [todasUnidades]);
  const soDoStatus = useCallback((m) => !statusFiltro || (statusFiltro === 'ativo') === (m.status === 'ativo'), [statusFiltro]);

  // Unidades de cada mentor (o 2º mentor tem as do 1º) e quem lidera cada uma: tudo do catálogo já carregado.
  const unidadesDoMentor = useMemo(() => {
      const mapa = {};
      todasUnidades.forEach(u => { if (u.mentorId) (mapa[u.mentorId] ||= []).push(u); });
      return mapa;
  }, [todasUnidades]);
  const unidadesDe = useCallback((m) => unidadesDoMentor[m.mentorPrincipalId || m.id] || [], [unidadesDoMentor]);
  const nomeDaUnidade = useCallback((id) => todasUnidades.find(u => String(u.id) === String(id))?.nome, [todasUnidades]);
  const nomeDoLider = useCallback((uid) => {
      const u = todasUnidades.find(x => x.liderUid === uid || x.lider2Uid === uid);
      return u ? (u.liderUid === uid ? u.liderNome : u.lider2Nome) : undefined;
  }, [todasUnidades]);

  // Situação do mentor: unidades, 2º mentor e há quanto tempo não entra (30 dias sem entrar = parado).
  const [agoraMs] = useState(() => Date.now());
  const situacaoDe = useCallback((m) => {
      const ms = m.ultimoAcesso?.toMillis?.() || 0;
      return {
          com: unidadesDe(m).length > 0,
          sem: unidadesDe(m).length === 0,
          segundo: !m.mentorPrincipalId && !!segundoDe(mentores, m.id),
          nunca: !ms,
          parado: !!ms && agoraMs - ms > 30 * 86400000,
      };
  }, [unidadesDe, mentores, agoraMs]);
  const soDaSituacao = useCallback((m) => situacao === 'todos' || situacaoDe(m)[situacao] === true, [situacao, situacaoDe]);
  const contagemSituacao = useMemo(() => {
      const base = mentores.filter(soDoStatus);
      const c = { todos: base.length, com: 0, sem: 0, segundo: 0, parado: 0, nunca: 0 };
      base.forEach(m => { const s = situacaoDe(m); Object.keys(c).forEach(k => { if (k !== 'todos' && s[k]) c[k]++; }); });
      return c;
  }, [mentores, soDoStatus, situacaoDe]);

  const filtro = useFiltroCascata(mentores, {
      getPais: (m) => m.pais || PAIS_DEFAULT,
      getEstados: (m) => estadosDoMentor[m.mentorPrincipalId || m.id] || [],
      getUnidadeIds: (m) => unidadesDe(m).map(u => u.id),
      getLiderIds: (m) => unidadesDe(m).flatMap(u => [u.liderUid, u.lider2Uid]).filter(Boolean),
      nomeUnidade: nomeDaUnidade,
      nomeLider: nomeDoLider,
      textoBusca: (m) => [m.nome, m.email, m.telefone, principalDe(mentores, m)?.nome, segundoDe(mentores, m.id)?.nome], // o 2º mentor aparece junto do 1º na busca
      extra: (m) => soDoStatus(m) && soDaSituacao(m),
  });

  // Selo "possível repetido" (mesmo telefone de outra pessoa): compara os mentores que a tela já carregou.
  const registrosRepetidos = useMemo(() => mentores.map(m => ({
      origem: 'cracha', id: String(m.id), nome: m.nome, email: m.email, telefone: m.telefone, pais: m.pais || PAIS_DEFAULT,
  })), [mentores]);
  const selosRepetidos = useSelosRepetidos(registrosRepetidos);

  // Todas as colunas ordenam (A→Z / Z→A). Abre por nome, de A a Z.
  // Acesso: quem nunca entrou = 0 → aparece primeiro no A→Z (quem está há mais tempo sem entrar).
  const colunas = useMemo(() => ({
      status: (m) => m.status || '',
      nome: (m) => m.nome || '',
      contato: (m) => m.email || '',
      unidades: (m) => unidadesDe(m).length,
      acesso: (m) => m.ultimoAcesso?.toMillis?.() || 0,
  }), [unidadesDe]);
  const ordenacao = useOrdenacao(filtro.resultado, colunas, { inicial: { campo: 'nome', direcao: 'asc' } });
  const mentoresProcessados = ordenacao.ordenada;

  const kpis = useMemo(() => {
      const ativos = mentores.filter(m => m.status === 'ativo').length;
      const inativos = mentores.filter(m => m.status !== 'ativo').length;
      return { total: mentores.length, ativos, inativos };
  }, [mentores]);

  // ==========================================
  // 3. AÇÕES (CRUD) COM AUDITORIA
  // ==========================================
  function abrirModalNovo() {
    setMentorEditando(null); 
    setDocTipo(tipoDocumentoPadrao(i18n.language)); setDocNumero("");
    setNome(""); 
    setEmail("");
    setPais(PAIS_DEFAULT); // 🟢 RESET DO PAÍS
    setDocTipo(tipoDocumentoDoPais(PAIS_DEFAULT));
    setTelefone(""); 
    setStatus("ativo");
    setErro(""); 
    setSucesso(""); 
    setModalAberto(true);
  }

  function abrirModalEditar(m) {
    setMentorEditando(m); 
    setNome(m.nome || ""); 
    setEmail(m.email || "");
    setPais(m.pais || PAIS_DEFAULT); // 🟢 CARREGA O PAÍS (fallback Brasil se ausente)
    setTelefone(m.telefone || ""); 
    setStatus(m.status || "ativo");
    setErro(""); 
    setSucesso(""); 
    setModalAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(""); 
    setSucesso(""); 
    setSalvando(true);

    if (!nome.trim()) { setSalvando(false); return setErro(t('mentorsTab.messages.nameRequired', 'Nome é obrigatório.')); }
    if (!telefone.trim()) { setSalvando(false); return setErro(t('mentorsTab.extra.whatsappRequired')); }
    if (!email.trim()) { setSalvando(false); return setErro(t('mentorsTab.messages.emailRequired', 'E-mail é obrigatório.')); }
    if (!mentorEditando && !EMAIL_VALIDO.test(email.trim())) { setSalvando(false); return setErro(t('mentorsTab.messages.invalidEmail', 'E-mail inválido.')); }

    try {
      if (mentorEditando) {
        // 🟢 AUDITORIA: Descobrir o que mudou na edição
        let mudancas = [];
        if (mentorEditando.nome !== nome.trim()) mudancas.push(`Nome: ${mentorEditando.nome} ➔ ${nome.trim()}`);
        if (mentorEditando.telefone !== telefone.trim()) mudancas.push(`WhatsApp: ${mentorEditando.telefone || 'Sem tel'} ➔ ${telefone.trim()}`);
        if ((mentorEditando.pais || PAIS_DEFAULT) !== pais) mudancas.push(`País: ${mentorEditando.pais || PAIS_DEFAULT} ➔ ${pais}`);
        if (mentorEditando.status !== status) mudancas.push(`Status: ${mentorEditando.status} ➔ ${status}`);

        // Parte B: telefone novo que já é de outra pessoa não é salvo.
        const bloqueio = await mensagemSeContatoEmUso({
          dono: { uid: mentorEditando.id },
          antes: { telefone: mentorEditando.telefone, pais: mentorEditando.pais || PAIS_DEFAULT },
          depois: { telefone: telefone.trim(), pais },
        }, t);
        if (bloqueio) { setSalvando(false); return setErro(bloqueio); }

        await updateDoc(doc(db, "usuarios", mentorEditando.id), {
          nome: nome.trim(), 
          pais, // 🟢 SALVA O PAÍS
          telefone: telefone.trim(), 
          status, 
          atualizadoEm: serverTimestamp()
        });
        // Reserva de e-mail/telefone (F3 parte A): depois de salvo; se já é de outra pessoa, só avisa.
        await sincronizarEAvisar({
          dono: { uid: mentorEditando.id },
          antes: { email: mentorEditando.email, telefone: mentorEditando.telefone, pais: mentorEditando.pais || PAIS_DEFAULT },
          depois: { email: mentorEditando.email, telefone: telefone.trim(), pais },
        }, t);

        if (mudancas.length > 0) {
            await registrarLogAuditoria('ALTERADA', 'Dados cadastrais do Mentor atualizados.', { ...mentorEditando, nome: nome.trim() }, mudancas.join(' | '));
        }

        setSucesso(t('mentorsTab.messages.updated', 'Mentor atualizado!'));
      } else {
        // Mentor novo = convite pelo e-mail do Google (sem senha). Cadastrar aqui já é a aprovação do admin.
        const emailGoogle = email.trim().toLowerCase();

        // Quem já tem acesso (outro papel) troca de papel em Controle de Acessos, não por convite.
        const jaTem = await getDocs(query(collection(db, "usuarios"), where("email", "==", emailGoogle), limit(1)));
        if (!jaTem.empty) { setSalvando(false); return setErro(t('mentorsTab.invite.alreadyHasAccess')); }

        if (docNumero.trim() && !documentoValido(docTipo, docNumero)) { setSalvando(false); return setErro(t("document.errors.invalid")); }

        // Parte B: e-mail/telefone que já é de outra pessoa não vira convite.
        const bloqueio = await mensagemSeContatoEmUso({ depois: { email: emailGoogle, telefone: telefone.trim(), pais } }, t);
        if (bloqueio) { setSalvando(false); return setErro(bloqueio); }

        await setDoc(doc(db, "convites_acesso", emailGoogle), {
          // Documento opcional: o mentor novo só o copia para a gaveta privada dele no 1º acesso (pages/InformarDocumento).
          ...(docNumero.trim() ? { documento: { tipo: docTipo, numero: limparDocumento(docNumero) } } : {}),
          papel: "mentor",
          status: "pendente",
          email: emailGoogle,
          nome: nome.trim(),
          pais, // 🟢 SALVA O PAÍS
          telefone: telefone.trim(),
          criadoPor: userId,
          criadoPorNome: userData?.nome || userData?.email || "Admin",
          criadoEm: serverTimestamp()
        });

        await registrarLogAuditoria('NOVA', 'Mentor cadastrado pelo e-mail do Google (aguardando o 1º acesso).',
            { id: null, nome: nome.trim(), email: emailGoogle, emailGoogle });

        setSucesso(t('mentorsTab.invite.created'));
      }
      
      setTimeout(() => { setModalAberto(false); setSucesso(""); }, 1000);

    } catch (e) {
      setErro("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  // CANCELAR CONVITE (não apaga: fica registrado como cancelado)
  async function cancelarConvite(c) {
    if (!window.confirm(t('mentorsTab.invite.cancelConfirm', { name: c.nome, email: c.email }))) return;
    try {
        await updateDoc(doc(db, "convites_acesso", c.id), { status: "cancelado", canceladoPor: userId, canceladoEm: serverTimestamp() });
        await registrarLogAuditoria('ALTERADA', 'Cadastro pelo e-mail do Google cancelado antes do 1º acesso.', { id: null, nome: c.nome, email: c.email, emailGoogle: c.email });
    } catch (e) {
        alert(t('mentorsTab.invite.cancelError') + " " + e.message);
    }
  }

  // EDICAO INLINE DO TELEFONE COM AUDITORIA
  async function salvarTelefoneInline(mentor) {
      if (!telefoneInline.trim()) { alert(t('mentorsTab.extra.phoneRequired')); return; }
      try {
          const telAntigo = mentor.telefone || "Sem telefone";
          await updateDoc(doc(db, "usuarios", mentor.id), { 
              telefone: telefoneInline.trim() 
          });

          if (telAntigo !== telefoneInline.trim()) {
              await registrarLogAuditoria('ALTERADA', 'Edição rápida do WhatsApp do Mentor.', mentor, `Telefone: ${telAntigo} ➔ ${telefoneInline.trim()}`);
          }
          setEditandoTelefoneId(null);
      } catch (error) { 
          alert(t('mentorsTab.extra.savePhoneError')); 
      }
  }

  // ==========================================
  // 2º MENTOR (espelho do 1º: mesmas unidades)
  // ==========================================
  // Tira o 2º mentor: líder/professor volta a ser o que era (a unidade e o nome de líder nunca saíram).
  async function removerSegundo(seg) {
    const principal = principalDe(mentores, seg);
    if (!window.confirm(t('mentorsTab.second.removeConfirm', { name: seg.nome, mentor: principal?.nome || '-' }))) return;
    try {
      setSalvando(true);
      await sairDeSegundo({ cracha: seg });
      await registrarLogAuditoria('ALTERADA', `Deixou de ser 2º mentor de ${principal?.nome || '-'}.`, seg, seg.papelAntesSegundoMentor ? `Voltou a: ${seg.papelAntesSegundoMentor}` : 'Sem papel anterior: ficou sem acesso.');
    } catch (e) { alert(t('mentorsTab.second.errors.save') + ' ' + e.message); } finally { setSalvando(false); }
  }

  // Mentor temporário (cobertura): encerrar agora ou mudar o prazo. A pessoa continua sendo o que era.
  const nomeDoCoberto = (pessoa) => mentores.find((m) => m.id === pessoa.coberturaMentorId)?.nome || '-';
  async function encerrarCoberturaDe(pessoa) {
    if (!window.confirm(t('tempLeader.mentor.endConfirm', { name: pessoa.nome, mentor: nomeDoCoberto(pessoa) }))) return;
    try {
      setSalvando(true);
      await encerrarCobertura(pessoa.id);
      await registrarLogAuditoria('ALTERADA', `Cobertura de ${nomeDoCoberto(pessoa)} encerrada.`, pessoa, 'Voltou ao acesso de antes.');
    } catch (e) { alert(t('mentorsTab.second.errors.save') + ' ' + e.message); } finally { setSalvando(false); }
  }
  async function mudarPrazoCobertura(pessoa, fim) {
    setPrazoAlvo(null);
    try {
      setSalvando(true);
      await prorrogarCobertura(pessoa.id, fim);
      await registrarLogAuditoria('ALTERADA', `Prazo da cobertura de ${nomeDoCoberto(pessoa)} alterado para ${diaDoFim(fim, i18n.language)}.`, pessoa, '');
    } catch (e) { alert(t('mentorsTab.second.errors.save') + ' ' + e.message); } finally { setSalvando(false); }
  }

  // O 2º mentor vira o 1º: recebe todas as unidades; o mentor de antes fica sem unidades (recebe outras depois).
  async function tornarPrimeiro(seg) {
    const principal = principalDe(mentores, seg);
    if (!principal) return;
    const total = todasUnidades.filter(u => u.mentorId === principal.id).length;
    if (!window.confirm(t('mentorsTab.second.promoteConfirm', { name: seg.nome, mentor: principal.nome, count: total }))) return;
    try {
      setSalvando(true);
      const movidas = await promoverASegundo({ principal, segundo: seg, unidades: todasUnidades });
      await registrarLogAuditoria('ALTERADA', `Virou o 1º mentor no lugar de ${principal.nome}.`, seg, `${movidas} unidade(s) passaram de ${principal.nome} para ${seg.nome}.`);
    } catch (e) { alert(t('mentorsTab.second.errors.save') + ' ' + e.message); } finally { setSalvando(false); }
  }

  // Se o 1º mentor sai (inativar ou excluir) e tem 2º mentor, o 2º assume as unidades antes.
  async function passarParaSegundoSeTiver(m) {
    const seg = segundoDe(mentores, m.id);
    if (!seg) return true;
    if (!window.confirm(t('mentorsTab.second.leavesConfirm', { mentor: m.nome, name: seg.nome }))) return false;
    const movidas = await promoverASegundo({ principal: m, segundo: seg, unidades: todasUnidades });
    await registrarLogAuditoria('ALTERADA', `Assumiu as unidades de ${m.nome} (o 1º mentor saiu).`, seg, `${movidas} unidade(s) passaram para ${seg.nome}.`);
    return true;
  }

  // STATUS COM AUDITORIA
  async function alternarStatus(m) {
    const novoStatus = m.status === 'ativo' ? 'inativo' : 'ativo';
    try { 
        if (novoStatus === 'inativo' && !(await passarParaSegundoSeTiver(m))) return;
        await updateDoc(doc(db, "usuarios", m.id), { status: novoStatus }); 
        await registrarLogAuditoria('ALTERADA', `Status modificado para ${novoStatus.toUpperCase()}`, m, novoStatus === 'inativo' ? 'Acesso ao sistema bloqueado.' : 'Acesso ao sistema liberado.');
    } catch (e) { 
        alert(t('mentorsTab.messages.statusError', 'Erro ao mudar status')); 
    }
  }

  // EXCLUSÃO COM AUDITORIA
  async function excluir(m) {
    if(!window.confirm(t('mentorsTab.messages.deleteWarning', { name: m.nome }))) return;
    
    try {
        setSalvando(true);
        if (!(await passarParaSegundoSeTiver(m))) { setSalvando(false); return; }
        await deleteDoc(doc(db, "usuarios", m.id));
        await registrarLogAuditoria('EXCLUÍDA', 'Mentor e acessos excluídos do sistema.', m, `Exclusão definitiva.`);
    } catch (e) { 
        alert(t('mentorsTab.messages.deleteError', 'Erro ao excluir mentor.') + " " + e.message); 
    } finally { 
        setSalvando(false); 
    }
  }


  // Barreira de Segurança Final
  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 font-bold">{t('mentorsTab.restricted', 'Acesso Restrito: Apenas Administradores.')}</div>;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6 uppercase">
      
      {/* HEADER E KPIS */}
      <CabecalhoDaAba abaId="mentores" icone={ShieldCheck} titulo={t('mentorsTab.title', 'Gestão de Mentores')} subtitulo={t('mentorsTab.subtitle', 'Diretoria e Gestores Regionais.')}
        numeros={<CaixaDeNumeros abaId="mentores" itens={[
          { id: "total", rotulo: t('mentorsTab.extra.total'), valor: kpis.total, onClick: () => setStatusFiltro(""), ativo: statusFiltro === "" },
          { id: "ativo", rotulo: t('mentorsTab.extra.active'), valor: kpis.ativos, cor: "text-green-600", onClick: () => setStatusFiltro("ativo"), ativo: statusFiltro === "ativo" },
          { id: "inativo", rotulo: t('mentorsTab.extra.inactive'), valor: kpis.inativos, cor: "text-red-500", onClick: () => setStatusFiltro("inativo"), ativo: statusFiltro === "inativo" },
        ]} />}>
        <BotaoPrincipal abaId="mentores" icone={Plus} onClick={abrirModalNovo}>{t('mentorsTab.newMentor', 'Novo Mentor')}</BotaoPrincipal>
      </CabecalhoDaAba>

      {/* BUSCA + FILTROS (filtro padrão das Configurações; o status são os números do topo) */}
      <FiltroPadrao abaId="mentores" filtro={filtro} mostrar={["pais", "estado", "unidade", "lider"]} ativoExtra={statusFiltro !== "ativo" || situacao !== "todos"} aoLimpar={() => { setStatusFiltro("ativo"); setSituacao("todos"); }} placeholder={t('mentorsTab.searchPlaceholder', 'Buscar mentor, e-mail ou telefone...')}
          acoes={role === "admin" && (
              <button type="button" onClick={() => setMostrarBuscaDoc(v => !v)} aria-expanded={mostrarBuscaDoc}
                  className={`px-4 py-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${mostrarBuscaDoc
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600"}`}>
                  <ScanSearch className="w-4 h-4"/> {t("document.search.title")}
              </button>
          )}>
          {role === "admin" && mostrarBuscaDoc && <BuscaDocumento />}

          {/* Situação: um seletor só, com a contagem de cada grupo (mesmo jeito da aba Líderes) */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 w-fit max-w-full">
            {[
              { id: "todos", rotulo: t('mentorsTab.filter.all') },
              { id: "com", rotulo: t('mentorsTab.filter.with') },
              { id: "sem", rotulo: t('mentorsTab.filter.without') },
              { id: "segundo", rotulo: t('mentorsTab.filter.second') },
              { id: "parado", rotulo: t('mentorsTab.filter.stale') },
              { id: "nunca", rotulo: t('mentorsTab.filter.never') },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setSituacao(f.id)} aria-pressed={situacao === f.id}
                className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-colors ${situacao === f.id
                  ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                {f.rotulo}
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] text-center ${situacao === f.id
                  ? "bg-blue-600 text-white"
                  : (f.id === "parado" || f.id === "nunca" || f.id === "sem") && contagemSituacao[f.id] > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>{contagemSituacao[f.id]}</span>
              </button>
            ))}
          </div>
      </FiltroPadrao>

      {/* CADASTRADOS PELO E-MAIL DO GOOGLE, AINDA SEM O 1º ACESSO */}
      {convites.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4"/> {t('mentorsTab.invite.pendingTitle', { count: convites.length })}
            </p>
            <p className="text-[11px] font-medium normal-case text-amber-700/80 dark:text-amber-400/80">{t('mentorsTab.invite.pendingHelp')}</p>
            <div className="grid gap-2 md:grid-cols-2">
                {convites.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-amber-100 dark:border-slate-700 rounded-xl px-4 py-3">
                        <div className="min-w-0">
                            <p className="font-black text-slate-800 dark:text-white text-sm truncate">{c.nome}</p>
                            <p className="text-xs text-slate-500 font-mono normal-case flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0"/> {c.email}</p>
                        </div>
                        <button onClick={() => cancelarConvite(c)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 transition-colors shrink-0" title={t('mentorsTab.invite.cancel')}>
                            <X className="w-4 h-4"/>
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* TABELA */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm normal-case">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <ColunaOrdenavel campo="status" rotulo={t('mentorsTab.table.status', 'Status')} ordenacao={ordenacao} cor="blue" className="w-28" />
                <ColunaOrdenavel campo="nome" rotulo={t('mentorsTab.table.name', 'Mentor')} ordenacao={ordenacao} cor="blue" />
                <ColunaOrdenavel campo="contato" rotulo={t('teachersTab.table.contact', 'Contato')} ordenacao={ordenacao} cor="blue" className="w-[26%]" />
                <ColunaOrdenavel campo="unidades" rotulo={t('mentorsTab.linked.column', 'Unidades')} ordenacao={ordenacao} cor="blue" className="w-36" />
                <ColunaOrdenavel campo="acesso" rotulo={t('tabela.access.column')} ordenacao={ordenacao} cor="blue" className="w-40" />
                <th className={`${CLASSE_TITULO} text-right w-40`}>{t('mentorsTab.table.actions', 'Ações')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                  <tr>
                      <td colSpan="6" className="p-10 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2"/>
                          <p className="text-slate-400 font-bold">{t('mentorsTab.loading', 'Sincronizando...')}</p>
                      </td>
                  </tr>
              ) : mentoresProcessados.length === 0 ? (
                  <tr>
                      <td colSpan="6" className="p-10 text-center text-slate-400 font-bold text-xs">
                          <User className="w-6 h-6 mx-auto mb-2 opacity-20"/> {t('mentorsTab.emptyState', 'Nenhum mentor encontrado.')}
                      </td>
                  </tr>
              ) : mentoresProcessados.map(m => {
                  const paisAtual = m.pais || PAIS_DEFAULT; // sem país definido = Brasil
                  const paisDDI = DDI_MAP[paisAtual];
                  const ativo = m.status === 'ativo';
                  const principal = m.mentorPrincipalId ? principalDe(mentores, m) : null;
                  const segundo = !m.mentorPrincipalId ? segundoDe(mentores, m.id) : null;
                  const convite = !m.mentorPrincipalId && !segundo ? conviteDe(convites, m.id) : null;
                  const cobrindoMe = coberturasDe(coberturas, m.id); // quem cobre as unidades deste mentor
                  const nUnidades = unidadesDe(m).length;
                  const editarTelefone = () => { setEditandoTelefoneId(m.id); setTelefoneInline(m.telefone ? m.telefone.replace(paisDDI, '').trim() : ""); };

                  return (
                  <tr key={m.id} className={`align-top transition-colors ${ativo ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50' : 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]'}`}>

                    {/* STATUS */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${ativo ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                        {ativo ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {ativo ? t('mentorsTab.table.active', 'ATIVO') : t('mentorsTab.table.inactive', 'INATIVO')}
                      </span>
                    </td>

                    {/* MENTOR: nome + etiquetas (2º mentor, dupla, temporário) */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <LinkCentral tipo="mentor" alvo={m} className="font-black text-slate-800 dark:text-white text-base uppercase">{m.nome}</LinkCentral>
                        <SeloRepetido selo={selosRepetidos.get(`cracha:${m.id}`)} detalheDe={(o) => o.email || ""} />
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        {principal && <div><Selo tipo="tema" abaId="mentores" icone={Users}>{t('mentorsTab.second.badge', { name: principal.nome || '-' })}</Selo></div>}
                        {segundo && <div><Selo tipo="tema" abaId="mentores" icone={Users}>{t('mentorsTab.row.duo', { name: segundo.nome })}</Selo></div>}
                        {convite && <div><Selo tipo="aviso" icone={Clock}>{t('mentorsTab.second.pending', { name: convite.nome })}</Selo></div>}

                        {/* Este mentor está COBRINDO outro (mentor temporário) */}
                        {m.coberturaMentorId && (
                          <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/10 px-2.5 py-1.5 w-fit">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <Selo tipo="tema" abaId="lideres" icone={Timer}>{t('mentorsTab.row.tempBadge')}</Selo>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{t('mentorsTab.row.covers', { name: nomeDoCoberto(m) })}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                              {t('mentorsTab.row.until', { date: diaDoFim(m.coberturaAte, i18n.language) })} <SeloDoPrazo fim={m.coberturaAte} />
                            </div>
                          </div>
                        )}

                        {/* Outras pessoas COBRINDO as unidades deste mentor */}
                        {cobrindoMe.map((c) => (
                          <div key={c.id} className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/10 px-2.5 py-1.5 w-fit">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <Selo tipo="tema" abaId="lideres" icone={Timer}>{t('mentorsTab.row.tempBadge')}</Selo>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{t('mentorsTab.row.coveredBy', { name: c.nome })}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                              {t('mentorsTab.row.until', { date: diaDoFim(c.coberturaAte, i18n.language) })} <SeloDoPrazo fim={c.coberturaAte} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* CONTATO: e-mail + telefone (o lápis edita o número ali mesmo) */}
                    <td className="px-4 py-4">
                        {editandoTelefoneId === m.id ? (
                            <div className="space-y-1">
                                <CelulaContato email={m.email} />
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-500/50 rounded-lg pl-2 pr-1 ring-2 ring-blue-500/20 w-fit">
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border ${PAIS_CONFIG[paisAtual]?.badgeClass}`}>
                                        <FlagIcon pais={paisAtual} /> {paisDDI}
                                    </span>
                                    <input
                                        autoFocus
                                        className="py-1.5 w-32 text-sm font-mono font-bold outline-none bg-transparent dark:text-white ml-1"
                                        value={telefoneInline}
                                        onChange={(e) => setTelefoneInline(formatarTelefone(e.target.value, paisAtual))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') salvarTelefoneInline(m); if (e.key === 'Escape') setEditandoTelefoneId(null); }}
                                        placeholder={getPhonePlaceholder(paisAtual)}
                                    />
                                    <button onClick={() => salvarTelefoneInline(m)} className="p-1 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-md hover:bg-green-600 hover:text-white transition-colors" title={t('common.actions.save')}>
                                        <Check className="w-3.5 h-3.5"/>
                                    </button>
                                    <button onClick={() => setEditandoTelefoneId(null)} className="p-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-md hover:bg-slate-300 transition-colors" title={t('common.actions.cancel')}>
                                        <X className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <CelulaContato email={m.email} telefone={m.telefone} pais={paisAtual} aoEditarTelefone={editarTelefone}
                                semTelefone={
                                    <button type="button" onClick={editarTelefone} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors">
                                        <Phone className="w-3.5 h-3.5"/> {t('mentorsTab.row.addPhone')}
                                    </button>
                                } />
                        )}
                    </td>

                    {/* UNIDADES: o número abre o vínculo (o 2º mentor usa as do 1º) */}
                    <td className="px-4 py-4">
                      {m.mentorPrincipalId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap" title={t('mentorsTab.second.sameUnits', { name: principal?.nome || '-' })}>
                          <Link2 className="w-3.5 h-3.5"/> {t('mentorsTab.row.unitsShared', { count: nUnidades })}
                        </span>
                      ) : (
                        <button onClick={() => setVinculoAlvo(m)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-300 transition-colors whitespace-nowrap" title={t('mentorsTab.linked.manage')}>
                          <Link2 className="w-3.5 h-3.5"/> {t('mentorsTab.row.units', { count: nUnidades })}
                        </button>
                      )}
                    </td>

                    {/* ACESSO: do mentor e, se tiver, do 2º mentor */}
                    <td className="px-4 py-4">
                      <CelulaAcesso quando={m.ultimoAcesso} />
                      {segundo && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                          <CelulaAcesso rotulo={segundo.nome} quando={segundo.ultimoAcesso} />
                        </div>
                      )}
                    </td>

                    {/* AÇÕES: Editar e Documento à vista; o resto no menu ⋯ (excluir sempre por último, em vermelho) */}
                    <td className="px-4 py-4">
                        <div className="flex gap-1.5 justify-end items-center">
                            <BotaoDeLinha abaId="mentores" discreto icone={Edit2} onClick={() => abrirModalEditar(m)} title={t('mentorsTab.table.edit', 'Editar Completo')} />
                            <BotaoDeLinha abaId="mentores" discreto icone={IdCard} onClick={() => setDocAlvo({ id: m.id, nome: m.nome, email: m.email })} title={t('document.modal.edit')} />
                            <MenuDeAcoes itens={[
                                { id: 'unidades', rotulo: t('mentorsTab.linked.manage'), icone: Link2, onClick: () => setVinculoAlvo(m), oculto: !!m.mentorPrincipalId },
                                { id: 'segundo', rotulo: t('mentorsTab.second.add'), icone: Users, onClick: () => setSegundoAlvo(m), oculto: !!m.mentorPrincipalId || !!segundo || !!convite || !ativo },
                                { id: 'primeiro', rotulo: t('mentorsTab.second.makeFirst'), icone: ArrowUpCircle, onClick: () => tornarPrimeiro(m), oculto: !m.mentorPrincipalId },
                                { id: 'temporario', rotulo: t('tempLeader.mentor.add'), icone: Timer, onClick: () => setTemporarioAlvo(m), oculto: !!m.mentorPrincipalId || !ativo },
                                { id: 'prorrogar-meu', rotulo: t('mentorsTab.row.extendMine'), icone: CalendarClock, onClick: () => setPrazoAlvo(m), oculto: !m.coberturaMentorId },
                                ...cobrindoMe.map((c) => ({ id: `prorrogar-${c.id}`, rotulo: t('mentorsTab.row.extendOf', { name: c.nome }), icone: CalendarClock, onClick: () => setPrazoAlvo(c) })),
                                { id: 'status', rotulo: ativo ? t('mentorsTab.table.deactivate', 'Desativar') : t('mentorsTab.table.activate', 'Ativar'), icone: ativo ? PowerOff : CheckCircle2, onClick: () => alternarStatus(m) },
                                { id: 'encerrar-meu', rotulo: t('mentorsTab.row.endMine'), icone: Timer, tipo: 'perigo', onClick: () => encerrarCoberturaDe(m), oculto: !m.coberturaMentorId },
                                ...cobrindoMe.map((c) => ({ id: `encerrar-${c.id}`, rotulo: t('mentorsTab.row.endOf', { name: c.nome }), icone: Timer, tipo: 'perigo', onClick: () => encerrarCoberturaDe(c) })),
                                { id: 'tirar-segundo', rotulo: t('mentorsTab.second.remove'), icone: UserMinus, tipo: 'perigo', onClick: () => removerSegundo(m), oculto: !m.mentorPrincipalId },
                                { id: 'excluir', rotulo: t('mentorsTab.table.delete', 'Excluir Definitivamente'), icone: Trash2, tipo: 'perigo', onClick: () => excluir(m), oculto: !!m.mentorPrincipalId },
                            ]} />
                        </div>
                    </td>
                  </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {segundoAlvo && <SegundoMentorModal principal={segundoAlvo} professores={catalogs?.professores || []} mentores={mentores} unidades={todasUnidades} quem={userData} registrarAuditoria={registrarLogAuditoria} onClose={() => setSegundoAlvo(null)} />}
      {temporarioAlvo && <SegundoMentorModal temporario principal={temporarioAlvo} professores={catalogs?.professores || []} mentores={mentores} unidades={todasUnidades} quem={userData} registrarAuditoria={registrarLogAuditoria} onClose={() => setTemporarioAlvo(null)} />}
      {prazoAlvo && <PrazoModal abaId="mentores" cracha={prazoAlvo} atalhos={ATALHOS_COBERTURA} onFechar={() => setPrazoAlvo(null)} onSalvar={(fim) => mudarPrazoCobertura(prazoAlvo, fim)} />}
      {vinculoAlvo && <UnidadesVinculadasModal mentor={vinculoAlvo} mentores={mentores} unidades={todasUnidades} quem={userData} onClose={() => setVinculoAlvo(null)} />}
      {docAlvo && <DocumentoModal alvo={docAlvo} onClose={() => setDocAlvo(null)} />}

      {modalAberto && (
        <PopupFlutuante
          titulo={mentorEditando ? t('mentorsTab.modal.editTitle', 'Editar Mentor') : t('mentorsTab.modal.newTitle', 'Novo Mentor')}
          onFechar={() => setModalAberto(false)}
          bloquearFechar={salvando}
          rotuloFechar={t('mentorsTab.modal.cancel', 'Cancelar')}
          chaveMemoria="mentores.popupMentor"
          largura={520}
          altura={680}
          rodape={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 disabled:opacity-50">
                {t('mentorsTab.modal.cancel', 'Cancelar')}
              </button>
              <button type="submit" form="form-mentor" disabled={salvando} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (mentorEditando ? t('mentorsTab.modal.saveEdit', 'Salvar Alterações') : t('mentorsTab.modal.saveNew', 'Concluir Cadastro'))}
              </button>
            </div>
          }
        >
          <form id="form-mentor" onSubmit={salvar} className="p-5 space-y-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('mentorsTab.modal.instructions', 'Preencha os dados abaixo.')}</p>
              
              {erro && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
              {sucesso && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}

              <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('mentorsTab.modal.name', 'Nome do Mentor')}</label>
                  <div className="relative">
                      <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                      <input 
                          value={nome} 
                          onChange={e=>setNome(e.target.value)} 
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl text-sm font-bold text-slate-800 dark:text-white uppercase outline-none dark:text-white" 
                          placeholder={t('mentorsTab.extra.fullNamePlaceholder')} 
                      />
                  </div>
              </div>
              
              {/* 🟢 PAÍS (nome completo) E STATUS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('mentorsTab.modal.country', 'País')}</label>
                      <div className="relative">
                          <select 
                              value={pais} 
                              onChange={e => {
                                  const novoPais = e.target.value;
                                  setPais(novoPais);
                                  setTelefone(formatarTelefone(telefone, novoPais));
                                  if (!mentorEditando) { const novoTipo = tipoDocumentoDoPais(novoPais); setDocTipo(novoTipo); setDocNumero(formatarDocumento(novoTipo, limparDocumento(docNumero))); }
                              }}
                              className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl text-sm font-bold text-slate-800 dark:text-white uppercase outline-none appearance-none dark:text-white"
                          >
                              {PAISES.map(p => <option key={p.id} value={p.id}>{t(`common.countries.${p.id}`, p.nome)}</option>)}
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
                  {mentorEditando && (
                  <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{t('mentorsTab.modal.status', 'Status')}</label>
                      <div className="relative">
                          <select 
                              value={status} 
                              onChange={e=>setStatus(e.target.value)} 
                              className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl text-sm font-bold text-slate-800 dark:text-white uppercase outline-none appearance-none dark:text-white"
                          >
                              <option value="ativo">✅ {t('mentorsTab.modal.statusActive', 'ATIVO')}</option>
                              <option value="inativo">🚫 {t('mentorsTab.modal.statusInactive', 'INATIVO')}</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
                  )}
              </div>

              {/* 🟢 WHATSAPP COM MÁSCARA DINÂMICA POR PAÍS */}
              <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center justify-between">
                      <span>{t('mentorsTab.modal.phone', 'WhatsApp')}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-black ${PAIS_CONFIG[pais]?.badgeClass}`}>
                          <FlagIcon pais={pais} /> {DDI_MAP[pais]}
                      </span>
                  </label>
                  <div className="relative">
                      <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                      <input 
                          value={telefone} 
                          onChange={e=>setTelefone(formatarTelefone(e.target.value, pais))} 
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl text-sm font-bold text-slate-800 dark:text-white uppercase outline-none dark:text-white" 
                          placeholder={getPhonePlaceholder(pais)}
                      />
                  </div>
              </div>

              {!mentorEditando && (
                <div className="space-y-1">
                  <CampoDocumento key={pais} claro id="convite-documento" tipoDoPais={tipoDocumentoDoPais(pais)} tipo={docTipo} onTipo={setDocTipo} valor={docNumero} onValor={setDocNumero} desabilitado={salvando} />
                  <p className="text-[11px] text-slate-400 ml-1">{t("document.invite.hint")}</p>
                </div>
              )}

              <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">{mentorEditando ? t('mentorsTab.modal.email', 'Login (E-mail)') : t('mentorsTab.invite.googleEmail')}</label>
                  <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                      <input 
                          value={email} 
                          onChange={e=>setEmail(e.target.value)} 
                          disabled={!!mentorEditando} 
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl text-sm font-bold text-slate-800 dark:text-white uppercase outline-none disabled:opacity-50 dark:text-white" 
                          placeholder={mentorEditando ? "mentor@pratique.com" : "nome@gmail.com"}
                      />
                  </div>
                  {!mentorEditando && (
                      <p className="text-[11px] font-medium normal-case text-slate-500 dark:text-slate-400 mt-2 pl-1">{t('mentorsTab.invite.googleEmailHelp')}</p>
                  )}
              </div>

          </form>
        </PopupFlutuante>
      )}
    </div>
  );
}
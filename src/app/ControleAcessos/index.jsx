import React, { useState, useEffect } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, Users, Key, ShieldCheck, Mail, Loader2, Search, Edit } from 'lucide-react';

export default function ControleAcessosPage() {
    const { userData, user } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(null);
    const [busca, setBusca] = useState("");

    // Trava de Segurança Nível Banco: Só ADMIN entra aqui.
    const isAdmin = String(userData?.role).toLowerCase() === 'admin';

    const carregarUsuarios = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'usuarios'));
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setUsuarios(lista);
        } catch (error) {
            console.error("Erro ao buscar usuários", error);
            alert("Erro ao buscar usuários no banco de dados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) carregarUsuarios();
    }, [isAdmin]);

    // 🟢 O X-9 INTEGRADO (O Olho Que Tudo Vê)
    const registrarAuditoriaAcesso = async (acao, descricao, usuarioAlvo, oldRole, newRole) => {
        try {
            await addDoc(collection(db, 'auditoria_configuracoes'), {
                tipoAcao: acao,
                descricao: descricao,
                modulo: 'CONFIGURACOES',
                diffExtras: `Alvo: ${usuarioAlvo.nome} (${usuarioAlvo.emailAuth || usuarioAlvo.email})`,
                estadoAnterior: oldRole ? { nivel_acesso: String(oldRole).toUpperCase(), usuario: usuarioAlvo.nome } : null,
                estadoNovo: newRole ? { nivel_acesso: String(newRole).toUpperCase(), usuario: usuarioAlvo.nome } : null,
                usuarioAcaoNome: userData?.nome || 'Administrador',
                usuarioAcaoId: user.uid,
                dataAcao: serverTimestamp()
            });
        } catch (error) {
            console.error("Falha ao gravar log de auditoria", error);
        }
    };

    const alterarRole = async (userId, userNome, oldRole, newRole) => {
        if (oldRole === newRole) return;
        if (!window.confirm(`Tem certeza que deseja alterar o acesso de ${userNome} para ${newRole.toUpperCase()}?`)) return;

        setProcessando(userId);
        try {
            await updateDoc(doc(db, 'usuarios', userId), { role: newRole });
            
            // X-9 EM AÇÃO
            await registrarAuditoriaAcesso(
                'ALTERADA', 
                `Alteração de Nível de Hierarquia/Acesso`, 
                { nome: userNome, email: userId }, 
                oldRole, 
                newRole
            );

            alert(`✅ Permissão de ${userNome} atualizada com sucesso!`);
            carregarUsuarios(); 
        } catch (error) {
            console.error(error);
            alert("Erro ao alterar permissão.");
        } finally {
            setProcessando(null);
        }
    };

    const dispararResetSenha = async (email, nome) => {
        if (!email) return alert("Este usuário não tem um e-mail de login válido cadastrado.");
        if (!window.confirm(`Enviar link de redefinição de senha para o e-mail: ${email}?`)) return;

        setProcessando(email);
        try {
            await sendPasswordResetEmail(auth, email);
            
            // X-9 EM AÇÃO
            await registrarAuditoriaAcesso(
                'NOVA', 
                `Envio de Redefinição de Senha Solicitado`, 
                { nome: nome, email: email }, 
                null, 
                null
            );

            alert(`✅ Link de recuperação enviado para ${email}!`);
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar e-mail. Verifique se o e-mail está correto no Firebase Auth.");
        } finally {
            setProcessando(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
                <ShieldAlert className="w-20 h-20 mb-4 text-rose-500 opacity-50" />
                <h2 className="text-2xl font-black uppercase tracking-widest text-slate-700">Acesso Negado</h2>
                <p className="mt-2 text-sm font-bold uppercase">Área restrita à Diretoria (Master) do Sistema.</p>
            </div>
        );
    }

    const usuariosFiltrados = usuarios.filter(u => 
        (u.nome || '').toLowerCase().includes(busca.toLowerCase()) || 
        (u.emailAuth || '').toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <span className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg">
                            <Key className="w-7 h-7" />
                        </span>
                        Controle de Acessos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold text-sm uppercase">
                        Gerencie hierarquias, permissões e senhas de todos os usuários da rede.
                    </p>
                </div>
                
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="BUSCAR USUÁRIO OU E-MAIL..." 
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:border-blue-500 transition-colors shadow-sm uppercase"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="p-5">Nome do Usuário</th>
                                    <th className="p-5">E-mail de Login</th>
                                    <th className="p-5">Nível de Acesso (Cargo)</th>
                                    <th className="p-5 text-right">Ações de Segurança</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {usuariosFiltrados.map(u => {
                                    const roleAtual = String(u.role || 'SEM ACESSO').toLowerCase();
                                    
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm
                                                        ${roleAtual === 'admin' ? 'bg-rose-600' : roleAtual === 'mentor' ? 'bg-blue-600' : 'bg-slate-400'}`}>
                                                        {roleAtual === 'admin' ? <ShieldCheck className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-slate-800 dark:text-slate-200 text-sm uppercase block">{u.nome || 'NOME NÃO CADASTRADO'}</span>
                                                        <span className="text-[10px] font-mono text-slate-400 font-bold block mt-0.5">ID: {u.id}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-5">
                                                <span className="font-bold text-slate-600 dark:text-slate-400 text-xs">
                                                    {u.emailAuth || u.email || 'NÃO ENCONTRADO'}
                                                </span>
                                            </td>

                                            <td className="p-5">
                                                <div className="relative w-48">
                                                    <select 
                                                        className={`w-full p-2.5 rounded-lg text-xs font-black uppercase outline-none border transition-all cursor-pointer appearance-none shadow-sm
                                                            ${roleAtual === 'admin' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                                                              roleAtual === 'mentor' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                                                              roleAtual === 'unidade' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                                              'bg-slate-50 border-slate-200 text-slate-700'}
                                                        `}
                                                        value={roleAtual}
                                                        onChange={(e) => alterarRole(u.id, u.nome, roleAtual, e.target.value)}
                                                        disabled={processando === u.id}
                                                    >
                                                        <option value="admin">Admin (Master)</option>
                                                        <option value="mentor">Mentor</option>
                                                        <option value="unidade">Unidade (Líder)</option>
                                                        <option value="professor">Professor</option>
                                                        <option value="bloqueado">Sem Acesso (Bloqueado)</option>
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        {processando === u.id ? <Loader2 className="w-3 h-3 animate-spin text-slate-400"/> : <Edit className="w-3 h-3 opacity-50"/>}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-5 text-right">
                                                <button 
                                                    onClick={() => dispararResetSenha(u.emailAuth || u.email, u.nome)}
                                                    disabled={processando === (u.emailAuth || u.email)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50"
                                                >
                                                    {processando === (u.emailAuth || u.email) ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Mail className="w-3.5 h-3.5"/>}
                                                    Resetar Senha
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        
                        {usuariosFiltrados.length === 0 && (
                            <div className="p-10 text-center font-bold text-slate-400 uppercase text-xs tracking-widest">
                                NENHUM USUÁRIO ENCONTRADO NA BASE DE DADOS.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
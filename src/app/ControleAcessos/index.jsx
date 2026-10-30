import React, { useState, useEffect } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, Users, Key, ShieldCheck, Mail, Loader2, Search, Edit } from 'lucide-react';

// 🟢 IMPORTANDO O NOSSO ESCUDO DE SENHA
import SecurePanel from '../../components/SecurePanel';
import { useTranslation } from 'react-i18next';

export default function ControleAcessosPage() {
    const { userData, user } = useAuth();
    const { t } = useTranslation();
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
            alert(t('misc.access.messages.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) carregarUsuarios();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!window.confirm(t('misc.access.messages.confirmRole', { name: userNome, role: t(`misc.access.roles.${newRole}`, newRole).toUpperCase() }))) return;

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

            alert(t('misc.access.messages.roleUpdated', { name: userNome }));
            carregarUsuarios(); 
        } catch (error) {
            console.error(error);
            alert(t('misc.access.messages.roleError'));
        } finally {
            setProcessando(null);
        }
    };

    const dispararResetSenha = async (email, nome) => {
        if (!email) return alert(t('misc.access.messages.noEmail'));
        if (!window.confirm(t('misc.access.messages.confirmReset', { email }))) return;

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

            alert(t('misc.access.messages.resetSent', { email }));
        } catch (error) {
            console.error(error);
            alert(t('misc.access.messages.resetError'));
        } finally {
            setProcessando(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
                <ShieldAlert className="w-20 h-20 mb-4 text-rose-500 opacity-50" />
                <h2 className="text-2xl font-black uppercase tracking-widest text-slate-700">{t('misc.access.deniedTitle')}</h2>
                <p className="mt-2 text-sm font-bold uppercase">{t('misc.access.deniedDesc')}</p>
            </div>
        );
    }

    const usuariosFiltrados = usuarios.filter(u => 
        (u.nome || '').toLowerCase().includes(busca.toLowerCase()) || 
        (u.emailAuth || '').toLowerCase().includes(busca.toLowerCase())
    );

    return (
        // 🟢 ENVELOPANDO A PÁGINA COM O ESCUDO
        <SecurePanel pinCorreto="7788" titulo={t('misc.access.title')}>
            <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                            <span className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg">
                                <Key className="w-7 h-7" />
                            </span>
                            {t('misc.access.title')}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold text-sm uppercase">
                            {t('misc.access.subtitle')}
                        </p>
                    </div>
                    
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder={t('misc.access.search').toUpperCase()} 
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
                                        <th className="p-5">{t('misc.access.colName')}</th>
                                        <th className="p-5">{t('misc.access.colEmail')}</th>
                                        <th className="p-5">{t('misc.access.colRole')}</th>
                                        <th className="p-5 text-right">{t('misc.access.colActions')}</th>
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
                                                            <span className="font-black text-slate-800 dark:text-slate-200 text-sm uppercase block">{u.nome || t('misc.access.noName')}</span>
                                                            <span className="text-[10px] font-mono text-slate-400 font-bold block mt-0.5">ID: {u.id}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="p-5">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400 text-xs">
                                                        {u.emailAuth || u.email || t('misc.access.notFound')}
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
                                                            <option value="admin">{t('misc.access.roles.admin')}</option>
                                                            <option value="mentor">{t('misc.access.roles.mentor')}</option>
                                                            <option value="unidade">{t('misc.access.roles.unidade')}</option>
                                                            <option value="professor">{t('misc.access.roles.professor')}</option>
                                                            <option value="bloqueado">{t('misc.access.roles.bloqueado')}</option>
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
                                                        {t('misc.access.resetPassword')}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            
                            {usuariosFiltrados.length === 0 && (
                                <div className="p-10 text-center font-bold text-slate-400 uppercase text-xs tracking-widest">
                                    {t('misc.access.empty')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </SecurePanel>
    );
}
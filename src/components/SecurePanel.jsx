import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight } from 'lucide-react';

export default function SecurePanel({ children, pinCorreto = "1234", titulo = "Área Restrita" }) {
    const [desbloqueado, setDesbloqueado] = useState(false);
    const [senhaDigitada, setSenhaDigitada] = useState('');
    const [erro, setErro] = useState(false);

    const handleUnlock = (e) => {
        e.preventDefault();
        // Se a senha bater com o PIN, libera o acesso!
        if (senhaDigitada === pinCorreto) {
            setDesbloqueado(true);
        } else {
            setErro(true);
            setSenhaDigitada('');
            setTimeout(() => setErro(false), 2000); // Tira o erro após 2 segundos
        }
    };

    // Se já estiver desbloqueado, mostra a página normal que está dentro dele
    if (desbloqueado) return <>{children}</>;

    // Se estiver bloqueado, mostra a tela do Cadeado
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center relative overflow-hidden">
                
                {/* Efeito de luz no fundo */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>

                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${erro ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <Lock className={`w-10 h-10 ${erro ? 'animate-bounce' : ''}`} />
                </div>
                
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">{titulo}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-8">
                    Confirme seu PIN de segurança
                </p>
                
                <form onSubmit={handleUnlock}>
                    <input 
                        type="password" 
                        autoFocus
                        value={senhaDigitada}
                        onChange={(e) => setSenhaDigitada(e.target.value)}
                        className={`w-full text-center text-3xl tracking-[0.5em] font-black p-4 rounded-2xl border-2 outline-none transition-all bg-slate-50 dark:bg-slate-950 dark:text-white ${erro ? 'border-rose-500 text-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-slate-800 dark:focus:border-slate-400'}`}
                        placeholder="••••"
                        maxLength={6}
                    />
                    {erro && <p className="text-[10px] font-black text-rose-500 uppercase mt-2 animate-pulse">Senha Incorreta</p>}
                    
                    <button 
                        type="submit"
                        className="mt-6 w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                        Desbloquear Cofre <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
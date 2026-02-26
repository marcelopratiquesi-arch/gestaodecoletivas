import React, { useState, useEffect } from 'react';
import { Moon, Power, Activity } from 'lucide-react';

export default function VigiaNoturno({ children, timeoutMinutes = 15 }) {
    const [isIdle, setIsIdle] = useState(false);

    useEffect(() => {
        let timeoutId;

        const handleActivity = () => {
            // Se já estiver dormindo, ignora a atividade. Só acorda clicando no botão.
            if (isIdle) return; 

            // Reseta o cronômetro
            clearTimeout(timeoutId);
            
            // Inicia um novo cronômetro
            timeoutId = setTimeout(() => {
                setIsIdle(true);
            }, timeoutMinutes * 60 * 1000);
        };

        // Escuta interação do usuário com o sistema
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => window.addEventListener(event, handleActivity));

        // Inicia o relógio na primeira vez
        handleActivity();

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            clearTimeout(timeoutId);
        };
    }, [isIdle, timeoutMinutes]);

    const handleWakeUp = () => {
        setIsIdle(false);
    };

    // SE ESTIVER INATIVO: Desmonta a tela atual (cortando as consultas Firebase) e mostra o descanso
    if (isIdle) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-700">
                <div className="bg-slate-800 p-8 rounded-[32px] border border-slate-700 shadow-2xl flex flex-col items-center max-w-md mx-4 text-center relative overflow-hidden">
                    
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>

                    <div className="w-24 h-24 bg-blue-900/30 rounded-full flex items-center justify-center mb-6 border border-blue-800/50 shadow-inner relative">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping"></div>
                        <Moon className="w-12 h-12 text-blue-400 animate-pulse" />
                    </div>
                    
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-3">
                        SISTEMA EM SONECA
                    </h2>
                    
                    <p className="text-slate-400 text-sm font-bold leading-relaxed mb-8 uppercase tracking-wide px-2">
                        A CONEXÃO DE DADOS FOI PAUSADA POR INATIVIDADE PARA EVITAR CONSUMO DESNECESSÁRIO DE SERVIDOR. 
                    </p>
                    
                    <button 
                        onClick={handleWakeUp}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 uppercase tracking-widest group"
                    >
                        <Power className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        RECONECTAR SISTEMA
                    </button>

                    <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <Activity className="w-3 h-3"/> PROTEÇÃO DE BANCO DE DADOS ATIVA
                    </div>
                </div>
            </div>
        );
    }

    // SE ESTIVER ATIVO: Renderiza a página
    return <>{children}</>;
}
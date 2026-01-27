import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import { User, Lock, Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  
  // Estados
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  // Função de Login (Conectada ao Firebase)
  async function handleLogin(e) {
    e.preventDefault(); // Evita recarregar a página
    setErro("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate("/app");
    } catch (error) {
      setErro(traduzErroFirebase(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black font-sans">
      
      {/* 1. IMAGEM DE FUNDO (Academia Dark) */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40 scale-105 animate-pulse-slow"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop')" }}
      ></div>
      
      {/* 2. MÁSCARA ESCURA (Para dar leitura) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/80 via-transparent to-black/80"></div>

      {/* 3. CARD DE LOGIN */}
      <div className="relative z-10 w-full max-w-md p-6 animate-fade-in">
        
        {/* Container com Efeito Glass/Dark */}
        <div className="bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-8 md:p-10 relative overflow-hidden group">
          
          {/* Brilho Sutil no Topo */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

          {/* LOGO */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-white italic tracking-tighter">
              PRATIQUE <span className="text-red-600">COLETIVAS</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">
              Gestão Happy Zone
            </p>
          </div>

          {/* FORMULÁRIO */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Input Usuário */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Usuário / E-mail</label>
              <div className="relative group/input">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within/input:text-red-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-12 pr-4 py-3.5 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all placeholder:text-zinc-600 placeholder:font-normal"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {/* Input Senha */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Senha</label>
              <div className="relative group/input">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within/input:text-red-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-12 pr-4 py-3.5 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all placeholder:text-zinc-600 placeholder:font-normal"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Mensagem de Erro */}
            {erro && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium animate-pulse">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            {/* Botão de Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm tracking-wide py-4 rounded-xl shadow-lg shadow-red-900/20 hover:shadow-red-600/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Acessando...
                </>
              ) : (
                "ENTRAR NO SISTEMA"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-zinc-600 text-xs">
               Esqueceu sua senha? <a href="#" className="text-zinc-400 hover:text-white underline transition-colors">Contate o suporte</a>
            </p>
            <p className="text-zinc-800 text-[10px] mt-4 font-mono">
              v2.5.0 • Pratique Fitness
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Função Auxiliar de Tradução de Erros
function traduzErroFirebase(e) {
  const code = e?.code || "";
  if (code === "auth/invalid-credential") return "E-mail ou senha incorretos.";
  if (code === "auth/user-not-found") return "Usuário não encontrado.";
  if (code === "auth/wrong-password") return "Senha incorreta.";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Tente novamente mais tarde.";
  if (code === "auth/user-disabled") return "Conta desativada. Fale com o suporte.";
  return "Erro ao acessar. Tente novamente.";
}
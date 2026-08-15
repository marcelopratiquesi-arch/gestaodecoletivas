import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import { User, Lock, Loader2, AlertCircle, ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next"; 

// 🌍 DADOS DAS BANDEIRAS E IDIOMAS
const LANGUAGES = [
  { 
    code: 'pt-BR', 
    name: 'Português', 
    region: '(Brasil)', 
    short: 'PT-BR', 
    flag: 'https://flagcdn.com/w40/br.png' 
  },
  { 
    code: 'en-US', 
    name: 'English', 
    region: '(US)', 
    short: 'EN', 
    flag: 'https://flagcdn.com/w40/us.png' 
  },
  { 
    code: 'es-AR', 
    name: 'Español', 
    region: '(Argentina)', 
    short: 'ES', 
    flag: 'https://flagcdn.com/w40/ar.png' 
  }
];

export default function Login() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("idioma_pratique", lng);
    setIsLangMenuOpen(false); 
  };

  const currentLang = LANGUAGES.find(lang => lang.code === (i18n.language || 'pt-BR')) || LANGUAGES[0];

  function traduzErroFirebase(e) {
    const code = e?.code || "";
    if (code === "auth/invalid-credential") return t("errors.invalidCredential");
    if (code === "auth/user-not-found") return t("errors.userNotFound");
    if (code === "auth/wrong-password") return t("errors.wrongPassword");
    if (code === "auth/too-many-requests") return t("errors.tooManyRequests");
    if (code === "auth/user-disabled") return t("errors.userDisabled");
    return t("errors.default");
  }

  async function handleLogin(e) {
    e.preventDefault();
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black font-sans" onClick={() => setIsLangMenuOpen(false)}>
      
      {/* 🌍 SELETOR DE IDIOMA TÁTICO */}
      <div className="absolute top-6 right-6 z-[60]">
        
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(!isLangMenuOpen); }}
          className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
        >
          <img src={currentLang.flag} alt="Bandeira" className="w-5 h-auto rounded-[2px] shadow-sm" />
          <ChevronDown size={14} className="text-zinc-400" />
        </button>

        {isLangMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden animate-in fade-in slide-in-from-top-2">
            
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Idioma / Language
              </span>
            </div>

            <div className="flex flex-col">
              {LANGUAGES.map((lang) => {
                const isSelected = i18n.language === lang.code;
                
                return (
                  <button
                    type="button"
                    key={lang.code}
                    onClick={(e) => { e.stopPropagation(); changeLanguage(lang.code); }}
                    className={`flex items-center justify-between px-4 py-3 transition-colors text-left
                      ${isSelected ? 'bg-red-600/10' : 'hover:bg-zinc-800'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <img src={lang.flag} alt={lang.name} className="w-6 h-auto rounded-[2px] shadow-sm" />
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold leading-tight ${isSelected ? 'text-red-500' : 'text-zinc-300'}`}>
                          {lang.name}
                        </span>
                        <div className="flex gap-1">
                          {lang.region && (
                            <span className={`text-xs leading-tight ${isSelected ? 'text-red-500/70' : 'text-zinc-500'}`}>
                              {lang.region}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={18} className="text-red-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40 scale-105 animate-pulse-slow"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop')" }}
      ></div>
      
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/80 via-transparent to-black/80"></div>

      <div className="relative z-10 w-full max-w-md p-6 animate-fade-in">
        <div className="bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-8 md:p-10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-white italic tracking-tighter">
              PRATIQUE <span className="text-red-600">COLETIVAS</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">
              {t("login.subtitle")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("login.emailLabel")}
              </label>
              <div className="relative group/input">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within/input:text-red-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-12 pr-4 py-3.5 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all placeholder:text-zinc-600 placeholder:font-normal"
                  placeholder={t("login.emailPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("login.passwordLabel")}
              </label>
              <div className="relative group/input">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within/input:text-red-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white font-bold pl-12 pr-4 py-3.5 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all placeholder:text-zinc-600 placeholder:font-normal tracking-widest"
                  placeholder={t("login.passwordPlaceholder")}
                />
              </div>
            </div>

            {erro && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium animate-pulse">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm tracking-wide py-4 rounded-xl shadow-lg shadow-red-900/20 hover:shadow-red-600/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> {t("login.loading")}
                </>
              ) : (
                t("login.button")
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-zinc-600 text-xs font-bold">
               {t("login.forgotPassword")} <a href="#" className="text-zinc-400 hover:text-white underline transition-colors">{t("login.support")}</a>
            </p>
            <p className="text-zinc-800 text-[10px] mt-4 font-mono font-bold">
              {t("login.version")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
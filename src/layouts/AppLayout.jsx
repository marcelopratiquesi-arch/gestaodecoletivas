import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar/Sidebar"; 
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    // MUDANÇA 2: dark:bg-slate-950 no container principal
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 
          transition-all duration-300 ease-in-out flex flex-col
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 
          md:relative 
          ${collapsed ? "w-20" : "w-64"}
        `}
      >
        {/* Header Mobile da Sidebar */}
        <div className="flex items-center justify-between p-4 h-16 border-b border-slate-800 md:hidden">
           <span className="text-white font-bold">Menu</span>
           <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
             <X size={24} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <Sidebar collapsed={collapsed} />
        </div>

        {/* Botão Retrátil (Desktop) - Ajustado para o tema escuro da sidebar */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-20 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 rounded-full p-1 shadow-md z-50 items-center justify-center w-6 h-6 transition-all hover:scale-110 hover:border-red-600"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        
        {/* Header Mobile (Topo da página) */}
        <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 h-16 transition-colors">
          <button onClick={() => setMobileOpen(true)} className="text-slate-600 dark:text-slate-200 hover:text-red-600">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-slate-800 dark:text-white">Gestão Pratique</span>
        </header>

        {/* MUDANÇA 3: Conteúdo com fundo dinâmico */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950 relative">
          <div className="max-w-7xl mx-auto">
             <Outlet />
          </div>
        </main>
      </div>

      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
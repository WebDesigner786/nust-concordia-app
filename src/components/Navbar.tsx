import React from 'react';
import { 
  UtensilsCrossed, 
  ShieldCheck, 
  ShoppingBag, 
  Clock, 
  User as UserIcon, 
  LogOut, 
  ChefHat, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  currentPortal: 'student' | 'admin';
  setCurrentPortal: (portal: 'student' | 'admin') => void;
  currentUser: UserProfile | null;
  onOpenAuth: (initialMode?: 'login' | 'signup' | 'admin') => void;
  onSignOut: () => void;
  cartCount: number;
  onOpenCart: () => void;
  activeOrdersCount: number;
  onOpenOrders: () => void;
  onQuickDemoSwitch: (role: 'student' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPortal,
  setCurrentPortal,
  currentUser,
  onOpenAuth,
  onSignOut,
  cartCount,
  onOpenCart,
  activeOrdersCount,
  onOpenOrders,
  onQuickDemoSwitch
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] font-black text-white items-center justify-center">
                  3
                </span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  NUST <span className="text-emerald-400">Concordia</span> Central
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  C1 • C2 • C3
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Anti-Scam Verified Ordering Engine • H-12 Campus
              </p>
            </div>
          </div>

          {/* Portal Switcher & Action Tabs */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Portal Switcher Pills */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setCurrentPortal('student')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentPortal === 'student'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Student Portal</span>
              </button>

              <button
                onClick={() => setCurrentPortal('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentPortal === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Admin KDS</span>
                {currentUser?.role === 'admin' && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            </div>

            {/* Quick Demo Access Bar */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Quick Test:
              </span>
              <button 
                onClick={() => onQuickDemoSwitch('student')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Fill as verified SEECS student"
              >
                Student
              </button>
              <button 
                onClick={() => onQuickDemoSwitch('admin')}
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition font-medium"
                title="Sign in as Admin Manager"
              >
                Admin
              </button>
            </div>

            {/* Student action buttons (Cart & Tracker) */}
            {currentPortal === 'student' && (
              <>
                <button
                  onClick={onOpenOrders}
                  className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                  title="Live Order Tracking"
                >
                  <Clock className="w-4 h-4 text-emerald-400" />
                  {activeOrdersCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow">
                      {activeOrdersCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={onOpenCart}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition active:scale-95"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Cart</span>
                  {cartCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white text-emerald-900">
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Auth Buttons / Profile */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                    {currentUser.name}
                    {currentUser.role === 'admin' ? (
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        ADMIN
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {currentUser.dept}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {currentUser.email}
                  </span>
                </div>

                <button
                  onClick={onSignOut}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md transition"
                >
                  Register
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};

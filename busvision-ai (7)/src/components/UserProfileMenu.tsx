import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { 
  User as UserIcon, 
  LogOut, 
  LogIn, 
  ChevronDown, 
  ShieldCheck, 
  Sparkles, 
  RotateCw,
  Mail,
  RefreshCw
} from 'lucide-react';

export const UserProfileMenu: React.FC = () => {
  const { user, isLoading, logout, setIsAuthModalOpen, loginWithGoogle } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitchingGoogle, setIsSwitchingGoogle] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне меню
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Если не авторизован — красивая кнопка "Войти" в стиле Apple macOS
  if (!user) {
    return (
      <button
        onClick={() => setIsAuthModalOpen(true)}
        className="h-8.5 px-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] font-medium flex items-center gap-1.5 shadow-[0_1px_4px_rgba(0,113,227,0.3)] transition active:scale-[0.97] cursor-pointer"
        title="Войти в систему BusVision"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Войти</span>
      </button>
    );
  }

  // Получение инициалов пользователя
  const getInitials = () => {
    if (!user.displayName) return user.email ? user.email.slice(0, 2).toUpperCase() : 'BV';
    const parts = user.displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.displayName.slice(0, 2).toUpperCase();
  };

  const handleSwitchGoogleAccount = async () => {
    setIsSwitchingGoogle(true);
    try {
      await logout();
      await loginWithGoogle();
      setIsOpen(false);
    } catch (err) {
      console.warn('Switch Google account notice:', err);
    } finally {
      setIsSwitchingGoogle(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Кнопка профиля в шапке */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8.5 pl-1.5 pr-2.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] border border-black/[0.06] flex items-center gap-2 transition cursor-pointer active:scale-[0.98]"
        title={user.displayName || user.email || 'Профиль диспетчера'}
      >
        {/* Аватар пользователя */}
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.displayName || 'Аватар'} 
            className="w-6 h-6 rounded-full object-cover ring-1 ring-black/10" 
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0071E3] to-[#409CFF] text-white text-[10px] font-semibold flex items-center justify-center shadow-sm">
            {getInitials()}
          </div>
        )}

        <div className="hidden sm:flex flex-col text-left">
          <span className="text-[12px] font-semibold text-[#1D1D1F] leading-tight max-w-[110px] truncate">
            {user.displayName || user.email?.split('@')[0]}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Выпадающее всплывающее меню Apple Frosted Glass */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-72 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.18)] border border-black/[0.08] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Информационная карточка пользователя */}
          <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.04] flex items-center gap-3 mb-2">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Аватар" 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#0071E3]/20" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0071E3] to-[#409CFF] text-white text-[13px] font-bold flex items-center justify-center shadow">
                {getInitials()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">
                {user.displayName || 'Диспетчер'}
              </div>
              <div className="text-[11px] text-[#86868B] truncate">
                {user.email || 'Без email'}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#34C759]/15 text-[#248A3D] flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {user.providerId === 'google.com' ? 'Google ID' : user.isDemo ? 'Демо' : 'Email ID'}
                </span>
                <span className="text-[10px] text-[#86868B]">Борт №42</span>
              </div>
            </div>
          </div>

          {/* Пункты меню действий */}
          <div className="space-y-1">
            {/* Кнопка смены Google-аккаунта (принудительный вызов select_account) */}
            <button
              onClick={handleSwitchGoogleAccount}
              disabled={isSwitchingGoogle}
              className="w-full h-8.5 px-2.5 rounded-xl hover:bg-black/[0.05] text-[12px] text-[#1D1D1F] font-medium flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {isSwitchingGoogle ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-[#0071E3]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-[#0071E3]" />
              )}
              <span>Сменить Google аккаунт</span>
            </button>

            {/* Выход из системы */}
            <button
              onClick={async () => {
                await logout();
                setIsOpen(false);
              }}
              className="w-full h-8.5 px-2.5 rounded-xl hover:bg-[#FF3B30]/10 text-[12px] text-[#FF3B30] font-medium flex items-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из системы</span>
            </button>
          </div>

          <div className="mt-2 pt-2 border-t border-black/[0.05] text-[10px] text-[#86868B] text-center">
            BusVision Security Core • Google Auth v12
          </div>
        </div>
      )}
    </div>
  );
};

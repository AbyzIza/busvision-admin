import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { BusLogo } from './BusLogo';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  RotateCw,
  Sparkles
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail, 
    sendPasswordReset,
    loginAsDemo,
    authError, 
    clearError 
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    clearError();
    setResetSentSuccess(false);
    onClose();
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      handleClose();
    } catch (err) {
      console.warn('Google sign-in attempt finished with notice:', err);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await loginWithEmail(email, password);
        handleClose();
      } else if (mode === 'signup') {
        await registerWithEmail(email, password, displayName);
        handleClose();
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setResetSentSuccess(true);
      }
    } catch (err) {
      console.warn('Auth action finished with notice:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Затемняющий фон с фирменным Apple размытием (Ultra-thin material blur) */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Окно авторизации в стиле Apple macOS Tahoe / iOS 18 */}
      <div 
        className="relative w-full max-w-[430px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.25)] border border-black/[0.08] p-6 sm:p-8 z-10 transition-all transform scale-100 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия окна */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Фирменная шапка BusVision */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-13 h-13 rounded-2xl bg-[#0071E3] flex items-center justify-center shadow-[0_4px_16px_rgba(0,113,227,0.35)] p-2 mb-3.5">
            <BusLogo size={32} color="#ffffff" />
          </div>
          <h2 className="text-[21px] font-semibold tracking-tight text-[#1D1D1F]">
            {mode === 'signin' 
              ? 'Вход в BusVision' 
              : mode === 'signup' 
              ? 'Регистрация в BusVision' 
              : 'Восстановление доступа'}
          </h2>
          <p className="text-[13px] text-[#86868B] mt-1">
            {mode === 'forgot'
              ? 'Введите email для отправки ссылки сброса пароля'
              : 'Система диспетчеризации и подсчета пассажиропотока'}
          </p>
        </div>

        {/* 1. Кнопка входа через Google с выбором аккаунта */}
        {mode !== 'forgot' && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting}
              className="w-full h-11.5 px-4 rounded-2xl bg-white hover:bg-[#F5F5F7] border border-black/[0.12] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.09)] flex items-center justify-center gap-3 text-[14px] font-medium text-[#1D1D1F] transition cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {isGoogleSubmitting ? (
                <RotateCw className="w-4 h-4 animate-spin text-[#0071E3]" />
              ) : (
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.66-5.2 3.66-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
              )}
              <span>Войти через Google</span>
            </button>
            <p className="text-[11px] text-center text-[#86868B] mt-1.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#34C759]" />
              Всегда запрашивать выбор Google-аккаунта
            </p>

            {/* Разделитель "или" */}
            <div className="flex items-center my-4.5">
              <div className="flex-1 h-[1px] bg-black/[0.08]" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-[#86868B] font-medium">
                или по email
              </span>
              <div className="flex-1 h-[1px] bg-black/[0.08]" />
            </div>
          </div>
        )}

        {/* Сегментированный переключатель Вход / Регистрация */}
        {mode !== 'forgot' && (
          <div className="flex p-1 rounded-2xl bg-[#E5E5EA]/70 mb-4 text-[13px] font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearError();
              }}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] font-semibold'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                clearError();
              }}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] font-semibold'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Регистрация
            </button>
          </div>
        )}

        {/* Сообщение об успешной отправке ссылки сброса */}
        {resetSentSuccess && (
          <div className="p-3.5 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#248A3D] text-[12px] flex items-start gap-2.5 mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Ссылка отправлена</div>
              <div>Проверьте ваш почтовый ящик {email} и следуйте инструкции для установки нового пароля.</div>
            </div>
          </div>
        )}

        {/* Баннер ошибки авторизации */}
        {authError && (
          <div className="p-3.5 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#D70015] text-[12px] flex items-start gap-2.5 mb-4 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Ошибка авторизации</div>
              <div>{authError}</div>
              {/* Быстрый доступ к демо-профилю при ограничениях песочницы */}
              <button
                type="button"
                onClick={() => loginAsDemo()}
                className="mt-2 text-[11px] underline text-[#0071E3] font-medium cursor-pointer block hover:opacity-80"
              >
                Войти в режиме демонстрации (Диспетчер)
              </button>
            </div>
          </div>
        )}

        {/* Форма Email / Пароль */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-medium text-[#86868B] uppercase tracking-wider mb-1 ml-1">
                Имя диспетчера
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Азамат Серікбаев"
                  className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[#F5F5F7] border border-transparent focus:border-[#0071E3] focus:bg-white text-[13px] text-[#1D1D1F] outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[#86868B] uppercase tracking-wider mb-1 ml-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dispatcher@busvision.kz"
                className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[#F5F5F7] border border-transparent focus:border-[#0071E3] focus:bg-white text-[13px] text-[#1D1D1F] outline-none transition"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1 ml-1 mr-1">
                <label className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">
                  Пароль
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      clearError();
                      setResetSentSuccess(false);
                    }}
                    className="text-[11px] text-[#0071E3] hover:underline cursor-pointer"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-10 rounded-2xl bg-[#F5F5F7] border border-transparent focus:border-[#0071E3] focus:bg-white text-[13px] text-[#1D1D1F] outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Кнопка отправки формы */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11.5 mt-2 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[14px] shadow-[0_2px_8px_rgba(0,113,227,0.35)] transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              'Войти'
            ) : mode === 'signup' ? (
              'Зарегистрироваться'
            ) : (
              'Отправить ссылку'
            )}
          </button>
        </form>

        {/* Нижние вспомогательные ссылки */}
        {mode === 'forgot' ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearError();
                setResetSentSuccess(false);
              }}
              className="text-[12px] text-[#0071E3] font-medium hover:underline cursor-pointer"
            >
              ← Вернуться ко входу
            </button>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] text-[#86868B]">
            <span>Защищено Firebase Auth</span>
            <button
              type="button"
              onClick={() => loginAsDemo()}
              className="text-[#0071E3] hover:underline font-medium cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Демо-доступ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

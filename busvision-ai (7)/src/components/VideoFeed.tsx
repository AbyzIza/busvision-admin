import React from 'react';
import { 
  Camera, 
  CameraOff, 
  Sparkles, 
  RefreshCw, 
  ShieldAlert, 
  Radio, 
  Users, 
  LogIn, 
  LogOut, 
  RotateCcw
} from 'lucide-react';
import { CameraStatus, ModelLoadingStatus } from '../types';

interface VideoFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraStatus: CameraStatus;
  modelStatus: ModelLoadingStatus;
  errorMessage: string | null;
  cameraNotice?: string | null;
  onDismissNotice?: () => void;
  passengerCount: number;
  currentInBus?: number;
  enteredCount?: number;
  exitedCount?: number;
  fps: number;
  inferenceTimeMs: number;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onSwitchToLive: () => void;
  onSwitchToDemo: () => void;
  onRetryModel?: () => void;
  onSimulateCross?: (type: 'in' | 'out') => void;
  onResetCounters?: () => void;
  isDemoMode: boolean;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  videoRef,
  canvasRef,
  cameraStatus,
  modelStatus,
  errorMessage,
  cameraNotice,
  onDismissNotice,
  passengerCount,
  currentInBus = 0,
  enteredCount = 0,
  exitedCount = 0,
  fps,
  inferenceTimeMs,
  onStartCamera,
  onStopCamera,
  onSwitchToLive,
  onSwitchToDemo,
  onRetryModel,
  onSimulateCross,
  onResetCounters,
  isDemoMode,
}) => {
  const totalRevenue = enteredCount * 100;

  // Статус салона по шкале загруженности
  const getSalonStatus = () => {
    if (currentInBus < 15) {
      return {
        title: 'Штатно',
        badgeClass: 'bg-[#34C759]/10 text-[#248A3D] border-[#34C759]/20',
        dot: 'bg-[#34C759]',
      };
    }
    if (currentInBus <= 30) {
      return {
        title: 'Уплотнение',
        badgeClass: 'bg-[#FF9500]/10 text-[#C97100] border-[#FF9500]/20',
        dot: 'bg-[#FF9500]',
      };
    }
    return {
      title: 'Перегруз',
      badgeClass: 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20 animate-pulse',
      dot: 'bg-[#FF3B30]',
    };
  };

  const status = getSalonStatus();

  return (
    <div 
      id="bento-camera-feed-card"
      className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 relative flex flex-col justify-between transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
    >
      {/* Верхняя панель в стиле Apple Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-black/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-black/[0.05] text-[#1D1D1F] flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
                Камера входной группы
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20">
                {isDemoMode ? 'Демо-режим' : 'Прямой эфир'}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/20" title="Непрерывное отслеживание любой точки тела без пропуска">
                Zero-Drop 100%
              </span>
            </div>
            <p className="text-[11px] text-[#86868B]">
              Ультра-сканирование человека: Лоб • Затылок • Торс • Ноги
            </p>
          </div>
        </div>

        {/* Элементы управления режимами в стиле iOS Segmented Control */}
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-full bg-[#E5E5EA]/70 flex items-center text-xs">
            <button
              id="btn-switch-live"
              onClick={onSwitchToLive}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                !isDemoMode && cameraStatus === 'active'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] font-semibold'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <Radio className="w-3 h-3 text-[#007AFF]" />
              <span>Камера</span>
            </button>

            <button
              id="btn-switch-simulation"
              onClick={onSwitchToDemo}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                isDemoMode && cameraStatus === 'active'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] font-semibold'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#AF52DE]" />
              <span>Симуляция</span>
            </button>
          </div>

          {/* Кнопка включения камеры в стиле Apple Primary Button */}
          {cameraStatus === 'active' ? (
            <button
              id="btn-stop-camera"
              onClick={onStopCamera}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/[0.05] hover:bg-[#FF3B30]/10 text-[#1D1D1F] hover:text-[#FF3B30] text-xs font-medium transition active:scale-95 cursor-pointer"
              title="Остановить видеопоток"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Остановить</span>
            </button>
          ) : (
            <button
              id="btn-start-camera"
              onClick={onStartCamera}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium shadow-[0_1px_3px_rgba(0,113,227,0.3)] transition active:scale-95 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Включить</span>
            </button>
          )}
        </div>
      </div>

      {/* Экран видеопотока со скруглениями Apple Hardware Display */}
      <div 
        id="video-feed-container"
        className="relative w-full h-[360px] lg:h-[400px] bg-[#000000] rounded-[20px] overflow-hidden border border-black/[0.08] shadow-inner flex items-center justify-center group z-0"
      >
        {/* HTML5 Video */}
        <video
          ref={videoRef}
          id="webcam-video"
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-contain ${
            cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-500`}
        />

        {/* Канвас детекций */}
        <canvas
          ref={canvasRef}
          id="detection-canvas"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
        />

        {/* Уведомление о разрешениях камеры */}
        {cameraNotice && (
          <div 
            id="camera-permission-notice"
            className="absolute top-3.5 left-3.5 right-3.5 z-40 bg-black/75 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-white shadow-2xl"
          >
            <div className="flex items-center gap-2.5 text-[#FFD60A]">
              <ShieldAlert className="w-4 h-4 text-[#FFD60A] shrink-0" />
              <span className="leading-tight text-xs">{cameraNotice}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-notice-retry"
                onClick={onStartCamera}
                className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition active:scale-95 cursor-pointer"
              >
                Повторить
              </button>
              {onDismissNotice && (
                <button
                  id="btn-notice-dismiss"
                  onClick={onDismissNotice}
                  className="p-1 text-white/60 hover:text-white text-xs transition cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* HUD накладки в стиле Apple VisionOS Frosted Glass */}
        {cameraStatus === 'active' && (
          <>
            {/* Верхний левый блок телеметрии */}
            <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap gap-2 pointer-events-none">
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-xs text-white flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.8)]" />
                <span className="font-medium">Vision AI</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-xs text-white shadow-sm tabular-nums">
                <span className="text-white/70">Кадров:</span> <strong className="font-semibold text-white">{fps} FPS</strong>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-xs text-white shadow-sm tabular-nums">
                <span className="text-white/70">Отклик:</span> <strong className="font-semibold text-white">{inferenceTimeMs} мс</strong>
              </div>
            </div>

            {/* Верхний правый индикатор пассажиров в кадре */}
            <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none">
              <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-xs flex items-center gap-2 shadow-lg">
                <Users className="w-3.5 h-3.5 text-[#34C759]" />
                <span className="text-white/80">В объективе:</span>
                <span className="font-semibold text-sm text-[#34C759] tabular-nums">{passengerCount}</span>
              </div>
            </div>
          </>
        )}

        {/* Плавающий виджет статуса борта (Apple Live Activity Widget Style) */}
        <div 
          id="floating-camera-occupancy-card"
          className="absolute bottom-3.5 right-3.5 z-30 bg-white/90 backdrop-blur-2xl rounded-2xl border border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 w-[240px] text-xs pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/[0.05]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
              <span className="font-semibold text-[#1D1D1F]">Борт №42</span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${status.badgeClass}`}>
              {status.title}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#86868B]">Пассажиров в салоне</span>
              <span className="font-semibold text-[#1D1D1F] tabular-nums">{currentInBus} / 35</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#86868B]">Вход / Выход</span>
              <span className="font-medium tabular-nums">
                <span className="text-[#34C759] font-semibold">+{enteredCount}</span> / <span className="text-[#FF3B30] font-semibold">−{exitedCount}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#86868B]">Выручка (100 ₸)</span>
              <span className="font-semibold text-[#248A3D] tabular-nums">{totalRevenue.toLocaleString('ru-RU')} ₸</span>
            </div>
          </div>

          {/* Кнопки симуляции в плавающей карточке */}
          {onSimulateCross && (
            <div className="mt-3 pt-2.5 border-t border-black/[0.05] grid grid-cols-2 gap-2">
              <button
                onClick={() => onSimulateCross('in')}
                className="px-2.5 py-1.5 rounded-full bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#248A3D] text-[11px] font-medium flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                +1 Вход
              </button>
              <button
                onClick={() => onSimulateCross('out')}
                className="px-2.5 py-1.5 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-[11px] font-medium flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                −1 Выход
              </button>
            </div>
          )}
        </div>

        {/* Состояние загрузки модели */}
        {modelStatus === 'loading' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 text-white animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Загрузка детектора пассажиров...
            </h3>
            <p className="text-xs text-white/60 max-w-xs">
              Инициализация нейросетевых весов и ускорения
            </p>
          </div>
        )}

        {/* Экран ожидания (камера выключена) */}
        {cameraStatus !== 'active' && modelStatus !== 'loading' && !errorMessage && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/65 backdrop-blur-md">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3 text-white">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Камера салона отключена
            </h3>
            <p className="text-xs text-white/70 max-w-xs mb-5">
              Включите веб-камеру устройства или запустите интеллектуальную симуляцию потока
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={onStartCamera}
                className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                Включить камеру
              </button>
              <button
                onClick={onSwitchToDemo}
                className="px-5 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition active:scale-95 cursor-pointer"
              >
                Режим симуляции
              </button>
            </div>
          </div>
        )}

        {/* Состояние ошибки */}
        {(errorMessage || modelStatus === 'error') && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FF3B30]/20 flex items-center justify-center mb-3 text-[#FF3B30]">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              {modelStatus === 'error' ? 'Ошибка загрузки модели' : 'Ошибка видеопотока'}
            </h3>
            <p className="text-xs text-white/80 max-w-md mb-4 bg-white/10 p-3 rounded-xl">
              {errorMessage || 'Не удалось подключиться к камере. Доступен режим симуляции.'}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={onRetryModel || onStartCamera}
                className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition active:scale-95 cursor-pointer"
              >
                Повторить
              </button>
              <button
                onClick={onSwitchToDemo}
                className="px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition active:scale-95 cursor-pointer"
              >
                Симуляция
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Нижняя легенда визуализации в Apple Design */}
      <div className="mt-4 pt-3.5 border-t border-black/[0.05] flex flex-wrap items-center justify-between gap-3 text-xs text-[#86868B]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5" title="Сканирование верхней части головы">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF] shadow-[0_0_6px_rgba(0,240,255,0.7)]"></span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">Лоб / Затылок</span>
          </div>
          <div className="flex items-center gap-1.5" title="Центр тяжести и торс">
            <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] shadow-[0_0_6px_rgba(52,199,89,0.7)]"></span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">Торс</span>
          </div>
          <div className="flex items-center gap-1.5" title="Опора и шаг">
            <span className="w-2.5 h-2.5 rounded-full bg-[#AF52DE] shadow-[0_0_6px_rgba(175,82,222,0.7)]"></span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">Ноги</span>
          </div>
          <div className="flex items-center gap-1.5" title="Безостановочный лазерный луч">
            <span className="w-3.5 h-1.5 rounded-full bg-gradient-to-r from-[#00FF00] to-[#00F0FF]"></span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">Лазер-сканер</span>
          </div>
          <div className="flex items-center gap-1.5" title="Удержание трека при временном перекрытии без единого сбоя">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_6px_rgba(0,229,255,0.7)]"></span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">Zero-Drop (без потерь)</span>
          </div>
        </div>

        {onResetCounters && (
          <button
            onClick={onResetCounters}
            className="flex items-center gap-1.5 text-[11px] text-[#86868B] hover:text-[#1D1D1F] transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Сброс счетчиков</span>
          </button>
        )}
      </div>
    </div>
  );
};

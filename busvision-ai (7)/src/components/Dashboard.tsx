import React, { useState, useEffect } from 'react';
import { 
  Users, 
  LogIn, 
  LogOut, 
  RotateCcw, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Navigation,
  Clock
} from 'lucide-react';
import { TrackedPerson, CrossingEvent, ModelLoadingStatus } from '../types';

// Формула гаверсинуса для расчета расстояния по координатам
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

interface DashboardProps {
  enteredCount: number;
  exitedCount: number;
  currentInBus: number;
  passengerInFrame: number;
  trackedPersons: TrackedPerson[];
  recentEvents: CrossingEvent[];
  modelStatus: ModelLoadingStatus;
  fps: number;
  inferenceTimeMs: number;
  confidenceThreshold: number;
  isCloudConnected?: boolean;
  waitingAtStop?: number;
  distance?: number;
  onUpdateWaitingCount?: (count: number) => void;
  onThresholdChange: (val: number) => void;
  onResetCounters: () => void;
  onSimulateCross: (type: 'in' | 'out') => void;
  onAddBulk: (count: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  enteredCount,
  exitedCount,
  currentInBus,
  passengerInFrame,
  recentEvents,
  modelStatus,
  fps,
  inferenceTimeMs,
  waitingAtStop = 0,
  distance: propDistance,
  onUpdateWaitingCount,
  onResetCounters,
  onSimulateCross,
  onAddBulk,
}) => {
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);

  // Навигационный трекер (GPS)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        setCurrentGps({ lat: currentLat, lng: currentLng });

        setStartLocation((prevStart) => {
          if (!prevStart) {
            return { lat: currentLat, lng: currentLng };
          } else {
            const dist = calculateDistance(prevStart.lat, prevStart.lng, currentLat, currentLng);
            setDistance(dist);
            return prevStart;
          }
        });
      },
      (error) => {
        console.warn('Dashboard geolocation note:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 12000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const displayDistance = propDistance !== undefined && propDistance > 0 ? propDistance : distance;

  return (
    <div className="flex flex-col space-y-4">
      {/* 1. Карточка: Пройдено за рейс (Apple Fitness / Maps Widget Style) */}
      <div 
        id="card-distance-traveled"
        className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 relative overflow-hidden transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
              <Navigation className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
                Пройдено за рейс
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Спутниковая навигация GPS
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
            <span>На связи</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tight text-[#1D1D1F] tabular-nums">
              {displayDistance.toFixed(2)}
            </span>
            <span className="text-base font-medium text-[#86868B]">км</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-[#86868B] block">Стартовая точка</span>
            <span className="text-xs font-medium text-[#1D1D1F] tabular-nums">
              {startLocation ? `${startLocation.lat.toFixed(4)}°, ${startLocation.lng.toFixed(4)}°` : 'Определение...'}
            </span>
          </div>
        </div>

        {currentGps && (
          <div className="mt-3.5 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] text-[#86868B]">
            <span>Текущие координаты</span>
            <span className="text-[#1D1D1F] font-medium tabular-nums">
              {currentGps.lat.toFixed(4)}° N, {currentGps.lng.toFixed(4)}° E
            </span>
          </div>
        )}
      </div>

      {/* 2. Карточка: Пассажиры в салоне (Apple Health / Live Activity Widget Style) */}
      <div 
        id="card-real-passenger-counter"
        className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
                Пассажиры в салоне
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Сенсор компьютерного зрения
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
            <span>{modelStatus === 'ready' ? 'Сенсор активен' : 'Калибровка...'}</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight text-[#1D1D1F] tabular-nums">
              {currentInBus}
            </span>
            <span className="text-sm font-medium text-[#86868B]">пассажиров</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-[#86868B] block">В поле зрения камеры</span>
            <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums">{passengerInFrame} чел.</span>
          </div>
        </div>

        {/* Компактные сегменты Вошло / Вышло */}
        <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-black/[0.05]">
          <div className="p-3 rounded-xl bg-[#F5F5F7] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#86868B] block font-medium">Вошло</span>
              <span className="text-lg font-semibold text-[#1D1D1F] tabular-nums">+{enteredCount}</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center">
              <LogIn className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#F5F5F7] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#86868B] block font-medium">Вышло</span>
              <span className="text-lg font-semibold text-[#1D1D1F] tabular-nums">−{exitedCount}</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] text-[#86868B]">
          <span>Частота кадров: <strong className="text-[#1D1D1F] font-medium tabular-nums">{fps} FPS</strong></span>
          <span>Отклик: <strong className="text-[#1D1D1F] font-medium tabular-nums">{inferenceTimeMs} мс</strong></span>
        </div>
      </div>

      {/* 3. Краудсорсинг-виджет: Ожидают на ТРК Актау */}
      <div 
        id="card-crowdsource-waiting"
        className={`rounded-2xl border transition-all duration-300 p-5 relative overflow-hidden ${
          waitingAtStop > 5 
            ? 'bg-[#FF3B30]/[0.03] border-[#FF3B30]/30 shadow-[0_2px_14px_rgba(255,59,48,0.1)]' 
            : 'bg-white border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              waitingAtStop > 5 ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#FF9500]/10 text-[#FF9500]'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
                Ожидают на ТРК Актау
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Онлайн-данные остановки
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 ${
            waitingAtStop > 5
              ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20'
              : 'bg-[#34C759]/10 text-[#248A3D] border-[#34C759]/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${waitingAtStop > 5 ? 'bg-[#FF3B30] animate-ping' : 'bg-[#34C759]'}`} />
            <span>{waitingAtStop > 5 ? 'Высокая нагрузка' : 'Штатно'}</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-4xl font-semibold tracking-tight tabular-nums ${
              waitingAtStop > 5 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'
            }`}>
              {waitingAtStop}
            </span>
            <span className="text-sm font-medium text-[#86868B]">чел.</span>
          </div>

          {waitingAtStop > 5 ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-1 rounded-full border border-[#FF3B30]/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Скопление пассажиров</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#248A3D] bg-[#34C759]/10 px-3 py-1 rounded-full border border-[#34C759]/20">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Посадка свободна</span>
            </div>
          )}
        </div>

        {onUpdateWaitingCount && (
          <div className="mt-3.5 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#86868B]">Тестирование:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateWaitingCount(Math.max(0, waitingAtStop - 1))}
                className="px-2.5 py-1 rounded-full bg-black/[0.05] hover:bg-black/[0.08] active:scale-95 text-[#1D1D1F] text-xs font-medium transition cursor-pointer"
                title="-1 человек"
              >
                −1
              </button>
              <button
                onClick={() => onUpdateWaitingCount(waitingAtStop + 1)}
                className="px-2.5 py-1 rounded-full bg-black/[0.05] hover:bg-black/[0.08] active:scale-95 text-[#1D1D1F] text-xs font-medium transition cursor-pointer"
                title="+1 человек"
              >
                +1
              </button>
              <button
                onClick={() => onUpdateWaitingCount(waitingAtStop > 5 ? 2 : 8)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition active:scale-95 cursor-pointer ${
                  waitingAtStop > 5 
                    ? 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]' 
                    : 'bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/20'
                }`}
                title="Переключить триггер > 5"
              >
                {waitingAtStop > 5 ? 'Сброс (2)' : 'Пик (>5)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. События посадки и высадки (Apple Notification List Style) */}
      <div 
        id="card-real-events-log"
        className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
              История перемещений
            </h3>
          </div>
          <span className="text-[11px] text-[#86868B] font-medium tabular-nums">
            {recentEvents.length} записей
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#86868B]">
            Ожидание пассажиров у зоны дверей...
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {recentEvents.slice(0, 6).map((evt) => (
              <div 
                key={evt.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F5F7] text-xs transition hover:bg-[#EBEBF0]"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${evt.type === 'in' ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                  <span className="font-medium text-[#1D1D1F]">
                    {evt.type === 'in' ? 'Пассажир вошел' : 'Пассажир вышел'}
                  </span>
                  <span className="text-[11px] text-[#86868B] tabular-nums">#{evt.personId}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#86868B] tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>{evt.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Быстрые действия в стиле Apple Actions */}
        <div className="mt-3.5 pt-3.5 border-t border-black/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSimulateCross('in')}
              className="px-3 py-1 rounded-full bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#248A3D] text-xs font-medium transition active:scale-95 cursor-pointer"
            >
              + Вход
            </button>
            <button
              onClick={() => onSimulateCross('out')}
              className="px-3 py-1 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium transition active:scale-95 cursor-pointer"
            >
              − Выход
            </button>
            <button
              onClick={() => onAddBulk(5)}
              className="px-3 py-1 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] text-xs font-medium transition active:scale-95 cursor-pointer"
            >
              +5 пасс.
            </button>
          </div>

          <button
            onClick={onResetCounters}
            className="text-xs text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-1 cursor-pointer transition active:scale-95"
            title="Сбросить счетчики"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Сброс</span>
          </button>
        </div>
      </div>
    </div>
  );
};


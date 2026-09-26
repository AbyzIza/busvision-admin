import React from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  GraduationCap, 
  TrendingUp, 
  ArrowRight, 
  Users, 
  Bot, 
  ShieldAlert,
  Clock
} from 'lucide-react';

interface PredictiveAnalyticsProps {
  occupancy: number;
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({ occupancy }) => {
  // 1. Predictive mathematical simulation as requested:
  // predictedOccupancy = occupancy + 22 (simulation of student rush at Yesenov University)
  const STUDENT_BOARDING_SIMULATION = 22;
  const predictedOccupancy = occupancy + STUDENT_BOARDING_SIMULATION;

  // Maximum nominal bus capacity for visual indicator (e.g. 50 passengers)
  const BUS_CAPACITY = 45;
  const isOverloadPredicted = predictedOccupancy > 40;
  const predictedLoadRatio = Math.min(100, Math.round((predictedOccupancy / BUS_CAPACITY) * 100));

  return (
    <div 
      id="bento-predictive-analytics"
      className={`rounded-3xl bg-white/[0.03] backdrop-blur-xl border transition-all duration-300 p-6 relative overflow-hidden flex flex-col justify-between group shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
        isOverloadPredicted 
          ? 'border-rose-500/40 hover:border-rose-500/60 shadow-[0_8px_35px_rgba(244,63,94,0.18)]' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Background ambient lighting */}
      <div 
        className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isOverloadPredicted ? 'bg-rose-600/20' : 'bg-purple-600/15'
        }`} 
      />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Header with AI Sparkles icon */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/25 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-sm">
              <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  ИИ-Прогноз на 15 минут
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/25 flex items-center gap-1">
                  <span>✨</span>
                  <span>Predictive AI</span>
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                Предиктивная аналитика пассажиропотока
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Горизонт: +15 мин</span>
          </div>
        </div>

        {/* Prediction Metrics Display */}
        <div className="my-5 grid grid-cols-2 gap-3">
          {/* Current Occupancy */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Текущие в салоне</span>
              <Users className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-white">
                {occupancy}
              </span>
              <span className="text-xs text-slate-400">пасс.</span>
            </div>
          </div>

          {/* Predicted Occupancy */}
          <div className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
            isOverloadPredicted
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-purple-500/10 border-purple-500/25'
          }`}>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={isOverloadPredicted ? 'text-rose-300' : 'text-purple-300'}>
                Прогноз у Есенова
              </span>
              <TrendingUp className={`w-3.5 h-3.5 ${isOverloadPredicted ? 'text-rose-400' : 'text-purple-400'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono ${
                isOverloadPredicted ? 'text-rose-400' : 'text-purple-300'
              }`}>
                {predictedOccupancy}
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-white/10 text-slate-200">
                +{STUDENT_BOARDING_SIMULATION}
              </span>
            </div>
          </div>
        </div>

        {/* Simulation Context Description */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 flex items-start gap-3">
          <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-300 mt-0.5">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-white">
              Прогноз для остановки "Университет Есенова":
            </p>
            <p className="text-slate-400 mt-0.5">
              ожидается массовая посадка студентов (~22 чел). Конец 3-й учебной пары (14:30), повышенная нагрузка на остановку.
            </p>
          </div>
        </div>

        {/* Dynamic Alert or Safe Status */}
        <div className="mt-4">
          {isOverloadPredicted ? (
            /* Pulsing Red Alert if predictedOccupancy > 40 */
            <div 
              id="ai-overload-alert"
              className="p-4 rounded-2xl bg-rose-950/60 border-2 border-rose-500/60 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.35)] animate-pulse transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/25 border border-rose-500 flex items-center justify-center text-rose-300 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-bold text-sm text-rose-300 flex items-center gap-1.5 mb-1">
                    <span>⚠️ ВНИМАНИЕ: Прогнозируется критический перегруз</span>
                  </div>
                  <p className="text-rose-100 font-medium">
                    через 7 минут на подъезде к 14 микрорайону.
                  </p>
                  <div className="mt-2.5 p-2 rounded-xl bg-black/40 border border-rose-500/30 text-[11px] text-rose-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
                    <span>
                      <strong>Решение ИИ:</strong> Маршрут №3 перенаправлен на помощь для разгрузки пассажиропотока.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Green Safe Status if predictedOccupancy <= 40 */
            <div 
              id="ai-normal-status"
              className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 transition-all"
            >
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-emerald-300">
                  Прогноз благоприятный, график соблюдается
                </p>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Заполняемость составит {predictedOccupancy} из {BUS_CAPACITY} мест ({predictedLoadRatio}%). Вместимости достаточно.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Dispatcher Telemetry */}
      <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Модель: Smart Transit ML v2.4</span>
        <span className="text-purple-400">Точность прогноза: 94.8%</span>
      </div>
    </div>
  );
};

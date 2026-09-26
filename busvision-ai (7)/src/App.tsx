import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { VideoFeed } from './components/VideoFeed';
import { Dashboard } from './components/Dashboard';
import { LiveMapAktau } from './components/LiveMapAktau';
import { BusLogo } from './components/BusLogo';
import { AuthModal } from './components/AuthModal';
import { UserProfileMenu } from './components/UserProfileMenu';
import { useAuth } from './services/AuthContext';
import { CentroidTracker } from './utils/centroidTracker';
import { 
  Compass, 
  Bell, 
  RotateCw, 
  Bus as BusIcon, 
  Lock,
  User
} from 'lucide-react';
import { 
  syncOccupancyToFirebase, 
  syncLocationToFirebase, 
  subscribeToFirebaseConnection,
  updateStopWaitingCount,
  database,
  db
} from './firebase';
import { ref, onValue, set } from 'firebase/database';
import { 
  DetectedObject, 
  TrackedPerson, 
  CrossingEvent, 
  ModelLoadingStatus, 
  CameraStatus 
} from './types';

// 1. Математика (Формула гаверсинуса):
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// Координаты остановки ТРК Актау
const TRK_AKTAU_COORDS = { lat: 43.6650, lng: 51.1550 };

export default function App() {
  const { isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const requestAnimationRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const isDetectingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const demoIntervalRef = useRef<number | null>(null);

  // Centroid Tracker reference
  const trackerRef = useRef<CentroidTracker>(new CentroidTracker());

  // App States
  const [modelStatus, setModelStatus] = useState<ModelLoadingStatus>('loading');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Cloud Sync State
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);

  // Passenger Counting States (Entered, Exited, InBus)
  const [enteredCount, setEnteredCount] = useState<number>(0);
  const [exitedCount, setExitedCount] = useState<number>(0);
  const [passengerInFrame, setPassengerInFrame] = useState<number>(0);
  const [trackedPersons, setTrackedPersons] = useState<TrackedPerson[]>([]);
  const [recentEvents, setRecentEvents] = useState<CrossingEvent[]>([]);

  // Performance metrics & filters
  const [fps, setFps] = useState<number>(0);
  const [inferenceTimeMs, setInferenceTimeMs] = useState<number>(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live-map' | 'vehicles' | 'routes' | 'analytics'>('dashboard');

  // Crowdsourcing passengers count at stop ТРК Актау (default: 0)
  const [waitingAtStop, setWaitingAtStop] = useState<number>(0);

  // 2. Стейты для подсчета пройденного расстояния (в километрах) и текущей геопозиции (location)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const hasResetWaitingAtStopRef = useRef<boolean>(false);

  // References for render loop & async counter calculations
  const enteredCountRef = useRef<number>(0);
  const exitedCountRef = useRef<number>(0);
  enteredCountRef.current = enteredCount;
  exitedCountRef.current = exitedCount;

  const confidenceThresholdRef = useRef<number>(0.25);
  confidenceThresholdRef.current = confidenceThreshold;
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // Current in bus: Entered - Exited
  const occupancy = Math.max(0, enteredCount - exitedCount);
  const currentInBus = occupancy;

  // Helper to log recent crossing events
  const addCrossingEvent = useCallback((type: 'in' | 'out', personId: number) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setRecentEvents((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        personId,
        timestamp: timeStr,
      },
      ...prev.slice(0, 19),
    ]);
  }, []);

  // Firebase connection listener
  useEffect(() => {
    const unsubscribe = subscribeToFirebaseConnection((connected) => {
      setIsCloudConnected(connected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Жесткий мониторинг переменной occupancy для отправки в Firebase
  useEffect(() => {
    if (occupancy !== undefined) {
      syncOccupancyToFirebase(occupancy)
        .then(() => console.log("Успешно синхронизировано:", occupancy))
        .catch((e) => console.error("Ошибка синхронизации:", e));
    }
  }, [occupancy]);

  // 1. Логика Firebase: слушатель onValue для пути stops/trk_aktau/waitingCount
  useEffect(() => {
    const stopWaitingRef = ref(database, 'stops/trk_aktau/waitingCount');
    const unsubscribe = onValue(
      stopWaitingRef,
      (snapshot) => {
        const val = snapshot.val();
        const count = typeof val === 'number' ? val : Number(val) || 0;
        setWaitingAtStop(count);
      },
      (error) => {
        console.warn('Firebase error reading stops/trk_aktau/waitingCount:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleUpdateWaitingCount = useCallback((count: number) => {
    const safeCount = Math.max(0, count);
    setWaitingAtStop(safeCount);
    updateStopWaitingCount(safeCount);
  }, []);

  // 3. Отслеживание дистанции по GPS (с момента открытия сайта)
  const handlePositionUpdate = useCallback((currentLat: number, currentLng: number) => {
    setLocation({ lat: currentLat, lng: currentLng });
    setStartLocation((prevStart) => {
      if (!prevStart) {
        return { lat: currentLat, lng: currentLng };
      } else {
        const dist = calculateDistance(prevStart.lat, prevStart.lng, currentLat, currentLng);
        setDistance(dist);
        return prevStart;
      }
    });
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        handlePositionUpdate(currentLat, currentLng);
      },
      (error) => {
        console.warn('Geolocation distance watcher warning:', error.message);
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
  }, [handlePositionUpdate]);

  // Автоматическое обнуление счетчика ожидающих на остановке ТРК Актау по GPS
  useEffect(() => {
    if (!location) return;

    // Проверка расстояния между текущей геопозицией автобуса (location) и остановкой ТРК Актау
    const distToStop = calculateDistance(
      location.lat,
      location.lng,
      TRK_AKTAU_COORDS.lat,
      TRK_AKTAU_COORDS.lng
    );

    // Если расстояние становится меньше 0.05 км (50 метров), автобус подъехал к остановке
    if (distToStop < 0.05) {
      // Условие, чтобы обнуление срабатывало только один раз при подъезде, избегая спама запросами в базу
      if (!hasResetWaitingAtStopRef.current) {
        hasResetWaitingAtStopRef.current = true;
        console.log(`[BusVision] Автобус прибыл на остановку ТРК Актау (${(distToStop * 1000).toFixed(0)}м). Обнуление счетчика ожидающих.`);
        set(ref(db, 'stops/trk_aktau/waitingCount'), 0).catch((error) => {
          console.error('Ошибка обнуления счетчика в Firebase:', error);
        });
      }
    } else if (distToStop > 0.1) {
      // Сброс флага при отъезде от остановки дальше 100м для фиксации следующего прибытия
      hasResetWaitingAtStopRef.current = false;
    }
  }, [location]);

  // 1. Initialize TensorFlow.js and load COCO-SSD with local hosting & fallback
  const loadModel = useCallback(async () => {
    try {
      setModelStatus('loading');
      setErrorMessage(null);
      await tf.ready();

      // Tier 1: Load from local static bundle (Fast, offline-friendly, bypasses external GCS CORS/CDN blocks)
      try {
        const localModelUrl = `${window.location.origin}/models/ssdlite_mobilenet_v2/model.json`;
        const localModel = await cocoSsd.load({
          modelUrl: localModelUrl,
          base: 'lite_mobilenet_v2',
        });
        modelRef.current = localModel;
        setModelStatus('ready');
        console.log('COCO-SSD loaded successfully from local repository');
        return;
      } catch (localErr) {
        console.warn('Local COCO-SSD load failed, falling back to official CDN...', localErr);
      }

      // Tier 2: Official lite_mobilenet_v2 CDN
      try {
        const cdnModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2',
        });
        modelRef.current = cdnModel;
        setModelStatus('ready');
        console.log('COCO-SSD loaded successfully from CDN (lite_mobilenet_v2)');
        return;
      } catch (cdnErr) {
        console.warn('CDN lite_mobilenet_v2 failed, falling back to mobilenet_v1...', cdnErr);
      }

      // Tier 3: mobilenet_v1 CDN
      const v1Model = await cocoSsd.load({
        base: 'mobilenet_v1',
      });
      modelRef.current = v1Model;
      setModelStatus('ready');
      console.log('COCO-SSD loaded successfully from CDN (mobilenet_v1)');
    } catch (err) {
      console.error('Failed to load COCO-SSD model:', err);
      setModelStatus('error');
      setErrorMessage('Ошибка загрузки COCO-SSD: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // 2. & 3. Continuous detection and Centroid Tracking loop
  const runDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      if (video && canvas && video.readyState >= 2) {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            const width = canvas.width;
            const height = canvas.height;
            const lineY = Math.round(height / 2);

            ctx.clearRect(0, 0, width, height);

            // Bright Red Door Threshold Line (thickness 3px)
            ctx.save();
            ctx.strokeStyle = '#FF0033';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(255, 0, 51, 0.7)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
            ctx.restore();

            // Door threshold label
            ctx.fillStyle = 'rgba(255, 0, 51, 0.85)';
            const tagHeight = 22;
            const tagWidth = 160;
            ctx.fillRect(8, lineY - tagHeight / 2, tagWidth, tagHeight);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('ПОРОГ ДВЕРЕЙ (ЛИНИЯ)', 14, lineY + 4);

            // Direction arrow tags
            ctx.fillStyle = 'rgba(0, 255, 0, 0.85)';
            ctx.fillRect(width - 120, lineY + 8, 110, 20);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('↓ ВХОД В САЛОН', width - 114, lineY + 22);

            ctx.fillStyle = 'rgba(255, 0, 51, 0.85)';
            ctx.fillRect(width - 120, lineY - 28, 110, 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('↑ ВЫХОД НА УЛИЦУ', width - 114, lineY - 14);

            // Inference
            if (model && !isDetectingRef.current) {
              isDetectingRef.current = true;
              const startInference = performance.now();

              try {
                // Запрашиваем детекции с низким порогом 0.20 для мгновенного захвата любой части тела (лоб, затылок, торс, ноги)
                const minScoreToQuery = Math.min(0.20, confidenceThresholdRef.current);
                const predictions = await model.detect(video, 40, minScoreToQuery);
                const elapsed = performance.now() - startInference;
                setInferenceTimeMs(Math.round(elapsed));

                // FPS
                frameCountRef.current++;
                const now = performance.now();
                if (now - lastFpsTimeRef.current >= 1000) {
                  setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
                  frameCountRef.current = 0;
                  lastFpsTimeRef.current = now;
                }

                // Фильтруем детекции человека по установленному порогу
                const currentThreshold = confidenceThresholdRef.current;
                const personDetections: DetectedObject[] = predictions.filter(
                  (p) => p.class === 'person' && p.score >= currentThreshold
                );

                // Обновляем Zero-Drop Centroid Tracker с анатомическим сканированием тела
                const activeTracks = trackerRef.current.update(
                  personDetections,
                  lineY,
                  {
                    onEnter: (personId) => {
                      setEnteredCount((prev) => prev + 1);
                      addCrossingEvent('in', personId);
                    },
                    onExit: (personId) => {
                      setExitedCount((prev) => prev + 1);
                      addCrossingEvent('out', personId);
                    },
                  }
                );

                setTrackedPersons([...activeTracks]);
                setPassengerInFrame(activeTracks.length);

                // Отрисовка биометрического сканера тела: Лоб, Затылок, Торс, Ноги без единого пропуска
                activeTracks.forEach((track) => {
                  const [x, y, w, h] = track.smoothedBbox;
                  const isHolding = track.lostFrames > 0;
                  const mainColor = isHolding ? '#00E5FF' : '#00FF00';
                  const glowColor = isHolding ? 'rgba(0, 229, 255, 0.8)' : 'rgba(0, 255, 0, 0.8)';
                  const fillColor = isHolding ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 255, 0, 0.08)';

                  ctx.save();

                  // 1. Неоновая рамка видоискателя с легким свечением
                  ctx.strokeStyle = mainColor;
                  ctx.lineWidth = 2;
                  ctx.shadowColor = glowColor;
                  ctx.shadowBlur = 8;
                  ctx.strokeRect(x, y, w, h);
                  ctx.fillStyle = fillColor;
                  ctx.fillRect(x, y, w, h);

                  // 2. Угловые видоискатели (Cyber/Vision Viewfinder)
                  const corner = Math.min(22, w / 4, h / 4);
                  ctx.lineWidth = 3.5;
                  ctx.strokeStyle = mainColor;

                  // Верхний левый угол
                  ctx.beginPath();
                  ctx.moveTo(x, y + corner);
                  ctx.lineTo(x, y);
                  ctx.lineTo(x + corner, y);
                  ctx.stroke();

                  // Верхний правый угол
                  ctx.beginPath();
                  ctx.moveTo(x + w - corner, y);
                  ctx.lineTo(x + w, y);
                  ctx.lineTo(x + w, y + corner);
                  ctx.stroke();

                  // Нижний левый угол
                  ctx.beginPath();
                  ctx.moveTo(x, y + h - corner);
                  ctx.lineTo(x, y + h);
                  ctx.lineTo(x + corner, y + h);
                  ctx.stroke();

                  // Нижний правый угол
                  ctx.beginPath();
                  ctx.moveTo(x + w - corner, y + h);
                  ctx.lineTo(x + w, y + h);
                  ctx.lineTo(x + w, y + h - corner);
                  ctx.stroke();

                  // 3. Динамический лазерный луч биосканирования тела (скользит сверху вниз)
                  const scanPhase = ((performance.now() * 0.003 + track.id * 1.3) % 1);
                  const scanY = y + scanPhase * h;

                  const laserGrad = ctx.createLinearGradient(x, scanY, x + w, scanY);
                  laserGrad.addColorStop(0, 'rgba(0, 255, 200, 0.1)');
                  laserGrad.addColorStop(0.5, isHolding ? 'rgba(0, 229, 255, 0.9)' : 'rgba(0, 255, 100, 0.9)');
                  laserGrad.addColorStop(1, 'rgba(0, 255, 200, 0.1)');

                  ctx.strokeStyle = laserGrad;
                  ctx.lineWidth = 2.5;
                  ctx.beginPath();
                  ctx.moveTo(x + 2, scanY);
                  ctx.lineTo(x + w - 2, scanY);
                  ctx.stroke();

                  // 4. Осевая биометрическая связь точек тела
                  const kp = track.keypoints;
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                  ctx.setLineDash([3, 3]);
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(kp.head.x, kp.head.y);
                  ctx.lineTo(kp.torso.x, kp.torso.y);
                  ctx.lineTo(kp.legs.x, kp.legs.y);
                  ctx.stroke();
                  ctx.setLineDash([]);

                  // 5. Анатомическая точка: ГОЛОВА (ЛОБ / ЗАТЫЛОК)
                  ctx.fillStyle = '#00F0FF';
                  ctx.beginPath();
                  ctx.arc(kp.head.x, kp.head.y, 4, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();

                  // Метка Лоб/Затылок
                  ctx.fillStyle = 'rgba(0, 20, 40, 0.85)';
                  ctx.fillRect(kp.head.x + 8, kp.head.y - 8, 86, 15);
                  ctx.fillStyle = '#00F0FF';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText('ЛОБ/ЗАТЫЛОК', kp.head.x + 11, kp.head.y + 3);

                  // 6. Анатомическая точка: ТОРС
                  ctx.fillStyle = '#34C759';
                  ctx.beginPath();
                  ctx.arc(kp.torso.x, kp.torso.y, 4.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();

                  // Метка Торс
                  ctx.fillStyle = 'rgba(10, 30, 10, 0.85)';
                  ctx.fillRect(kp.torso.x + 8, kp.torso.y - 8, 52, 15);
                  ctx.fillStyle = '#34C759';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText('ТОРС', kp.torso.x + 11, kp.torso.y + 3);

                  // 7. Анатомическая точка: НОГИ / ОПОРА
                  ctx.fillStyle = '#AF52DE';
                  ctx.beginPath();
                  ctx.arc(kp.legs.x, kp.legs.y, 4, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();

                  // Метка Ноги
                  ctx.fillStyle = 'rgba(30, 10, 40, 0.85)';
                  ctx.fillRect(kp.legs.x + 8, kp.legs.y - 8, 52, 15);
                  ctx.fillStyle = '#AF52DE';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText('НОГИ', kp.legs.x + 11, kp.legs.y + 3);

                  // 8. Верхний информационный бейдж пассажира
                  const statusText = isHolding 
                    ? `ID #${track.id} • УДЕРЖАНИЕ ТРЕКА` 
                    : `ID #${track.id} • ${Math.round(track.score * 100)}% • СКАНИРОВАНИЕ`;

                  ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
                  const badgeW = ctx.measureText(statusText).width + 16;
                  const labelY = y > 24 ? y - 22 : y + 4;

                  ctx.fillStyle = mainColor;
                  ctx.fillRect(x, labelY, badgeW, 19);
                  ctx.fillStyle = '#000000';
                  ctx.fillText(statusText, x + 8, labelY + 13);

                  ctx.restore();

                  // 9. Траектория перемещения
                  if (track.history.length > 1) {
                    ctx.save();
                    ctx.strokeStyle = isHolding ? 'rgba(0, 229, 255, 0.6)' : 'rgba(52, 199, 89, 0.6)';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(track.history[0].x, track.history[0].y);
                    for (let i = 1; i < track.history.length; i++) {
                      ctx.lineTo(track.history[i].x, track.history[i].y);
                    }
                    ctx.stroke();
                    ctx.restore();
                  }
                });
              } catch (err) {
                console.error('Detection frame error:', err);
              } finally {
                isDetectingRef.current = false;
              }
            }
          }
        }
      }

      if (isRunningRef.current) {
        requestAnimationRef.current = requestAnimationFrame(detect);
      }
    };

    isRunningRef.current = true;
    requestAnimationRef.current = requestAnimationFrame(detect);
  }, [addCrossingEvent]);

  // 4. Camera Stream Acquisition
  const startCamera = async () => {
    setErrorMessage(null);
    setCameraNotice(null);
    setCameraStatus('requesting');
    setIsDemoMode(false);

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Браузер не поддерживает доступ к веб-камере через mediaDevices.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playAndDetect = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setCameraStatus('active');
              runDetectionLoop();
            }).catch((playErr) => {
              console.warn('Video play notice:', playErr);
              setCameraStatus('active');
              runDetectionLoop();
            });
          }
        };
        videoRef.current.onloadedmetadata = playAndDetect;
        setTimeout(playAndDetect, 250);
      }
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      console.warn('Camera access was not granted by user/browser:', errObj?.message || err);

      const isPermissionDenied = 
        errObj?.name === 'NotAllowedError' || 
        errObj?.name === 'PermissionDeniedError' || 
        (typeof errObj?.message === 'string' && errObj.message.toLowerCase().includes('permission denied'));

      // Graceful Auto-Fallback: start interactive demo stream so the system keeps functioning seamlessly
      startDemoStream();

      if (isPermissionDenied) {
        setCameraNotice('Доступ к веб-камере отклонен браузером. Автоматически активирован режим симуляции. Разрешите камеру в настройках браузера (значок 🔒) для использования реальной камеры.');
      } else if (errObj?.name === 'NotFoundError' || errObj?.name === 'DevicesNotFoundError') {
        setCameraNotice('Веб-камера не найдена на устройстве. Включен режим интерактивной симуляции.');
      } else {
        setCameraNotice('Камера недоступна. Активирован режим симуляции потока.');
      }
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    if (requestAnimationRef.current) {
      cancelAnimationFrame(requestAnimationRef.current);
      requestAnimationRef.current = null;
    }

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    trackerRef.current.reset();
    setTrackedPersons([]);
    setPassengerInFrame(0);
    setCameraStatus('idle');
    setFps(0);
  };

  // Synthetic Simulation Stream
  const startDemoStream = () => {
    stopCamera();
    setIsDemoMode(true);
    setErrorMessage(null);
    setCameraStatus('active');

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 640;
    offscreenCanvas.height = 480;
    const offCtx = offscreenCanvas.getContext('2d');
    if (!offCtx) return;

    let tick = 0;

    interface DemoPerson {
      x: number;
      y: number;
      speedY: number;
      headColor: string;
      shirtColor: string;
      direction: 'down' | 'up';
    }

    const demoPassengers: DemoPerson[] = [
      { x: 220, y: 80, speedY: 2.2, headColor: '#fed7aa', shirtColor: '#2563eb', direction: 'down' },
      { x: 380, y: 390, speedY: -2.0, headColor: '#fde68a', shirtColor: '#dc2626', direction: 'up' },
    ];

    const renderDemoFrame = () => {
      tick += 0.03;

      // Deep dark bus background
      offCtx.fillStyle = '#080808';
      offCtx.fillRect(0, 0, 640, 480);

      // Bus entrance area
      offCtx.fillStyle = '#141414';
      offCtx.fillRect(100, 0, 440, 480);

      // Glass door frame
      offCtx.fillStyle = '#222222';
      offCtx.fillRect(90, 0, 16, 480);
      offCtx.fillRect(534, 0, 16, 480);

      // Steps
      offCtx.strokeStyle = '#2d2d2d';
      offCtx.lineWidth = 2;
      for (let y = 60; y < 480; y += 70) {
        offCtx.beginPath();
        offCtx.moveTo(110, y);
        offCtx.lineTo(530, y);
        offCtx.stroke();
      }

      // Rails
      offCtx.strokeStyle = '#eab308';
      offCtx.lineWidth = 5;
      offCtx.beginPath();
      offCtx.moveTo(140, 0);
      offCtx.lineTo(140, 480);
      offCtx.moveTo(500, 0);
      offCtx.lineTo(500, 480);
      offCtx.stroke();

      // Passengers
      demoPassengers.forEach((p) => {
        p.y += p.speedY;

        if (p.direction === 'down' && p.y > 420) {
          p.y = 50;
        } else if (p.direction === 'up' && p.y < 50) {
          p.y = 420;
        }

        const sway = Math.sin(tick * 3 + p.x) * 6;
        const curX = p.x + sway;
        const curY = p.y;

        // Head
        offCtx.fillStyle = p.headColor;
        offCtx.beginPath();
        offCtx.arc(curX, curY - 35, 20, 0, Math.PI * 2);
        offCtx.fill();

        // Hair
        offCtx.fillStyle = '#374151';
        offCtx.beginPath();
        offCtx.arc(curX, curY - 42, 18, Math.PI, 0);
        offCtx.fill();

        // Torso
        offCtx.fillStyle = p.shirtColor;
        offCtx.beginPath();
        offCtx.roundRect ? offCtx.roundRect(curX - 25, curY - 15, 50, 60, 8) : offCtx.fillRect(curX - 25, curY - 15, 50, 60);
        offCtx.fill();

        // Legs
        offCtx.fillStyle = '#0a0a0a';
        offCtx.fillRect(curX - 20, curY + 45, 16, 50);
        offCtx.fillRect(curX + 4, curY + 45, 16, 50);
      });
    };

    renderDemoFrame();

    try {
      const demoCanvas = offscreenCanvas as HTMLCanvasElement & { captureStream?(fps?: number): MediaStream };
      if (typeof demoCanvas.captureStream === 'function') {
        const demoStream = demoCanvas.captureStream(30);
        streamRef.current = demoStream;

        if (videoRef.current) {
          videoRef.current.srcObject = demoStream;
          const playAndDetect = () => {
            if (videoRef.current) {
              videoRef.current.play().then(() => {
                runDetectionLoop();
              }).catch(() => {
                runDetectionLoop();
              });
            }
          };
          videoRef.current.onloadedmetadata = playAndDetect;
          setTimeout(playAndDetect, 150);
        }
      } else {
        runDetectionLoop();
      }

      demoIntervalRef.current = window.setInterval(renderDemoFrame, 33);
    } catch (err) {
      console.warn('Simulation notice:', err);
      runDetectionLoop();
    }
  };

  const handleResetCounters = () => {
    setEnteredCount(0);
    setExitedCount(0);
    setRecentEvents([]);
    trackerRef.current.reset();
    setTrackedPersons([]);
  };

  const handleSimulateCross = (type: 'in' | 'out') => {
    const fakeId = Math.floor(Math.random() * 900) + 100;
    if (type === 'in') {
      setEnteredCount((prev) => prev + 1);
      addCrossingEvent('in', fakeId);
    } else {
      setExitedCount((prev) => prev + 1);
      addCrossingEvent('out', fakeId);
    }
  };

  const handleAddBulk = (targetCount: number) => {
    setEnteredCount(targetCount);
    setExitedCount(0);
    addCrossingEvent('in', 888);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div 
      id="busvision-app" 
      className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans antialiased flex flex-col items-center justify-start select-none"
    >
      {/* Главный контейнер приложения в стиле Apple macOS / iPadOS */}
      <div className="w-full max-w-7xl flex flex-col min-h-screen">
        
        {/* Фирменная полупрозрачная шапка Apple Top Bar (Frosted Glass) */}
        <header className="sticky top-0 z-50 px-6 py-3.5 backdrop-blur-2xl bg-white/80 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-4 transition-all">
          {/* Логотип и заголовок приложения */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#0071E3] flex items-center justify-center shadow-[0_2px_8px_rgba(0,113,227,0.3)] p-1.5">
              <BusLogo size={22} color="#ffffff" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                  BusVision
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.05] text-[#86868B]">
                  Актау • Борт №42
                </span>
              </div>
            </div>
          </div>

          {/* Центральный навигационный переключатель (iOS 18 Segmented Control) */}
          <div className="flex items-center p-1 rounded-full bg-[#E5E5EA]/70 text-xs font-medium">
            {(['dashboard', 'live-map', 'vehicles', 'routes', 'analytics'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1 rounded-full capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] font-semibold'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {tab === 'dashboard' ? 'Обзор' : tab === 'live-map' ? 'Карта' : tab === 'vehicles' ? 'Флот' : tab === 'routes' ? 'Маршрут' : 'Аналитика'}
              </button>
            ))}
          </div>

          {/* Правый системный блок: статус Firebase + уведомления + профиль пользователя */}
          <div className="flex items-center gap-2.5">
            <div 
              id="header-cloud-sync-pill"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition ${
                isCloudConnected
                  ? 'bg-[#34C759]/10 border-[#34C759]/20 text-[#248A3D]'
                  : 'bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]'
              }`}
              title="Синхронизация с Firebase Realtime Database"
            >
              <span className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-[#34C759] shadow-[0_0_6px_rgba(52,199,89,0.6)]' : 'bg-[#FF3B30]'}`} />
              <span className="text-[11px] font-medium">
                {isCloudConnected ? 'Облако активно' : 'Автономно'}
              </span>
            </div>

            <button 
              className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] flex items-center justify-center transition active:scale-95 cursor-pointer relative"
              title="Уведомления"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF3B30]"></span>
            </button>

            {/* Авторизация: Профиль пользователя или кнопка Вход */}
            <UserProfileMenu />
          </div>
        </header>

        {/* Основной двухколоночный контент (Bento Layout) */}
        <main className="p-4 sm:p-6 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Левая колонка: Камера и Интерактивная карта */}
            <div className="lg:col-span-8 flex flex-col space-y-5">
              {/* Секция видеопотока с детекцией пассажиров */}
              <section id="section-camera-feed">
                <VideoFeed
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  cameraStatus={cameraStatus}
                  modelStatus={modelStatus}
                  errorMessage={errorMessage}
                  cameraNotice={cameraNotice}
                  onDismissNotice={() => setCameraNotice(null)}
                  passengerCount={passengerInFrame}
                  currentInBus={currentInBus}
                  enteredCount={enteredCount}
                  exitedCount={exitedCount}
                  fps={fps}
                  inferenceTimeMs={inferenceTimeMs}
                  onStartCamera={startCamera}
                  onStopCamera={stopCamera}
                  onSwitchToLive={startCamera}
                  onSwitchToDemo={startDemoStream}
                  onRetryModel={loadModel}
                  onSimulateCross={handleSimulateCross}
                  onResetCounters={handleResetCounters}
                  isDemoMode={isDemoMode}
                />
              </section>

              {/* Секция живой карты г. Актау */}
              <section id="section-live-map">
                <LiveMapAktau 
                  occupancy={currentInBus} 
                  waitingAtStop={waitingAtStop}
                  onPositionUpdate={handlePositionUpdate}
                />
              </section>
            </div>

            {/* Правая колонка: Виджеты телеметрии и краудсорсинга в Apple Design */}
            <div className="lg:col-span-4 flex flex-col space-y-5">
              <Dashboard
                enteredCount={enteredCount}
                exitedCount={exitedCount}
                currentInBus={currentInBus}
                passengerInFrame={passengerInFrame}
                trackedPersons={trackedPersons}
                recentEvents={recentEvents}
                modelStatus={modelStatus}
                fps={fps}
                inferenceTimeMs={inferenceTimeMs}
                confidenceThreshold={confidenceThreshold}
                isCloudConnected={isCloudConnected}
                waitingAtStop={waitingAtStop}
                distance={distance}
                onUpdateWaitingCount={handleUpdateWaitingCount}
                onThresholdChange={setConfidenceThreshold}
                onResetCounters={handleResetCounters}
                onSimulateCross={handleSimulateCross}
                onAddBulk={handleAddBulk}
              />
            </div>
          </div>
        </main>

        {/* Лаконичный футер в стиле Apple */}
        <footer className="px-6 py-4 border-t border-black/[0.05] flex flex-wrap items-center justify-between text-xs text-[#86868B]">
          <div>
            BusVision • Система интеллектуального пассажиропотока • г. Актау
          </div>
          <div className="flex items-center gap-4 text-[#86868B]">
            <span>Маршрут №12</span>
            <span>•</span>
            <span>Firebase Realtime Database</span>
            <span>•</span>
            <span>Vision Core</span>
          </div>
        </footer>
      </div>

      {/* Модальное окно авторизации BusVision (Google / Email & Password) */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}

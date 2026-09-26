import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap,
  Circle,
  Polyline
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Crosshair, 
  Users, 
  Bus as BusIcon,
  Radio
} from 'lucide-react';
import { BusLogo } from './BusLogo';
import { syncLocationToFirebase } from '../firebase';

// Fix for default Leaflet icon paths in Vite/bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LiveMapAktauProps {
  occupancy: number;
  waitingAtStop?: number;
  onPositionUpdate?: (lat: number, lng: number) => void;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Координаты маршрута в г. Актау
const DEFAULT_AKTAU_COORDS: Coordinates = {
  lat: 43.6481,
  lng: 51.1706,
};

// Остановки по маршруту
const AKTAU_STOPS = [
  { name: '11-й микрорайон', lat: 43.6570, lng: 51.1620, desc: 'Остановка 11 мкр' },
  { name: 'Университет Есенова', lat: 43.6435, lng: 51.1740, desc: 'Студенческий хаб' },
  { name: 'Набережная (15 мкр)', lat: 43.6390, lng: 51.1560, desc: 'Побережье Каспия' },
  { name: 'Автовокзал Актау', lat: 43.6620, lng: 51.1540, desc: 'Транспортный терминал' },
];

const ROUTE_LINE_COORDS: [number, number][] = [
  [43.6620, 51.1540],
  [43.6570, 51.1620],
  [43.6515, 51.1655],
  [43.6481, 51.1706],
  [43.6435, 51.1740],
  [43.6390, 51.1560],
];

function MapCenterController({ position, triggerCenter }: { position: Coordinates; triggerCenter: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng], map.getZoom(), {
      animate: true,
    });
  }, [position.lat, position.lng, triggerCenter, map]);
  return null;
}

export const LiveMapAktau: React.FC<LiveMapAktauProps> = ({ occupancy, waitingAtStop = 0, onPositionUpdate }) => {
  const [currentPosition, setCurrentPosition] = useState<Coordinates>(DEFAULT_AKTAU_COORDS);
  const [gpsStatus, setGpsStatus] = useState<'seeking' | 'active' | 'fallback' | 'denied'>('seeking');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [recenterCount, setRecenterCount] = useState<number>(0);
  const [isSimulatingGps, setIsSimulatingGps] = useState<boolean>(false);
  const markerRef = useRef<L.Marker | null>(null);

  // Маркер остановки ТРК Актау в стиле Apple Maps
  const crowdsourceStopIcon = useMemo(() => {
    const isCrowded = waitingAtStop > 5;
    return L.divIcon({
      className: 'custom-crowdsource-stop-icon',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          ${
            isCrowded
              ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(255, 59, 48, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : `<div style="position: absolute; width: 40px; height: 40px; border-radius: 9999px; background: rgba(255, 149, 0, 0.2);"></div>`
          }
          <div style="position: relative; width: 34px; height: 34px; border-radius: 12px; background: ${
            isCrowded ? '#FF3B30' : '#FF9500'
          }; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.18); color: #ffffff;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style="position: absolute; top: -7px; font-size: 11px; font-weight: 600; background: ${
            isCrowded ? '#D70015' : '#C97100'
          }; color: #ffffff; padding: 1px 7px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); white-space: nowrap; border: 1.5px solid #ffffff;">
            ${waitingAtStop} чел.
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });
  }, [waitingAtStop]);

  // Маркер автобуса в стиле Apple Maps
  const busDivIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-bus-leaflet-icon',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(0, 113, 227, 0.2); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 34px; height: 34px; border-radius: 12px; background: #ffffff; border: 2px solid #0071E3; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,113,227,0.22); padding: 4px;">
            <img src="/logo.svg" width="20" height="20" style="display: block; object-fit: contain;" alt="Bus" />
          </div>
          <div style="position: absolute; top: -7px; font-size: 11px; font-weight: 600; background: #0071E3; color: #ffffff; padding: 1px 7px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); white-space: nowrap; border: 1.5px solid #ffffff;">
            №42 (${occupancy})
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });
  }, [occupancy]);

  // Маркер промежуточных остановок
  const busStopIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-stop-icon',
      html: `
        <div style="width: 14px; height: 14px; border-radius: 9999px; background: #ffffff; border: 3px solid #34C759; box-shadow: 0 2px 6px rgba(52, 199, 89, 0.4);"></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });
  }, []);

  // HTML5 Geolocation Tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('fallback');
      return;
    }

    setGpsStatus('seeking');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newCoords: Coordinates = {
          lat: latitude,
          lng: longitude,
        };

        setCurrentPosition(newCoords);
        setGpsStatus('active');
        setGpsAccuracy(Math.round(accuracy));
        onPositionUpdate?.(latitude, longitude);
        syncLocationToFirebase(latitude, longitude);
      },
      (error) => {
        console.warn('Geolocation warning:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('fallback');
        }
        syncLocationToFirebase(DEFAULT_AKTAU_COORDS.lat, DEFAULT_AKTAU_COORDS.lng, {
          timestamp: Date.now(),
        });
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
  }, [onPositionUpdate]);

  useEffect(() => {
    if (currentPosition) {
      syncLocationToFirebase(currentPosition.lat, currentPosition.lng, {
        timestamp: Date.now(),
      });
    }
  }, [occupancy, currentPosition]);

  const handleToggleSimulation = () => {
    if (isSimulatingGps) {
      setIsSimulatingGps(false);
      setCurrentPosition(DEFAULT_AKTAU_COORDS);
      syncLocationToFirebase(DEFAULT_AKTAU_COORDS.lat, DEFAULT_AKTAU_COORDS.lng);
      return;
    }

    setIsSimulatingGps(true);
    setGpsStatus('active');
    const deltaLat = (Math.random() - 0.5) * 0.005;
    const deltaLng = (Math.random() - 0.5) * 0.005;
    const simCoords: Coordinates = {
      lat: DEFAULT_AKTAU_COORDS.lat + deltaLat,
      lng: DEFAULT_AKTAU_COORDS.lng + deltaLng,
    };
    setCurrentPosition(simCoords);
    onPositionUpdate?.(simCoords.lat, simCoords.lng);
    syncLocationToFirebase(simCoords.lat, simCoords.lng, {
      speed: 12.5,
      timestamp: Date.now(),
    });
  };

  const handleRecenter = () => {
    setRecenterCount((prev) => prev + 1);
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
  };

  return (
    <div 
      id="bento-live-map-aktau"
      className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 relative overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
    >
      {/* Верхняя панель в стиле Apple Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-black/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-black/[0.05] text-[#1D1D1F] flex items-center justify-center p-1">
            <BusLogo size={20} color="#1D1D1F" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
                Карта маршрута №12 • Борт №42
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                <span>На линии</span>
              </span>
            </div>
            <p className="text-[11px] text-[#86868B]">
              г. Актау • 5 остановок • Каспийское побережье
            </p>
          </div>
        </div>

        {/* Элементы управления в стиле iOS */}
        <div className="flex items-center gap-2">
          <div 
            id="gps-status-pill"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
              gpsStatus === 'active'
                ? 'bg-[#34C759]/10 border-[#34C759]/20 text-[#248A3D]'
                : 'bg-black/[0.03] border-black/[0.06] text-[#86868B]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              gpsStatus === 'active' 
                ? 'bg-[#34C759]' 
                : 'bg-[#FF9500]'
            }`} />
            <span className="text-[11px] font-medium">
              {gpsStatus === 'active' 
                ? `GPS активен ${gpsAccuracy ? `(±${gpsAccuracy}м)` : ''}` 
                : 'Позиция: Актау'}
            </span>
          </div>

          <button
            onClick={handleToggleSimulation}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer active:scale-95 ${
              isSimulatingGps
                ? 'bg-[#0071E3] text-white border-[#0071E3]'
                : 'bg-black/[0.04] hover:bg-black/[0.07] text-[#1D1D1F] border-black/[0.06]'
            }`}
          >
            {isSimulatingGps ? 'Симуляция GPS: ВКЛ' : 'Тест GPS'}
          </button>

          <button
            id="btn-recenter-map"
            onClick={handleRecenter}
            title="Отцентрировать на автобусе №42"
            className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] border border-black/[0.06] text-[#1D1D1F] flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Окно карты Leaflet с фирменным закруглением Apple */}
      <div 
        id="leaflet-map-wrapper"
        className="relative w-full h-[360px] lg:h-[400px] rounded-[20px] overflow-hidden border border-black/[0.08] shadow-inner z-0"
      >
        <MapContainer
          center={[currentPosition.lat, currentPosition.lng]}
          zoom={14}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ height: '100%', width: '100%' }}
        >
          {/* CartoDB Voyager Light Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />

          <MapCenterController 
            position={currentPosition} 
            triggerCenter={recenterCount} 
          />

          {/* Маршрутная нить */}
          <Polyline 
            positions={ROUTE_LINE_COORDS}
            pathOptions={{
              color: '#0071E3',
              weight: 4,
              opacity: 0.8,
              dashArray: '8, 8',
            }}
          />

          {/* Радиус точности GPS */}
          {gpsAccuracy && gpsAccuracy < 300 && (
            <Circle
              center={[currentPosition.lat, currentPosition.lng]}
              radius={gpsAccuracy}
              pathOptions={{
                color: '#0071E3',
                fillColor: '#0071E3',
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
          )}

          {/* Остановки Актау */}
          {AKTAU_STOPS.map((stop) => (
            <Marker
              key={stop.name}
              position={[stop.lat, stop.lng]}
              icon={busStopIcon}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-1 font-sans">
                  <p className="font-semibold text-xs text-[#1D1D1F]">🚏 {stop.name}</p>
                  <p className="text-[11px] text-[#86868B]">{stop.desc}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Остановка ТРК Актау с краудсорсингом пассажиров */}
          <Marker
            position={[43.6650, 51.1550]}
            icon={crowdsourceStopIcon}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1.5 font-sans min-w-[175px]">
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5 mb-1.5">
                  <span className="font-semibold text-xs text-[#1D1D1F]">🚏 ТРК «Актау»</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    waitingAtStop > 5 ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#FF9500]/10 text-[#C97100]'
                  }`}>
                    Остановка
                  </span>
                </div>
                <p className="text-xs text-[#1D1D1F]">
                  Ожидают автобус: <span className={`font-semibold tabular-nums ${waitingAtStop > 5 ? 'text-[#FF3B30]' : 'text-[#C97100]'}`}>{waitingAtStop}</span> чел.
                </p>
                {waitingAtStop > 5 ? (
                  <div className="mt-2 px-2 py-1 rounded-xl bg-[#FF3B30]/10 text-[10px] text-[#FF3B30] font-medium border border-[#FF3B30]/20 flex items-center gap-1">
                    <span>⚠️ Высокая концентрация людей</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-[#86868B] mt-1.5">Остановка ТРК Актау (краудсорсинг)</p>
                )}
                <div className="mt-1 text-[10px] text-[#86868B] tabular-nums">
                  43.6650°N, 51.1550°E
                </div>
              </div>
            </Popup>
          </Marker>

          {/* Главный маркер автобуса №42 */}
          <Marker
            ref={markerRef}
            position={[currentPosition.lat, currentPosition.lng]}
            icon={busDivIcon}
          >
            <Popup 
              className="custom-leaflet-popup"
              autoPan={false}
            >
              <div className="p-1.5 font-sans min-w-[170px]">
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5 mb-1.5">
                  <span className="font-semibold text-xs text-[#0071E3]">Борт №42</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-semibold">
                    В пути
                  </span>
                </div>
                <p className="text-xs text-[#1D1D1F]">
                  Пассажиров в салоне: <span className="font-semibold text-[#0071E3] tabular-nums">{occupancy}</span>
                </p>
                <div className="mt-1 text-[10px] text-[#86868B] tabular-nums">
                  {currentPosition.lat.toFixed(5)}°N, {currentPosition.lng.toFixed(5)}°E
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Плавающая карточка Apple Live Activity с расписанием флота */}
        <div 
          id="floating-route-schedule-card"
          className="absolute bottom-3.5 right-3.5 z-[400] bg-white/90 backdrop-blur-2xl rounded-2xl border border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 w-[230px] text-xs pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/[0.05]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#34C759]"></span>
              <span className="font-semibold text-[#1D1D1F]">По расписанию</span>
            </div>
            <span className="text-[11px] text-[#86868B]">Маршрут №12</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#1D1D1F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span>
                <strong>Борт №42</strong>
              </span>
              <span className="font-semibold text-[#0071E3] tabular-nums">{occupancy} пасс.</span>
            </div>
            <div className="flex items-center justify-between text-[#86868B]">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]"></span>
                <span>Борт №19</span>
              </span>
              <span className="text-[#C97100] font-medium">+2 мин</span>
            </div>
            <div className="flex items-center justify-between text-[#86868B]">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]"></span>
                <span>След. остановка</span>
              </span>
              <span className="text-[#1D1D1F] font-medium">~3 мин</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-black/[0.05]">
            <div className="bg-black/[0.03] rounded-xl p-2 flex items-center justify-between text-[11px] text-[#1D1D1F]">
              <span className="font-medium">Линия: ТРК — 11 мкр</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#34C759]/10 text-[#248A3D]">
                АКТИВЕН
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

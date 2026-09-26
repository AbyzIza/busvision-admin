import { DetectedObject, TrackedPerson, BodyKeypoints } from '../types';

export interface TrackerCallbacks {
  onEnter: (personId: number) => void;
  onExit: (personId: number) => void;
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// Вычисление анатомических ключевых точек сканирования (голова/лоб/затылок, торс, ноги)
function computeBodyKeypoints(bbox: [number, number, number, number]): {
  keypoints: BodyKeypoints;
  activePart: 'head' | 'torso' | 'legs' | 'full';
} {
  const [x, y, w, h] = bbox;
  const cx = x + w / 2;

  const keypoints: BodyKeypoints = {
    head: { 
      x: cx, 
      y: y + Math.max(8, h * 0.15), 
      label: 'Лоб / Затылок' 
    },
    torso: { 
      x: cx, 
      y: y + h * 0.50, 
      label: 'Торс' 
    },
    legs: { 
      x: cx, 
      y: y + Math.max(16, h * 0.88), 
      label: 'Ноги' 
    },
  };

  let activePart: 'head' | 'torso' | 'legs' | 'full' = 'full';
  const aspectRatio = h / Math.max(1, w);

  if (aspectRatio < 0.85) {
    // Небольшая высота относительно ширины: ракурс сверху или видна только голова/плечи
    activePart = 'head';
  } else if (aspectRatio < 1.4) {
    activePart = 'torso';
  } else {
    activePart = 'full';
  }

  return { keypoints, activePart };
}

// Расчет коэффициента пересечения областей (IoU) для надежной связки треков
function calculateIoU(boxA: [number, number, number, number], boxB: [number, number, number, number]): number {
  const [x1, y1, w1, h1] = boxA;
  const [x2, y2, w2, h2] = boxB;

  const xA = Math.max(x1, x2);
  const yA = Math.max(y1, y2);
  const xB = Math.min(x1 + w1, x2 + w2);
  const yB = Math.min(y1 + h1, y2 + h2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = w1 * h1;
  const boxBArea = w2 * h2;
  const unionArea = boxAArea + boxBArea - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

export class CentroidTracker {
  private nextId = 1;
  private objects: Map<number, TrackedPerson> = new Map();
  // Увеличенное время жизни трека при временном перекрытии (30 кадров = ~1 секунда)
  private maxLostFrames = 30;
  // Адаптивное максимальное расстояние привязки
  private baseMaxDistance = 180;

  public update(
    detections: DetectedObject[],
    lineY: number,
    callbacks: TrackerCallbacks
  ): TrackedPerson[] {
    // 1. Принимаем класс person, а также частичные силуэты
    const validDetections = detections.filter(
      (d) => d.class === 'person' && d.bbox && d.bbox[2] > 10 && d.bbox[3] > 10
    );

    // Вычисляем центроиды и анатомические зоны детекций
    const currentItems = validDetections.map((d) => {
      const [x, y, w, h] = d.bbox;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const { keypoints, activePart } = computeBodyKeypoints(d.bbox);
      return {
        cx,
        cy,
        bbox: d.bbox,
        score: d.score,
        keypoints,
        activePart,
      };
    });

    const matchedObjectIds = new Set<number>();
    const matchedDetectionIndices = new Set<number>();

    // 2. Связывание текущих детекций с существующими треками (Комбинация расстояния + IoU)
    if (this.objects.size > 0 && currentItems.length > 0) {
      const existingEntries = Array.from(this.objects.entries());

      interface MatchScore {
        objId: number;
        detIdx: number;
        cost: number;
        dist: number;
      }

      const matchScores: MatchScore[] = [];

      existingEntries.forEach(([objId, tracked]) => {
        // Прогнозируем положение с учетом текущей скорости
        const predictedCx = tracked.cx + tracked.vx;
        const predictedCy = tracked.cy + tracked.vy;

        currentItems.forEach((det, detIdx) => {
          const dx = predictedCx - det.cx;
          const dy = predictedCy - det.cy;
          const dist = Math.hypot(dx, dy);

          const iou = calculateIoU(tracked.bbox, det.bbox);
          // Стоимость матчинга: меньшая дистанция и высокий IoU дают наименьшую стоимость
          const cost = dist - iou * 120;

          const maxDistThreshold = Math.max(
            this.baseMaxDistance,
            Math.max(tracked.bbox[2], tracked.bbox[3]) * 1.1
          );

          if (dist < maxDistThreshold || iou > 0.15) {
            matchScores.push({ objId, detIdx, cost, dist });
          }
        });
      });

      // Сортировка по наилучшему совпадению
      matchScores.sort((a, b) => a.cost - b.cost);

      for (const match of matchScores) {
        if (
          !matchedObjectIds.has(match.objId) &&
          !matchedDetectionIndices.has(match.detIdx)
        ) {
          matchedObjectIds.add(match.objId);
          matchedDetectionIndices.add(match.detIdx);

          const tracked = this.objects.get(match.objId)!;
          const det = currentItems[match.detIdx];

          const prevY = tracked.cy;
          const currY = det.cy;

          // Рассчитываем скорость перемещения
          tracked.vx = det.cx - tracked.cx;
          tracked.vy = currY - prevY;

          // Обновление координат
          tracked.prevCy = prevY;
          tracked.cx = det.cx;
          tracked.cy = currY;
          tracked.bbox = det.bbox;
          tracked.score = det.score;
          tracked.lostFrames = 0;
          tracked.totalVisibleFrames += 1;
          tracked.keypoints = det.keypoints;
          tracked.activePart = det.activePart;

          // Плавное сглаживание координат рамки (Zero-Drop Jitter-free Smoothing)
          tracked.smoothedBbox = [
            lerp(tracked.smoothedBbox[0], det.bbox[0], 0.55),
            lerp(tracked.smoothedBbox[1], det.bbox[1], 0.55),
            lerp(tracked.smoothedBbox[2], det.bbox[2], 0.55),
            lerp(tracked.smoothedBbox[3], det.bbox[3], 0.55),
          ];

          // Сохраняем шлейф траектории движения
          tracked.history.push({ x: det.cx, y: det.cy });
          if (tracked.history.length > 20) {
            tracked.history.shift();
          }

          // 3. Логика подсчета пассажиров при пересечении порога двери
          // Учитываем движение центроида, а также ключевых точек (ног и торса)
          const legsY = det.keypoints.legs.y;
          const torsoY = det.keypoints.torso.y;

          // Проверка направления движения ВХОД (сверху вниз через линию)
          const hasMovedDownward = (prevY < lineY && currY >= lineY) || 
                                   (tracked.prevCy < lineY && (torsoY >= lineY || legsY >= lineY));

          // Проверка направления движения ВЫХОД (снизу вверх через линию)
          const hasMovedUpward = (prevY > lineY && currY <= lineY) || 
                                 (tracked.prevCy > lineY && torsoY <= lineY);

          if (hasMovedDownward) {
            if (!tracked.hasCrossedIn) {
              tracked.hasCrossedIn = true;
              tracked.hasCrossedOut = false;
              callbacks.onEnter(tracked.id);
            }
          } else if (hasMovedUpward) {
            if (!tracked.hasCrossedOut) {
              tracked.hasCrossedOut = true;
              tracked.hasCrossedIn = false;
              callbacks.onExit(tracked.id);
            }
          }
        }
      }
    }

    // 4. Обработка временно потерянных объектов:
    // Экстраполяция положения по вектору скорости (не терять объект на секунду!)
    this.objects.forEach((tracked, id) => {
      if (!matchedObjectIds.has(id)) {
        tracked.lostFrames += 1;

        if (tracked.lostFrames <= this.maxLostFrames) {
          // Плавная инерция движения
          const decay = Math.max(0, 1 - tracked.lostFrames / this.maxLostFrames);
          tracked.cx += tracked.vx * 0.7 * decay;
          tracked.cy += tracked.vy * 0.7 * decay;
          tracked.smoothedBbox[0] += tracked.vx * 0.7 * decay;
          tracked.smoothedBbox[1] += tracked.vy * 0.7 * decay;

          // Обновление ключевых точек при инерции
          const { keypoints } = computeBodyKeypoints(tracked.smoothedBbox);
          tracked.keypoints = keypoints;
        } else {
          // Удаление после истечения времени удержания (более 30 кадров)
          this.objects.delete(id);
        }
      }
    });

    // 5. Регистрация новых обнаруженных силуэтов
    currentItems.forEach((det, idx) => {
      if (!matchedDetectionIndices.has(idx)) {
        const id = this.nextId++;
        const newTrack: TrackedPerson = {
          id,
          cx: det.cx,
          cy: det.cy,
          prevCy: det.cy,
          vx: 0,
          vy: 0,
          bbox: det.bbox,
          smoothedBbox: [...det.bbox],
          lostFrames: 0,
          totalVisibleFrames: 1,
          score: det.score,
          hasCrossedIn: false,
          hasCrossedOut: false,
          history: [{ x: det.cx, y: det.cy }],
          keypoints: det.keypoints,
          activePart: det.activePart,
        };
        this.objects.set(id, newTrack);
      }
    });

    // Возвращаем все активные треки, включая те, что удерживаются в памяти (до 12 кадров)
    // чтобы визуальный сканер ни на долю секунды не пропадал
    return Array.from(this.objects.values()).filter((obj) => obj.lostFrames <= 12);
  }

  public reset() {
    this.objects.clear();
    this.nextId = 1;
  }
}

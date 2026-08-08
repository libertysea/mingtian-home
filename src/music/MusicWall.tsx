'use client';

import {
  Pause,
  Play,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { Track, WallInstance, WallLayout } from './types';
import { clamp } from './utils';

interface MusicWallProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelect: (track: Track) => void;
  onOpen: (track: Track) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAmbientMove: (x: number, y: number) => void;
}

interface Camera {
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  pointerX: number;
  pointerY: number;
  dragging: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  lastTime: number;
  moved: number;
  initialized: boolean;
}

function buildMasonryLayout(tracks: Track[], columns: number, unitWidth: number, gap: number): WallLayout {
  const heights = Array(columns).fill(0) as number[];
  const cards: WallLayout['cards'] = [];

  tracks.forEach(track => {
    const span = track.span === 2 ? 2 : 1;
    if (span === 1) {
      let column = 0;
      for (let index = 1; index < columns; index += 1) {
        if (heights[index] < heights[column]) column = index;
      }
      const width = unitWidth - gap;
      const height = Math.round(1.3 * width);
      cards.push({ track, worldX: column * unitWidth, worldY: heights[column], width, height });
      heights[column] += height + gap;
      return;
    }

    let column = 0;
    for (let index = 1; index < columns - 1; index += 1) {
      const candidate = Math.max(heights[index], heights[index + 1]);
      const current = Math.max(heights[column], heights[column + 1]);
      if (candidate < current) column = index;
    }
    const top = Math.max(heights[column], heights[column + 1]);
    const width = 2 * unitWidth - gap;
    const height = Math.round(1.3 * width);
    cards.push({ track, worldX: column * unitWidth, worldY: top, width, height });
    heights[column] = top + height + gap;
    heights[column + 1] = top + height + gap;
  });

  return {
    cards,
    tileWidth: columns * unitWidth,
    tileHeight: cards.length ? Math.max(...heights) : 1
  };
}

function getVisibleInstances(layout: WallLayout, camera: Camera) {
  const instances: WallInstance[] = [];
  const buffer = 90;

  layout.cards.forEach(card => {
    const baseX = card.worldX + camera.x;
    const minTileX = Math.floor((-baseX - card.width - buffer) / layout.tileWidth);
    const maxTileX = Math.floor((window.innerWidth - baseX + buffer) / layout.tileWidth);
    const baseY = card.worldY + camera.y;
    const minTileY = Math.floor((-baseY - card.height - buffer) / layout.tileHeight);
    const maxTileY = Math.floor((window.innerHeight - baseY + buffer) / layout.tileHeight);

    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        instances.push({
          key: `${card.track.id}_${tileX}_${tileY}`,
          card,
          worldX: card.worldX + tileX * layout.tileWidth,
          worldY: card.worldY + tileY * layout.tileHeight
        });
      }
    }
  });

  return instances;
}

export default function MusicWall({
  tracks,
  currentTrack,
  isPlaying,
  onSelect,
  onOpen,
  onPrevious,
  onNext,
  onAmbientMove
}: MusicWallProps) {
  const reduceMotion = useReducedMotion();
  const worldRef = useRef<HTMLElement>(null);
  const elementRefs = useRef(new Map<string, HTMLElement>());
  const instanceRef = useRef<WallInstance[]>([]);
  const signatureRef = useRef('');
  const draggedRef = useRef(false);
  const dragResetTimerRef = useRef<number | null>(null);
  const [instances, setInstances] = useState<WallInstance[]>([]);
  const [unitWidth, setUnitWidth] = useState(180);
  const cameraRef = useRef<Camera>({
    targetX: 0,
    targetY: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    moved: 0,
    initialized: false
  });

  const layout = useMemo(
    () => buildMasonryLayout(tracks, 8, unitWidth, 6),
    [tracks, unitWidth]
  );

  useEffect(() => {
    const updateUnit = () => {
      setUnitWidth(window.innerWidth < 768 ? 140 : 180);
      cameraRef.current.initialized = false;
      signatureRef.current = '';
    };
    updateUnit();
    window.addEventListener('resize', updateUnit);
    return () => window.removeEventListener('resize', updateUnit);
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera.initialized && layout.cards.length) {
      const activeCard = layout.cards.find(card => card.track.id === currentTrack?.id) || layout.cards[0];
      camera.targetX = window.innerWidth / 2 - activeCard.worldX - activeCard.width / 2;
      camera.targetY = window.innerHeight / 2 - activeCard.worldY - activeCard.height / 2;
      camera.x = camera.targetX;
      camera.y = camera.targetY;
      camera.initialized = true;
    }
    signatureRef.current = '';
  }, [currentTrack?.id, layout]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const camera = cameraRef.current;
      if (!camera.dragging && !reduceMotion) {
        if (Math.abs(camera.velocityX) > 0.05 || Math.abs(camera.velocityY) > 0.05) {
          camera.targetX += camera.velocityX;
          camera.targetY += camera.velocityY;
          camera.velocityX *= 0.92;
          camera.velocityY *= 0.92;
        }
      }

      const interpolation = reduceMotion ? 1 : 0.15;
      camera.x += (camera.targetX - camera.x) * interpolation;
      camera.y += (camera.targetY - camera.y) * interpolation;
      const nextInstances = getVisibleInstances(layout, camera);
      const signature = nextInstances.map(instance => instance.key).join('|');

      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        instanceRef.current = nextInstances;
        setInstances(nextInstances);
      } else {
        instanceRef.current = nextInstances;
      }

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const radius = 0.42 * Math.min(window.innerWidth, window.innerHeight);

      nextInstances.forEach(instance => {
        const element = elementRefs.current.get(instance.key);
        if (!element) return;
        const x = instance.worldX + camera.x;
        const y = instance.worldY + camera.y;
        const offsetX = x + instance.card.width / 2 - centerX;
        const offsetY = y + instance.card.height / 2 - centerY;
        const distance = Math.hypot(offsetX, offsetY);
        const influence = Math.exp(-Math.pow(distance / radius, 2));
        const scale = 0.45 + 0.55 * influence;
        const depth = -330 + 580 * influence;
        const rotateX = clamp((offsetY / radius) * 44, -46, 46);
        const rotateY = clamp((-offsetX / radius) * 44, -46, 46);
        const opacity = 0.35 + 0.65 * Math.exp(-Math.pow(distance / (2.5 * radius), 2));
        element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${depth.toFixed(1)}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        element.style.opacity = opacity.toFixed(3);
        element.style.zIndex = String(Math.round(influence * 1000));
        element.dataset.far = influence < 0.24 ? '1' : '0';
      });

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [layout, reduceMotion]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      camera.targetY -= event.deltaY;
      camera.targetX -= event.deltaX;
      camera.velocityX = 0;
      camera.velocityY = 0;
    };
    world.addEventListener('wheel', onWheel, { passive: false });
    return () => world.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const camera = cameraRef.current;
      camera.pointerX = event.clientX;
      camera.pointerY = event.clientY;
      onAmbientMove(event.clientX, event.clientY);
      if (!camera.dragging || camera.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - camera.lastX;
      const deltaY = event.clientY - camera.lastY;
      const now = performance.now();
      const elapsed = Math.max(1, now - camera.lastTime);
      camera.targetX += deltaX;
      camera.targetY += deltaY;
      camera.velocityX = deltaX / elapsed;
      camera.velocityY = deltaY / elapsed;
      camera.moved += Math.hypot(deltaX, deltaY);
      if (camera.moved > 8) draggedRef.current = true;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      camera.lastTime = now;
    };

    const release = (event: PointerEvent) => {
      const camera = cameraRef.current;
      if (!camera.dragging || camera.pointerId !== event.pointerId) return;
      camera.dragging = false;
      camera.pointerId = null;
      camera.velocityX *= 16;
      camera.velocityY *= 16;
      worldRef.current?.classList.remove('is-dragging');
      if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = window.setTimeout(() => {
        draggedRef.current = false;
        dragResetTimerRef.current = null;
      }, 0);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
    };
  }, [onAmbientMove]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const camera = cameraRef.current;
    camera.dragging = true;
    camera.pointerId = event.pointerId;
    camera.lastX = event.clientX;
    camera.lastY = event.clientY;
    camera.lastTime = performance.now();
    camera.velocityX = 0;
    camera.velocityY = 0;
    camera.moved = 0;
    draggedRef.current = false;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    worldRef.current?.classList.add('is-dragging');
  }, []);

  return (
    <section
      ref={worldRef}
      className="music-world"
      id="music-world"
      aria-label="Draggable music card wall"
      onPointerDown={onPointerDown}
    >
      <div className="music-card-layer">
        {instances.map(instance => {
          const track = instance.card.track;
          const current = currentTrack?.id === track.id;
          return (
            <article
              key={instance.key}
              ref={element => {
                if (element) elementRefs.current.set(instance.key, element);
                else elementRefs.current.delete(instance.key);
              }}
              className={`music-card${current ? ' is-current' : ''}`}
              data-far="0"
              tabIndex={0}
              aria-label={`${track.title}, ${track.artist || 'Unknown artist'}`}
              style={{
                width: instance.card.width,
                height: instance.card.height,
                '--track-hue': String(track.hue || 210)
              } as CSSProperties}
              onClick={() => {
                if (draggedRef.current) return;
                if (!current) onSelect(track);
                onOpen(track);
              }}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (!current) onSelect(track);
                onOpen(track);
              }}
            >
              <div className="music-card__cover">
                {track.cover ? (
                  <img
                    src={track.cover}
                    alt={track.title}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </div>
              <div className="music-card__meta">
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </div>
              <div className="music-card__controls">
                <button type="button" aria-label="Previous track" onClick={event => { event.stopPropagation(); onPrevious(); }}>
                  <SkipBack aria-hidden="true" />
                </button>
                <button type="button" aria-label={current && isPlaying ? 'Pause' : 'Play'} onClick={event => { event.stopPropagation(); onSelect(track); }}>
                  {current && isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <button type="button" aria-label="Next track" onClick={event => { event.stopPropagation(); onNext(); }}>
                  <SkipForward aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

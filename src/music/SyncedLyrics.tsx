'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import type { LyricLine } from './types';

interface SyncedLyricsProps {
  lines: LyricLine[];
  currentTime: number;
  compact: boolean;
  water: boolean;
  playing: boolean;
}

const filterScales = [6, 11, 17];
const lyricEase = [0.2, 0.8, 0.2, 1] as const;

function WaterFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="music-lyric-filters">
      <defs>
        {filterScales.map((scale, index) => {
          const depth = index + 1;
          return (
            <filter
              id={`lyric-water-${depth}`}
              key={depth}
              x="-15%"
              y="-50%"
              width="130%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                id={`lw-turb-${depth}`}
                type="fractalNoise"
                baseFrequency="0.014 0.020"
                numOctaves="2"
                seed="2"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0.25 0 0 0 0.375  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                result="shaped"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="shaped"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}

export default function SyncedLyrics({
  lines,
  currentTime,
  compact,
  water,
  playing
}: SyncedLyricsProps) {
  const reduceMotion = useReducedMotion();
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const activeTime = currentTime + 0.12;

  let activeIndex = -1;
  for (let index = 0; index < lines.length && lines[index].time <= activeTime; index += 1) {
    activeIndex = index;
  }

  const items = useMemo(() => {
    if (activeIndex < 0) return [];
    const next = [];
    for (let depth = 0; depth < 5; depth += 1) {
      const index = activeIndex - depth;
      if (index < 0) break;
      next.push({ key: index, text: lines[index].text, depth });
    }
    return next;
  }, [activeIndex, lines]);

  useEffect(() => {
    if (!water || reduceMotion) return;
    let frame = 0;
    let phase = 0;
    let motion = playingRef.current ? 1 : 0.15;
    let previous = performance.now();
    let lastUpdate = 0;
    let turbulence: SVGElement[] = [];

    const animate = (now: number) => {
      if (!turbulence.length) {
        turbulence = [1, 2, 3]
          .map(depth => document.querySelector<SVGElement>(`#lw-turb-${depth}`))
          .filter((element): element is SVGElement => Boolean(element));
      }

      const elapsed = Math.min(50, now - previous);
      previous = now;
      const target = playingRef.current ? 1 : 0.15;
      motion += (target - motion) * 0.05;
      phase += elapsed / 16.7 * 0.012 * (0.25 + 0.75 * motion);

      if ((playingRef.current || motion > 0.25) && now - lastUpdate >= 33) {
        lastUpdate = now;
        const x = (0.014 + 0.006 * Math.sin(phase)).toFixed(4);
        const y = (0.02 + 0.006 * Math.cos(0.8 * phase)).toFixed(4);
        turbulence.forEach(element => element.setAttribute('baseFrequency', `${x} ${y}`));
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, water]);

  if (activeIndex < 0 || !items.length) return null;
  const gap = compact ? 26 : 34;

  return (
    <>
      {water && !reduceMotion ? <WaterFilters /> : null}
      {([-1, 1] as const).map(side => (
        <div
          key={side}
          aria-hidden="true"
          className={`music-synced-lyrics music-synced-lyrics--${side < 0 ? 'top' : 'bottom'}`}
          style={side < 0
            ? { bottom: '100%', marginBottom: 0.6 * gap, height: 0 }
            : { top: '100%', marginTop: 0.6 * gap, height: 0 }}
        >
          <AnimatePresence initial={false}>
            {items.map(item => {
              const filters = [
                !reduceMotion && item.depth > 0 ? `blur(${0.8 * item.depth}px)` : '',
                water && !reduceMotion && item.depth > 0 && item.depth <= 3
                  ? `url(#lyric-water-${item.depth})`
                  : ''
              ].filter(Boolean).join(' ') || undefined;

              return (
                <motion.div
                  key={`${side}-${item.key}`}
                  className={`music-synced-lyrics__line${item.depth === 0 ? ' is-current' : ''}`}
                  style={{
                    ...(side < 0 ? { bottom: 0 } : { top: 0 }),
                    filter: filters
                  }}
                  initial={reduceMotion ? false : {
                    opacity: 0,
                    y: -(side * gap * 0.7),
                    scaleX: 1,
                    scaleY: 1
                  }}
                  animate={{
                    opacity: Math.max(0, 1 - 0.22 * item.depth),
                    y: side * item.depth * gap,
                    scaleX: 1 - 0.06 * item.depth,
                    scaleY: 1 - 0.16 * item.depth
                  }}
                  exit={reduceMotion ? { opacity: 0 } : {
                    opacity: 0,
                    y: 5 * side * gap,
                    scaleX: 0.7,
                    scaleY: 0.2
                  }}
                  transition={{ duration: reduceMotion ? 0 : 0.5, ease: lyricEase }}
                >
                  {item.text}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ))}
    </>
  );
}

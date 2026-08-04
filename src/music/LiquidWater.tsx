'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
// @ts-expect-error Vendored ESM has no declaration file.
import createLiquid from '../../vendor/liquid1.min.js';
import type { AmbientEffect, BackgroundTheme } from './types';
import { resolveAsset } from './utils';

interface LiquidPlane {
  material?: {
    metalness: number;
    roughness: number;
  };
  uniforms?: {
    displacementScale?: { value: number };
  };
  addDrop?: (x: number, y: number, radius: number, strength: number) => void;
}

interface LiquidController {
  liquidPlane?: LiquidPlane;
  loadImage: (source: string | null) => Promise<void> | void;
  setRain: (enabled: boolean) => void;
  setRainTime?: (seconds: number) => void;
  dispose?: () => void;
}

interface LiquidWaterProps {
  playing: boolean;
  volume: number;
  effect: AmbientEffect;
  theme: BackgroundTheme;
  hue: number;
  coverUrl: string;
  currentTime: number;
}

function makeGradient(hue: number) {
  const width = Math.min(1600, Math.max(640, window.innerWidth));
  const height = Math.min(1000, Math.max(480, window.innerHeight));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';

  context.fillStyle = '#06070b';
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'lighter';

  const paint = (x: number, y: number, radius: number, color: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };

  const size = Math.max(width, height);
  paint(0.26 * width, 0.42 * height, 0.6 * size, `hsla(${hue}, 85%, 55%, 0.55)`);
  paint(0.8 * width, 0.64 * height, 0.52 * size, `hsla(${(hue + 40) % 360}, 80%, 50%, 0.4)`);
  paint(0.56 * width, 0.16 * height, 0.42 * size, `hsla(${(hue + 330) % 360}, 78%, 55%, 0.3)`);
  context.globalCompositeOperation = 'source-over';
  return canvas.toDataURL('image/jpeg', 0.9);
}

export default function LiquidWater({
  playing,
  volume,
  effect,
  theme,
  hue,
  coverUrl,
  currentTime
}: LiquidWaterProps) {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<LiquidController | null>(null);
  const playingRef = useRef(playing);
  const volumeRef = useRef(volume);
  const effectRef = useRef(effect);
  const timeRef = useRef(currentTime);
  const imageSequenceRef = useRef(0);
  const [ready, setReady] = useState(false);

  playingRef.current = playing;
  volumeRef.current = volume;
  effectRef.current = effect;
  timeRef.current = currentTime;

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!canvasRef.current || reduceMotion) return;
      try {
        if (cancelled || !canvasRef.current) return;
        const controller = createLiquid(canvasRef.current) as LiquidController;
        controllerRef.current = controller;
        if (controller.liquidPlane?.material) {
          controller.liquidPlane.material.metalness = 0.35;
          controller.liquidPlane.material.roughness = 0.45;
        }
        if (controller.liquidPlane?.uniforms?.displacementScale) {
          controller.liquidPlane.uniforms.displacementScale.value = 2;
        }
        controller.setRain(false);
        setReady(true);
      } catch {
        controllerRef.current = null;
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      controllerRef.current?.dispose?.();
      controllerRef.current = null;
    };
  }, [reduceMotion]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!ready || !controller) return;

    const sequence = ++imageSequenceRef.current;
    const source = theme === 'gradient'
      ? makeGradient(hue)
      : theme === 'cover' && coverUrl
        ? coverUrl
        : resolveAsset('images/mos-background.webp');

    Promise.resolve(controller.loadImage(source)).catch(() => {
      if (sequence === imageSequenceRef.current) {
        void controller.loadImage(resolveAsset('images/mos-background.webp'));
      }
    });
  }, [coverUrl, hue, ready, theme]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let rainEnabled = false;
    let centerElapsed = 0;
    let goldenAngle = 0;

    const animate = () => {
      const now = performance.now();
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const controller = controllerRef.current;
      const active = playingRef.current;
      const mode = effectRef.current;
      const normalizedVolume = Math.max(0, Math.min(1, volumeRef.current));
      const intensity = active ? 0.5 + 0.25 * Math.sin(timeRef.current * 3.7) : 0;
      const energy = (0.4 + 0.6 * normalizedVolume) * (0.55 + 0.45 * intensity);
      const rain = mode === 'rain' && active;

      if (controller && rain !== rainEnabled) {
        controller.setRain(rain);
        rainEnabled = rain;
      }
      if (controller && rain) {
        controller.setRainTime?.(
          1 / Math.max(4, Math.min(30, (4 + 26 * normalizedVolume) * (0.7 + 0.6 * intensity)))
        );
      }

      if (mode === 'center' && active && controller?.liquidPlane?.addDrop) {
        centerElapsed += delta;
        if (centerElapsed >= 1 / (0.4 + 0.2 * energy)) {
          centerElapsed = 0;
          goldenAngle += 2.399963;
          const radius = 0.2 * Math.random();
          controller.liquidPlane.addDrop(
            Math.cos(goldenAngle) * radius,
            Math.sin(goldenAngle) * radius,
            0.05,
            0.01 + 0.018 * energy
          );
        }
      } else {
        centerElapsed = 0;
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="music-expanded__liquid"
    />
  );
}

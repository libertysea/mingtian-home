'use client';

import {
  CircleStop,
  CloudSnow,
  CircleOff,
  Disc3,
  History,
  Image,
  ListMusic,
  Mic2,
  Music2,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Search,
  Share2,
  Sparkles,
  SkipBack,
  SkipForward,
  Upload,
  UploadCloud,
  Volume1,
  Volume2,
  VolumeX,
  Waves,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type {
  AmbientEffect,
  BackgroundTheme,
  LibraryTab,
  PlayMode,
  Track,
  LyricLine,
} from './types';
import { formatTime } from './utils';
import LiquidWater from './LiquidWater';
import SyncedLyrics from './SyncedLyrics';

const spring = { type: 'spring' as const, stiffness: 260, damping: 28 };

interface LibraryPanelProps {
  open: boolean;
  tab: LibraryTab;
  query: string;
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  total: number;
  onClose: () => void;
  onQuery: (value: string) => void;
  onTab: (tab: LibraryTab) => void;
  onPlay: (track: Track) => void;
  onUpload: () => void;
}

export function LibraryPanel({
  open,
  tab,
  query,
  tracks,
  currentTrack,
  isPlaying,
  total,
  onClose,
  onQuery,
  onTab,
  onPlay,
  onUpload
}: LibraryPanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          className="music-library is-open"
          aria-label="Music library"
          aria-hidden="false"
          initial={{ x: -44, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -36, opacity: 0 }}
          transition={spring}
        >
          <header className="music-library__header">
            <div>
              <span className="music-library__mark">MUSIC</span>
              <h2>LIBRARY</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close library">
              <X aria-hidden="true" />
            </button>
          </header>

          <label className="music-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search tracks</span>
            <input
              type="search"
              value={query}
              onChange={event => onQuery(event.target.value)}
              placeholder="Search title or artist..."
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className="music-library__tabs" role="tablist" aria-label="Library filter">
            {([
              ['recent', 'Recent'],
              ['all', 'All']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => onTab(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <motion.div className="music-library__list" layout>
            <AnimatePresence mode="popLayout">
              {tracks.length ? tracks.map(track => {
                const current = currentTrack?.id === track.id;
                return (
                  <motion.button
                    layout
                    key={track.id}
                    type="button"
                    className={`music-library-item${current ? ' is-current' : ''}`}
                    onClick={() => onPlay(track)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {track.cover ? (
                      <img src={track.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="music-library-item__placeholder"><Music2 aria-hidden="true" /></span>
                    )}
                    <span className="music-library-item__meta">
                      <strong>{track.title}</strong>
                      <small>{track.artist || 'Unknown artist'}</small>
                    </span>
                    {current && isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  </motion.button>
                );
              }) : (
                <motion.div
                  className="music-library__empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {tab === 'recent' ? 'No listening history yet.' : 'No matching tracks.'}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <footer className="music-library__footer">
            <button className="text-button" type="button" onClick={onUpload}>
              <Upload aria-hidden="true" />
              Add local music
            </button>
            <span>{total} tracks</span>
          </footer>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

interface VolumeControlProps {
  volume: number;
  hue: number;
  onVolume: (value: number) => void;
}

function VolumeControl({ volume, hue, onVolume }: VolumeControlProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - 25, window.innerWidth - 58));
      setPosition({ bottom: window.innerHeight - rect.top + 10, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        className="icon-button music-volume-button music-player__desktop-control"
        type="button"
        aria-label="Volume"
        aria-expanded={open}
        aria-controls="music-volume-popover"
        title="Volume"
        onClick={() => setOpen(previous => !previous)}
      >
        <VolumeIcon aria-hidden="true" />
      </button>

      {typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {open && position ? (
            <motion.div
              className="music-volume-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <button className="music-volume-scrim" type="button" onClick={() => setOpen(false)} aria-label="Close volume control" />
              <motion.div
                id="music-volume-popover"
                className="music-volume-popover"
                role="dialog"
                aria-label="Volume control"
                style={{
                  bottom: position.bottom,
                  left: position.left,
                  '--volume-hue': String(hue)
                } as React.CSSProperties}
                initial={{ y: 8, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 8, scale: 0.95 }}
                transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1] }}
                onPointerDown={event => event.stopPropagation()}
                onWheel={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onVolume(volume + (event.deltaY < 0 ? 0.05 : -0.05));
                }}
              >
                <div className="music-volume-track" aria-hidden="true">
                  <span className="music-volume-fill" style={{ height: `${volume * 112}px` }} />
                </div>
                <input
                  className="music-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onInput={event => onVolume(Number(event.currentTarget.value))}
                  onChange={event => onVolume(Number(event.currentTarget.value))}
                  aria-label="Volume"
                />
                <span className="music-volume-thumb" style={{ bottom: `${15 + volume * 112}px` }} aria-hidden="true" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      ) : null}
    </>
  );
}

interface PlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  mode: PlayMode;
  effect: AmbientEffect;
  theme: BackgroundTheme;
  onExpand: () => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onMode: () => void;
  onEffect: () => void;
  onTheme: () => void;
  onVolume: (value: number) => void;
  onHistory: () => void;
  onSeek: (value: number) => void;
}

export function PlayerBar({
  track,
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  mode,
  effect,
  theme,
  onExpand,
  onToggle,
  onPrevious,
  onNext,
  onMode,
  onEffect,
  onTheme,
  onVolume,
  onHistory,
  onSeek
}: PlayerBarProps) {
  const progress = duration ? currentTime / duration : 0;
  const ModeIcon = mode === 'one' ? Repeat1 : mode === 'once' ? CircleStop : Repeat2;
  const EffectIcon = effect === 'rain' ? CloudSnow : effect === 'center' ? Waves : CircleOff;
  const ThemeIcon = theme === 'background' ? Image : theme === 'cover' ? Disc3 : Sparkles;
  const modeLabel = mode === 'list' ? '列表循环' : mode === 'one' ? '单曲循环' : '播完停止';
  const effectLabel = effect === 'rain' ? '声波粒子' : effect === 'center' ? '中心涟漪' : '关闭特效';
  const themeLabel = theme === 'background' ? '小波底图' : theme === 'cover' ? '当前封面' : '渐变色场';

  return (
    <AnimatePresence>
      {track ? (
        <motion.section
          className="music-player"
          aria-label="Music player"
          initial={{ y: 56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 36, opacity: 0 }}
          transition={spring}
        >
          <button className="music-player__summary" type="button" onClick={onExpand} aria-label="Open current track">
            <motion.span className="music-player__cover" layoutId="active-cover">
              <AnimatePresence mode="wait" initial={false}>
                {track.cover ? (
                  <motion.img
                    key={track.id}
                    src={track.cover}
                    alt=""
                    draggable={false}
                    referrerPolicy="no-referrer"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.04 }}
                    transition={{ duration: 0.22 }}
                  />
                ) : null}
              </AnimatePresence>
            </motion.span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={track.id} className="music-player__meta" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </motion.span>
            </AnimatePresence>
          </button>

          <div className="music-player__controls" aria-label="Playback controls">
            <button className="icon-button" type="button" onClick={onPrevious} aria-label="Previous track"><SkipBack aria-hidden="true" /></button>
            <button className="music-play-button" type="button" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button className="icon-button" type="button" onClick={onNext} aria-label="Next track"><SkipForward aria-hidden="true" /></button>
            <button className={`icon-button music-player__desktop-control${mode !== 'once' ? ' is-active' : ''}`} type="button" onClick={onMode} aria-label={modeLabel} title={`循环：${modeLabel}，点击切换`} aria-pressed={mode !== 'once'}><ModeIcon aria-hidden="true" /></button>
            <button className={`icon-button music-player__desktop-control music-player__state-control${effect !== 'off' ? ' is-active' : ''}`} data-state={effect} type="button" onClick={onEffect} aria-label={effectLabel} title={`特效：${effectLabel}，点击切换`} aria-pressed={effect !== 'off'}>
              <EffectIcon aria-hidden="true" />
              <span className="music-player__state-dot" aria-hidden="true" />
            </button>
            <button className="icon-button music-player__desktop-control music-player__state-control is-active" data-state={theme} type="button" onClick={onTheme} aria-label={themeLabel} title={`背景：${themeLabel}，点击切换`} aria-pressed={true}>
              <ThemeIcon aria-hidden="true" />
              <span className="music-player__state-dot" aria-hidden="true" />
            </button>
            <VolumeControl volume={volume} hue={track.hue || 210} onVolume={onVolume} />
            <button className="icon-button" type="button" onClick={onHistory} aria-label="Listening history"><History aria-hidden="true" /></button>
          </div>

          <div className="music-player__timeline">
            <span>{formatTime(currentTime)}</span>
            <div className="music-progress">
              <span className="music-progress__buffered" style={{ width: `${buffered * 100}%` }} />
              <span className="music-progress__played" style={{ width: `${progress * 100}%` }} />
              <input
                type="range"
                min="0"
                max="1000"
                value={Math.round(progress * 1000)}
                onChange={event => onSeek(Number(event.target.value) / 1000)}
                aria-label="Playback position"
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

interface ExpandedPlayerProps {
  open: boolean;
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  effect: AmbientEffect;
  theme: BackgroundTheme;
  volume: number;
  lyrics: LyricLine[];
  lyricsEnabled: boolean;
  onClose: () => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShare: () => void;
  onLyrics: () => void;
  onSeek: (ratio: number) => void;
}

export function ExpandedPlayer({
  open,
  track,
  isPlaying,
  currentTime,
  duration,
  buffered,
  effect,
  theme,
  volume,
  lyrics,
  lyricsEnabled,
  onClose,
  onToggle,
  onPrevious,
  onNext,
  onShare,
  onLyrics,
  onSeek
}: ExpandedPlayerProps) {
  const progress = duration ? currentTime / duration : 0;
  const [compact, setCompact] = useState(false);
  const canShowLyrics = Boolean(track?.lyricSource || (track && !track.local));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <AnimatePresence>
      {open && track ? (
        <motion.div
          className="music-expanded"
          data-effect={effect}
          data-theme={theme}
          style={{
            '--expanded-hue': String(track.hue || 210),
            '--expanded-cover': track.cover ? `url("${track.cover.replaceAll('"', '%22')}")` : 'none'
          } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={event => { if (event.target === event.currentTarget) onClose(); }}
        >
          <div className="music-expanded__ambient" aria-hidden="true">
            <LiquidWater
              playing={isPlaying}
              volume={volume}
              effect={effect}
              theme={theme}
              hue={track.hue || 210}
              coverUrl={track.cover}
              currentTime={currentTime}
            />
            <div className="music-expanded__dust" />
          </div>
          <motion.section
            className="music-expanded__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-title"
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
          >
            {lyricsEnabled && lyrics.length ? (
              <SyncedLyrics
                lines={lyrics}
                currentTime={currentTime}
                compact={compact}
                water
                playing={isPlaying}
              />
            ) : null}
            <div className="music-expanded__disc-wrap">
              <svg className="music-expanded__ring" viewBox="0 0 224 224" aria-hidden="true">
                <circle cx="112" cy="112" r="104" />
                <circle cx="112" cy="112" r="104" style={{ strokeDashoffset: 653.45 * (1 - progress) }} />
              </svg>
              <motion.div className={`music-expanded__disc${isPlaying ? ' is-playing' : ''}`} layoutId="active-cover">
                <AnimatePresence mode="wait" initial={false}>
                  {track.cover ? (
                    <motion.img key={track.id} src={track.cover} alt={track.title} draggable={false} referrerPolicy="no-referrer" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.24 }} />
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
            <div className="music-expanded__content">
              <div className="music-expanded__heading">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={track.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <h2 id="expanded-title">{track.title}</h2>
                    <p>{track.artist}</p>
                  </motion.div>
                </AnimatePresence>
                <button className="icon-button" type="button" onClick={onClose} aria-label="Close expanded player"><X aria-hidden="true" /></button>
              </div>
              <div className="music-expanded__progress">
                <span className="music-expanded__progress-buffered" style={{ width: String(buffered * 100) + '%' }} />
                <span className="music-expanded__progress-played" style={{ width: String(progress * 100) + '%' }} />
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={Math.round(progress * 1000)}
                  onChange={event => onSeek(Number(event.target.value) / 1000)}
                  aria-label="Expanded playback position"
                />
              </div>
              <div className="music-expanded__time">
                <span>{formatTime(currentTime)}</span><span>/</span><span>{formatTime(duration)}</span>
              </div>
              <div className="music-expanded__controls">
                <button className="icon-button" type="button" onClick={onPrevious} aria-label="Previous track"><SkipBack aria-hidden="true" /></button>
                <button className="music-play-button" type="button" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
                <button className="icon-button" type="button" onClick={onNext} aria-label="Next track"><SkipForward aria-hidden="true" /></button>
                <button className="icon-button" type="button" onClick={onShare} aria-label="Share track"><Share2 aria-hidden="true" /></button>
                {canShowLyrics ? (
                  <button className="icon-button music-expanded__accent" type="button" onClick={onLyrics} aria-label="Lyrics" aria-pressed={lyricsEnabled}><Mic2 aria-hidden="true" /></button>
                ) : null}
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface UploadModalProps {
  open: boolean;
  status: string;
  onClose: () => void;
  onFiles: (files: FileList | null) => void;
}

export function UploadModal({ open, status, onClose, onFiles }: UploadModalProps) {
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onFiles(event.dataTransfer.files);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="music-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={event => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.section
            className="music-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={spring}
          >
            <header>
              <div><span>LOCAL LIBRARY</span><h2 id="upload-title">Add local music</h2></div>
              <button className="icon-button" type="button" onClick={onClose} aria-label="Close upload"><X aria-hidden="true" /></button>
            </header>
            <label
              className="music-upload-drop"
              htmlFor="music-file-input"
              onDragEnter={event => event.preventDefault()}
              onDragOver={event => event.preventDefault()}
              onDrop={handleDrop}
            >
              <UploadCloud aria-hidden="true" />
              <strong>Select or drop audio files</strong>
              <small>MP3, FLAC, M4A and other browser-supported audio. Up to 30MB per file and 50 local tracks.</small>
            </label>
            <input
              id="music-file-input"
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => onFiles(event.target.files)}
            />
            <div className="music-upload-status" aria-live="polite">{status}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function LibraryToggle({ onClick }: { onClick: () => void }) {
  return (
    <button className="music-library-toggle icon-button" type="button" onClick={onClick} aria-label="Open music library" title="Open music library">
      <ListMusic aria-hidden="true" />
    </button>
  );
}

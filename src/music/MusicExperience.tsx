'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import MusicWall from './MusicWall';
import {
  ExpandedPlayer,
  LibraryPanel,
  LibraryToggle,
  PlayerBar,
  UploadModal
} from './MusicUI';
import type {
  AmbientEffect,
  BackgroundTheme,
  LibraryTab,
  LyricLine,
  PlayMode,
  StoredTrack,
  Track
} from './types';
import {
  clamp,
  getMetingBases,
  loadLocalTracks,
  normalizeMetingSource,
  readAudioMetadata,
  readStored,
  resolveAsset,
  saveLocalTrack,
  writeStored
} from './utils';

const storageKeys = {
  recent: 'music-history-react-v1',
  mode: 'music-play-mode-react-v1',
  volume: 'music-volume-react-v1',
  effect: 'music-effect-react-v1',
  theme: 'music-theme-react-v1',
  lyrics: 'music-lyrics-react-v1'
};
const fallbackPlaylist = {
  id: 'netease-main',
  type: 'meting-playlist',
  server: 'netease',
  source: 'https://music.163.com/#/playlist?id=14035449837',
  enabled: true
} as const;

interface MetingPlaylistItem {
  name?: string;
  artist?: string;
  url?: string;
  pic?: string;
}

function getConfiguredMetingPlaylist() {
  const network = window.SITE_CONFIG?.music?.sources?.network;
  if (network?.enabled === false) return null;

  const playlists = Array.isArray(network?.playlists)
    ? network.playlists.filter(playlist => playlist?.enabled !== false)
    : [];
  const selected = playlists.find(playlist => playlist.id === network?.default) || playlists[0] || fallbackPlaylist;

  if (selected.type !== 'meting-playlist') return null;
  return selected;
}

function readPlaylistSourceId(source = '') {
  const sourceId = source.match(/[?&]id=([0-9A-Za-z]+)/)?.[1];
  return sourceId || (/^[0-9A-Za-z_-]+$/.test(source) ? source : '');
}

async function loadConfiguredPlaylist() {
  const playlist = getConfiguredMetingPlaylist();
  const playlistId = readPlaylistSourceId(playlist?.source);
  if (!playlist || !playlistId) return [];

  const server = playlist.server || 'netease';
  for (const base of getMetingBases()) {
    try {
      const response = await fetch(`${base}?server=${server}&type=playlist&id=${playlistId}`);
      if (!response.ok) continue;

      const items = await response.json() as MetingPlaylistItem[];
      if (!Array.isArray(items)) continue;

      const tracks = items.map((item, index) => {
        const songId = item.url?.match(/[?&]id=([0-9A-Za-z]+)/)?.[1];
        if (!songId || !item.name || !item.url) return null;
        return {
          id: `${server}-${songId}`,
          title: item.name,
          artist: item.artist || 'Unknown artist',
          cover: item.pic || '',
          audio: item.url,
          hue: (Number(songId) + index * 29) % 360,
          ratio: 1,
          span: index % 7 === 1 ? 2 : 1
        } satisfies Track;
      }).filter((track): track is Track => Boolean(track));

      if (tracks.length) return tracks;
    } catch {
      // Try the next configured Meting endpoint.
    }
  }
  return [];
}

const creditLinePattern = /(\u4f5c\u8bcd|\u4f5c\u66f2|\u7f16\u66f2|\u6f14\u5531|\u6b4c\u624b|\u6df7\u97f3|\u6bcd\u5e26|\u5236\u4f5c|\u76d1\u5236|\u5236\u4f5c\u4eba|\u5f55\u97f3|\u8c03\u97f3|\u548c\u58f0|\u5409\u4ed6|\u8d1d\u65af|\u9f13|\u952e\u76d8|\u5f26\u4e50|\u7ba1\u4e50|\u6253\u51fb\u4e50|\u7b56\u5212|\u7edf\u7b79|\u4f01\u5212|\u7ffb\u5531|\u539f\u5531|\u66f2\u7ed8|PV|OP|SP|by)\s*[:\uFF1A]/i;
const noLyricsPattern = /\u7eaf\u97f3\u4e50|\u8bf7\u6b23\u8d4f|\u6b64\u6b4c\u66f2\u4e3a\u6ca1\u6709\u586b\u8bcd/;

function parseLyrics(source: string): LyricLine[] {
  const parsed: LyricLine[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!timestamps.length) continue;

    const text = rawLine.replace(/\[[^\]]+\]/g, '').trim();
    if (!text || creditLinePattern.test(text)) continue;
    if (noLyricsPattern.test(text)) return [];

    timestamps.forEach(match => {
      const fraction = match[3] || '';
      parsed.push({
        time: Number(match[1]) * 60 + Number(match[2]) + (fraction ? Number(fraction) / 10 ** fraction.length : 0),
        text
      });
    });
  }

  return parsed
    .sort((left, right) => left.time - right.time)
    .filter((line, index, lines) => index === 0 || line.time !== lines[index - 1].time || line.text !== lines[index - 1].text);
}

interface MusicExperienceProps {
  onExit?: () => void;
}

export default function MusicExperience({ onExit }: MusicExperienceProps) {
  const backdropRef = useRef<HTMLImageElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<Track | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const modeRef = useRef<PlayMode>('list');
  const sourceIndexRef = useRef(0);
  const intendedToPlayRef = useRef(false);
  const nextRef = useRef<() => void>(() => {});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lyricsRequestRef = useRef(0);

  const [remoteTracks, setRemoteTracks] = useState<Track[]>([]);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const tracks = useMemo(() => {
    const featuredTracks = remoteTracks.filter(track => track.featured);
    const featuredIds = new Set(featuredTracks.map(track => track.id));
    return [
      ...featuredTracks,
      ...localTracks.filter(track => !featuredIds.has(track.id)),
      ...remoteTracks.filter(track => !track.featured)
    ];
  }, [localTracks, remoteTracks]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playMode, setPlayMode] = useState<PlayMode>('list');
  const [recent, setRecent] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('all');
  const [query, setQuery] = useState('');
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [effect, setEffect] = useState<AmbientEffect>('rain');
  const [theme, setTheme] = useState<BackgroundTheme>('background');
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null);
  const [lyricsEnabled, setLyricsEnabled] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    const savedRecent = readStored<string[]>(storageKeys.recent, []);
    const savedMode = readStored<PlayMode>(storageKeys.mode, 'list');
    const savedVolume = clamp(readStored<number>(storageKeys.volume, 1), 0, 1);
    const savedEffect = readStored<AmbientEffect>(storageKeys.effect, 'rain');
    const savedTheme = readStored<BackgroundTheme>(storageKeys.theme, 'background');
    const savedLyrics = readStored<boolean>(storageKeys.lyrics, true);
    setRecent(savedRecent);
    setPlayMode(savedMode);
    setVolumeState(savedVolume);
    setEffect(savedEffect);
    setTheme(savedTheme);
    setLyricsEnabled(savedLyrics);

    let cancelled = false;
    const loadTracks = async () => {
      const fallbackTracks = Array.isArray(window.MUSIC_TRACKS) ? window.MUSIC_TRACKS : [];
      setRemoteTracks(fallbackTracks);

      void loadLocalTracks()
        .then(loadedTracks => { if (!cancelled) setLocalTracks(loadedTracks); })
        .catch(() => { if (!cancelled) setLocalTracks([]); });

      const playlistTracks = await loadConfiguredPlaylist();
      if (cancelled) return;
      if (playlistTracks.length) {
        const playlistIds = new Set(playlistTracks.map(track => track.id.replace(/^[a-z]+-/, '')));
        const remainingTracks = fallbackTracks.filter(track => {
          if (track.local || track.featured) return true;
          const sourceId = track.audio.match(/[?&]id=([0-9A-Za-z]+)/)?.[1];
          return !sourceId || !playlistIds.has(sourceId);
        });
        setRemoteTracks([...playlistTracks, ...remainingTracks]);
      } else {
        showToast('Online playlist is temporarily unavailable.');
      }
    };
    void loadTracks();

    return () => {
      cancelled = true;
      localTracks.forEach(track => {
        if (track.local && track.audio.startsWith('blob:')) URL.revokeObjectURL(track.audio);
      });
    };
  }, [showToast]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    modeRef.current = playMode;
  }, [playMode]);

  const addRecent = useCallback((trackId: string) => {
    setRecent(previous => {
      const next = [trackId, ...previous.filter(id => id !== trackId)].slice(0, 50);
      writeStored(storageKeys.recent, next);
      return next;
    });
  }, []);

  const loadTrack = useCallback(async (track: Track, autoplay = true, startAt = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    const normalizedStartAt = Number.isFinite(startAt) ? Math.max(0, startAt) : 0;

    intendedToPlayRef.current = autoplay;
    sourceIndexRef.current = 0;
    setCurrentTrack(track);
    currentRef.current = track;
    setCurrentTime(normalizedStartAt);
    setDuration(0);
    setBuffered(0);
    lyricsRequestRef.current += 1;
    setLyrics([]);
    setLyricsTrackId(null);
    addRecent(track.id);

    const nextSrc = track.local ? track.audio : normalizeMetingSource(track.audio, 0);
    const resolvedNextSrc = new URL(nextSrc, window.location.href).href;
    const sameSource = audio.src === resolvedNextSrc;
    if (!sameSource) {
      audio.pause();
      audio.src = nextSrc;
      audio.load();
    }
    if (normalizedStartAt > 0) {
      const applyStartTime = () => {
        if (sameSource && !audio.paused && Math.abs((audio.currentTime || 0) - normalizedStartAt) < 1) return;
        const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
        audio.currentTime = nextDuration ? Math.min(normalizedStartAt, Math.max(0, nextDuration - 0.25)) : normalizedStartAt;
        setCurrentTime(audio.currentTime || normalizedStartAt);
      };
      if (audio.readyState >= 1) applyStartTime();
      else audio.addEventListener('loadedmetadata', applyStartTime, { once: true });
    }
    if (!autoplay) return;
    if (sameSource && !audio.paused) {
      setIsPlaying(true);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      showToast('Playback was blocked or the source is unavailable.');
    }
  }, [addRecent, showToast]);

  const playNext = useCallback(() => {
    const available = tracksRef.current;
    if (!available.length) return;
    const index = available.findIndex(track => track.id === currentRef.current?.id);
    void loadTrack(available[(index + 1 + available.length) % available.length], true);
  }, [loadTrack]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    const available = tracksRef.current;
    if (!available.length) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const index = available.findIndex(track => track.id === currentRef.current?.id);
    void loadTrack(available[(index - 1 + available.length) % available.length], true);
  }, [loadTrack]);

  useEffect(() => {
    nextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    const audio = window.SharedMusicAudio || new Audio();
    const sharedAudio = audio === window.SharedMusicAudio;
    audio.preload = 'metadata';
    if (sharedAudio) setVolumeState(audio.volume);
    else audio.volume = volume;
    audioRef.current = audio;

    const updateProgress = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setCurrentTime(audio.currentTime || 0);
      setDuration(nextDuration);
      if (audio.buffered.length && nextDuration) {
        setBuffered(clamp(audio.buffered.end(audio.buffered.length - 1) / nextDuration, 0, 1));
      } else {
        setBuffered(0);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (modeRef.current === 'one') {
        audio.currentTime = 0;
        void audio.play();
      } else if (modeRef.current === 'list') {
        nextRef.current();
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      const track = currentRef.current;
      const metingBases = getMetingBases();
      if (track && !track.local && sourceIndexRef.current < metingBases.length - 1) {
        sourceIndexRef.current += 1;
        audio.src = normalizeMetingSource(track.audio, sourceIndexRef.current);
        audio.load();
        if (intendedToPlayRef.current) void audio.play().catch(() => {});
        return;
      }
      setIsPlaying(false);
      showToast(track?.local ? 'The local audio file could not be played.' : 'This audio source is temporarily unavailable.');
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('progress', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    updateProgress();
    setIsPlaying(!audio.paused);

    return () => {
      const track = currentRef.current;
      if (track) {
        window.HomeMusicSync = {
          trackId: track.id,
          track,
          currentTime: audio.currentTime || 0,
          wasPlaying: !audio.paused,
          userPaused: audio.paused
        };
      }
      if (!sharedAudio) audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('progress', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
      audio.removeEventListener('durationchange', updateProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [showToast]);

  useEffect(() => {
    if (!currentTrack && tracks.length && audioRef.current) {
      const sync = window.HomeMusicSync;
      const syncedTrack = sync?.trackId ? tracks.find(track => track.id === sync.trackId) : null;
      const initialTrack = syncedTrack || tracks[0];
      const shouldAutoplay = syncedTrack ? Boolean(sync?.wasPlaying && !sync?.userPaused) : false;
      void loadTrack(initialTrack, shouldAutoplay, syncedTrack ? sync?.currentTime || 0 : 0);
    }
  }, [currentTrack, loadTrack, tracks]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentRef.current && tracksRef.current[0]) {
      void loadTrack(tracksRef.current[0], true);
      return;
    }
    intendedToPlayRef.current = audio.paused;
    if (audio.paused) void audio.play().catch(() => showToast('Click play again to allow audio.'));
    else audio.pause();
  }, [loadTrack, showToast]);

  const selectTrack = useCallback((track: Track) => {
    if (currentRef.current?.id === track.id && audioRef.current?.src) togglePlay();
    else void loadTrack(track, true);
  }, [loadTrack, togglePlay]);

  const cycleMode = useCallback(() => {
    const modes: PlayMode[] = ['list', 'one', 'once'];
    setPlayMode(previous => {
      const next = modes[(modes.indexOf(previous) + 1) % modes.length];
      writeStored(storageKeys.mode, next);
      showToast(next === 'list' ? '列表循环' : next === 'one' ? '单曲循环' : '播完停止');
      return next;
    });
  }, [showToast]);

  const cycleEffect = useCallback(() => {
    const effects: AmbientEffect[] = ['rain', 'center', 'off'];
    setEffect(previous => {
      const next = effects[(effects.indexOf(previous) + 1) % effects.length];
      writeStored(storageKeys.effect, next);
      showToast(next === 'rain' ? '特效：声波粒子' : next === 'center' ? '特效：中心涟漪' : '特效：关闭');
      return next;
    });
  }, [showToast]);

  const cycleTheme = useCallback(() => {
    const themes: BackgroundTheme[] = ['background', 'cover', 'gradient'];
    setTheme(previous => {
      const next = themes[(themes.indexOf(previous) + 1) % themes.length];
      writeStored(storageKeys.theme, next);
      showToast(next === 'background' ? '背景：小波底图' : next === 'cover' ? '背景：当前封面' : '背景：渐变色场');
      return next;
    });
  }, [showToast]);

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);
    setVolumeState(next);
    if (audioRef.current) audioRef.current.volume = next;
    writeStored(storageKeys.volume, next);
  }, []);

  const seek = useCallback((progress: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = progress * audio.duration;
  }, []);

  const filteredTracks = useMemo(() => {
    let result = tracks;
    if (libraryTab === 'recent') {
      result = recent.map(id => tracks.find(track => track.id === id)).filter((track): track is Track => Boolean(track));
    }
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery) {
      result = result.filter(track => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(normalizedQuery));
    }
    return result;
  }, [libraryTab, query, recent, tracks]);

  const addLocalFiles = useCallback(async (fileList: FileList | null) => {
    const files = Array.from(fileList || []).slice(0, Math.max(0, 50 - localTracks.length));
    if (!files.length) return;
    setUploadStatus('Reading audio metadata...');
    let added = 0;

    for (const file of files) {
      if (file.size > 30 * 1024 * 1024) {
        showToast(`${file.name} exceeds 30MB and was skipped.`);
        continue;
      }
      try {
        const metadata = await readAudioMetadata(file);
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const record: StoredTrack = {
          id,
          title: metadata.title,
          artist: metadata.artist || 'Local audio',
          cover: metadata.cover,
          audio: '',
          hue: Math.abs(id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) % 360,
          ratio: 1,
          span: 1,
          local: true,
          addedAt: Date.now(),
          blob: file
        };
        await saveLocalTrack(record);
        setLocalTracks(previous => [...previous, { ...record, blob: undefined, audio: URL.createObjectURL(file) } as Track]);
        added += 1;
      } catch {
        showToast(`${file.name} could not be added.`);
      }
    }

    setUploadStatus(added ? `Added ${added} local track${added === 1 ? '' : 's'}.` : 'No tracks were added.');
  }, [localTracks.length, showToast]);

  const shareCurrent = useCallback(async () => {
    if (!currentTrack) return;
    const data = { title: currentTrack.title, text: `${currentTrack.title} - ${currentTrack.artist}` };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.text);
        showToast('Track details copied.');
      }
    } catch {
      // The native share sheet can be dismissed without feedback.
    }
  }, [currentTrack, showToast]);

  const loadLyrics = useCallback(async (track: Track, notify = false) => {
    const request = ++lyricsRequestRef.current;
    setLyrics([]);
    setLyricsTrackId(track.id);

    const lyricSource = track.lyricSource || (() => {
      const match = track.audio.match(/[?&]server=(netease|tencent).*?[?&]id=([0-9A-Za-z]+)/);
      return match ? { server: match[1] as 'netease' | 'tencent', id: match[2] } : null;
    })();

    if (!lyricSource) {
      if (notify) showToast('Lyrics are not available for this local track.');
      return;
    }

    if (notify) showToast('Loading lyrics...');
    for (const base of getMetingBases()) {
      try {
        const response = await fetch(`${base}?server=${lyricSource.server}&type=lrc&id=${lyricSource.id}`);
        if (!response.ok) continue;
        const parsed = parseLyrics(await response.text());
        if (request !== lyricsRequestRef.current || currentRef.current?.id !== track.id) return;
        if (parsed.length) {
          setLyrics(parsed);
          return;
        }
      } catch {
        // Try the next parser endpoint.
      }
    }

    if (request === lyricsRequestRef.current && currentRef.current?.id === track.id && notify) {
      showToast('No lyrics are available for this track.');
    }
  }, [showToast]);

  const toggleLyrics = useCallback(() => {
    setLyricsEnabled(previous => {
      const next = !previous;
      writeStored(storageKeys.lyrics, next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!expandedOpen || !lyricsEnabled || !currentTrack || lyricsTrackId === currentTrack.id) return;
    void loadLyrics(currentTrack);
  }, [currentTrack, expandedOpen, loadLyrics, lyricsEnabled, lyricsTrackId]);

  const onAmbientMove = useCallback((x: number, y: number) => {
    if (!backdropRef.current) return;
    const normalizedX = x / window.innerWidth * 2 - 1;
    const normalizedY = y / window.innerHeight * 2 - 1;
    backdropRef.current.style.transform = `translate3d(${(-24 * normalizedX).toFixed(2)}px, ${(-24 * normalizedY).toFixed(2)}px, 0) scale(1.06)`;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (uploadOpen) setUploadOpen(false);
      else if (expandedOpen) setExpandedOpen(false);
      else if (libraryOpen) setLibraryOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedOpen, libraryOpen, uploadOpen]);

  return (
    <main className="music-app" id="music-app" aria-label="Immersive music space">
      <div className="music-backdrop" aria-hidden="true">
        <img ref={backdropRef} src={resolveAsset('images/mos-background.webp')} alt="" draggable={false} decoding="async" />
        <div className="music-backdrop__wash" />
        <div className="music-backdrop__vignette" />
        <div className="music-backdrop__grain" />
      </div>

      <MusicWall
        tracks={tracks}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onSelect={selectTrack}
        onOpen={() => setExpandedOpen(true)}
        onPrevious={playPrevious}
        onNext={playNext}
        onAmbientMove={onAmbientMove}
      />

      <button className="music-close icon-button" type="button" data-music-exit aria-label="Return to interests" title="Return to interests" onClick={onExit}>
        <X aria-hidden="true" />
      </button>

      <LibraryPanel
        open={libraryOpen}
        tab={libraryTab}
        query={query}
        tracks={filteredTracks}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        total={tracks.length}
        onClose={() => setLibraryOpen(false)}
        onQuery={setQuery}
        onTab={setLibraryTab}
        onPlay={track => void loadTrack(track, true)}
        onUpload={() => { setLibraryOpen(false); setUploadOpen(true); }}
      />
      <LibraryToggle onClick={() => setLibraryOpen(true)} />

      <PlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        volume={volume}
        mode={playMode}
        effect={effect}
        theme={theme}
        onExpand={() => setExpandedOpen(true)}
        onToggle={togglePlay}
        onPrevious={playPrevious}
        onNext={playNext}
        onMode={cycleMode}
        onEffect={cycleEffect}
        onTheme={cycleTheme}
        onVolume={setVolume}
        onHistory={() => { setLibraryTab('recent'); setLibraryOpen(true); }}
        onSeek={seek}
      />

      <ExpandedPlayer
        open={expandedOpen}
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        effect={effect}
        theme={theme}
        volume={volume}
        lyrics={lyrics}
        lyricsEnabled={lyricsEnabled}
        onClose={() => setExpandedOpen(false)}
        onToggle={togglePlay}
        onPrevious={playPrevious}
        onNext={playNext}
        onShare={() => void shareCurrent()}
        onLyrics={toggleLyrics}
        onSeek={seek}
      />

      <UploadModal
        open={uploadOpen}
        status={uploadStatus}
        onClose={() => setUploadOpen(false)}
        onFiles={files => void addLocalFiles(files)}
      />

      <AnimatePresence>
        {toast ? (
          <motion.div
            className="music-toast is-visible"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

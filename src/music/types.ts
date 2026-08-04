export type PlayMode = 'list' | 'one' | 'once';
export type LibraryTab = 'all' | 'recent';
export type AmbientEffect = 'rain' | 'center' | 'off';
export type BackgroundTheme = 'background' | 'cover' | 'gradient';

export interface LyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  audio: string;
  hue: number;
  ratio: number;
  span: number;
  local?: boolean;
  addedAt?: number;
  featured?: boolean;
  lyricSource?: {
    server: 'netease' | 'tencent';
    id: string;
  };
}

export interface StoredTrack extends Track {
  blob: Blob;
}

export interface CardLayout {
  track: Track;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
}

export interface WallLayout {
  cards: CardLayout[];
  tileWidth: number;
  tileHeight: number;
}

export interface WallInstance {
  key: string;
  card: CardLayout;
  worldX: number;
  worldY: number;
}

declare global {
  interface Window {
    MUSIC_TRACKS?: Track[];
    MusicAssets?: Record<string, string>;
    MusicRouteTransition?: {
      navigate: (url: string, cardName: string, direction: number) => void;
      open: (entry?: HTMLElement | null) => void;
      close: () => void;
    };
    MusicComponent?: {
      show: () => void;
      hide: () => void;
      focusClose: () => void;
      isOpen: () => boolean;
    };
    HomeMusicSync?: {
      trackId: string;
      currentTime: number;
      wasPlaying: boolean;
    };
    SharedMusicAudio?: HTMLAudioElement;
  }
}

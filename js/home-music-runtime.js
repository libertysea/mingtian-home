(() => {
  const homeMusicOrb = document.getElementById('homeMusicOrb');
  const homeMusicAudio = document.getElementById('homeMusicAudio');
  if (homeMusicAudio) window.SharedMusicAudio = homeMusicAudio;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const homeMusicPanel = document.getElementById('homeMusicPanel');
  const homeMusicCover = document.getElementById('homeMusicCover');
  const homeMusicTitle = document.getElementById('homeMusicTitle');
  const homeMusicArtist = document.getElementById('homeMusicArtist');
  const homeMusicPrev = document.getElementById('homeMusicPrev');
  const homeMusicToggle = document.getElementById('homeMusicToggle');
  const homeMusicNext = document.getElementById('homeMusicNext');
  const homeMusicMinimize = document.getElementById('homeMusicMinimize');
  const homeMusicProgress = document.getElementById('homeMusicProgress');
  const homeMusicProgressFill = document.getElementById('homeMusicProgressFill');
  const homeMusicList = document.getElementById('homeMusicList');
  let homeMusicStarted = false;
  let homeMusicStartQueued = false;
  let homeMusicResumeAfterMusic = false;
  let homeMusicTrackIndex = 0;
  let homeMusicPanelRendered = false;
  let homeMusicRevealStartRequested = false;
  let homeMusicVolumeInitialized = false;
  let homeMusicUserPaused = false;
  let homeMusicGestureUnlocked = false;
  let homeMusicGestureUnlocking = false;
  let homeMusicExternalTrack = null;

  const homeMusicFallbackTrack = {
    id: 'local-yoasobi-gunjou',
    title: '群青',
    artist: 'YOASOBI',
    cover: 'images/music/music-yoasobi-gunjou-cover.jpg',
    audio: 'music/local/yoasobi-gunjou.mp3',
    local: true
  };

  const isHomeMusicAutoplayEnabled = () => window.SITE_CONFIG?.music?.player?.autoplay !== false;

  const getHomeMusicTracks = () => {
    const sharedTracks = Array.isArray(window.MUSIC_TRACKS) ? window.MUSIC_TRACKS : [];
    const baseTracks = sharedTracks.filter(track => track?.audio && track?.cover && track?.title);
    const playableTracks = homeMusicExternalTrack?.audio && !baseTracks.some(track => track.id === homeMusicExternalTrack.id)
      ? [homeMusicExternalTrack, ...baseTracks]
      : baseTracks;
    return playableTracks.length ? playableTracks : [homeMusicFallbackTrack];
  };

  const applyHomeMusicExternalTrack = (track) => {
    if (!track?.id || !track?.audio || !track?.cover || !track?.title) return;
    homeMusicExternalTrack = track;
  };

  const getHomeMusicTrack = () => {
    const tracks = getHomeMusicTracks();
    homeMusicTrackIndex = clamp(homeMusicTrackIndex, 0, tracks.length - 1);
    return tracks[homeMusicTrackIndex] || homeMusicFallbackTrack;
  };

  const updateHomeMusicSync = () => {
    const track = getHomeMusicTrack();
    window.HomeMusicSync = {
      trackId: track.id,
      track,
      currentTime: homeMusicAudio?.currentTime || 0,
      wasPlaying: !homeMusicUserPaused && (Boolean(homeMusicAudio && !homeMusicAudio.paused) || homeMusicStartQueued),
      userPaused: homeMusicUserPaused
    };
  };

  const setHomeMusicPlaying = (playing) => {
    const track = getHomeMusicTrack();
    if (!homeMusicOrb) return;
    homeMusicOrb.classList.toggle('is-playing', playing);
    homeMusicOrb.title = playing ? '展开音乐列表 - 正在播放' : '展开音乐列表';
    homeMusicOrb.setAttribute('aria-label', playing ? '展开音乐列表，音乐正在播放' : '展开音乐列表');
    if (homeMusicToggle) {
      homeMusicToggle.textContent = playing ? 'Ⅱ' : '▶';
      homeMusicToggle.setAttribute('aria-label', playing ? '暂停' : '播放');
    }
    const orbCover = homeMusicOrb.querySelector('.home-music-orb__disc img');
    if (orbCover && track?.cover) orbCover.src = track.cover;
  };

  const renderHomeMusicPanel = () => {
    const tracks = getHomeMusicTracks();
    const track = getHomeMusicTrack();
    if (homeMusicCover) homeMusicCover.src = track.cover || '';
    if (homeMusicTitle) homeMusicTitle.textContent = track.title || 'Unknown';
    if (homeMusicArtist) homeMusicArtist.textContent = track.artist || 'Unknown artist';
    if (!homeMusicList) return;
    homeMusicList.innerHTML = '';
    tracks.forEach((item, index) => {
      const button = document.createElement('button');
      button.className = 'home-music-panel__item';
      if (index === homeMusicTrackIndex) button.classList.add('is-current');
      button.type = 'button';
      button.innerHTML = '<span class="home-music-panel__item-cover"><img alt="" draggable="false"></span><span><strong class="home-music-panel__item-title"></strong><span class="home-music-panel__item-artist"></span></span>';
      const image = button.querySelector('img');
      const title = button.querySelector('.home-music-panel__item-title');
      const artist = button.querySelector('.home-music-panel__item-artist');
      if (image) image.src = item.cover || '';
      if (title) title.textContent = item.title || 'Unknown';
      if (artist) artist.textContent = item.artist || 'Unknown artist';
      button.addEventListener('click', () => playHomeMusicTrack(index, true));
      homeMusicList.appendChild(button);
    });
    homeMusicList.querySelector('.home-music-panel__item.is-current')?.scrollIntoView({
      block: 'nearest'
    });
    homeMusicPanelRendered = true;
  };

  const updateHomeMusicProgress = () => {
    if (!homeMusicAudio) return;
    const duration = Number.isFinite(homeMusicAudio.duration) ? homeMusicAudio.duration : 0;
    const progress = duration ? homeMusicAudio.currentTime / duration : 0;
    if (homeMusicProgress) homeMusicProgress.value = String(Math.round(progress * 1000));
    if (homeMusicProgressFill) homeMusicProgressFill.style.width = String(clamp(progress, 0, 1) * 100) + '%';
    updateHomeMusicSync();
  };

  const playHomeMusicTrack = async (index = homeMusicTrackIndex, autoplay = true, startAt = 0) => {
    if (!homeMusicAudio) return;
    const tracks = getHomeMusicTracks();
    homeMusicTrackIndex = (index + tracks.length) % tracks.length;
    const track = getHomeMusicTrack();
    const nextSrc = new URL(track.audio, document.baseURI).href;
    const shouldLoad = homeMusicAudio.src !== nextSrc;
    if (shouldLoad) {
      homeMusicAudio.pause();
      homeMusicAudio.src = track.audio;
      homeMusicAudio.load();
    }
    const applyStart = () => {
      if (!startAt) return;
      if (!shouldLoad && !homeMusicAudio.paused && Math.abs((homeMusicAudio.currentTime || 0) - startAt) < 1) return;
      const duration = Number.isFinite(homeMusicAudio.duration) ? homeMusicAudio.duration : 0;
      homeMusicAudio.currentTime = duration ? Math.min(startAt, Math.max(0, duration - 0.25)) : startAt;
    };
    if (startAt) {
      if (homeMusicAudio.readyState >= 1) applyStart();
      else homeMusicAudio.addEventListener('loadedmetadata', applyStart, { once: true });
    }
    renderHomeMusicPanel();
    updateHomeMusicProgress();
    if (!autoplay) {
      homeMusicStartQueued = false;
      setHomeMusicPlaying(false);
      updateHomeMusicSync();
      return;
    }
    if (!shouldLoad && !homeMusicAudio.paused) {
      homeMusicStarted = true;
      homeMusicStartQueued = false;
      setHomeMusicPlaying(true);
      updateHomeMusicSync();
      return;
    }
    const finishHomeMusicStart = () => {
      homeMusicStarted = true;
      homeMusicUserPaused = false;
      homeMusicStartQueued = false;
      setHomeMusicPlaying(true);
      updateHomeMusicSync();
    };
    const queueHomeMusicStart = () => {
      setHomeMusicPlaying(false);
      homeMusicStartQueued = true;
      updateHomeMusicSync();
    };
    try {
      await homeMusicAudio.play();
      finishHomeMusicStart();
    } catch {
      const wasMuted = homeMusicAudio.muted;
      try {
        homeMusicAudio.muted = true;
        await homeMusicAudio.play();
        if (!wasMuted) {
          window.setTimeout(() => {
            if (!homeMusicUserPaused && !homeMusicAudio.paused) homeMusicAudio.muted = false;
          }, 80);
        }
        finishHomeMusicStart();
      } catch {
        homeMusicAudio.muted = wasMuted;
        queueHomeMusicStart();
      }
    }
  };

  const startHomeMusic = () => {
    if (!homeMusicAudio || !homeMusicOrb) return;
    homeMusicOrb.classList.add('is-visible');
    if (!homeMusicVolumeInitialized && !window.HomeMusicSync) {
      homeMusicAudio.volume = 0.68;
      homeMusicVolumeInitialized = true;
    }
    const sync = window.HomeMusicSync;
    const tracks = getHomeMusicTracks();
    const syncIndex = tracks.findIndex(track => track.id === sync?.trackId);
    if (sync?.userPaused) {
      homeMusicUserPaused = true;
      void playHomeMusicTrack(syncIndex >= 0 ? syncIndex : homeMusicTrackIndex, false, sync?.currentTime || 0);
      return;
    }
    void playHomeMusicTrack(syncIndex >= 0 ? syncIndex : homeMusicTrackIndex, true, sync?.currentTime || 0);
  };

  const unlockHomeMusicOnGesture = async () => {
    if (!homeMusicAudio || homeMusicGestureUnlocked || homeMusicGestureUnlocking || homeMusicUserPaused || window.MusicComponent?.isOpen?.()) return;
    if (homeMusicRevealStartRequested || homeMusicStartQueued) {
      startHomeMusic();
      return;
    }
    homeMusicGestureUnlocking = true;
    const wasMuted = homeMusicAudio.muted;
    try {
      homeMusicAudio.muted = true;
      await homeMusicAudio.play();
      homeMusicGestureUnlocked = true;
      homeMusicAudio.pause();
      homeMusicAudio.muted = wasMuted;
      updateHomeMusicSync();
    } catch {
      homeMusicAudio.muted = wasMuted;
    } finally {
      homeMusicGestureUnlocking = false;
    }
  };

  const retryHomeMusicOnGesture = () => {
    if (window.MusicComponent?.isOpen?.() || homeMusicUserPaused || window.HomeMusicSync?.userPaused) return;
    if (homeMusicStartQueued || homeMusicRevealStartRequested) {
      startHomeMusic();
      return;
    }
    void unlockHomeMusicOnGesture();
  };

  const clickHomeMusicPlayControl = () => {
    const sync = window.HomeMusicSync;
    if (!homeMusicToggle || !homeMusicAudio || !homeMusicAudio.paused || homeMusicUserPaused || sync?.userPaused) return false;
    if (sync?.trackId) {
      const tracks = getHomeMusicTracks();
      const syncIndex = tracks.findIndex(track => track.id === sync.trackId);
      if (syncIndex >= 0) homeMusicTrackIndex = syncIndex;
      if (sync.currentTime && sync.trackId === getHomeMusicTrack().id) homeMusicAudio.currentTime = sync.currentTime;
    }
    homeMusicToggle.click();
    return true;
  };

  const setHomeMusicPanelOpen = (open) => {
    if (!homeMusicPanel || !homeMusicOrb) return;
    if (open && !homeMusicPanelRendered) renderHomeMusicPanel();
    homeMusicPanel.hidden = false;
    homeMusicOrb.setAttribute('aria-expanded', String(open));
    homeMusicPanel.classList.toggle('is-open', open);
    if (!open) {
      window.setTimeout(() => {
        if (!homeMusicPanel.classList.contains('is-open')) homeMusicPanel.hidden = true;
      }, 260);
    }
  };

  const startHomeMusicForHomeReveal = () => {
    if (homeMusicRevealStartRequested) return;
    homeMusicRevealStartRequested = true;
    homeMusicOrb?.classList.add('is-visible');
    window.setTimeout(() => {
      if (!clickHomeMusicPlayControl()) startHomeMusic();
    }, 0);
  };

  const primeHomeMusic = () => {
    if (!homeMusicAudio) return;
    try {
      homeMusicAudio.load();
    } catch {
      // Some browsers ignore explicit preload calls until media is visible.
    }
  };

  const startHomeMusicWhenNavReady = () => {
    const run = () => {
      if (!isHomeMusicAutoplayEnabled()) {
        homeMusicOrb?.classList.add('is-visible');
        renderHomeMusicPanel();
        updateHomeMusicSync();
        return;
      }
      startHomeMusicForHomeReveal();
    };
    if (document.body.classList.contains('site-nav-ready')) {
      run();
      return;
    }
    const bodyObserver = new MutationObserver(() => {
      if (!document.body.classList.contains('site-nav-ready')) return;
      bodyObserver.disconnect();
      run();
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('site-nav-ready', () => {
      bodyObserver.disconnect();
      run();
    }, { once: true });
  };

  homeMusicAudio?.addEventListener('play', () => {
    homeMusicUserPaused = false;
    setHomeMusicPlaying(true);
    updateHomeMusicSync();
  });
  homeMusicAudio?.addEventListener('pause', () => {
    setHomeMusicPlaying(false);
    updateHomeMusicSync();
  });
  homeMusicAudio?.addEventListener('timeupdate', updateHomeMusicProgress);
  homeMusicAudio?.addEventListener('loadedmetadata', updateHomeMusicProgress);
  homeMusicAudio?.addEventListener('durationchange', updateHomeMusicProgress);
  homeMusicAudio?.addEventListener('ended', () => void playHomeMusicTrack(homeMusicTrackIndex + 1, true));
  homeMusicOrb?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setHomeMusicPanelOpen(!homeMusicPanel?.classList.contains('is-open'));
  });
  homeMusicPrev?.addEventListener('click', () => void playHomeMusicTrack(homeMusicTrackIndex - 1, true));
  homeMusicNext?.addEventListener('click', () => void playHomeMusicTrack(homeMusicTrackIndex + 1, true));
  homeMusicToggle?.addEventListener('click', () => {
    if (!homeMusicAudio) return;
    if (homeMusicAudio.paused) {
      homeMusicUserPaused = false;
      void playHomeMusicTrack(homeMusicTrackIndex, true, homeMusicAudio.currentTime || 0);
    } else {
      homeMusicUserPaused = true;
      homeMusicStartQueued = false;
      homeMusicAudio.pause();
      updateHomeMusicSync();
    }
  });
  homeMusicMinimize?.addEventListener('click', () => setHomeMusicPanelOpen(false));
  homeMusicProgress?.addEventListener('input', () => {
    if (!homeMusicAudio) return;
    const duration = Number.isFinite(homeMusicAudio.duration) ? homeMusicAudio.duration : 0;
    if (duration) homeMusicAudio.currentTime = duration * (Number(homeMusicProgress.value) / 1000);
    updateHomeMusicProgress();
  });
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#homeMusicPanel') || event.target.closest('#homeMusicOrb')) return;
    setHomeMusicPanelOpen(false);
  });
  window.addEventListener('music-route-opening', () => {
    homeMusicResumeAfterMusic = !homeMusicUserPaused && (homeMusicStarted || Boolean(homeMusicAudio && !homeMusicAudio.paused) || homeMusicStartQueued);
    updateHomeMusicSync();
    if (window.HomeMusicSync) window.HomeMusicSync.wasPlaying = homeMusicResumeAfterMusic;
    setHomeMusicPanelOpen(false);
  });
  window.addEventListener('pointerdown', retryHomeMusicOnGesture, { passive: true });
  window.addEventListener('keydown', retryHomeMusicOnGesture);
  window.addEventListener('music-component-closed', () => {
    const sync = window.HomeMusicSync;
    if (sync?.track) applyHomeMusicExternalTrack(sync.track);
    if (sync?.trackId) {
      const tracks = getHomeMusicTracks();
      const nextIndex = tracks.findIndex(track => track.id === sync.trackId);
      if (nextIndex >= 0) homeMusicTrackIndex = nextIndex;
    }
    if (homeMusicAudio && sync?.trackId === getHomeMusicTrack().id) {
      homeMusicAudio.currentTime = sync.currentTime || 0;
      homeMusicUserPaused = Boolean(sync.userPaused);
      homeMusicResumeAfterMusic = !homeMusicUserPaused && Boolean(sync.wasPlaying);
    }
    renderHomeMusicPanel();
    if (!homeMusicResumeAfterMusic) return;
    homeMusicResumeAfterMusic = false;
    startHomeMusic();
  });
  primeHomeMusic();
  startHomeMusicWhenNavReady();
})();

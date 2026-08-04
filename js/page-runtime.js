const loader = document.getElementById('loader');
    const loaderFill = document.getElementById('loaderFill');
    const stage = document.getElementById('stage');
    const video = document.getElementById('heroVideo');
    const homeMusicOrb = document.getElementById('homeMusicOrb');
    const homeMusicAudio = document.getElementById('homeMusicAudio');
    if (homeMusicAudio) window.SharedMusicAudio = homeMusicAudio;

    const aboutSection = document.getElementById('about');

    let progress = 0;
    let done = false;
    let started = false;
    let aboutLanyardActive = false;
    let scrollFloatFrame = 0;
    let scrollFloatTimeline = null;
    let scrollFloatTrigger = null;
    let scrollFloatUsingGsap = false;
    let blogScrollFloatTween = null;
    let blogPreviewFadeTween = null;
    let identityTiltFrame = 0;
    let identityTiltPoint = null;
    let identityTiltTarget = null;
    let identityHoverActive = false;
    let identityTiltTweenTarget = null;
    let identityTiltState = { x: 0, y: 0 };
    let identityTiltXTo = null;
    let identityTiltYTo = null;
    const scrollFloatItems = [];
    const loaderSettleMs = 760;
    const loaderHoldMs = 500;
    const loaderEraseMs = 180;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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

    const homeMusicFallbackTrack = {
      id: 'local-yoasobi-gunjou',
      title: '群青',
      artist: 'YOASOBI',
      cover: 'images/music/music-yoasobi-gunjou-cover.jpg',
      audio: 'music/local/yoasobi-gunjou.mp3',
      local: true
    };

    const getHomeMusicTracks = () => {
      const sharedTracks = Array.isArray(window.MUSIC_TRACKS) ? window.MUSIC_TRACKS : [];
      const playableTracks = sharedTracks.filter(track => track?.audio && track?.cover && track?.title);
      return playableTracks.length ? playableTracks : [homeMusicFallbackTrack];
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
        currentTime: homeMusicAudio?.currentTime || 0,
        wasPlaying: Boolean(homeMusicAudio && !homeMusicAudio.paused) || homeMusicStartQueued
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
      if (!autoplay) return;
      if (!shouldLoad && !homeMusicAudio.paused) {
        homeMusicStarted = true;
        homeMusicStartQueued = false;
        setHomeMusicPlaying(true);
        return;
      }
      try {
        await homeMusicAudio.play();
        homeMusicStarted = true;
        homeMusicStartQueued = false;
        setHomeMusicPlaying(true);
      } catch {
        setHomeMusicPlaying(false);
        homeMusicStartQueued = true;
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
      void playHomeMusicTrack(syncIndex >= 0 ? syncIndex : homeMusicTrackIndex, true, sync?.currentTime || 0);
    };

    const retryHomeMusicOnGesture = () => {
      if (!homeMusicStartQueued || window.MusicComponent?.isOpen?.()) return;
      startHomeMusic();
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
      window.setTimeout(startHomeMusic, 0);
    };

    const primeHomeMusic = () => {
      if (!homeMusicAudio) return;
      try {
        homeMusicAudio.load();
      } catch {
        // Some browsers ignore explicit preload calls until media is visible.
      }
    };

    const startHomeMusicWhenStageReady = () => {
      const run = () => {
        homeMusicOrb?.classList.add('is-visible');
        startHomeMusicForHomeReveal();
      };
      if (stage?.classList.contains('is-ready')) {
        run();
        return;
      }
      const navObserver = new MutationObserver(() => {
        if (!stage?.classList.contains('is-ready')) return;
        navObserver.disconnect();
        run();
      });
      if (stage) navObserver.observe(stage, { attributes: true, attributeFilter: ['class'] });
    };

    homeMusicAudio?.addEventListener('play', () => setHomeMusicPlaying(true));
    homeMusicAudio?.addEventListener('pause', () => setHomeMusicPlaying(false));
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
      if (homeMusicAudio.paused) void playHomeMusicTrack(homeMusicTrackIndex, true, homeMusicAudio.currentTime || 0);
      else homeMusicAudio.pause();
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
      homeMusicResumeAfterMusic = homeMusicStarted || Boolean(homeMusicAudio && !homeMusicAudio.paused) || homeMusicStartQueued;
      updateHomeMusicSync();
      if (window.HomeMusicSync) window.HomeMusicSync.wasPlaying = homeMusicResumeAfterMusic;
      setHomeMusicPanelOpen(false);
    });
    window.addEventListener('pointerdown', retryHomeMusicOnGesture, { passive: true });
    window.addEventListener('keydown', retryHomeMusicOnGesture);
    window.addEventListener('music-component-closed', () => {
      const sync = window.HomeMusicSync;
      if (sync?.trackId) {
        const tracks = getHomeMusicTracks();
        const nextIndex = tracks.findIndex(track => track.id === sync.trackId);
        if (nextIndex >= 0) homeMusicTrackIndex = nextIndex;
      }
      if (homeMusicAudio && sync?.trackId === getHomeMusicTrack().id) {
        homeMusicAudio.currentTime = sync.currentTime || 0;
        homeMusicResumeAfterMusic = sync.wasPlaying;
      }
      renderHomeMusicPanel();
      if (!homeMusicResumeAfterMusic) return;
      homeMusicResumeAfterMusic = false;
      startHomeMusic();
    });
    primeHomeMusic();
    startHomeMusicWhenStageReady();

    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

    const scrollFloatEase = (value) => value * value * (3 - 2 * value);

    const setupBlogScrollFloat = () => {
      const title = document.querySelector('.blog-title');
      const blogSection = title?.closest('.blog-section');
      if (!title || !blogSection || !window.gsap || !window.ScrollTrigger) return false;

      const chars = title.querySelectorAll('.blog-title__core > span, .blog-title__punct');
      if (chars.length === 0 || reduceMotionQuery.matches) return false;

      window.gsap.registerPlugin(window.ScrollTrigger);
      blogScrollFloatTween?.kill();
      blogScrollFloatTween = window.gsap.fromTo(chars, {
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: '50% 0%',
        force3D: true
      }, {
        duration: 1,
        ease: 'back.inOut(2)',
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger: 0.03,
        scrollTrigger: {
          trigger: blogSection,
          start: 'top 82%',
          end: '+=70%',
          scrub: 1.2
        }
      });

      return true;
    };

    const setupBlogPreviewFade = () => {
      const blogSection = document.querySelector('.blog-section');
      const preview = blogSection?.querySelector('.blog-preview-frame');
      if (!blogSection || !preview || !window.gsap || !window.ScrollTrigger || reduceMotionQuery.matches) return false;

      window.gsap.registerPlugin(window.ScrollTrigger);
      blogPreviewFadeTween?.scrollTrigger?.kill();
      blogPreviewFadeTween?.kill();
      blogPreviewFadeTween = window.gsap.fromTo(preview, {
        autoAlpha: 1,
        yPercent: 0,
        scale: 1,
        transformOrigin: '50% 25%',
        force3D: true
      }, {
        autoAlpha: 0,
        yPercent: 10,
        scale: 0.96,
        ease: 'none',
        scrollTrigger: {
          id: 'blog-preview-fade',
          trigger: blogSection,
          start: '35% top',
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });

      return true;
    };

    const setupDailyTerminal = () => {
      const dailyBook = document.querySelector('.daily-book');
      const getBodies = () => [...document.querySelectorAll('[data-daily-terminal-body]')];
      const forEachBody = (callback) => getBodies().forEach(callback);
      if (!dailyBook || getBodies().length === 0) return;

      const introLines = [
        { kind: 'cmd', text: 'who am I?' },
        { kind: 'accent', text: '我是明天~' },
        { kind: 'accent', text: 'Hi，明天！' }
      ];
      const detailLines = [
        { kind: 'cmd', text: 'cat about.md' },
        { kind: 'accent', text: 'AI 工程师' },
        { kind: 'accent', text: '把想法做成可运行的产品' },
        { kind: 'accent', text: '和 Agent 一起搭建工作流' },
        { kind: 'cursor', text: '' }
      ];
      let stage = 'idle';
      let runId = 0;

      const clearTerminal = () => {
        runId += 1;
        stage = 'idle';
        forEachBody((body) => {
          body.classList.remove('is-waiting');
          body.replaceChildren();
        });
      };

      const createLine = (line) => {
        return getBodies().map((body) => {
          const row = document.createElement('p');
          const marker = document.createElement('span');
          const typed = document.createElement('span');

          row.className = line.kind === 'cmd' ? 'daily-right-terminal__cmd' : 'daily-right-terminal__line';
          marker.className = line.kind === 'cmd' ? 'daily-right-terminal__prompt' : 'daily-right-terminal__arrow';
          marker.textContent = line.kind === 'cmd' ? '$ ' : '> ';
          typed.className = `daily-right-terminal__typed ${line.kind === 'soft' ? 'daily-right-terminal__soft' : line.kind === 'accent' ? 'daily-right-terminal__accent' : line.kind === 'cursor' ? 'daily-right-terminal__cursor' : ''}`.trim();

          row.append(marker, typed);
          body.appendChild(row);
          return typed;
        });
      };

      const typeLine = (line, token) =>
        new Promise((resolve) => {
          const typedNodes = createLine(line);
          if (line.kind === 'cursor') {
            window.setTimeout(resolve, 360);
            return;
          }
          let index = 0;
          const tick = () => {
            if (token !== runId) return;
            typedNodes.forEach((typed) => {
              typed.textContent = line.text.slice(0, index);
            });
            index += 1;
            if (index <= line.text.length) {
              window.setTimeout(tick, line.kind === 'cmd' ? 74 : 58);
              return;
            }
            window.setTimeout(resolve, line.kind === 'cmd' ? 420 : 560);
          };
          tick();
        });

      const playLines = async (lines, nextStage) => {
        const token = runId;
        for (const line of lines) {
          await typeLine(line, token);
          if (token !== runId) return;
        }
        stage = nextStage;
        forEachBody((body) => {
          body.classList.toggle('is-waiting', nextStage === 'waiting');
        });
      };

      const startIntro = () => {
        if (!dailyBook.classList.contains('is-computer-page')) {
          clearTerminal();
          return;
        }
        clearTerminal();
        stage = 'intro';
        const token = runId;
        window.setTimeout(() => {
          if (token !== runId || !dailyBook.classList.contains('is-computer-page')) return;
          playLines(introLines, 'waiting');
        }, 520);
      };

      const continueDetails = () => {
        if (stage !== 'waiting' || !dailyBook.classList.contains('is-computer-page')) return;
        forEachBody((body) => {
          body.classList.remove('is-waiting');
        });
        stage = 'details';
        playLines(detailLines, 'done');
      };

      document.addEventListener('daily:computer-page', startIntro);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          continueDetails();
        }
      });
      document.addEventListener('click', (event) => {
        if (event.target.closest('[data-daily-terminal-body]')) {
          continueDetails();
        }
      });
    };

    const setupDailyPageFlip = () => {
      const dailyBook = document.querySelector('.daily-book');
      const dailyFlipButtons = [...document.querySelectorAll('[data-daily-flip]')];
      const dailyShell = dailyBook?.closest('.daily-shell');
      const spreadCount = 3;
      const halfPageCount = spreadCount * 2;
      const mobileDailyQuery = window.matchMedia('(max-width: 760px)');
      const pageForSpread = (spreadIndex) => 2 + spreadIndex * 2;
      const spreadForIndex = (pageIndex) => mobileDailyQuery.matches ? Math.floor(pageIndex / 2) : pageIndex;
      let dailyPageIndex = 0;
      let isTurning = false;

      if (!dailyBook || dailyFlipButtons.length === 0) {
        return;
      }

      const applyDailyPageState = (element, pageIndex) => {
        const spreadIndex = spreadForIndex(pageIndex);
        element.classList.toggle('is-computer-page', spreadIndex === 1);
        element.classList.toggle('is-stock-page', spreadIndex === 2);

        if (element === dailyBook) {
          element.classList.toggle('is-mobile-half-page', mobileDailyQuery.matches);
          for (let index = 0; index < halfPageCount; index += 1) {
            element.classList.toggle('mobile-half-' + index, mobileDailyQuery.matches && pageIndex === index);
          }
        }
      };

      const setFlipButtonsDisabled = (disabled) => {
        const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
        dailyFlipButtons.forEach((button) => {
          const targetIndex = dailyPageIndex + (button.dataset.dailyFlip === 'next' ? 1 : -1);
          button.disabled = disabled || targetIndex < 0 || targetIndex >= pageCount;
        });
      };

      const syncDailyPageState = () => {
        const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
        dailyPageIndex = Math.max(0, Math.min(pageCount - 1, dailyPageIndex));
        applyDailyPageState(dailyBook, dailyPageIndex);
        setFlipButtonsDisabled(isTurning);
      };

      const createTurnPreview = (sourcePage, pageIndex) => {
        const preview = document.createElement('div');
        const clone = sourcePage.cloneNode(true);

        preview.className = 'daily-book daily-page-flip-state-preview';
        applyDailyPageState(preview, pageIndex);
        clone.classList.add('daily-turn-page-copy');
        clone.removeAttribute('aria-hidden');
        preview.appendChild(clone);

        return preview;
      };

      const createTurnPage = (sourcePage, pageIndex) => {
        const page = document.createElement('div');
        const visual = document.createElement('div');

        page.className = 'daily-turn-page';
        visual.className = 'daily-turn-visual';
        visual.appendChild(createTurnPreview(sourcePage, pageIndex));
        page.appendChild(visual);

        return page;
      };

      const buildTurnBook = () => {
        const leftPage = dailyBook.querySelector('.daily-left-page');
        const rightPage = dailyBook.querySelector('.daily-right-page');
        const turnBook = document.createElement('div');

        if (!leftPage || !rightPage || !window.jQuery || !window.jQuery.fn || !window.jQuery.fn.turn) {
          return null;
        }

        turnBook.className = 'daily-turn-book';
        turnBook.appendChild(document.createElement('div'));

        for (let pageIndex = 0; pageIndex < spreadCount; pageIndex += 1) {
          turnBook.appendChild(createTurnPage(leftPage, pageIndex));
          turnBook.appendChild(createTurnPage(rightPage, pageIndex));
        }

        turnBook.appendChild(document.createElement('div'));
        dailyBook.appendChild(turnBook);

        return turnBook;
      };

      const runStaticDailyFlip = (direction) => {
        const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
        const nextPageIndex = dailyPageIndex + (direction === 'next' ? 1 : -1);
        if (nextPageIndex < 0 || nextPageIndex >= pageCount) return;
        dailyPageIndex = nextPageIndex;
        syncDailyPageState();
        document.dispatchEvent(new CustomEvent('daily:computer-page'));
      };

      if (mobileDailyQuery.matches) {
        if (dailyShell) {
          dailyFlipButtons.forEach((button) => dailyShell.appendChild(button));
        }
        dailyFlipButtons.forEach((button) => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            button.blur();
            runStaticDailyFlip(button.dataset.dailyFlip);
          });
        });
        syncDailyPageState();
        mobileDailyQuery.addEventListener('change', syncDailyPageState);
        return;
      }

      const turnBook = buildTurnBook();
      if (!turnBook) {
        dailyFlipButtons.forEach((button) => {
          button.addEventListener('click', () => runStaticDailyFlip(button.dataset.dailyFlip));
        });
        syncDailyPageState();
        return;
      }

      const $turnBook = window.jQuery(turnBook);
      const resizeTurnBook = () => {
        const leftPage = dailyBook.querySelector('.daily-left-page');
        const rightPage = dailyBook.querySelector('.daily-right-page');
        const leftRect = leftPage.getBoundingClientRect();
        const rightRect = rightPage.getBoundingClientRect();
        const bookRect = dailyBook.getBoundingClientRect();

        turnBook.style.left = (leftRect.left - bookRect.left) + 'px';
        turnBook.style.top = (leftRect.top - bookRect.top) + 'px';
        $turnBook.turn('size', Math.round(rightRect.right - leftRect.left), Math.round(Math.max(leftRect.height, rightRect.height)));
      };

      $turnBook.turn({
        page: pageForSpread(0),
        display: 'double',
        autoCenter: false,
        gradients: true,
        acceleration: true,
        duration: reduceMotionQuery.matches ? 260 : 1120,
        elevation: 62,
        when: {
          turning: (event, page) => {
            dailyPageIndex = Math.max(0, Math.min(spreadCount - 1, Math.floor((page - 2) / 2)));
            isTurning = true;
            dailyBook.classList.add('is-daily-flipping');
            syncDailyPageState();
          },
          turned: (event, page) => {
            dailyPageIndex = Math.max(0, Math.min(spreadCount - 1, Math.floor((page - 2) / 2)));
            isTurning = false;
            dailyBook.classList.remove('is-daily-flipping');
            syncDailyPageState();
            document.dispatchEvent(new CustomEvent('daily:computer-page'));
          }
        }
      });

      resizeTurnBook();
      dailyBook.classList.add('is-turn-ready');
      syncDailyPageState();
      window.addEventListener('resize', resizeTurnBook);

      const runDailyFlip = (direction) => {
        if (isTurning) return;
        if (direction === 'next') {
          $turnBook.turn('next');
        } else {
          $turnBook.turn('previous');
        }
      };

      dailyFlipButtons.forEach((button) => {
        button.addEventListener('click', () => runDailyFlip(button.dataset.dailyFlip));
      });
      syncDailyPageState();
    };

    const splitGraphemes = (text) => {
      if ('Segmenter' in Intl) {
        return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)].map((part) => part.segment);
      }

      return Array.from(text);
    };

    const splitScrollFloatText = (element, stagger) => {
      if (!element || element.dataset.scrollFloatReady === 'true') return null;

      const text = element.textContent.trim();
      if (!text) return null;

      const textWrap = document.createElement('span');
      textWrap.className = 'scroll-float-text';
      textWrap.setAttribute('aria-hidden', 'true');

      const chars = splitGraphemes(text).map((char) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.opacity = '1';
        span.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
        textWrap.appendChild(span);
        return span;
      });

      element.textContent = '';
      element.appendChild(textWrap);
      element.classList.add('identity-scroll-float');
      element.dataset.scrollFloatReady = 'true';
      element.setAttribute('aria-label', text);

      return { element, chars, stagger };
    };

    const applyFallbackScrollFloat = () => {
      if (!aboutSection || scrollFloatItems.length === 0) return;

      const reduceMotion = reduceMotionQuery.matches;
      const rect = aboutSection.getBoundingClientRect();
      const start = window.innerHeight * 1.05;
      const end = 0;
      const progressValue = reduceMotion ? 1 : clamp((start - rect.top) / (start - end));

      scrollFloatItems.forEach((item) => {
        const usableRange = Math.max(0.46, 1 - item.chars.length * item.stagger);

        item.chars.forEach((char, index) => {
          const raw = clamp((progressValue - index * item.stagger) / usableRange);
          const eased = scrollFloatEase(raw);
          const yPercent = (1 - eased) * 120;
          const scaleY = 1 + (1 - eased) * 1.3;
          const scaleX = 0.7 + eased * 0.3;

          char.style.opacity = eased.toFixed(3);
          char.style.transform = `translate3d(0, ${yPercent.toFixed(2)}%, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
        });
      });
    };

    const isAboutCopyInView = () => {
      const copy = aboutSection?.querySelector('.identity-copy');
      if (!copy) return false;
      const rect = copy.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.88 && rect.bottom > window.innerHeight * 0.08;
    };

    const forceScrollFloatVisible = (animated = false) => {
      const chars = scrollFloatItems.flatMap((item) => item.chars);
      if (chars.length === 0) return;

      if (window.gsap && animated && !reduceMotionQuery.matches) {
        window.gsap.to(chars, {
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          duration: 0.48,
          ease: 'power3.out',
          stagger: 0.006,
          overwrite: true
        });
        return;
      }

      chars.forEach((char) => {
        char.style.opacity = '1';
        char.style.transform = 'translate3d(0, 0%, 0) scale(1, 1)';
      });
    };

    const resetGsapScrollFloat = () => {
      if (!scrollFloatUsingGsap || !scrollFloatTimeline || reduceMotionQuery.matches) return;
      scrollFloatTimeline.pause(0);
    };

    const playGsapScrollFloat = (restart = false) => {
      if (!scrollFloatUsingGsap || !scrollFloatTimeline) {
        forceScrollFloatVisible(true);
        return;
      }

      if (restart) {
        scrollFloatTimeline.restart(true, false);
        return;
      }

      scrollFloatTimeline.play();
    };

    const setupGsapScrollFloat = () => {
      if (!aboutSection || scrollFloatItems.length === 0 || reduceMotionQuery.matches) return false;
      if (!window.gsap || !window.ScrollTrigger) return false;

      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      const copy = aboutSection.querySelector('.identity-copy');
      if (!copy) return false;

      gsap.registerPlugin(ScrollTrigger);

      if (scrollFloatTrigger) {
        scrollFloatTrigger.kill();
        scrollFloatTrigger = null;
      }

      if (scrollFloatTimeline) {
        scrollFloatTimeline.kill();
      }

      const chars = scrollFloatItems.flatMap((item) => item.chars);
      gsap.set(chars, {
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: '50% 0%',
        force3D: true
      });

      scrollFloatTimeline = gsap.timeline({
        paused: true,
        defaults: {
          duration: 1.06,
          ease: 'back.inOut(2)',
          force3D: true
        },
        onComplete: () => forceScrollFloatVisible(false)
      });

      scrollFloatItems.forEach((item, groupIndex) => {
        scrollFloatTimeline.to(item.chars, {
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger: item.stagger
        }, groupIndex * 0.16);
      });

      scrollFloatTrigger = ScrollTrigger.create({
        trigger: copy,
        start: 'top 88%',
        end: 'bottom 12%',
        onEnter: () => playGsapScrollFloat(true),
        onEnterBack: () => playGsapScrollFloat(true),
        onLeaveBack: () => resetGsapScrollFloat(),
        onRefresh: () => {
          if (isAboutCopyInView()) {
            playGsapScrollFloat(false);
          }
        }
      });

      scrollFloatUsingGsap = true;
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        if (isAboutCopyInView()) {
          playGsapScrollFloat(false);
        }
      });
      return true;
    };
    const updateScrollFloat = () => {
      scrollFloatFrame = 0;
      if (scrollFloatUsingGsap) return;
      applyFallbackScrollFloat();
    };

    const requestScrollFloatUpdate = () => {
      if (scrollFloatUsingGsap) return;
      if (!scrollFloatFrame) {
        scrollFloatFrame = requestAnimationFrame(updateScrollFloat);
      }
    };
    const applyIdentityTiltVars = () => {
      const copy = identityTiltTweenTarget;
      if (!copy) return;
      copy.style.setProperty('--copy-tilt-x', `${identityTiltState.x.toFixed(2)}deg`);
      copy.style.setProperty('--copy-tilt-y', `${identityTiltState.y.toFixed(2)}deg`);
    };

    const ensureGsapIdentityTilt = (copy) => {
      if (!window.gsap || reduceMotionQuery.matches) return false;

      if (identityTiltTweenTarget !== copy) {
        identityTiltTweenTarget = copy;
        identityTiltState = { x: 0, y: 0 };
        identityTiltXTo = window.gsap.quickTo(identityTiltState, 'x', {
          duration: 0.24,
          ease: 'power3.out',
          onUpdate: applyIdentityTiltVars
        });
        identityTiltYTo = window.gsap.quickTo(identityTiltState, 'y', {
          duration: 0.24,
          ease: 'power3.out',
          onUpdate: applyIdentityTiltVars
        });
      }

      return true;
    };

    const resetIdentityTilt = () => {
      const target = identityTiltTarget;
      identityTiltPoint = null;
      identityTiltTarget = null;
      identityHoverActive = false;

      if (!target) return;

      target.style.setProperty('--copy-lift', '0px');

      if (window.gsap && identityTiltTweenTarget === target) {
        window.gsap.to(identityTiltState, {
          x: 0,
          y: 0,
          duration: 0.28,
          ease: 'power3.out',
          overwrite: true,
          onUpdate: applyIdentityTiltVars,
          onComplete: () => {
            target.classList.remove('is-tilting');
          }
        });
        return;
      }

      target.classList.remove('is-tilting');
      target.style.setProperty('--copy-tilt-x', '0deg');
      target.style.setProperty('--copy-tilt-y', '0deg');
    };

    const syncIdentityTilt = () => {
      identityTiltFrame = 0;
      const copy = identityTiltTarget;
      if (!copy || !identityTiltPoint || reduceMotionQuery.matches) return;

      const rect = copy.getBoundingClientRect();
      const localX = (identityTiltPoint.x - rect.left) / rect.width - 0.5;
      const localY = (identityTiltPoint.y - rect.top) / rect.height - 0.5;
      const tiltX = clamp(localY * -4.6, -2.4, 2.4);
      const tiltY = clamp(localX * 5.6, -3.0, 3.0);

      copy.classList.add('is-tilting');
      copy.style.setProperty('--copy-lift', '-2px');

      if (ensureGsapIdentityTilt(copy)) {
        identityTiltXTo(tiltX);
        identityTiltYTo(tiltY);
        return;
      }

      copy.style.setProperty('--copy-tilt-x', `${tiltX.toFixed(2)}deg`);
      copy.style.setProperty('--copy-tilt-y', `${tiltY.toFixed(2)}deg`);
    };
    const handleIdentityPointerMove = (event) => {
      if (reduceMotionQuery.matches) return;
      const copy = aboutSection?.querySelector('.identity-copy');
      if (!copy) return;

      const rect = copy.getBoundingClientRect();
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!isInside) {
        resetIdentityTilt();
        return;
      }

      identityTiltTarget = copy;
      identityTiltPoint = { x: event.clientX, y: event.clientY };

      if (!identityHoverActive) {
        identityHoverActive = true;
        playGsapScrollFloat(true);
      }

      if (!identityTiltFrame) {
        identityTiltFrame = requestAnimationFrame(syncIdentityTilt);
      }
    };

    const initIdentityTextEffects = () => {
      const copy = aboutSection?.querySelector('.identity-copy');
      if (!copy || copy.dataset.textEffectsReady === 'true') return false;

      const targets = [
        splitScrollFloatText(copy.querySelector('h2'), 0.018),
        ...[...copy.querySelectorAll('.identity-role')].map((role) => splitScrollFloatText(role, 0.012))
      ].filter(Boolean);

      scrollFloatItems.length = 0;
      scrollFloatItems.push(...targets);
      copy.dataset.textEffectsReady = 'true';
      scrollFloatUsingGsap = setupGsapScrollFloat();

      if (!scrollFloatUsingGsap) {
        requestScrollFloatUpdate();
      }
      return true;
    };

    let aboutLanyardReplayTimer = 0;

    const replayAboutLanyardDom = () => {
      const lanyard = aboutSection?.querySelector('.bits-lanyard');
      if (!lanyard) return false;

      window.clearTimeout(aboutLanyardReplayTimer);
      lanyard.classList.add('is-drop-active');

      if (reduceMotionQuery.matches) {
        lanyard.classList.remove('is-replaying');
        return true;
      }

      lanyard.classList.remove('is-replaying');
      void lanyard.offsetWidth;
      lanyard.classList.add('is-replaying');
      aboutLanyardReplayTimer = window.setTimeout(() => {
        lanyard.classList.remove('is-replaying');
      }, 1650);
      return true;
    };

    if (typeof window.__replayAboutLanyard !== 'function') {
      window.__replayAboutLanyard = replayAboutLanyardDom;
    }

    const replayAboutLanyardWhenReady = () => {
      let attempts = 0;
      const run = () => {
        const replay = typeof window.__replayAboutLanyard === 'function'
          ? window.__replayAboutLanyard
          : replayAboutLanyardDom;

        if (replay()) return;
        attempts += 1;
        if (attempts < 36) requestAnimationFrame(run);
      };
      run();
    };

    const setAboutLanyardActive = (active) => {
      if (!aboutSection) return;
      if (!active) return;
      if (aboutLanyardActive === active) return;
      aboutLanyardActive = active;
      aboutSection.classList.add('lanyard-drop-active');
      replayAboutLanyardWhenReady();
    };

    const fillProgress = () => {
      progress = Math.min(progress + (progress < 70 ? 2 : 1), 100);
      loaderFill.style.transform = `translateX(${progress - 100}%)`;

      if (progress < 100) {
        requestAnimationFrame(fillProgress);
        return;
      }

      if (done) return;
      done = true;

      loader.classList.add('is-complete');
      startHomeMusicForHomeReveal();
      window.setTimeout(() => {
        loaderFill.style.transform = 'translateX(0) scaleX(0)';
        loader.classList.add('is-leaving');
        stage.classList.add('is-ready');
        video.play().catch(() => {});
      }, loaderSettleMs + loaderHoldMs);

      window.setTimeout(() => {
        loader.classList.add('is-hidden');
      }, loaderSettleMs + loaderHoldMs + loaderEraseMs + 120);
    };

    const start = () => {
      if (started) return;
      started = true;
      requestAnimationFrame(fillProgress);
    };

    start();
    video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });

    setupDailyPageFlip();
    setupDailyTerminal();
    setupBlogScrollFloat();
    setupBlogPreviewFade();
    window.addEventListener('load', () => {
      if (!blogScrollFloatTween) {
        setupBlogScrollFloat();
      }
      if (!blogPreviewFadeTween) {
        setupBlogPreviewFade();
      }
    }, { once: true });

    if (aboutSection && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target !== aboutSection) return;
          setAboutLanyardActive(entry.isIntersecting && entry.intersectionRatio >= 0.46);
          if (!entry.isIntersecting) {
            resetIdentityTilt();
          }
        });
      }, { threshold: [0, 0.16, 0.46] });

      observer.observe(aboutSection);
    }

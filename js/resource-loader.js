(() => {
  const loadedStyles = new Map();
  const loadedScripts = new Map();
  const loadedGroups = new Map();
  const loadedDailyPages = new Map();
  const deferredOrder = ['interests', 'blog', 'travel', 'daily'];
  let deferredQueueStarted = false;
  let deferredQueuePromise = null;

  const resolveUrl = (url) => new URL(url, document.baseURI).href;

  const loadStyle = (style) => {
    const href = typeof style === 'string' ? style : style.href;
    const shouldReapply = Boolean(typeof style === 'object' && style.reapply);
    const key = resolveUrl(href);
    if (loadedStyles.has(key) && !shouldReapply) return loadedStyles.get(key);

    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => resolveUrl(link.getAttribute('href')) === key);

    const promise = new Promise((resolve) => {
      const link = existing || document.createElement('link');
      const finish = () => resolve(true);

      if (existing?.sheet) {
        if (shouldReapply) document.head.appendChild(existing);
        resolve(true);
        return;
      }

      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', () => resolve(false), { once: true });

      if (!existing) {
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      } else if (shouldReapply) {
        document.head.appendChild(link);
      }
    });

    if (!shouldReapply) loadedStyles.set(key, promise);
    return promise;
  };

  const loadScript = (src, options = {}) => {
    const key = resolveUrl(src);
    if (loadedScripts.has(key)) return loadedScripts.get(key);

    const existing = Array.from(document.scripts)
      .find((script) => resolveUrl(script.getAttribute('src')) === key);

    const promise = new Promise((resolve) => {
      const script = existing || document.createElement('script');
      const finish = () => resolve(true);

      if (existing?.dataset.resourceLoaded === 'true') {
        resolve(true);
        return;
      }

      script.addEventListener('load', () => {
        script.dataset.resourceLoaded = 'true';
        finish();
      }, { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });

      if (!existing) {
        script.src = src;
        if (options.type) script.type = options.type;
        if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
        document.body.appendChild(script);
      }
    });

    loadedScripts.set(key, promise);
    return promise;
  };

  const waitForImage = (image) => {
    if (!(image instanceof HTMLImageElement)) return Promise.resolve(false);
    if (image.dataset.lazySrc && !image.src) image.src = image.dataset.lazySrc;
    if (image.complete && image.naturalWidth > 0) {
      return typeof image.decode === 'function'
        ? image.decode().then(() => true, () => true)
        : Promise.resolve(true);
    }
    return new Promise((resolve) => {
      image.addEventListener('load', () => resolve(true), { once: true });
      image.addEventListener('error', () => resolve(false), { once: true });
    });
  };

  const waitForVideo = (video) => {
    if (!(video instanceof HTMLVideoElement)) return Promise.resolve(false);
    if (video.dataset.lazySrc && !video.src) video.src = video.dataset.lazySrc;
    video.preload = video.preload || 'metadata';
    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (ok) => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
        resolve(ok);
      };
      const onReady = () => done(true);
      const onError = () => done(false);
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  };

  const preloadImageUrl = (src) => new Promise((resolve) => {
    const image = new Image();
    const finish = (ok) => resolve(ok);

    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(() => finish(true), () => finish(true));
      } else {
        finish(true);
      }
    };
    image.onerror = () => finish(false);
    image.src = src;
  });

  const preloadFetchUrl = (src) => (
    fetch(src, { cache: 'force-cache' }).then((response) => response.ok, () => false)
  );

  const dailyPageSelectors = {
    1: [
      '.daily-left-seal-sticker',
      '.daily-left-card-sticker',
      '.daily-left-coder-sticker',
      '.daily-left-sticker',
      '.daily-right-light-film',
      '.daily-floating-study',
      '.daily-right-card',
      '.daily-page-arrow img'
    ],
    2: [
      '.daily-left-vibe__comic',
      '.daily-left-vibe__cloud',
      '.daily-right-vibe-sticker'
    ],
    3: [
      '.daily-left-stock-sticker',
      '.daily-right-stock-sticker'
    ]
  };

  const dailyPageBackgrounds = {
    1: [
      ['--daily-book-binder-image', 'dailyBookBinder'],
      ['--daily-campus-left-bg', 'dailyCampusLeftBg'],
      ['--daily-campus-right-bg', 'dailyCampusRightBg']
    ],
    2: [
      ['--daily-vibe-left-bg', 'dailyVibeLeftBg'],
      ['--daily-vibe-right-bg', 'dailyVibeRightBg']
    ],
    3: [
      ['--daily-stock-left-bg', 'dailyStockLeftBg'],
      ['--daily-stock-right-bg', 'dailyStockRightBg']
    ]
  };

  const loadDailyPage = (page) => {
    if (loadedDailyPages.has(page)) return loadedDailyPages.get(page);

    const promise = Promise.resolve().then(() => {
      const sourceBook = document.querySelector('#daily .daily-book:not(.daily-page-flip-state-preview)');
      if (!sourceBook || !dailyPageSelectors[page]) return false;

      dailyPageBackgrounds[page].forEach(([property, dataKey]) => {
        const value = sourceBook.dataset[dataKey];
        if (!value) return;
        document.querySelectorAll('#daily .daily-book').forEach((book) => {
          book.style.setProperty(property, `url("${resolveUrl(value)}")`);
        });
      });

      const images = Array.from(document.querySelectorAll(
        dailyPageSelectors[page].map((selector) => `#daily ${selector}`).join(',')
      ));
      return Promise.all(images.map((image) => {
        const src = image.dataset.lazySrc;
        if (src && !image.src) {
          image.removeAttribute('data-lazy-src');
          image.src = src;
        }
        return waitForImage(image);
      }));
    });

    loadedDailyPages.set(page, promise);
    return promise;
  };

  const revealMedia = (root) => {
    const scope = typeof root === 'string' ? document.querySelector(root) : root;
    if (!scope) return Promise.resolve([]);

    const media = Array.from(scope.querySelectorAll('[data-lazy-src]'));
    const waits = media.map((item) => {
      const src = item.dataset.lazySrc;
      if (!src) return Promise.resolve(false);
      item.removeAttribute('data-lazy-src');
      if (item instanceof HTMLImageElement) {
        item.loading = item.loading || 'lazy';
        item.decoding = item.decoding || 'async';
        item.src = src;
        return waitForImage(item);
      }
      if (item instanceof HTMLVideoElement) {
        item.src = src;
        return waitForVideo(item);
      }
      item.setAttribute('src', src);
      return Promise.resolve(true);
    });

    return Promise.all(waits);
  };

  const getAboutRuntimeScripts = () => (
    location.protocol === 'file:'
      ? [{ src: 'js/runtime/about-card-standalone.js' }]
      : [{ src: 'js/runtime/about-card-module.js', type: 'module', crossOrigin: 'anonymous' }]
  );

  const waitForElement = (selector, timeoutMs = 4500) => {
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(true);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        observer.disconnect();
        resolve(ok);
      };
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) finish(true);
      });
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  };

  const waitForNextFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const delay = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const waitForAboutCardFirstFrame = async (timeoutMs = 6000) => {
    const startedAt = performance.now();
    await waitForElement('#about .lanyard-wrapper, #about .bits-lanyard', timeoutMs);

    return new Promise((resolve) => {
      let stableFrames = 0;

      const check = () => {
        const root = document.querySelector('#about .lanyard-wrapper, #about .bits-lanyard');
        const canvas = document.querySelector('#about canvas');
        const target = canvas || root;
        const rect = target?.getBoundingClientRect();
        const hasBox = Boolean(rect && rect.width > 20 && rect.height > 20);
        const canvasReady = Boolean(canvas && canvas.width > 0 && canvas.height > 0);
        const visible = Boolean(target && getComputedStyle(target).visibility !== 'hidden');
        let hasRenderedPixels = false;

        if (canvasReady) {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            const sample = new Uint8Array(4);
            const points = [
              [0.5, 0.5], [0.5, 0.35], [0.5, 0.65],
              [0.35, 0.55], [0.65, 0.55]
            ];
            hasRenderedPixels = points.some(([x, y]) => {
              gl.readPixels(
                Math.min(canvas.width - 1, Math.max(0, Math.floor(canvas.width * x))),
                Math.min(canvas.height - 1, Math.max(0, Math.floor(canvas.height * y))),
                1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample
              );
              return sample[3] > 0 && (sample[0] > 0 || sample[1] > 0 || sample[2] > 0);
            });
          }
        }

        if (hasBox && canvasReady && visible && hasRenderedPixels) {
          stableFrames += 1;
          if (stableFrames >= 3) {
            window.dispatchEvent(new CustomEvent('about-card-first-frame'));
            resolve(true);
            return;
          }
        } else {
          stableFrames = 0;
        }

        if (performance.now() - startedAt > timeoutMs) {
          resolve(false);
          return;
        }

        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    });
  };

  const loadAboutCardRuntime = () => getAboutRuntimeScripts().reduce(
      (chain, spec) => chain.then(() => loadScript(spec.src, spec)),
      Promise.resolve(true)
    );

  const prepareAboutCardFirstFrame = (runtimePromise, assetsPromise) => (
    Promise.all([runtimePromise, assetsPromise]).then(async () => {
      if (typeof window.__renderAboutCardRuntime === 'function') {
        window.__renderAboutCardRuntime();
      }
      await waitForAboutCardFirstFrame();
      await waitForNextFrame();
      document.documentElement.classList.add('about-card-critical-ready');
      return true;
    })
  );

  const aboutRuntimePromise = loadAboutCardRuntime();
  const aboutFrontPromise = preloadImageUrl('images/about/about-card-front.png');
  const aboutBackPromise = preloadImageUrl('images/about/about-card-back.png');
  const aboutModelPromise = preloadFetchUrl('models/about-card.glb');
  const aboutAssetsPromise = Promise.all([aboutFrontPromise, aboutBackPromise, aboutModelPromise]);
  const aboutFirstFramePromise = prepareAboutCardFirstFrame(aboutRuntimePromise, aboutAssetsPromise);
  const criticalTasks = [
    { promise: loadStyle('css/site-fonts.css'), bytes: 4032 },
    { promise: loadStyle('css/about-card-runtime.css'), bytes: 17561 },
    { promise: loadStyle('css/hero.css'), bytes: 21131 },
    { promise: loadStyle('css/about.css'), bytes: 37993 },
    { promise: loadStyle('css/navigation.css'), bytes: 9795 },
    { promise: loadStyle('css/music-orb.css'), bytes: 16473 },
    { promise: aboutRuntimePromise, bytes: 3487386 },
    { promise: aboutFrontPromise, bytes: 816998 },
    { promise: aboutBackPromise, bytes: 683585 },
    { promise: aboutModelPromise, bytes: 2421820 },
    { promise: aboutFirstFramePromise, bytes: 65536 },
    { promise: waitForVideo(document.getElementById('heroVideo')), bytes: 1361106 },
    { promise: waitForImage(document.querySelector('.site-nav__brand img')), bytes: 983220 },
    { promise: waitForImage(document.querySelector('.home-music-orb__disc img')), bytes: 19106 },
    {
      promise: document.fonts?.ready?.then(() => true, () => false) || Promise.resolve(false),
      bytes: 622100
    }
  ];
  const criticalProgress = {
    completed: 0,
    total: criticalTasks.length,
    loadedBytes: 0,
    totalBytes: criticalTasks.reduce((sum, task) => sum + task.bytes, 0)
  };
  const reportCriticalProgress = () => {
    window.dispatchEvent(new CustomEvent('site:critical-progress', {
      detail: {
        ...criticalProgress,
        progress: criticalProgress.totalBytes
          ? criticalProgress.loadedBytes / criticalProgress.totalBytes
          : 1
      }
    }));
  };
  const criticalPromise = Promise.all(criticalTasks.map((task) => Promise.resolve(task.promise).then(
    (result) => {
      criticalProgress.completed += 1;
      criticalProgress.loadedBytes += task.bytes;
      reportCriticalProgress();
      return result;
    },
    () => {
      criticalProgress.completed += 1;
      criticalProgress.loadedBytes += task.bytes;
      reportCriticalProgress();
      return false;
    }
  )));

  const groups = {
    interests: {
      root: '#interests',
      styles: [
        'css/interests-player.css',
        'css/interests-room.css',
        'css/story-section.css'
      ],
      scripts: ['js/interests-player.js']
    },
    blog: {
      root: '#blog',
      styles: ['css/blog.css'],
      scripts: ['js/blog-runtime.js']
    },
    daily: {
      root: '#daily',
      styles: [
        'css/daily.css',
        { href: 'css/page-layout.css', reapply: true },
        'css/ending.css'
      ],
      scripts: [
        'vendor/jquery-1.12.4.min.js',
        'vendor/turn.js',
        'js/daily-runtime.js'
      ]
    },
    travel: {
      root: '#travel',
      styles: [
        'css/travel.css',
        'css/travel-gallery-transition.css'
      ],
      scripts: [
        'vendor/lottie.min.js',
        'js/travel-gallery-transition.js',
        'js/data/travel-gallery-data.js',
        'js/travel-world.js'
      ]
    }
  };

  const loadGroup = (name) => {
    if (loadedGroups.has(name)) return loadedGroups.get(name);
    const group = groups[name];
    if (!group) return Promise.resolve(false);

    const musicBufferGate = Promise.race([
      window.HomeMusicBufferReady || Promise.resolve(true),
      delay(5000).then(() => false)
    ]);
    const promise = musicBufferGate.then(() => Promise.all(group.styles.map(loadStyle))).then(() => (
      name === 'daily' ? loadDailyPage(1) : true
    )).then(() => group.scripts.reduce(
      (chain, script) => chain.then(() => loadScript(script)),
      Promise.resolve(true)
    )).then(() => name === 'daily' ? true : revealMedia(group.root));

    loadedGroups.set(name, promise);
    return promise;
  };

  const startDeferredQueue = () => {
    if (deferredQueueStarted) return deferredQueuePromise;
    deferredQueueStarted = true;
    deferredQueuePromise = Promise.all(
      deferredOrder.map((name, index) => delay(index * 350).then(() => loadGroup(name)))
    );
    return deferredQueuePromise;
  };

  const observeGroups = () => {
    Object.entries(groups).forEach(([name, group]) => {
      const target = document.querySelector(group.root);
      if (!target) return;

      if (!('IntersectionObserver' in window)) {
        window.addEventListener('load', startDeferredQueue, { once: true });
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (loadedGroups.has(name)) return;
        loadGroup(name);
      }, {
        rootMargin: '120% 0px',
        threshold: 0
      });

      observer.observe(target);
    });

    const daily = document.querySelector('#daily');
    if (daily && 'IntersectionObserver' in window) {
      const dailyEntryObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        dailyEntryObserver.disconnect();
        loadDailyPage(3);
        if (window.matchMedia('(max-width: 760px)').matches) loadDailyPage(2);
      }, { threshold: 0.1 });
      dailyEntryObserver.observe(daily);
    }
  };

  window.SiteResourceLoader = {
    loadGroup,
    startDeferredQueue,
    revealMedia,
    loadDailyPage,
    getCriticalProgress: () => ({ ...criticalProgress }),
    waitForCritical: () => criticalPromise
  };

  const startDeferredGroups = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeGroups, { once: true });
    } else {
      observeGroups();
    }
  };

  criticalPromise.then(() => {
    startDeferredGroups();
    Promise.race([
      window.HomeMusicBufferReady || Promise.resolve(true),
      delay(5000)
    ]).then(startDeferredQueue);
  }, startDeferredGroups);
})();

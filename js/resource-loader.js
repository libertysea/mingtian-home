(() => {
  const loadedStyles = new Map();
  const loadedScripts = new Map();
  const loadedGroups = new Map();
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

  const loadAboutCardCritical = () => getAboutRuntimeScripts().reduce(
    (chain, spec) => chain.then(() => loadScript(spec.src, spec)),
    Promise.resolve(true)
  ).then(async () => {
    if (typeof window.__renderAboutCardRuntime === 'function') {
      window.__renderAboutCardRuntime();
    }
    await waitForElement('#about .lanyard-wrapper, #about .bits-lanyard');
    await waitForNextFrame();
    if (!document.getElementById('about')?.classList.contains('lanyard-drop-active')) {
      window.__clearAboutCardRuntime?.();
    }
    document.documentElement.classList.add('about-card-critical-ready');
    return true;
  });

  const criticalPromise = Promise.all([
    loadStyle('css/site-fonts.css'),
    loadStyle('css/about-card-runtime.css'),
    loadStyle('css/hero.css'),
    loadStyle('css/about.css'),
    loadStyle('css/navigation.css'),
    loadStyle('css/music-orb.css'),
    loadAboutCardCritical(),
    waitForImage(document.querySelector('.site-nav__brand img')),
    waitForImage(document.querySelector('.home-music-orb__disc img')),
    document.fonts?.ready?.then(() => true, () => false) || Promise.resolve(false)
  ]);

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

    const promise = Promise.all([
      ...group.styles.map(loadStyle),
      revealMedia(group.root)
    ]).then(() => group.scripts.reduce(
      (chain, script) => chain.then(() => loadScript(script)),
      Promise.resolve(true)
    ));

    loadedGroups.set(name, promise);
    return promise;
  };

  const startDeferredQueue = () => {
    if (deferredQueueStarted) return deferredQueuePromise;
    deferredQueueStarted = true;
    deferredQueuePromise = deferredOrder.reduce(
      (chain, name) => chain.then(() => loadGroup(name)),
      Promise.resolve(true)
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
        const waitForPreviousGroups = deferredOrder
          .slice(0, Math.max(0, deferredOrder.indexOf(name)))
          .reduce((chain, previousName) => chain.then(() => loadGroup(previousName)), Promise.resolve(true));
        waitForPreviousGroups.then(() => loadGroup(name));
      }, {
        rootMargin: '120% 0px',
        threshold: 0
      });

      observer.observe(target);
    });
  };

  window.SiteResourceLoader = {
    loadGroup,
    startDeferredQueue,
    revealMedia,
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
    startDeferredQueue();
  }, startDeferredGroups);
})();

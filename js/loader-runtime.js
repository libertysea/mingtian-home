(() => {
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const stage = document.getElementById('stage');
  const video = document.getElementById('heroVideo');

  if (!loader || !loaderFill || !stage || !video) return;

  let progress = 0;
  let done = false;
  let started = false;
  let criticalReady = false;
  const loaderSettleMs = 760;
  const loaderHoldMs = 500;
  const loaderEraseMs = 180;
  const maxCriticalWaitMs = 6000;
  const softCap = 92;

  const setProgress = (value) => {
    progress = Math.max(progress, Math.min(value, 100));
    loaderFill.style.transform = 'translateX(' + (progress - 100) + '%)';
  };

  const finish = () => {
    if (done) return;
    done = true;
    setProgress(100);

    loader.classList.add('is-complete');
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

  const fillProgress = () => {
    if (done) return;

    const cap = criticalReady ? 100 : softCap;
    const step = progress < 62 ? 1.9 : progress < 82 ? 0.9 : 0.28;
    setProgress(Math.min(progress + step, cap));

    if (criticalReady && progress >= 100) {
      finish();
      return;
    }

    if (!criticalReady && progress >= softCap) {
      window.setTimeout(() => requestAnimationFrame(fillProgress), 80);
      return;
    }

    if (!criticalReady || progress < softCap) {
      requestAnimationFrame(fillProgress);
      return;
    }

    requestAnimationFrame(fillProgress);
  };

  const start = () => {
    if (started) return;
    started = true;
    requestAnimationFrame(fillProgress);
  };

  const withTimeout = (promise, timeoutMs) => new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);

    promise.then(
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(true);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(false);
      }
    );
  });

  const waitForHeroVideo = () => {
    video.preload = 'auto';
    video.setAttribute('fetchpriority', 'high');
    video.load();

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };

      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  };

  const waitForImage = (selector) => {
    const image = document.querySelector(selector);
    if (!(image instanceof HTMLImageElement) || (!image.currentSrc && !image.src)) {
      return Promise.resolve(false);
    }
    if (image.complete && image.naturalWidth > 0) {
      return typeof image.decode === 'function'
        ? image.decode().then(() => true, () => false)
        : Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const cleanup = () => {
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
      };
      const onLoad = () => {
        cleanup();
        if (typeof image.decode === 'function') {
          image.decode().then(() => resolve(true), () => resolve(false));
        } else {
          resolve(true);
        }
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      image.addEventListener('load', onLoad, { once: true });
      image.addEventListener('error', onError, { once: true });
    });
  };

  const waitForFonts = () => (
    document.fonts?.ready?.then(() => true, () => false) || Promise.resolve(false)
  );

  const waitForCriticalResources = async () => {
    await withTimeout(Promise.all([
      window.SiteResourceLoader?.waitForCritical?.() || Promise.resolve(false),
      waitForHeroVideo(),
      waitForFonts(),
      waitForImage('.site-nav__brand img'),
      waitForImage('.home-music-orb__disc img')
    ]), maxCriticalWaitMs);
    criticalReady = true;
  };

  start();
  waitForCriticalResources().then(() => {
    requestAnimationFrame(fillProgress);
  });
  video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
})();

(() => {
  const aboutSection = document.getElementById('about');
  if (!aboutSection) return;

  let aboutLanyardActive = false;
  let scrollFloatFrame = 0;
  let scrollFloatTimeline = null;
  let scrollFloatTrigger = null;
  let scrollFloatUsingGsap = false;
  let identityTiltFrame = 0;
  let identityTiltPoint = null;
  let identityTiltTarget = null;
  let identityHoverActive = false;
  let identityTiltTweenTarget = null;
  let identityTiltState = { x: 0, y: 0 };
  let identityTiltXTo = null;
  let identityTiltYTo = null;
  const scrollFloatItems = [];
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const scrollFloatEase = (value) => value * value * (3 - 2 * value);

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
  let aboutRuntimeLoading = false;
  let aboutRuntimeLoaded = Boolean(aboutSection?.querySelector('.bits-lanyard, .lanyard-wrapper'));
  let aboutRuntimePromise = null;
  let portfolioRuntimeLoaded = false;

  const getAboutLanyardElement = () => (
    aboutSection?.querySelector('.bits-lanyard, .lanyard-wrapper')
  );

  const setAboutRuntimeLoaded = () => {
    aboutRuntimeLoaded = true;
    document.documentElement.classList.add('about-card-runtime-loaded');
    requestAboutLanyardScrollCheck();
  };

  const loadRuntimeScript = (spec) => new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${spec.src}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = spec.src;
    if (spec.type) script.type = spec.type;
    if (spec.crossOrigin) script.crossOrigin = spec.crossOrigin;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const getAboutRuntimeScripts = () => {
    const fileMode = location.protocol === 'file:';
    return fileMode
      ? [{ src: 'js/runtime/about-card-standalone.js' }]
      : [{ src: 'js/runtime/about-card-module.js', type: 'module', crossOrigin: 'anonymous' }];
  };

  const loadPortfolioRuntime = () => {
    if (portfolioRuntimeLoaded) return Promise.resolve(true);
    const fileMode = location.protocol === 'file:';
    const spec = fileMode
      ? { src: 'js/runtime/portfolio-gallery-standalone.js' }
      : { src: 'js/portfolio-gallery.js', type: 'module' };

    return loadRuntimeScript(spec).then((ok) => {
      if (ok) portfolioRuntimeLoaded = true;
      return ok;
    });
  };

  const loadAboutCardRuntime = () => {
    if (aboutRuntimeLoaded) return Promise.resolve(true);
    if (aboutRuntimeLoading && aboutRuntimePromise) return aboutRuntimePromise;
    aboutRuntimeLoading = true;

    aboutRuntimePromise = getAboutRuntimeScripts().reduce((chain, spec) => (
      chain.then((ok) => {
        if (!ok) return false;
        return loadRuntimeScript(spec);
      })
    ), Promise.resolve(true)).then((ok) => {
      aboutRuntimeLoading = false;
      if (ok) {
        setAboutRuntimeLoaded();
        if (typeof window.__rebuildAboutCardText === 'function') {
          window.__rebuildAboutCardText();
        }
      }
      return ok;
    }).catch((error) => {
      aboutRuntimeLoading = false;
      aboutRuntimePromise = null;
      throw error;
    });

    return aboutRuntimePromise;
  };

  const resetAboutCardRuntime = () => {
    window.clearTimeout(aboutLanyardReplayTimer);
    aboutSection.classList.remove('lanyard-drop-active');
    getAboutLanyardElement()?.classList.remove('is-drop-active', 'is-replaying');
  };

  const replayAboutLanyardDom = () => {
    const lanyard = getAboutLanyardElement();
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
      if (attempts < 180) requestAnimationFrame(run);
    };
    run();
  };

  const setAboutLanyardActive = (active) => {
    if (!aboutSection) return;
    if (!active) {
      if (!aboutLanyardActive && !aboutRuntimeLoaded && !aboutRuntimeLoading && !getAboutLanyardElement()) return;
      aboutLanyardActive = false;
      resetAboutCardRuntime();
      return;
    }
    if (aboutLanyardActive === active) {
      if (!getAboutLanyardElement() || aboutRuntimeLoading) {
        loadAboutCardRuntime().then((ok) => {
          if (ok) replayAboutLanyardWhenReady();
        });
      }
      return;
    }
    aboutLanyardActive = active;
    aboutSection.classList.add('lanyard-drop-active');
    loadAboutCardRuntime().then((ok) => {
      if (ok) replayAboutLanyardWhenReady();
    });
  };

  const updateAboutLanyardByScroll = () => {
    if (!aboutSection) return;
    const rect = aboutSection.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    const shouldDrop = rect.top <= viewport * 0.72 && rect.bottom >= viewport * 0.34;
    const beforeAbout = rect.top > viewport * 0.92;

    if (shouldDrop) {
      setAboutLanyardActive(true);
    } else if (beforeAbout || aboutLanyardActive) {
      setAboutLanyardActive(false);
    }
  };

  let aboutLanyardScrollFrame = 0;
  const requestAboutLanyardScrollCheck = () => {
    if (aboutLanyardScrollFrame) return;
    aboutLanyardScrollFrame = requestAnimationFrame(() => {
      aboutLanyardScrollFrame = 0;
      updateAboutLanyardByScroll();
    });
  };

  if (aboutSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target !== aboutSection) return;
        requestAboutLanyardScrollCheck();
        if (!entry.isIntersecting) {
          resetIdentityTilt();
        }
      });
    }, { threshold: [0, 0.16, 0.46] });

    observer.observe(aboutSection);
  }
  window.addEventListener('scroll', requestAboutLanyardScrollCheck, { passive: true });
  window.addEventListener('resize', requestAboutLanyardScrollCheck);
  window.addEventListener('load', requestAboutLanyardScrollCheck, { once: true });

  const projectsSection = document.getElementById('projects');
  if (projectsSection && 'IntersectionObserver' in window) {
    const portfolioObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      portfolioObserver.disconnect();
      loadPortfolioRuntime();
    }, { rootMargin: '70% 0px', threshold: 0 });

    portfolioObserver.observe(projectsSection);
  } else {
    window.addEventListener('load', () => {
      window.setTimeout(loadPortfolioRuntime, 1200);
    }, { once: true });
  }

  requestAboutLanyardScrollCheck();
})();

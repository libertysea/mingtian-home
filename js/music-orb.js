(() => {
  'use strict';

  const THEME_KEY = 'music-route-transition-theme-v1';
  const themes = ['pink', 'purple', 'green', 'yellow'];
  const coverDuration = 900;
  const revealDuration = 620;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = false;
  let componentPromise = null;
  let opener = null;

  const cards = {
    music: { word: 'MUSIC', jp: '音楽', cn: '音乐', no: 'EX', mark: '♪' },
    home: { word: 'HOME', jp: 'ホーム', cn: '首页', no: '01', mark: '◇' }
  };

  function createTransition(card, direction, phase, theme) {
    const root = document.createElement('div');
    root.className = `route-transition route-transition--${theme}`;
    root.dataset.phase = phase;
    root.style.setProperty('--rt-direction', String(direction));
    root.setAttribute('aria-hidden', 'true');

    const letters = Array.from(card.word)
      .map((letter, index) => `<span class="route-transition__letter" style="--letter-index:${index}">${letter}</span>`)
      .join('');
    const detailText = `${card.word}  ${card.mark}  ${card.jp}  ◆  ${card.cn}  ✦  `.repeat(14);
    const shortText = `${card.word}  ${card.mark}  `.repeat(12);
    const bandText = `${card.mark}  ${card.word}  ★  ${card.no}  ◆  ${card.jp}  ✦  `.repeat(10);
    const rows = Array.from({ length: 6 }, (_, index) => (
      `<div class="route-transition__row"><span>${index % 2 === 0 ? shortText : detailText}</span></div>`
    )).join('');

    root.innerHTML = `
      <div class="route-transition__wipe route-transition__wipe--accent"><div class="route-transition__fill"></div></div>
      <div class="route-transition__wipe route-transition__wipe--paper"><div class="route-transition__fill"></div></div>
      <div class="route-transition__wipe route-transition__wipe--main">
        <div class="route-transition__panel">
          <div class="route-transition__halftone"></div>
          <div class="route-transition__band route-transition__band--one"><span>${bandText}</span></div>
          <div class="route-transition__band route-transition__band--two"><span>${bandText}</span></div>
          <div class="route-transition__band route-transition__band--three"><span>${bandText}</span></div>
          <div class="route-transition__rows">${rows}</div>
          <div class="route-transition__scanlines"></div>
        </div>
        <div class="route-transition__mark">${card.mark}</div>
        <div class="route-transition__title">
          <div class="route-transition__word" data-word="${card.word}">${letters}</div>
          <div class="route-transition__hazard"></div>
          <div class="route-transition__chip"><span>${card.jp}</span><i></i><span>${card.cn}</span></div>
        </div>
        <div class="route-transition__number">${card.no}</div>
        <div class="route-transition__loading">NOW LOADING ▸▸▸</div>
      </div>
      <div class="route-transition__flash"></div>
    `;
    return root;
  }

  function chooseTheme() {
    let lastTheme = null;
    try {
      lastTheme = sessionStorage.getItem(THEME_KEY);
    } catch (error) {
      // Random selection still works when storage is unavailable.
    }

    const availableThemes = themes.filter(theme => theme !== lastTheme);
    const theme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
    try {
      sessionStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // The selected theme is still valid for the current transition.
    }
    return theme;
  }

  function wait(duration) {
    return new Promise(resolve => window.setTimeout(resolve, duration));
  }

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function ensureMusicComponent() {
    if (window.MusicComponent) return Promise.resolve(window.MusicComponent);
    if (componentPromise) return componentPromise;

    componentPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('js/runtime/music-component.js', document.baseURI).href;
      script.dataset.musicComponentBundle = 'true';
      script.onload = () => {
        if (window.MusicComponent) resolve(window.MusicComponent);
        else reject(new Error('The music component did not initialize.'));
      };
      script.onerror = () => reject(new Error('Unable to load the music component bundle.'));
      document.body.appendChild(script);
    }).catch(error => {
      componentPromise = null;
      throw error;
    });

    return componentPromise;
  }

  async function runTransition(cardName, direction, prepare, switchView, afterReveal) {
    if (active) return;
    active = true;

    if (reducedMotion.matches) {
      try {
        await prepare();
        switchView();
        afterReveal?.();
      } finally {
        active = false;
      }
      return;
    }

    const root = createTransition(cards[cardName], direction, 'cover', chooseTheme());
    document.body.classList.add('route-transition-lock');
    document.body.appendChild(root);

    try {
      await Promise.all([wait(coverDuration), prepare()]);
      switchView();
      await nextPaint();
      root.dataset.phase = 'reveal';
      await wait(revealDuration);
    } catch (error) {
      console.error(error);
      root.dataset.phase = 'reveal';
      await wait(revealDuration);
    } finally {
      root.remove();
      document.body.classList.remove('route-transition-lock');
      active = false;
      afterReveal?.();
    }
  }

  function open(entry = null) {
    if (active || window.MusicComponent?.isOpen()) return;
    opener = entry || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    window.dispatchEvent(new CustomEvent('music-route-opening'));
    void runTransition(
      'music',
      1,
      ensureMusicComponent,
      () => window.MusicComponent?.show(),
      () => window.MusicComponent?.focusClose()
    );
  }

  function close() {
    if (active || !window.MusicComponent?.isOpen()) return;
    void runTransition(
      'home',
      -1,
      () => Promise.resolve(),
      () => window.MusicComponent?.hide(),
      () => opener?.focus({ preventScroll: true })
    );
  }

  function bindEntryPoints() {
    document.querySelectorAll('[data-music-entry]').forEach(entry => {
      entry.addEventListener('click', event => {
        event.preventDefault();
        open(entry instanceof HTMLElement ? entry : null);
      });
    });
  }

  window.MusicRouteTransition = {
    open,
    close,
    navigate(_url, cardName) {
      if (cardName === 'home') close();
      else open();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEntryPoints, { once: true });
  } else {
    bindEntryPoints();
  }
})();

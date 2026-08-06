(() => {
  const section = document.getElementById('interests');
  if (!section) return;

  if (!('IntersectionObserver' in window)) {
    section.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    section.classList.add('is-visible');
    observer.disconnect();
  }, { threshold: 0.35 });

  observer.observe(section);
})();

(() => {
  const showcase = document.querySelector('[data-game-showcase]');
  if (!showcase) return;

  const hotspot = document.querySelector('[data-game-hotspot]');
  let isOpen = false;

  const getPanels = () => Array.from(showcase.querySelectorAll('[data-game-panel]'));
  const current = showcase.querySelector('[data-game-current]');
  let activeIndex = -1;

  const activate = (index) => {
    const panels = getPanels();
    if (panels.length === 0) return;
    activeIndex = (index + panels.length) % panels.length;
    panels.forEach((panel, panelIndex) => {
      const isActive = panelIndex === activeIndex;
      panel.classList.toggle('is-active', isActive);
      panel.setAttribute('aria-pressed', String(isActive));
    });
    if (current) current.textContent = String(activeIndex + 1).padStart(2, '0');
  };

  const clearActive = () => {
    activeIndex = -1;
    getPanels().forEach((panel) => {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-pressed', 'false');
    });
    if (current) current.textContent = '--';
  };

  const setOpen = (open) => {
    isOpen = open;
    showcase.classList.toggle('is-open', open);
    if (hotspot) hotspot.setAttribute('aria-expanded', String(open));
    if (!open) clearActive();
  };

  const activatePanel = (panel) => {
    const panels = getPanels();
    const index = panels.indexOf(panel);
    if (index >= 0) activate(index);
  };

  hotspot?.addEventListener('click', () => setOpen(!isOpen));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) setOpen(false);
  });

  showcase.addEventListener('click', (event) => {
    const panel = event.target.closest('[data-game-panel]');
    if (panel && showcase.contains(panel)) activatePanel(panel);
  });
  showcase.addEventListener('pointerover', (event) => {
    const panel = event.target.closest('[data-game-panel]');
    if (!panel || !showcase.contains(panel) || panel.contains(event.relatedTarget)) return;
    activatePanel(panel);
  });
  showcase.addEventListener('focusin', (event) => {
    const panel = event.target.closest('[data-game-panel]');
    if (panel && showcase.contains(panel)) activatePanel(panel);
  });

  showcase.addEventListener('pointerleave', clearActive);
  showcase.addEventListener('focusout', (event) => {
    if (showcase.contains(event.relatedTarget)) return;
    clearActive();
  });
  showcase.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = activeIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = getPanels().length - 1;
    else if (activeIndex < 0) nextIndex = event.key === 'ArrowLeft' ? getPanels().length - 1 : 0;
    else if (event.key === 'ArrowLeft') nextIndex -= 1;
    else nextIndex += 1;
    activate(nextIndex);
    getPanels()[activeIndex]?.focus();
  });

  window.addEventListener('site-config-applied', () => {
    clearActive();
    setOpen(true);
  });

  setOpen(true);
})();

(() => {
  const screen = document.querySelector('[data-tv-carousel]');
  if (!screen) return;

  const getSlides = () => Array.from(screen.querySelectorAll('[data-tv-slide]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let timer = 0;

  const activate = (index) => {
    const slides = getSlides();
    if (slides.length === 0) return;
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    screen.setAttribute('aria-label', `切换电视节目，当前：${slides[activeIndex].dataset.title}`);
  };

  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
  };

  const start = () => {
    stop();
    if (reducedMotion || document.hidden || getSlides().length < 2) return;
    timer = window.setInterval(() => activate(activeIndex + 1), 3500);
  };

  screen.addEventListener('click', () => {
    activate(activeIndex + 1);
    start();
  });
  screen.addEventListener('pointerenter', stop);
  screen.addEventListener('pointerleave', start);
  screen.addEventListener('focus', stop);
  screen.addEventListener('blur', start);
  screen.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') activate(activeIndex - 1);
    if (event.key === 'ArrowRight') activate(activeIndex + 1);
    if (event.key === 'Home') activate(0);
    if (event.key === 'End') activate(getSlides().length - 1);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener('site-config-applied', () => {
    const activeSlide = getSlides().findIndex((slide) => slide.classList.contains('is-active'));
    activeIndex = Math.max(0, activeSlide);
    activate(activeIndex);
    start();
  });

  const activeSlide = getSlides().findIndex((slide) => slide.classList.contains('is-active'));
  activeIndex = Math.max(0, activeSlide);
  activate(activeIndex);
  start();
})();

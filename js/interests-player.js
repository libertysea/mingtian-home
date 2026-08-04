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

  const panels = Array.from(showcase.querySelectorAll('[data-game-panel]'));
  const current = showcase.querySelector('[data-game-current]');
  let activeIndex = -1;

  const activate = (index) => {
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
    panels.forEach((panel) => {
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

  hotspot?.addEventListener('click', () => setOpen(!isOpen));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) setOpen(false);
  });

  panels.forEach((panel, index) => {
    panel.addEventListener('click', () => activate(index));
    panel.addEventListener('pointerenter', () => activate(index));
    panel.addEventListener('focus', () => activate(index));
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
    else if (event.key === 'End') nextIndex = panels.length - 1;
    else if (activeIndex < 0) nextIndex = event.key === 'ArrowLeft' ? panels.length - 1 : 0;
    else if (event.key === 'ArrowLeft') nextIndex -= 1;
    else nextIndex += 1;
    activate(nextIndex);
    panels[activeIndex].focus();
  });

  setOpen(true);
})();

(() => {
  const screen = document.querySelector('[data-tv-carousel]');
  if (!screen) return;

  const slides = Array.from(screen.querySelectorAll('[data-tv-slide]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
  let timer = 0;

  const activate = (index) => {
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
    if (reducedMotion || document.hidden || slides.length < 2) return;
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
    if (event.key === 'End') activate(slides.length - 1);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  activate(activeIndex);
  start();
})();

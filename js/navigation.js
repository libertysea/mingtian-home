(() => {
  const navigation = document.querySelector('.site-nav');
  const menuButton = navigation?.querySelector('.site-nav__menu');
  const getNavItems = () => [...(navigation?.querySelectorAll('[data-nav-target]') || [])];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observedSections = getNavItems()
    .map((item) => document.getElementById(item.dataset.navTarget))
    .filter(Boolean);

  if (!navigation || !menuButton || observedSections.length === 0) return;

  const closeMenu = () => {
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  let currentSectionId = 'stage';

  const setCurrentSection = (sectionId) => {
    currentSectionId = sectionId;
    const isPastHero = sectionId !== 'stage';
    navigation.dataset.compact = String(isPastHero);
    navigation.dataset.section = sectionId;
    if (isPastHero) closeMenu();
    getNavItems().forEach((item) => {
      if (item.dataset.navTarget === sectionId) {
        item.setAttribute('aria-current', 'location');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  };

  menuButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  navigation.addEventListener('click', (event) => {
    const item = event.target.closest('[data-nav-target]');
    if (!item || !navigation.contains(item)) return;
    const target = document.getElementById(item.dataset.navTarget);
    if (!target) return;

    event.preventDefault();
    closeMenu();
    target.scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    history.replaceState(null, '', `#${target.id}`);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('site-config-applied', () => {
    setCurrentSection(currentSectionId);
  });

  const visibility = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => visibility.set(entry.target.id, entry.intersectionRatio));
    const current = [...visibility.entries()].sort((a, b) => b[1] - a[1])[0];
    if (current?.[1] > 0) setCurrentSection(current[0]);
  }, {
    rootMargin: '-18% 0px -58% 0px',
    threshold: [0, 0.15, 0.35, 0.6]
  });

  observedSections.forEach((section) => observer.observe(section));
  const initialSection = location.hash.slice(1);
  setCurrentSection(observedSections.some((section) => section.id === initialSection) ? initialSection : 'stage');

  const heroStage = document.getElementById('stage');
  const heroVideo = document.getElementById('heroVideo');
  let revealFallback = 0;

  const revealNavigation = () => {
    window.clearTimeout(revealFallback);
    if (document.body.classList.contains('site-nav-ready')) return;
    document.body.classList.add('site-nav-ready');
    window.dispatchEvent(new CustomEvent('site-nav-ready'));
  };

  const armHeroReveal = () => {
    if (!heroStage?.classList.contains('is-ready')) return;
    if (reduceMotion.matches) {
      revealNavigation();
      return;
    }
    revealFallback = window.setTimeout(revealNavigation, 3400);
  };

  heroVideo?.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'filter') revealNavigation();
  });

  if (heroStage?.classList.contains('is-ready')) {
    armHeroReveal();
  } else if (heroStage) {
    const heroObserver = new MutationObserver(() => {
      if (!heroStage.classList.contains('is-ready')) return;
      heroObserver.disconnect();
      armHeroReveal();
    });
    heroObserver.observe(heroStage, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
})();

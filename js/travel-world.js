(function () {
  const gallery = document.getElementById('travel-gallery');
  const openButton = document.querySelector('[data-open-travel-gallery]');
  const closeButton = document.querySelector('[data-close-travel-gallery]');
  const stage = document.querySelector('[data-travel-dome]');
  const sphere = document.querySelector('[data-travel-sphere]');
  const viewer = document.querySelector('[data-travel-viewer]');
  const scrim = document.querySelector('[data-close-travel-image]');
  const frame = document.querySelector('[data-travel-frame]');

  if (!gallery || !openButton || !closeButton || !stage || !sphere || !viewer || !scrim || !frame) return;

  const imageManifestUrl = 'images/travel/gallery.json';
  let images = [];
  let galleryInitialized = false;
  let galleryInitializing = null;

  const config = {
    fit: 0.66,
    fitBasis: 'auto',
    minRadius: 600,
    maxRadius: Infinity,
    padFactor: 0.18,
    maxVerticalRotationDeg: 5,
    dragSensitivity: 20,
    enlargeTransitionMs: 300,
    segments: 35,
    dragDampening: 0.72,
    openedImageWidth: 'min(620px, calc(100vw - 96px), calc(100dvh - 160px))',
    openedImageHeight: 'min(620px, calc(100vw - 96px), calc(100dvh - 160px))',
    imageBorderRadius: '30px',
    openedImageBorderRadius: '30px',
    grayscale: false
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const normalizeAngle = (deg) => ((deg % 360) + 360) % 360;
  const wrapAngleSigned = (deg) => {
    const angle = (((deg + 180) % 360) + 360) % 360;
    return angle - 180;
  };
  const getDataNumber = (el, name, fallback) => {
    const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
    const value = attr == null ? NaN : parseFloat(attr);
    return Number.isFinite(value) ? value : fallback;
  };

  const state = {
    rotation: { x: 0, y: 0 },
    startRotation: { x: 0, y: 0 },
    startPointer: null,
    dragging: false,
    moved: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    inertiaFrame: 0,
    focusedTile: null,
    originalTilePosition: null,
    opening: false,
    openStartedAt: 0,
    scrollLocked: false,
    transitionPlaying: false
  };

  let featuredTile = null;
  let featureTimer = 0;

  function buildItems(pool, segments) {
    if (!pool.length) return [];

    const xStart = -((segments - 1) / 2) * 2 - 0.5;
    const xCols = Array.from({ length: segments }, (_, index) => xStart + index * 2);
    const evenYs = [-4, -2, 0, 2, 4];
    const oddYs = [-3, -1, 1, 3, 5];
    const coords = xCols.flatMap((x, column) => {
      const ys = column % 2 === 0 ? evenYs : oddYs;
      return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }));
    });
    const usedImages = Array.from({ length: coords.length }, (_, index) => pool[index % pool.length]);

    for (let index = 1; index < usedImages.length; index += 1) {
      if (usedImages[index].src !== usedImages[index - 1].src) continue;
      for (let swap = index + 1; swap < usedImages.length; swap += 1) {
        if (usedImages[swap].src === usedImages[index].src) continue;
        [usedImages[index], usedImages[swap]] = [usedImages[swap], usedImages[index]];
        break;
      }
    }

    return coords.map((coord, index) => ({
      ...coord,
      src: usedImages[index].src,
      alt: usedImages[index].alt
    }));
  }

  function computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments) {
    const unit = 360 / segments / 2;
    return {
      rotateX: unit * (offsetY - (sizeY - 1) / 2),
      rotateY: unit * (offsetX + (sizeX - 1) / 2)
    };
  }

  function lockScroll() {
    if (state.scrollLocked) return;
    state.scrollLocked = true;
    document.body.classList.add('travel-gallery-lock');
  }

  function unlockScroll() {
    if (!state.scrollLocked || gallery.classList.contains('is-open')) return;
    state.scrollLocked = false;
    document.body.classList.remove('travel-gallery-lock');
  }

  function applyTransform() {
    sphere.style.transform = `translate3d(-50%, -50%, calc(var(--travel-radius) * -1)) rotateX(${state.rotation.x}deg) rotateY(${state.rotation.y}deg)`;
  }

  function updateLayout() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const stageStyle = getComputedStyle(stage);
    const configuredDomeWidth = parseCssSize(stageStyle.getPropertyValue('--travel-stage-width').trim(), width);
    const domeWidth = Math.max(width, configuredDomeWidth, window.innerWidth - 32);
    const minDim = Math.min(width, height);
    const maxDim = Math.max(domeWidth, height);
    const aspect = domeWidth / height;
    let basis;

    switch (config.fitBasis) {
      case 'min':
        basis = minDim;
        break;
      case 'max':
        basis = maxDim;
        break;
      case 'width':
        basis = domeWidth;
        break;
      case 'height':
        basis = height;
        break;
      default:
        basis = aspect >= 1.3 ? domeWidth : minDim;
    }

    let radius = basis * config.fit;
    radius = Math.min(radius, height * 1.8);
    radius = clamp(radius, config.minRadius, config.maxRadius);

    const viewerPad = Math.max(8, Math.round(minDim * config.padFactor));
    stage.style.setProperty('--travel-radius', `${Math.round(radius)}px`);
    stage.style.setProperty('--travel-viewer-pad', `${viewerPad}px`);
    stage.style.setProperty('--travel-segments-x', config.segments);
    stage.style.setProperty('--travel-segments-y', config.segments);
    stage.style.setProperty('--travel-tile-radius', config.imageBorderRadius);
    stage.style.setProperty('--travel-enlarge-radius', config.openedImageBorderRadius);
    stage.style.setProperty('--travel-image-filter', config.grayscale ? 'grayscale(1)' : 'none');
    applyTransform();

    const enlarged = viewer.querySelector('.travel-gallery__enlarge');
    if (enlarged) placeEnlargedInFrame(enlarged, false);
  }

  function setFeaturedTile(tile) {
    if (featuredTile && featuredTile !== tile) featuredTile.classList.remove('is-featured');
    featuredTile = tile;
    if (featuredTile) featuredTile.classList.add('is-featured');
  }

  function renderGallery() {
    const items = buildItems(images, config.segments);
    sphere.innerHTML = '';

    items.forEach((item, index) => {
      const outer = document.createElement('div');
      const tile = document.createElement('button');
      const img = document.createElement('img');

      outer.className = 'travel-gallery__item';
      outer.dataset.src = item.src;
      outer.dataset.offsetX = item.x;
      outer.dataset.offsetY = item.y;
      outer.dataset.sizeX = item.sizeX;
      outer.dataset.sizeY = item.sizeY;
      outer.style.setProperty('--offset-x', item.x);
      outer.style.setProperty('--offset-y', item.y);
      outer.style.setProperty('--item-size-x', item.sizeX);
      outer.style.setProperty('--item-size-y', item.sizeY);

      tile.className = 'travel-gallery__tile';
      tile.type = 'button';
      tile.setAttribute('aria-label', item.alt || 'Open image');
      tile.dataset.index = index;

      img.src = item.src;
      img.alt = item.alt;
      img.draggable = false;
      img.loading = 'lazy';
      img.decoding = 'async';

      tile.appendChild(img);
      outer.appendChild(tile);
      sphere.appendChild(outer);

      tile.addEventListener('pointerenter', () => {
        if (state.focusedTile) return;
        window.clearTimeout(featureTimer);
        featureTimer = window.setTimeout(() => setFeaturedTile(tile), 900);
      });
      tile.addEventListener('pointerleave', () => {
        window.clearTimeout(featureTimer);
        if (featuredTile === tile) setFeaturedTile(null);
      });
      tile.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.dragging || state.moved || state.opening) return;
        openTile(tile);
      });
      tile.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openTile(tile);
      });
    });

    applyTransform();
  }

  function stopInertia() {
    if (!state.inertiaFrame) return;
    cancelAnimationFrame(state.inertiaFrame);
    state.inertiaFrame = 0;
  }

  function startInertia(vx, vy) {
    stopInertia();
    let velocityX = clamp(vx, -1.4, 1.4) * 80;
    let velocityY = clamp(vy, -1.4, 1.4) * 80;
    let frames = 0;
    const damping = clamp(config.dragDampening, 0, 1);
    const friction = 0.94 + 0.055 * damping;
    const stopThreshold = 0.015 - 0.01 * damping;
    const maxFrames = Math.round(90 + 270 * damping);

    const step = () => {
      velocityX *= friction;
      velocityY *= friction;

      if (Math.abs(velocityX) < stopThreshold && Math.abs(velocityY) < stopThreshold) {
        state.inertiaFrame = 0;
        return;
      }
      if (frames > maxFrames) {
        state.inertiaFrame = 0;
        return;
      }

      frames += 1;
      state.rotation.x = clamp(
        state.rotation.x - velocityY / 200,
        -config.maxVerticalRotationDeg,
        config.maxVerticalRotationDeg
      );
      state.rotation.y = wrapAngleSigned(state.rotation.y + velocityX / 200);
      applyTransform();
      state.inertiaFrame = requestAnimationFrame(step);
    };

    state.inertiaFrame = requestAnimationFrame(step);
  }

  function getTileFromPoint(x, y) {
    const direct = document.elementFromPoint(x, y)?.closest?.('.travel-gallery__tile');
    if (direct && sphere.contains(direct)) return direct;

    let nearestTile = null;
    let nearestDistance = Infinity;
    sphere.querySelectorAll('.travel-gallery__tile').forEach((tile) => {
      const rect = tile.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (distance < nearestDistance) {
        nearestTile = tile;
        nearestDistance = distance;
      }
    });

    return nearestTile;
  }

  function placeEnlargedInFrame(enlarged, animated) {
    const stageRect = stage.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const width = parseCssSize(config.openedImageWidth, frameRect.width);
    const height = parseCssSize(config.openedImageHeight, frameRect.height);

    enlarged.style.transition = animated
      ? `left ${config.enlargeTransitionMs}ms ease, top ${config.enlargeTransitionMs}ms ease, width ${config.enlargeTransitionMs}ms ease, height ${config.enlargeTransitionMs}ms ease`
      : 'none';
    enlarged.style.left = `${frameRect.left - stageRect.left + (frameRect.width - width) / 2}px`;
    enlarged.style.top = `${frameRect.top - stageRect.top + (frameRect.height - height) / 2}px`;
    enlarged.style.width = `${width}px`;
    enlarged.style.height = `${height}px`;
  }

  function parseCssSize(value, fallback) {
    if (!value) return fallback;
    if (value.endsWith('px')) return parseFloat(value);
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:${value};height:${value};`;
    stage.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();
    return rect.width || fallback;
  }

  function openTile(tile) {
    if (state.opening || state.focusedTile) return;
    state.opening = true;
    state.openStartedAt = performance.now();
    setFeaturedTile(tile);
    lockScroll();

    const parent = tile.parentElement;
    const offsetX = getDataNumber(parent, 'offsetX', 0);
    const offsetY = getDataNumber(parent, 'offsetY', 0);
    const sizeX = getDataNumber(parent, 'sizeX', 2);
    const sizeY = getDataNumber(parent, 'sizeY', 2);
    const baseRotation = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, config.segments);
    const parentY = normalizeAngle(baseRotation.rotateY);
    const globalY = normalizeAngle(state.rotation.y);
    let rotY = -(parentY + globalY) % 360;
    if (rotY < -180) rotY += 360;
    const rotX = -baseRotation.rotateX - state.rotation.x;

    parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
    parent.style.setProperty('--rot-x-delta', `${rotX}deg`);

    const reference = document.createElement('div');
    reference.className = 'travel-gallery__tile travel-gallery__tile--reference';
    reference.style.opacity = '0';
    reference.style.transform = `rotateX(${-baseRotation.rotateX}deg) rotateY(${-baseRotation.rotateY}deg)`;
    parent.appendChild(reference);

    void reference.offsetHeight;

    const tileRect = reference.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    if (tileRect.width <= 0 || tileRect.height <= 0) {
      reference.remove();
      parent.style.setProperty('--rot-y-delta', '0deg');
      parent.style.setProperty('--rot-x-delta', '0deg');
      state.opening = false;
      return;
    }

    state.focusedTile = tile;
    state.originalTilePosition = {
      left: tileRect.left,
      top: tileRect.top,
      width: tileRect.width,
      height: tileRect.height
    };

    tile.style.visibility = 'hidden';
    tile.style.zIndex = '0';

    const enlarged = document.createElement('div');
    const img = document.createElement('img');
    enlarged.className = 'travel-gallery__enlarge';
    enlarged.style.left = `${frameRect.left - stageRect.left}px`;
    enlarged.style.top = `${frameRect.top - stageRect.top}px`;
    enlarged.style.width = `${frameRect.width}px`;
    enlarged.style.height = `${frameRect.height}px`;
    enlarged.style.opacity = '0';
    enlarged.style.transformOrigin = 'top left';
    enlarged.style.transform = 'none';
    enlarged.style.transition = `opacity ${config.enlargeTransitionMs}ms ease`;

    img.src = parent.dataset.src || tile.querySelector('img')?.src || '';
    img.alt = tile.querySelector('img')?.alt || tile.getAttribute('aria-label') || '';
    enlarged.appendChild(img);
    viewer.appendChild(enlarged);
    placeEnlargedInFrame(enlarged, false);

    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      enlarged.style.opacity = '1';
    });

    window.setTimeout(() => {
      state.opening = false;
    }, config.enlargeTransitionMs);
  }

  function closeImage() {
    if (!state.focusedTile || state.opening) return;
    if (performance.now() - state.openStartedAt < 250) return;

    const tile = state.focusedTile;
    const parent = tile.parentElement;
    const reference = parent.querySelector('.travel-gallery__tile--reference');
    const enlarged = viewer.querySelector('.travel-gallery__enlarge');

    if (!enlarged || !state.originalTilePosition) {
      cleanupOpenedTile();
      return;
    }

    state.opening = true;
    const currentRect = enlarged.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const target = {
      left: state.originalTilePosition.left - stageRect.left,
      top: state.originalTilePosition.top - stageRect.top,
      width: state.originalTilePosition.width,
      height: state.originalTilePosition.height
    };

    const closing = document.createElement('div');
    closing.className = 'travel-gallery__enlarge-closing';
    closing.style.left = `${currentRect.left - stageRect.left}px`;
    closing.style.top = `${currentRect.top - stageRect.top}px`;
    closing.style.width = `${currentRect.width}px`;
    closing.style.height = `${currentRect.height}px`;

    const img = enlarged.querySelector('img')?.cloneNode();
    if (img) closing.appendChild(img);
    enlarged.remove();
    stage.appendChild(closing);

    void closing.offsetWidth;

    requestAnimationFrame(() => {
      closing.style.left = `${target.left}px`;
      closing.style.top = `${target.top}px`;
      closing.style.width = `${target.width}px`;
      closing.style.height = `${target.height}px`;
      closing.style.opacity = '0';
    });

    const finish = () => {
      closing.remove();
      reference?.remove();
      cleanupOpenedTile();
    };
    closing.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, config.enlargeTransitionMs + 80);
  }

  function cleanupOpenedTile() {
    const tile = state.focusedTile;
    const parent = tile?.parentElement;
    if (parent) {
      parent.style.setProperty('--rot-y-delta', '0deg');
      parent.style.setProperty('--rot-x-delta', '0deg');
    }
    if (tile) {
      tile.style.visibility = '';
      tile.style.zIndex = '';
    }

    viewer.classList.remove('is-open');
    viewer.setAttribute('aria-hidden', 'true');
    state.focusedTile = null;
    state.originalTilePosition = null;
    state.opening = false;
    setFeaturedTile(null);
  }

  function openGallery() {
    gallery.classList.add('is-open');
    gallery.setAttribute('aria-hidden', 'false');
    openButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('travel-gallery-lock');
    state.scrollLocked = true;
    stopInertia();
    updateLayout();
  }

  function createTravelTransitionCard(image, index, total, viewport) {
    const card = document.createElement('div');
    const img = document.createElement('img');
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const pileDepth = total - index - 1;
    const startSpreadX = ((index % 3) - 1) * 1.8;
    const startSpreadY = ((index % 4) - 1.5) * 2.4;
    const start = {
      x: center.x - 62 + startSpreadX,
      y: center.y - 74 + 88 + startSpreadY + pileDepth * 1.2
    };

    img.src = image.src;
    img.alt = '';
    img.decoding = 'async';
    card.className = 'travel-gallery-transition__card';
    card.appendChild(img);
    card.style.setProperty('--travel-card-index', String(index));
    card.style.zIndex = String(100 + index);
    card.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) rotate(${-3 + (index % 5) * 1.5}deg) scale(.94)`;
    card.style.opacity = '0';
    card.style.filter = 'blur(.2px)';
    card.dataset.startX = String(start.x);
    card.dataset.startY = String(start.y);
    card.dataset.startRotation = String(-3 + (index % 5) * 1.5);
    card.dataset.stackRotation = String(((index % 7) - 3) * 1.2);
    return card;
  }

  function playTravelGalleryTransition(onReady) {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || state.transitionPlaying || !images.length) return Promise.resolve();

    state.transitionPlaying = true;
    openButton.disabled = true;
    openButton.classList.add('is-transitioning');

    const overlay = document.createElement('div');
    overlay.className = 'travel-gallery-transition';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const targetCardCount = viewport.width < 768 ? 16 : 20;
    const selected = Array.from({ length: targetCardCount }, (_, index) => images[index % images.length]);
    const cards = selected.map((image, index) => {
      const card = createTravelTransitionCard(image, index, selected.length, viewport);
      overlay.appendChild(card);
      return card;
    });
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const scatterMaxDistance = Math.hypot(viewport.width, viewport.height) / 2;
    const scatterSlots = [
      { x: .09, y: .17 }, { x: .30, y: .10 }, { x: .50, y: .12 }, { x: .70, y: .10 },
      { x: .91, y: .17 }, { x: .13, y: .42 }, { x: .34, y: .34 }, { x: .54, y: .43 },
      { x: .74, y: .34 }, { x: .91, y: .42 }, { x: .09, y: .67 }, { x: .28, y: .61 },
      { x: .48, y: .69 }, { x: .68, y: .61 }, { x: .90, y: .67 }, { x: .18, y: .89 },
      { x: .38, y: .84 }, { x: .58, y: .90 }, { x: .78, y: .84 }, { x: .96, y: .86 }
    ];
    let readyCalled = false;
    const markReady = () => {
      if (readyCalled) return;
      readyCalled = true;
      onReady?.();
    };

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        overlay.classList.add('is-active');
        cards.forEach((card, index) => {
          const stackRotation = Number(card.dataset.stackRotation || 0);
          const stackOffsetX = ((index % 5) - 2) * 1.1;
          const stackOffsetY = (Math.floor(index / 5) - 1.5) * 1.15;
          const x = center.x - card.offsetWidth / 2 + stackOffsetX;
          const y = center.y - card.offsetHeight / 2 + stackOffsetY;
          card.style.transitionDelay = `${index * 38}ms`;
          card.style.opacity = '1';
          card.style.filter = 'blur(0)';
          card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${stackRotation}deg) scale(.98)`;
        });
      });

      window.setTimeout(() => {
        cards.forEach((card, index) => {
          const slot = scatterSlots[index % scatterSlots.length];
          const targetCenterX = viewport.width * slot.x;
          const targetCenterY = viewport.height * slot.y;
          const distance = Math.hypot(targetCenterX - center.x, targetCenterY - center.y) / scatterMaxDistance;
          const x = targetCenterX - card.offsetWidth / 2;
          const y = targetCenterY - card.offsetHeight / 2;
          const rotation = Number(card.dataset.stackRotation || 0) + (index % 2 === 0 ? -28 : 28) * Math.max(.45, distance);
          const duration = 560 + Math.round(distance * 520);
          const scale = 1.04 + Math.min(.1, distance * .1);
          card.style.transition = `
            transform ${duration}ms cubic-bezier(.16, 1, .3, 1),
            opacity ${duration}ms ease,
            filter ${duration}ms ease
          `;
          card.style.transitionDelay = `${(index % 4) * 12}ms`;
          card.style.opacity = '.94';
          card.style.filter = 'blur(0)';
          card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`;
        });
      }, 1420);

      window.setTimeout(markReady, 2100);

      window.setTimeout(() => {
        markReady();
        cards.forEach((card, index) => {
          card.style.transitionDelay = `${index * 28}ms`;
          card.style.opacity = '0';
          card.style.filter = 'blur(.6px)';
        });
        overlay.classList.remove('is-active');
      }, 2340);

      window.setTimeout(() => {
        overlay.remove();
        openButton.disabled = false;
        openButton.classList.remove('is-transitioning');
        state.transitionPlaying = false;
        resolve();
      }, 2640);
    });
  }

  async function openGalleryWithTransition() {
    if (gallery.classList.contains('is-open') || state.transitionPlaying) return;
    await ensureGalleryInitialized();
    let opened = false;
    const openOnce = () => {
      if (opened) return;
      opened = true;
      openGallery();
    };
    await playTravelGalleryTransition(openOnce);
    openOnce();
  }

  function closeGallery() {
    if (state.focusedTile) {
      cleanupOpenedTile();
      viewer.querySelector('.travel-gallery__enlarge')?.remove();
      viewer.querySelector('.travel-gallery__enlarge-closing')?.remove();
    }
    gallery.classList.remove('is-open');
    gallery.setAttribute('aria-hidden', 'true');
    openButton.setAttribute('aria-expanded', 'false');
    state.scrollLocked = false;
    document.body.classList.remove('travel-gallery-lock');
    stopInertia();
    openButton.focus({ preventScroll: true });
  }

  function onPointerDown(event) {
    if (state.focusedTile || event.target.closest('.travel-gallery__topbar')) return;
    stopInertia();
    state.pointerId = event.pointerId;
    state.dragging = true;
    state.moved = false;
    state.startRotation = { ...state.rotation };
    state.startPointer = { x: event.clientX, y: event.clientY };
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastTime = performance.now();
    stage.classList.add('is-dragging');
    stage.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || state.pointerId !== event.pointerId || !state.startPointer) return;
    const dx = event.clientX - state.startPointer.x;
    const dy = event.clientY - state.startPointer.y;

    if (Math.hypot(dx, dy) > 4) state.moved = true;

    state.rotation.x = clamp(
      state.startRotation.x - dy / config.dragSensitivity,
      -config.maxVerticalRotationDeg,
      config.maxVerticalRotationDeg
    );
    state.rotation.y = wrapAngleSigned(state.startRotation.y + dx / config.dragSensitivity);
    applyTransform();

    const now = performance.now();
    const elapsed = Math.max(16, now - state.lastTime);
    state.velocityX = ((event.clientX - state.lastX) / elapsed) * 16;
    state.velocityY = ((event.clientY - state.lastY) / elapsed) * 16;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastTime = now;
  }

  function onPointerUp(event) {
    if (!state.dragging || state.pointerId !== event.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    stage.classList.remove('is-dragging');
    stage.releasePointerCapture?.(event.pointerId);

    if (state.moved) {
      startInertia(state.velocityX, state.velocityY);
      window.setTimeout(() => {
        state.moved = false;
      }, 120);
    }
  }

  function onGalleryClick(event) {
    if (state.focusedTile || state.dragging || state.moved || state.opening) return;
    if (event.target.closest('.travel-gallery__topbar')) return;

    const stageRect = stage.getBoundingClientRect();
    if (
      event.clientX < stageRect.left ||
      event.clientX > stageRect.right ||
      event.clientY < stageRect.top ||
      event.clientY > stageRect.bottom
    ) {
      return;
    }

    const tile = getTileFromPoint(event.clientX, event.clientY);
    if (tile) openTile(tile);
  }

  async function loadImages() {
    if (Array.isArray(window.TRAVEL_GALLERY)) {
      return window.TRAVEL_GALLERY
        .map((image) => ({
          src: typeof image.src === 'string' ? image.src.trim() : '',
          alt: typeof image.alt === 'string' ? image.alt : ''
        }))
        .filter((image) => image.src);
    }

    try {
      const response = await fetch(imageManifestUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const manifest = await response.json();
      if (!Array.isArray(manifest)) throw new Error('The image manifest must be an array.');

      return manifest
        .map((image) => ({
          src: typeof image.src === 'string' ? image.src.trim() : '',
          alt: typeof image.alt === 'string' ? image.alt : ''
        }))
        .filter((image) => image.src);
    } catch (error) {
      console.error('[TravelGallery] Failed to load images/travel/gallery.json', error);
      return [];
    }
  }

  async function initializeGallery() {
    if (!images.length) images = await loadImages();
    if (!images.length) return;

    renderGallery();
    updateLayout();
    galleryInitialized = true;
  }

  function ensureGalleryInitialized() {
    if (galleryInitialized) return Promise.resolve(true);
    if (galleryInitializing) return galleryInitializing;

    galleryInitializing = initializeGallery()
      .then(() => galleryInitialized)
      .finally(() => {
        galleryInitializing = null;
      });

    return galleryInitializing;
  }

  openButton.setAttribute('aria-controls', 'travel-gallery');
  openButton.setAttribute('aria-expanded', 'false');
  openButton.addEventListener('click', openGalleryWithTransition);
  closeButton.addEventListener('click', closeGallery);
  scrim.addEventListener('click', closeImage);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  gallery.addEventListener('click', onGalleryClick);
  window.addEventListener('keydown', (event) => {
    if (!gallery.classList.contains('is-open') || event.key !== 'Escape') return;
    if (state.focusedTile) {
      closeImage();
      return;
    }
    closeGallery();
  });

  const resizeObserver = new ResizeObserver(updateLayout);
  resizeObserver.observe(stage);

  if ('IntersectionObserver' in window) {
    const preloadObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      preloadObserver.disconnect();
      loadImages().then((loadedImages) => {
        if (!images.length) images = loadedImages;
      });
    }, { rootMargin: '35% 0px', threshold: 0 });

    preloadObserver.observe(openButton);
  }
})();

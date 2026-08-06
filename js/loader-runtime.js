(() => {
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const stage = document.getElementById('stage');
  const video = document.getElementById('heroVideo');

  if (!loader || !loaderFill || !stage || !video) return;

  let progress = 0;
  let done = false;
  let started = false;
  const loaderSettleMs = 760;
  const loaderHoldMs = 500;
  const loaderEraseMs = 180;

  const fillProgress = () => {
    progress = Math.min(progress + (progress < 70 ? 2 : 1), 100);
    loaderFill.style.transform = 'translateX(' + (progress - 100) + '%)';

    if (progress < 100) {
      requestAnimationFrame(fillProgress);
      return;
    }

    if (done) return;
    done = true;

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

  const start = () => {
    if (started) return;
    started = true;
    requestAnimationFrame(fillProgress);
  };

  start();
  video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
})();

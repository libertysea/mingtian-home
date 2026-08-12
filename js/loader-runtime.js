(() => {
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const stage = document.getElementById('stage');
  const video = document.getElementById('heroVideo');

  if (!loader || !loaderFill || !stage || !video) return;

  let progress = 0;
  let done = false;
  const loaderSettleMs = 760;
  const loaderHoldMs = 500;
  const loaderEraseMs = 180;

  const setProgress = (value) => {
    progress = Math.max(0, Math.min(value, 100));
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

  const updateProgress = (event) => {
    const value = Number(event.detail?.progress);
    if (Number.isFinite(value)) setProgress(value * 100);
  };

  window.addEventListener('site:critical-progress', updateProgress);
  const initial = window.SiteResourceLoader?.getCriticalProgress?.();
  if (initial?.totalBytes) setProgress((initial.loadedBytes / initial.totalBytes) * 100);

  (window.SiteResourceLoader?.waitForCritical?.() || Promise.resolve()).then(finish);
  video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
})();

(() => {
  const fileMode = location.protocol === 'file:';
  const scripts = fileMode
    ? [
        { src: 'js/runtime/about-card-standalone.js' },
        { src: 'js/runtime/portfolio-gallery-standalone.js' }
      ]
    : [
        { src: 'js/runtime/about-card-module.js', type: 'module', crossOrigin: 'anonymous' },
        { src: 'js/portfolio-gallery.js', type: 'module' }
      ];

  function load(index) {
    if (index >= scripts.length) return;
    const spec = scripts[index];
    const script = document.createElement('script');
    script.src = spec.src;
    if (spec.type) script.type = spec.type;
    if (spec.crossOrigin) script.crossOrigin = spec.crossOrigin;
    script.onload = script.onerror = () => load(index + 1);
    document.body.appendChild(script);
  }

  load(0);
})();

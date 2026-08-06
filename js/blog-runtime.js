(() => {
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let blogScrollFloatTween = null;
  let blogPreviewFadeTween = null;

  const setupBlogScrollFloat = () => {
    const title = document.querySelector('.blog-title');
    const blogSection = title?.closest('.blog-section');
    if (!title || !blogSection || !window.gsap || !window.ScrollTrigger) return false;

    const chars = title.querySelectorAll('.blog-title__core > span, .blog-title__punct');
    if (chars.length === 0 || reduceMotionQuery.matches) return false;

    window.gsap.registerPlugin(window.ScrollTrigger);
    blogScrollFloatTween?.kill();
    blogScrollFloatTween = window.gsap.fromTo(chars, {
      opacity: 0,
      yPercent: 120,
      scaleY: 2.3,
      scaleX: 0.7,
      transformOrigin: '50% 0%',
      force3D: true
    }, {
      duration: 1,
      ease: 'back.inOut(2)',
      opacity: 1,
      yPercent: 0,
      scaleY: 1,
      scaleX: 1,
      stagger: 0.03,
      scrollTrigger: {
        trigger: blogSection,
        start: 'top 82%',
        end: '+=70%',
        scrub: 1.2
      }
    });

    return true;
  };

  const setupBlogPreviewFade = () => {
    const blogSection = document.querySelector('.blog-section');
    const preview = blogSection?.querySelector('.blog-preview-frame');
    if (!blogSection || !preview || !window.gsap || !window.ScrollTrigger || reduceMotionQuery.matches) return false;

    window.gsap.registerPlugin(window.ScrollTrigger);
    blogPreviewFadeTween?.scrollTrigger?.kill();
    blogPreviewFadeTween?.kill();
    blogPreviewFadeTween = window.gsap.fromTo(preview, {
      autoAlpha: 1,
      yPercent: 0,
      scale: 1,
      transformOrigin: '50% 25%',
      force3D: true
    }, {
      autoAlpha: 0,
      yPercent: 10,
      scale: 0.96,
      ease: 'none',
      scrollTrigger: {
        id: 'blog-preview-fade',
        trigger: blogSection,
        start: '35% top',
        end: 'bottom top',
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    return true;
  };



  setupBlogScrollFloat();
  setupBlogPreviewFade();
  window.addEventListener('load', () => {
    if (!blogScrollFloatTween) setupBlogScrollFloat();
    if (!blogPreviewFadeTween) setupBlogPreviewFade();
  }, { once: true });
})();

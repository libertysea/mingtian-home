(function () {
  const overlay = document.querySelector('[data-travel-flight-transition]');
  const stage = document.querySelector('[data-travel-flight-stage]');
  const interestSection = document.getElementById('community');
  const blogSection = document.getElementById('blog');
  const travelSection = document.getElementById('travel');
  const largePlane = document.querySelector('[data-travel-flight-large]');
  const smallPlane = document.querySelector('[data-travel-flight-small]');

  if (
    !overlay ||
    !stage ||
    !interestSection ||
    !blogSection ||
    !travelSection ||
    !largePlane ||
    !smallPlane ||
    !window.gsap ||
    !window.ScrollTrigger ||
    !window.lottie
  ) {
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;

  const isMobile = window.matchMedia('(max-width: 760px)').matches;

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const animations = [];
  const largeProgress = { value: 0 };
  const smallProgress = { value: 0 };
  let largeTimeline = null;
  let smallTimeline = null;

  gsap.registerPlugin(ScrollTrigger);

  const loadPlane = (container, path) => {
    const animation = window.lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path,
      rendererSettings: {
        progressiveLoad: true,
        preserveAspectRatio: 'xMidYMid meet'
      }
    });

    animations.push(animation);
    return animation;
  };

  const largeAnimation = loadPlane(
    largePlane,
    'images/travel/transitions/paper-plane-enter.json'
  );
  const smallAnimation = loadPlane(
    smallPlane,
    'images/travel/transitions/paper-plane-exit.json'
  );

  const seek = (animation, progress) => {
    if (!animation.isLoaded || !animation.totalFrames) return;
    const frame = Math.max(0, Math.min(animation.totalFrames - 1, progress * animation.totalFrames));
    animation.goToAndStop(frame, true);
  };

  const isActive = (timeline, start = 0.002, end = 0.998) => {
    const progress = timeline?.progress() ?? 0;
    return progress >= start && progress < end;
  };

  const updateStageVisibility = () => {
    gsap.set(stage, { autoAlpha: isActive(largeTimeline, 0.5) || isActive(smallTimeline, 0.002, 0.7) ? 1 : 0 });
  };

  largeAnimation.addEventListener('DOMLoaded', () => {
    seek(largeAnimation, Math.max(0, ((largeTimeline?.progress() ?? 0) - 0.5) * 2));
  });
  smallAnimation.addEventListener('DOMLoaded', () => {
    seek(smallAnimation, Math.min(1, (smallTimeline?.progress() ?? 0) / 0.68));
  });

  gsap.set(stage, { autoAlpha: 0 });
  gsap.set(largePlane, {
    xPercent: -20,
    yPercent: 20,
    autoAlpha: 1
  });
  gsap.set(smallPlane, {
    xPercent: 100,
    x: 0,
    y: 0,
    scale: 1,
    autoAlpha: 1
  });

  largeTimeline = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: function () {
      const progress = Math.max(0, (this.progress() - 0.5) * 2);
      seek(largeAnimation, progress);
      updateStageVisibility();
    },
    scrollTrigger: {
      id: 'interest-to-blog-flight',
      trigger: interestSection,
      start: 'top top',
      endTrigger: blogSection,
      end: 'top top',
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  largeTimeline
    .to(largeProgress, { value: 1, duration: 1 }, 0)
    .to(
      largePlane,
      {
        xPercent: 160,
        yPercent: -120,
        duration: 0.5
      },
      0.5
    );

  smallTimeline = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: function () {
      const progress = Math.min(1, this.progress() / 0.68);
      seek(smallAnimation, progress);
      updateStageVisibility();
    },
    scrollTrigger: {
      id: 'blog-to-travel-flight',
      trigger: blogSection,
      start: 'top top',
      endTrigger: travelSection,
      end: 'top top',
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  smallTimeline
    .to(smallProgress, { value: 1, duration: 1 }, 0)
    .to(
      smallPlane,
      {
        xPercent: 0,
        x: () => -window.innerWidth * (isMobile ? 0.18 : 0.58),
        y: () => -window.innerHeight * (isMobile ? 0.18 : 0.56),
        scale: 0.65,
        duration: 0.5
      },
      0
    )
    .to(
      smallPlane,
      {
        x: () => -window.innerWidth * (isMobile ? 0.7 : 1.15),
        y: () => -window.innerHeight * (isMobile ? 0.45 : 0.9),
        scale: 0.55,
        duration: 0.18
      },
      0.5
    );

  updateStageVisibility();

  window.addEventListener(
    'pagehide',
    () => {
      largeTimeline?.scrollTrigger?.kill();
      smallTimeline?.scrollTrigger?.kill();
      largeTimeline?.kill();
      smallTimeline?.kill();
      animations.forEach((animation) => animation.destroy());
      gsap.set(stage, { autoAlpha: 0 });
    },
    { once: true }
  );
})();

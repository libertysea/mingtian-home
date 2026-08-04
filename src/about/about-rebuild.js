/* about right typography rebuild v38: isolated 3D stage + ScrollFloat */
(() => {
  const about = document.getElementById('about');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollFloatDefaults = {
    animationDuration: 1,
    ease: 'back.inOut(2)',
    scrollStart: 'center bottom+=50%',
    scrollEnd: 'bottom bottom-=40%',
    titleStagger: 0.03,
    roleStagger: 0.022
  };

  let rebuilt = false;
  let stageReady = false;
  let stage = null;
  let hitarea = null;
  let rotationXTo = null;
  let rotationYTo = null;
  let yTo = null;
  let shadowTo = null;
  const shadowState = { value: 0 };
  const mountFlipHint = () => {
    const section = about;
    if (!section || section.querySelector('.identity-flip-hint')) return false;

    const host = section.querySelector('.identity-lanyard-pane') || section;

    const hint = document.createElement('div');
    hint.className = 'identity-flip-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '👆点击翻转';

    host.appendChild(hint);
    return true;
  };
  const copyText = {
    title: 'Hi, 我是明天~',
    roles: ['中科院 AI 硕士 📖', 'CV 工程师 👨‍💻 & 天才交易员 📈'],
    note: '保持好奇，持续创造。'
  };

  const splitGraphemes = (text) => {
    if ('Segmenter' in Intl) {
      return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)].map((part) => part.segment);
    }
    return Array.from(text);
  };

  const restoreCopyText = (copy) => {
    const h2 = copy.querySelector('h2');
    if (h2) {
      h2.textContent = copyText.title;
      h2.setAttribute('aria-label', copyText.title);
    }

    [...copy.querySelectorAll('.identity-role')].forEach((role, index) => {
      if (!copyText.roles[index]) return;
      role.textContent = copyText.roles[index];
      role.setAttribute('aria-label', copyText.roles[index]);
    });

    const note = copy.querySelector('.identity-note');
    if (note) note.textContent = copyText.note;
  };

  const buildStage = (copy) => {
    copy.querySelectorAll('.identity-tilt-surface, .identity-3d-hitarea').forEach((node) => node.remove());
    const oldStage = copy.querySelector('.identity-3d-stage');
    if (oldStage) {
      [...oldStage.childNodes].forEach((node) => copy.insertBefore(node, oldStage));
      oldStage.remove();
    }

    stage = document.createElement('div');
    stage.className = 'identity-3d-stage';
    const children = [...copy.children].filter((child) => !child.classList.contains('identity-3d-hitarea'));
    children.forEach((child) => stage.appendChild(child));
    copy.appendChild(stage);

    hitarea = document.createElement('div');
    hitarea.className = 'identity-3d-hitarea';
    hitarea.setAttribute('aria-hidden', 'true');
    copy.appendChild(hitarea);
  };

  const splitScrollFloatText = (element, stagger) => {
    if (!element) return null;
    const text = element.getAttribute('aria-label') || element.textContent.trim();
    element.textContent = '';
    element.classList.add('scroll-float', 'identity-scroll-float');
    element.setAttribute('aria-label', text);

    const textWrap = document.createElement('span');
    textWrap.className = 'scroll-float-text';
    textWrap.setAttribute('aria-hidden', 'true');

    const chars = splitGraphemes(text).map((char, index) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.dataset.charIndex = String(index);
      span.textContent = char === ' ' ? '\u00A0' : char;
      textWrap.appendChild(span);
      return span;
    });

    element.appendChild(textWrap);
    return { element, chars, stagger };
  };

  const setAllVisible = (items) => {
    items.flatMap((item) => item.chars).forEach((char) => {
      char.style.opacity = '1';
      char.style.transform = 'translate3d(0, 0%, 0) scale(1, 1)';
    });
    stageReady = true;
    stage?.classList.add('is-stage-ready');
  };

  const updateStageShadow = () => {
    if (!stage) return;
    const value = shadowState.value;
    stage.style.setProperty('--stage-shadow', value.toFixed(2));
  };

  const bindStageTilt = () => {
    if (!window.gsap || reduceMotion.matches || !stage || !hitarea) return;

    window.gsap.set(stage, {
      transformPerspective: 760,
      transformOrigin: '50% 42%',
      rotationX: 0,
      rotationY: 0,
      y: 0,
      z: 0,
      force3D: true
    });

    rotationXTo = window.gsap.quickTo(stage, 'rotationX', { duration: 0.42, ease: 'power3.out' });
    rotationYTo = window.gsap.quickTo(stage, 'rotationY', { duration: 0.42, ease: 'power3.out' });
    yTo = window.gsap.quickTo(stage, 'y', { duration: 0.42, ease: 'power3.out' });
    shadowTo = window.gsap.quickTo(shadowState, 'value', { duration: 0.42, ease: 'power3.out', onUpdate: updateStageShadow });

    hitarea.addEventListener('pointermove', (event) => {
      if (!stageReady) return;
      const rect = hitarea.getBoundingClientRect();
      const localX = (event.clientX - rect.left) / rect.width - 0.5;
      const localY = (event.clientY - rect.top) / rect.height - 0.5;
      stage.classList.add('is-stage-tilting');
      rotationXTo(Math.max(-5.5, Math.min(5.5, localY * -10)));
      rotationYTo(Math.max(-18, Math.min(18, localX * 34)));
      yTo(-10);
      shadowTo(1);
    }, { passive: true });

    hitarea.addEventListener('pointerleave', () => {
      stage.classList.remove('is-stage-tilting');
      rotationXTo(0);
      rotationYTo(0);
      yTo(0);
      shadowTo(0);
    }, { passive: true });
  };

  const bindScrollFloat = (copy, items) => {
    if (!window.gsap || !window.ScrollTrigger || reduceMotion.matches) {
      setAllVisible(items);
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.getAll().forEach((trigger) => {
      if (trigger.trigger && about.contains(trigger.trigger)) trigger.kill();
    });

    items.forEach((item) => {
      window.gsap.fromTo(
        item.chars,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 120,
          scaleY: 2.3,
          scaleX: 0.7,
          transformOrigin: '50% 0%'
        },
        {
          duration: scrollFloatDefaults.animationDuration,
          ease: scrollFloatDefaults.ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger: item.stagger,
          scrollTrigger: {
            trigger: item.element,
            start: scrollFloatDefaults.scrollStart,
            end: scrollFloatDefaults.scrollEnd,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: () => {
              const allVisible = items.every((entry) => {
                const chars = entry.chars;
                if (chars.length === 0) return true;
                return Number(window.getComputedStyle(chars[chars.length - 1]).opacity) > 0.92;
              });
              if (allVisible && !stageReady) {
                stageReady = true;
                stage?.classList.add('is-stage-ready');
              }
            }
          }
        }
      );
    });

    requestAnimationFrame(() => window.ScrollTrigger.refresh());
  };

  const rebuild = () => {
    const copy = about?.querySelector('.identity-copy');
    if (!copy || rebuilt) return false;

    restoreCopyText(copy);
    buildStage(copy);

    const items = [
      splitScrollFloatText(stage.querySelector('h2'), scrollFloatDefaults.titleStagger),
      ...[...stage.querySelectorAll('.identity-role')].map((role) => splitScrollFloatText(role, scrollFloatDefaults.roleStagger))
    ].filter(Boolean);

    rebuilt = true;
    mountFlipHint();
    bindScrollFloat(copy, items);
    bindStageTilt();
    return true;
  };

  if (!rebuild()) {
    const root = document.getElementById('identity-root');
    const observer = new MutationObserver(() => {
      if (rebuild()) observer.disconnect();
    });
    if (root) observer.observe(root, { childList: true, subtree: true });
  }
})();

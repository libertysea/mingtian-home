(() => {
  const getConfig = () => window.SITE_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const setText = (selector, value, root = document) => {
    const node = $(selector, root);
    if (node && value !== undefined && value !== null) node.textContent = value;
  };

  const setAttr = (selector, attr, value, root = document) => {
    const node = $(selector, root);
    if (node && value) node.setAttribute(attr, value);
  };

  const setImage = (selector, src, root = document) => {
    if (!src) return;
    const image = $(selector, root);
    if (image) image.src = src;
  };

  const setVideo = (selector, src, root = document) => {
    if (!src) return;
    const video = $(selector, root);
    if (!video) return;
    const nextSrc = new URL(src, document.baseURI).href;
    if (video.currentSrc === nextSrc || video.src === nextSrc) return;
    video.src = src;
    video.load();
  };

  const splitTitleLine = (line) => {
    const text = String(line || '');
    const punct = text.match(/[，。！？,.!?]$/)?.[0] || '';
    return {
      core: punct ? text.slice(0, -punct.length) : text,
      punct
    };
  };

  const toAssetUrl = (value) => new URL(value, document.baseURI).href;

  const setCssUrl = (element, name, value) => {
    if (element && value) element.style.setProperty(name, `url("${toAssetUrl(value)}")`);
  };

  const renderNavigation = (config) => {
    const nav = $('.site-nav');
    const links = $('#site-nav-links');
    const items = config.navigation?.items;
    if (!nav || !links || !Array.isArray(items)) return;

    const brand = config.navigation?.brand || {};
    const brandLink = $('.site-nav__brand', nav);
    if (brandLink) {
      if (brand.target) {
        brandLink.href = '#' + brand.target;
        brandLink.dataset.navTarget = brand.target;
      }
      if (brand.label) brandLink.setAttribute('aria-label', brand.label);
      setImage('img', brand.image, brandLink);
    }

    links.replaceChildren(...items.map((item) => {
      const anchor = document.createElement('a');
      anchor.className = 'site-nav__link';
      anchor.href = '#' + item.target;
      anchor.dataset.navTarget = item.target;
      anchor.textContent = item.label;
      return anchor;
    }));
  };

  const renderHero = (config) => {
    const hero = config.hero || {};
    setVideo('#heroVideo', hero.background?.video);
    setText('.title__kicker', hero.kicker);
    setText('.title__latin', hero.title);
    setText('.title__cn', hero.subtitle);

    const crop = hero.background?.crop;
    const stage = $('#stage');
    const video = $('#heroVideo');
    if (crop?.position && video) video.style.objectPosition = crop.position;
    if (crop?.scale && stage) stage.style.setProperty('--hero-video-scale', crop.scale);
  };

  const renderAboutBadge = (config) => {
    const about = $('#about');
    const badge = config.about?.badge || {};
    if (!about) return;

    if (badge.front) about.style.setProperty('--about-badge-front-image', `url("${toAssetUrl(badge.front)}")`);
    if (badge.back) about.style.setProperty('--about-badge-back-image', `url("${toAssetUrl(badge.back)}")`);

    if (!document.getElementById('about-badge-config-style')) {
      const style = document.createElement('style');
      style.id = 'about-badge-config-style';
      style.textContent = [
        '#about .bits-card{background:var(--about-badge-front-image),radial-gradient(circle at 22% 18%,rgba(255,255,255,.86),transparent 18%),linear-gradient(135deg,#f6f5f2,#ecebe8,#faf9f5);background-position:center;background-size:cover;background-repeat:no-repeat}',
        '#about .bits-lanyard.is-config-flipped .bits-card{background:var(--about-badge-back-image),radial-gradient(circle at 22% 18%,rgba(255,255,255,.86),transparent 18%),linear-gradient(135deg,#f6f5f2,#ecebe8,#faf9f5);background-position:center;background-size:cover;background-repeat:no-repeat}',
        '#about .bits-lanyard.is-config-flipped .bits-atom{opacity:0}'
      ].join('\n');
      document.head.appendChild(style);
    }
  };

  const renderHomeMusic = (config) => {
    const tracks = Array.isArray(window.MUSIC_TRACKS) ? window.MUSIC_TRACKS : [];
    const featuredTrack = config.music?.player?.featuredTrack;
    const initialTrack = tracks.find((track) => track.id === featuredTrack) || tracks[0];
    if (!initialTrack) return;

    setImage('.home-music-orb__disc img', initialTrack.cover);
    setText('.home-music-orb__meta strong', initialTrack.title);
    setText('.home-music-orb__meta small', initialTrack.artist);
    setAttr('#homeMusicAudio', 'src', initialTrack.audio);
    setImage('#homeMusicCover', initialTrack.cover);
    setText('#homeMusicTitle', initialTrack.title);
    setText('#homeMusicArtist', initialTrack.artist);
  };

  const renderInterests = (config) => {
    const interests = config.interests || {};
    const scene = interests.scene || {};
    setAttr('#interests', 'aria-label', scene.title?.cn ? '个人兴趣：' + scene.title.cn : null);
    setImage('.interests-room', scene.background);
    setText('.interests-enjoy-title__en', scene.title?.en);
    setText('.interests-enjoy-title__cn', scene.title?.cn);

    setAttr('[data-music-entry]', 'title', interests.music?.entryTooltip);
    setText('.interests-player__tooltip', interests.music?.entryTooltip);
    setImage('.interests-player__vinyl', interests.music?.vinyl);
    setImage('.interests-player__tonearm', interests.music?.tonearm);
    setImage('.interests-asset--music', interests.music?.character);
    setImage('.interests-asset--tv', interests.tv?.frame);
    setImage('.interests-asset--gaming', interests.games?.character);

    const tvScreen = $('[data-tv-carousel]');
    if (tvScreen && Array.isArray(interests.tv?.slides)) {
      tvScreen.replaceChildren(...interests.tv.slides.map((slide, index) => {
        const image = document.createElement('img');
        image.className = 'interests-tv-slide' + (index === 0 ? ' is-active' : '');
        image.src = slide.image;
        image.alt = '';
        image.dataset.tvSlide = '';
        image.dataset.title = slide.title;
        image.setAttribute('aria-hidden', String(index !== 0));
        image.draggable = false;
        image.loading = 'lazy';
        image.decoding = 'async';
        return image;
      }));
      tvScreen.setAttribute('aria-label', '切换电视节目，当前：' + (interests.tv.slides[0]?.title || ''));
    }

    const panels = $('.interests-game-showcase__panels');
    if (panels && Array.isArray(interests.games?.items)) {
      panels.replaceChildren(...interests.games.items.map((item) => {
        const button = document.createElement('button');
        button.className = 'interests-game-panel';
        button.type = 'button';
        button.dataset.gamePanel = '';
        button.setAttribute('aria-label', item.title);
        button.setAttribute('aria-pressed', 'false');
        button.innerHTML = '<img alt="" draggable="false" loading="lazy" decoding="async"><span class="interests-game-panel__label"></span>';
        button.querySelector('img').src = item.image;
        button.querySelector('.interests-game-panel__label').textContent = item.title;
        return button;
      }));
      const count = $('.interests-game-showcase__count');
      if (count) count.lastChild.textContent = ' / ' + String(interests.games.items.length).padStart(2, '0');
    }
  };

  const renderBlog = (config) => {
    const blog = config.blog || {};
    setText('.blog-kicker', blog.kicker);
    const title = blog.title || '';
    const core = $('.blog-title__core');
    const punct = $('.blog-title__punct');
    if (core && title) {
      const finalPunct = title.match(/[！!。.]$/)?.[0] || '';
      const chars = Array.from(finalPunct ? title.slice(0, -finalPunct.length) : title);
      core.replaceChildren(...chars.map((char) => {
        const span = document.createElement('span');
        span.textContent = char;
        return span;
      }));
      if (punct) punct.textContent = finalPunct;
      $('.blog-title')?.setAttribute('aria-label', title);
    }
    setText('.blog-lede', blog.lede);
    setImage('.blog-preview-frame img', blog.previewImage);
    const link = $('.blog-button');
    if (link && blog.link) {
      link.textContent = blog.link.label || '';
      link.href = blog.link.url || '#';
    }
  };

  const renderTravel = (config) => {
    const travel = config.travel || {};
    setVideo('.travel-video', travel.hero?.video);

    const title = $('.travel-title');
    if (title && Array.isArray(travel.hero?.titleLines)) {
      title.replaceChildren(...travel.hero.titleLines.map((line) => {
        const parts = splitTitleLine(line);
        const row = document.createElement('span');
        row.className = 'travel-title__line';

        const core = document.createElement('span');
        core.className = 'travel-title__core';
        core.textContent = parts.core;
        row.appendChild(core);

        if (parts.punct) {
          const punct = document.createElement('span');
          punct.className = 'travel-title__punct';
          punct.textContent = parts.punct;
          row.appendChild(punct);
        }

        return row;
      }));
      title.setAttribute('aria-label', travel.hero.titleLines.join(''));
    }

    const subtitle = $('.travel-subtitle');
    if (subtitle && Array.isArray(travel.hero?.subtitle)) {
      subtitle.replaceChildren(...travel.hero.subtitle.map((line) => {
        const span = document.createElement('span');
        span.textContent = line;
        return span;
      }));
    }

    setText('[data-open-travel-gallery]', travel.hero?.button);
    setText('.travel-gallery__title', travel.gallery?.title);
  };

  const renderPortfolio = (config) => {
    const portfolio = config.portfolio || {};
    setImage('.portfolio-photographer', portfolio.photographerImage);
    setText('.portfolio-kicker', portfolio.kicker);
    setText('.portfolio-title', portfolio.title);
    setText('.portfolio-lede', portfolio.lede);
  };

  const renderDaily = (config) => {
    const daily = config.daily || {};
    const dailyBook = $('.daily-book');
    setCssUrl(dailyBook, '--daily-book-binder-image', daily.book?.binder);
    setCssUrl(dailyBook, '--daily-campus-left-bg', daily.campus?.background?.left);
    setCssUrl(dailyBook, '--daily-campus-right-bg', daily.campus?.background?.right);
    setCssUrl(dailyBook, '--daily-vibe-left-bg', daily.vibeCoding?.background?.left);
    setCssUrl(dailyBook, '--daily-vibe-right-bg', daily.vibeCoding?.background?.right);
    setCssUrl(dailyBook, '--daily-stock-left-bg', daily.stock?.background?.left);
    setCssUrl(dailyBook, '--daily-stock-right-bg', daily.stock?.background?.right);
    setText('.daily-title-date', daily.campus?.date);
    setText('.daily-title-main', daily.campus?.title);
    setText('.daily-title-tags', daily.campus?.tags);
    setText('.daily-left-note', daily.campus?.note);
    setImage('.daily-left-seal-sticker', daily.campus?.images?.seal);
    setImage('.daily-left-card-sticker', daily.campus?.images?.card);
    setImage('.daily-left-coder-sticker', daily.campus?.images?.coder);
    setImage('.daily-left-sticker', daily.campus?.images?.sticker);

    setText('.daily-left-vibe__caption', daily.vibeCoding?.caption);
    setImage('.daily-left-vibe__comic', daily.vibeCoding?.images?.quotaComic);
    setImage('.daily-left-vibe__cloud', daily.vibeCoding?.images?.dreamCloud);
    setImage('.daily-right-vibe-sticker', daily.vibeCoding?.images?.gif);

    setText('.daily-left-stock-title__main', daily.stock?.title);
    setText('.daily-left-stock-title__sub', daily.stock?.subtitle);
    setText('.daily-left-stock-fill__stamp', daily.stock?.difficulty);
    setImage('.daily-left-stock-sticker--learn', daily.stock?.images?.learn);
    setImage('.daily-left-stock-sticker--question', daily.stock?.images?.question);
    setImage('.daily-right-stock-sticker--capital', daily.stock?.images?.capitalTrap);
    setImage('.daily-right-stock-sticker--rider', daily.stock?.images?.deliveryRider);
    setText('.daily-right-stock-copy__title', daily.stock?.apologyTitle);

    const lines = $$('.daily-right-stock-copy__line > span:last-child');
    if (Array.isArray(daily.stock?.apologyLines)) {
      lines.forEach((node, index) => {
        if (daily.stock.apologyLines[index]) node.textContent = daily.stock.apologyLines[index];
      });
    }

    setText('.daily-right-terminal__user', daily.log?.terminalUser);
    setText('.daily-right-kicker', daily.log?.kicker);
    setText('.daily-right-title', daily.log?.title);
    setText('.daily-right-date-tape', daily.log?.dateTape);
    setText('.daily-right-note', daily.log?.note);
    setImage('.daily-right-light-film', daily.log?.images?.filmStrip);
    setImage('.daily-floating-study', daily.log?.images?.study);
    setImage('.daily-right-card--walk', daily.log?.images?.walkCard);
    setImage('.daily-right-card--arch', daily.log?.images?.archCard);
    setImage('.daily-right-card--film', daily.log?.images?.filmCard);
    setImage('.daily-page-arrow--left img', daily.book?.arrow);
    setImage('.daily-page-arrow--right img', daily.book?.arrow);
  };

  const renderContinuation = (config) => {
    const continuation = config.continuation || {};
    setAttr('.daily-continuation', 'aria-label', continuation.title);
    setText('.daily-continuation__title', continuation.title);
    setText('.daily-continuation__subtitle', continuation.subtitle);
    setText('.daily-continuation__quote', continuation.quote);

    const footer = config.footer || {};
    const record = $('.daily-continuation__record');
    if (record && footer.record) {
      record.textContent = footer.record.text || '';
      record.href = footer.record.url || '#';
    }
    setText('.daily-continuation__copyright', footer.copyright);
  };

  const applySiteConfig = () => {
    const config = getConfig();
    if (config.config?.language) document.documentElement.lang = config.config.language;
    renderNavigation(config);
    renderHero(config);
    renderAboutBadge(config);
    renderHomeMusic(config);
    renderInterests(config);
    renderBlog(config);
    renderTravel(config);
    renderPortfolio(config);
    renderDaily(config);
    renderContinuation(config);
    window.dispatchEvent(new CustomEvent('site-config-applied'));
  };

  window.applySiteConfig = applySiteConfig;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySiteConfig, { once: true });
  } else {
    applySiteConfig();
  }
})();


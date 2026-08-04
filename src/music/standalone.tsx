import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import musicBackground from '../../images/mos-background.webp';
import MusicExperience from './MusicExperience';

const host = document.getElementById('music-component-root');

window.MusicAssets = {
  'images/mos-background.webp': musicBackground as unknown as string
};

if (!host) {
  throw new Error('The music component host is missing.');
}

const root = createRoot(host);
const homeState = new Map<HTMLElement, { inert: boolean; ariaHidden: string | null }>();
let mounted = false;
let homeTitle = document.title;

function setHomeInert(inert: boolean) {
  if (inert) {
    homeState.clear();
    Array.from(document.body.children).forEach(element => {
      if (!(element instanceof HTMLElement)) return;
      if (element === host || element.matches('script, .route-transition')) return;
      homeState.set(element, {
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      });
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    return;
  }

  homeState.forEach((state, element) => {
    element.inert = state.inert;
    if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', state.ariaHidden);
  });
  homeState.clear();
}

function requestClose() {
  window.MusicRouteTransition?.close();
}

window.MusicComponent = {
  show() {
    if (mounted) return;
    homeTitle = document.title;
    host.hidden = false;
    host.setAttribute('aria-hidden', 'false');
    document.body.classList.add('music-component-open');
    setHomeInert(true);
    try {
      flushSync(() => root.render(<MusicExperience onExit={requestClose} />));
      document.title = 'Music | Per Aspera Ad Astra';
      mounted = true;
    } catch (error) {
      host.hidden = true;
      host.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('music-component-open');
      setHomeInert(false);
      document.title = homeTitle;
      throw error;
    }
  },
  hide() {
    if (!mounted) return;
    flushSync(() => root.render(null));
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('music-component-open');
    setHomeInert(false);
    document.title = homeTitle;
    mounted = false;
    window.dispatchEvent(new CustomEvent('music-component-closed'));
  },
  focusClose() {
    host.querySelector<HTMLElement>('[data-music-exit]')?.focus({ preventScroll: true });
  },
  isOpen() {
    return mounted;
  }
};

window.dispatchEvent(new CustomEvent('music-component-ready'));

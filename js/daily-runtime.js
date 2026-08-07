(() => {
  const setupDailyTerminal = () => {
    const dailyBook = document.querySelector('.daily-book');
    const getBodies = () => [...document.querySelectorAll('[data-daily-terminal-body]')];
    const forEachBody = (callback) => getBodies().forEach(callback);
    if (!dailyBook || getBodies().length === 0) return;

    const introLines = [
      { kind: 'cmd', text: 'who am I?' },
      { kind: 'accent', text: '我是明天~' },
      { kind: 'accent', text: 'Hi，明天！' }
    ];
    const detailLines = [
      { kind: 'cmd', text: 'cat about.md' },
      { kind: 'accent', text: 'AI 工程师' },
      { kind: 'accent', text: '把想法做成可运行的产品' },
      { kind: 'accent', text: '和 Agent 一起搭建工作流' },
      { kind: 'cursor', text: '' }
    ];
    let stage = 'idle';
    let runId = 0;

    const clearTerminal = () => {
      runId += 1;
      stage = 'idle';
      forEachBody((body) => {
        body.classList.remove('is-waiting');
        body.replaceChildren();
      });
    };

    const createLine = (line) => {
      return getBodies().map((body) => {
        const row = document.createElement('p');
        const marker = document.createElement('span');
        const typed = document.createElement('span');

        row.className = line.kind === 'cmd' ? 'daily-right-terminal__cmd' : 'daily-right-terminal__line';
        marker.className = line.kind === 'cmd' ? 'daily-right-terminal__prompt' : 'daily-right-terminal__arrow';
        marker.textContent = line.kind === 'cmd' ? '$ ' : '> ';
        typed.className = `daily-right-terminal__typed ${line.kind === 'soft' ? 'daily-right-terminal__soft' : line.kind === 'accent' ? 'daily-right-terminal__accent' : line.kind === 'cursor' ? 'daily-right-terminal__cursor' : ''}`.trim();

        row.append(marker, typed);
        body.appendChild(row);
        return typed;
      });
    };

    const typeLine = (line, token) =>
      new Promise((resolve) => {
        const typedNodes = createLine(line);
        if (line.kind === 'cursor') {
          window.setTimeout(resolve, 360);
          return;
        }
        let index = 0;
        const tick = () => {
          if (token !== runId) return;
          typedNodes.forEach((typed) => {
            typed.textContent = line.text.slice(0, index);
          });
          index += 1;
          if (index <= line.text.length) {
            window.setTimeout(tick, line.kind === 'cmd' ? 74 : 58);
            return;
          }
          window.setTimeout(resolve, line.kind === 'cmd' ? 420 : 560);
        };
        tick();
      });

    const playLines = async (lines, nextStage) => {
      const token = runId;
      for (const line of lines) {
        await typeLine(line, token);
        if (token !== runId) return;
      }
      stage = nextStage;
      forEachBody((body) => {
        body.classList.toggle('is-waiting', nextStage === 'waiting');
      });
    };

    const startIntro = () => {
      if (!dailyBook.classList.contains('is-computer-page')) {
        clearTerminal();
        return;
      }
      clearTerminal();
      stage = 'intro';
      const token = runId;
      window.setTimeout(() => {
        if (token !== runId || !dailyBook.classList.contains('is-computer-page')) return;
        playLines(introLines, 'waiting');
      }, 520);
    };

    const continueDetails = () => {
      if (stage !== 'waiting' || !dailyBook.classList.contains('is-computer-page')) return;
      forEachBody((body) => {
        body.classList.remove('is-waiting');
      });
      stage = 'details';
      playLines(detailLines, 'done');
    };

    document.addEventListener('daily:computer-page', startIntro);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        continueDetails();
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-daily-terminal-body]')) {
        continueDetails();
      }
    });
  };

  const setupDailyPageFlip = () => {
    const dailyBook = document.querySelector('.daily-book');
    const dailyFlipButtons = [...document.querySelectorAll('[data-daily-flip]')];
    const dailyShell = dailyBook?.closest('.daily-shell');
    const spreadCount = 3;
    const halfPageCount = spreadCount * 2;
    const mobileDailyQuery = window.matchMedia('(max-width: 760px)');
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pageForSpread = (spreadIndex) => 2 + spreadIndex * 2;
    const spreadForIndex = (pageIndex) => mobileDailyQuery.matches ? Math.floor(pageIndex / 2) : pageIndex;
    let dailyPageIndex = 0;
    let isTurning = false;

    if (!dailyBook || dailyFlipButtons.length === 0) {
      return;
    }

    const applyDailyPageState = (element, pageIndex) => {
      const spreadIndex = spreadForIndex(pageIndex);
      element.classList.toggle('is-computer-page', spreadIndex === 1);
      element.classList.toggle('is-stock-page', spreadIndex === 2);

      if (element === dailyBook) {
        element.classList.toggle('is-mobile-half-page', mobileDailyQuery.matches);
        for (let index = 0; index < halfPageCount; index += 1) {
          element.classList.toggle('mobile-half-' + index, mobileDailyQuery.matches && pageIndex === index);
        }
      }
    };

    const setFlipButtonsDisabled = (disabled) => {
      const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
      dailyFlipButtons.forEach((button) => {
        const targetIndex = dailyPageIndex + (button.dataset.dailyFlip === 'next' ? 1 : -1);
        button.disabled = disabled || targetIndex < 0 || targetIndex >= pageCount;
      });
    };

    const syncDailyPageState = () => {
      const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
      dailyPageIndex = Math.max(0, Math.min(pageCount - 1, dailyPageIndex));
      applyDailyPageState(dailyBook, dailyPageIndex);
      setFlipButtonsDisabled(isTurning);
    };

    const createTurnPreview = (sourcePage, pageIndex) => {
      const preview = document.createElement('div');
      const clone = sourcePage.cloneNode(true);

      preview.className = 'daily-book daily-page-flip-state-preview';
      applyDailyPageState(preview, pageIndex);
      clone.classList.add('daily-turn-page-copy');
      clone.removeAttribute('aria-hidden');
      preview.appendChild(clone);

      return preview;
    };

    const createTurnPage = (sourcePage, pageIndex) => {
      const page = document.createElement('div');
      const visual = document.createElement('div');

      page.className = 'daily-turn-page';
      visual.className = 'daily-turn-visual';
      visual.appendChild(createTurnPreview(sourcePage, pageIndex));
      page.appendChild(visual);

      return page;
    };

    const buildTurnBook = () => {
      const leftPage = dailyBook.querySelector('.daily-left-page');
      const rightPage = dailyBook.querySelector('.daily-right-page');
      const turnBook = document.createElement('div');

      if (!leftPage || !rightPage || !window.jQuery || !window.jQuery.fn || !window.jQuery.fn.turn) {
        return null;
      }

      turnBook.className = 'daily-turn-book';
      turnBook.appendChild(document.createElement('div'));

      for (let pageIndex = 0; pageIndex < spreadCount; pageIndex += 1) {
        turnBook.appendChild(createTurnPage(leftPage, pageIndex));
        turnBook.appendChild(createTurnPage(rightPage, pageIndex));
      }

      turnBook.appendChild(document.createElement('div'));
      dailyBook.appendChild(turnBook);

      return turnBook;
    };

    const runStaticDailyFlip = (direction) => {
      const pageCount = mobileDailyQuery.matches ? halfPageCount : spreadCount;
      const nextPageIndex = dailyPageIndex + (direction === 'next' ? 1 : -1);
      if (nextPageIndex < 0 || nextPageIndex >= pageCount) return;
      dailyPageIndex = nextPageIndex;
      syncDailyPageState();
      document.dispatchEvent(new CustomEvent('daily:computer-page'));
    };

    if (mobileDailyQuery.matches) {
      if (dailyShell) {
        dailyFlipButtons.forEach((button) => dailyShell.appendChild(button));
      }
      dailyFlipButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          button.blur();
          runStaticDailyFlip(button.dataset.dailyFlip);
        });
      });
      syncDailyPageState();
      mobileDailyQuery.addEventListener('change', syncDailyPageState);
      return;
    }

    const turnBook = buildTurnBook();
    if (!turnBook) {
      dailyFlipButtons.forEach((button) => {
        button.addEventListener('click', () => runStaticDailyFlip(button.dataset.dailyFlip));
      });
      syncDailyPageState();
      return;
    }

    const $turnBook = window.jQuery(turnBook);
    const resizeTurnBook = () => {
      const leftPage = dailyBook.querySelector('.daily-left-page');
      const rightPage = dailyBook.querySelector('.daily-right-page');
      const leftRect = leftPage.getBoundingClientRect();
      const rightRect = rightPage.getBoundingClientRect();
      const bookRect = dailyBook.getBoundingClientRect();

      turnBook.style.left = (leftRect.left - bookRect.left) + 'px';
      turnBook.style.top = (leftRect.top - bookRect.top) + 'px';
      $turnBook.turn('size', Math.round(rightRect.right - leftRect.left), Math.round(Math.max(leftRect.height, rightRect.height)));
    };

    $turnBook.turn({
      page: pageForSpread(0),
      display: 'double',
      autoCenter: false,
      gradients: true,
      acceleration: true,
      duration: reduceMotionQuery.matches ? 260 : 1120,
      elevation: 62,
      when: {
        turning: (event, page) => {
          dailyPageIndex = Math.max(0, Math.min(spreadCount - 1, Math.floor((page - 2) / 2)));
          isTurning = true;
          dailyBook.classList.add('is-daily-flipping');
          syncDailyPageState();
        },
        turned: (event, page) => {
          dailyPageIndex = Math.max(0, Math.min(spreadCount - 1, Math.floor((page - 2) / 2)));
          isTurning = false;
          dailyBook.classList.remove('is-daily-flipping');
          syncDailyPageState();
          document.dispatchEvent(new CustomEvent('daily:computer-page'));
        }
      }
    });

    resizeTurnBook();
    dailyBook.classList.add('is-turn-ready');
    syncDailyPageState();
    window.addEventListener('resize', resizeTurnBook);

    const runDailyFlip = (direction) => {
      if (isTurning) return;
      if (direction === 'next') {
        $turnBook.turn('next');
      } else {
        $turnBook.turn('previous');
      }
    };

    dailyFlipButtons.forEach((button) => {
      button.addEventListener('click', () => runDailyFlip(button.dataset.dailyFlip));
    });
    syncDailyPageState();
  };



  setupDailyPageFlip();
  setupDailyTerminal();
})();

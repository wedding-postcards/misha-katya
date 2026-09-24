/* Both views share one painter; this component only arranges and scales its leaves. */
window.createBookReader = function createBookReader({ holder, painter, assets = {}, onAction, onStep }) {
  if (!holder) throw new Error('A holder is required for the book reader.');
  const paint = painter || window.createBookPainter?.(assets);
  if (!paint?.drawLeaf || !paint?.getRegions) throw new Error('The reader requires a book painter.');
  const WIDTH = 600, HEIGHT = 780, EXPORT_WIDTH = 900, CACHE_LIMIT = 4;
  const copy = window.BOOK_CONTENT, cache = new Map(), near = new Set();
  let pages = [], current = -1, active = true, observer = null, scrollFrame = 0, idleWork = 0, idleKind = '';
  let adjusting = false, adjustmentFrame = 0;
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  holder.classList.add('reader-root');
  holder.setAttribute('aria-label', 'Свадебная книга, все страницы');
  const viewport = el('div', 'reader-viewport'), scene = el('div', 'reader-pages');
  viewport.setAttribute('aria-label', 'Страницы книги');
  viewport.append(scene);
  holder.replaceChildren(viewport);
  const visible = () => active && holder.getClientRects().length > 0;
  const boundedStep = value => Math.min(13, Math.max(0, Math.round(Number(value) || 0)));
  const spreadForStep = step => step === 0 ? 0 : step === 13 ? 7 : Math.ceil(step / 2);
  const sideForStep = step => step === 0 ? 'R' : step === 13 ? 'L' : step % 2 ? 'L' : 'R';

  function paragraphIndices(step) {
    switch (step) {
      case 1: return [0, 1];
      case 2: return [2, 3, 4];
      case 3: return [0];
      case 4: return [1, 2, 3];
      case 6: return [0, 1, 2, 3];
      case 7: return [0, 1];
      case 8: return [2, 3, 4];
      case 10: return [0, 1, 2];
      case 12: return [0, 1];
      default: return [];
    }
  }

  function makePage(step) {
    const index = spreadForStep(step), side = sideForStep(step);
    const leaf = el('article', 'reader-leaf' + (step === 0 || step === 13 ? ' reader-cover' : ''));
    leaf.dataset.readerStep = String(step);
    leaf.dataset.readerSpread = String(index);
    leaf.setAttribute('aria-label', copy[index].label + (index > 0 && index < 7 ? '. Страница ' + step : ''));
    const visual = el('div', 'reader-page-image');
    visual.setAttribute('aria-hidden', 'true');
    const text = el('section', 'reader-accessible-text');
    text.setAttribute('aria-label', 'Текст страницы');
    text.append(el(step === 0 ? 'h1' : 'h2', '', copy[index].title));
    for (const i of paragraphIndices(step)) {
      if (copy[index].paragraphs[i]) text.append(el('p', '', copy[index].paragraphs[i]));
    }
    if (step === 0) {
      text.append(el('p', '', 'Наша история. Всё начинается с вас.'), el('p', '', 'Фотографии сохраняют день. История возвращает в него.'));
      if (window.PHOTO_INFO?.[4]) text.append(el('p', '', window.PHOTO_INFO[4].alt));
    }
    if (step === 13) text.append(el('p', '', 'Миша и Ксюша'));
    const hotspots = el('div', 'reader-hotspots');
    leaf.append(visual, text, hotspots);
    return { step, index, side, leaf, visual, hotspots, hasRegions: false };
  }

  function updateStep(step) {
    if (current === step) return;
    current = step;
    holder.dataset.readerStep = String(step);
    onStep?.(step);
  }
  function headerBottom() {
    return document.getElementById('book-header')?.getBoundingClientRect().bottom || 64;
  }
  function readingLine() {
    const bottom = headerBottom();
    return Math.min(window.innerHeight - 24, Math.max(24, bottom) + Math.min(120, window.innerHeight * .17));
  }
  function distanceFromView(step) {
    const rect = pages[step].leaf.getBoundingClientRect(), line = readingLine();
    return rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
  }
  function nearestStep() {
    let nearest = current < 0 ? 0 : current, best = Infinity;
    for (const page of pages) {
      const distance = distanceFromView(page.step);
      if (distance < best) { best = distance; nearest = page.step; }
    }
    return nearest;
  }

  function addRegions(page) {
    if (page.hasRegions) return;
    for (const region of paint.getRegions(page.index, page.side)) {
      const action = region.action;
      const sealed = action.type === 'sealed' || (action.type === 'envelope' && action.key !== 'invite');
      const target = el(sealed ? 'div' : 'button', 'reader-hotspot' + (sealed ? ' reader-sealed-envelope' : ''));
      if (sealed) target.setAttribute('role', 'img');
      else {
        target.type = 'button';
        target.dataset.readerAction = action.type;
        if (action.id !== undefined) target.dataset.photoId = String(action.id);
        if (action.key) target.dataset.envelopeKey = action.key;
        target.addEventListener('click', () => onAction?.(action, target));
      }
      const alt = action.type === 'photo' ? window.PHOTO_INFO?.[action.id]?.alt : '';
      target.setAttribute('aria-label', region.label + (alt ? '. ' + alt : ''));
      target.style.left = (region.x / WIDTH * 100) + '%';
      target.style.top = (region.y / HEIGHT * 100) + '%';
      target.style.width = (region.w / WIDTH * 100) + '%';
      target.style.height = (region.h / HEIGHT * 100) + '%';
      target.style.transform = 'rotate(' + (region.angle || 0) + 'rad)';
      page.hotspots.append(target);
    }
    page.hasRegions = true;
  }
  function removeCanvas(step) {
    const canvas = cache.get(step);
    if (!canvas) return;
    canvas.remove();
    canvas.width = 0;
    canvas.height = 0;
    cache.delete(step);
    pages[step].leaf.dataset.rendered = 'false';
  }
  function drawPage(step, keep = null) {
    if (!active) return;
    if (cache.has(step)) return;
    if (cache.size >= CACHE_LIMIT) {
      const candidates = [...cache.keys()].filter(key => key !== step);
      const outside = keep ? candidates.filter(key => !keep.has(key)) : [];
      const discard = (outside.length ? outside : candidates).sort((a, b) => distanceFromView(b) - distanceFromView(a))[0];
      removeCanvas(discard);
    }
    const page = pages[step], canvas = paint.drawLeaf(page.index, page.side, EXPORT_WIDTH);
    canvas.classList.add('reader-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    page.visual.append(canvas);
    cache.set(step, canvas);
    page.leaf.dataset.rendered = 'true';
    addRegions(page);
    holder.dataset.readerCachedPages = String(cache.size);
  }
  function wantedPages() {
    const active = current < 0 ? 0 : current, candidates = new Set([active, ...near]);
    for (const step of [active - 2, active - 1, active + 1, active + 2]) if (step >= 0 && step <= 13) candidates.add(step);
    return [...candidates].sort((a, b) => a === active ? -1 : b === active ? 1 : distanceFromView(a) - distanceFromView(b)).slice(0, CACHE_LIMIT);
  }
  function cancelPrefetch() {
    if (!idleWork) return;
    if (idleKind === 'idle') window.cancelIdleCallback(idleWork);
    else window.clearTimeout(idleWork);
    idleWork = 0;
  }
  function prefetch() {
    idleWork = 0;
    if (!visible() || !pages.length) return;
    const wanted = wantedPages(), missing = wanted.find(step => !cache.has(step));
    if (missing === undefined) return;
    drawPage(missing, new Set(wanted));
    schedulePrefetch();
  }
  function schedulePrefetch() {
    if (idleWork || !visible()) return;
    if (typeof window.requestIdleCallback === 'function') {
      idleKind = 'idle';
      idleWork = window.requestIdleCallback(prefetch, { timeout: 180 });
    } else {
      idleKind = 'timeout';
      idleWork = window.setTimeout(prefetch, 24);
    }
  }
  function scheduleScrollRead() {
    if (adjusting || scrollFrame || !visible() || !pages.length) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      if (adjusting || !visible()) return;
      updateStep(nearestStep());
      if (!cache.has(current)) drawPage(current);
      schedulePrefetch();
    });
  }
  function ensurePages() {
    if (pages.length) return;
    pages = Array.from({ length: 14 }, (_, step) => makePage(step));
    scene.append(...pages.map(page => page.leaf));
    // Layout metadata comes from the same painter. These temporary canvases retain no pixels.
    // All controls are therefore keyboard/screen-reader accessible before visual lazy loading.
    for (const page of pages) {
      const metadataCanvas = paint.drawLeaf(page.index, page.side, 1);
      addRegions(page);
      metadataCanvas.width = 0;
      metadataCanvas.height = 0;
    }
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const step = Number(entry.target.dataset.readerStep);
          if (entry.isIntersecting) near.add(step); else near.delete(step);
        }
        scheduleScrollRead();
      }, { rootMargin: '100% 0px', threshold: 0 });
      for (const page of pages) observer.observe(page.leaf);
    }
  }

  function captureAnchor() {
    if (!pages.length || !visible()) return null;
    const step = nearestStep(), rect = pages[step].leaf.getBoundingClientRect(), screenY = readingLine();
    return { step, screenY, fraction: rect.height ? Math.max(0, Math.min(1, (screenY - rect.top) / rect.height)) : 0 };
  }
  function restoreAnchor(anchor) {
    if (!anchor || !visible()) return;
    if (adjustmentFrame) window.cancelAnimationFrame(adjustmentFrame);
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    adjusting = true;
    const restore = () => {
      // Only the document scrolls vertically. Avoid scrollIntoView moving nested containers.
      viewport.scrollTop = 0;
      const rect = pages[anchor.step].leaf.getBoundingClientRect();
      const target = window.scrollY + rect.top + anchor.fraction * rect.height - anchor.screenY;
      window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
    };
    restore();
    updateStep(anchor.step);
    // One settling frame accounts for focus/scrollbar reflow; this is not an animation loop.
    adjustmentFrame = window.requestAnimationFrame(() => {
      adjustmentFrame = 0;
      if (visible()) restore();
      adjusting = false;
      scheduleScrollRead();
    });
  }
  function layout(preserve = true) {
    const anchor = preserve ? captureAnchor() : null;
    const headerHeight = document.getElementById('book-header')?.getBoundingClientRect().height || 64;
    holder.style.setProperty('--reader-header-height', headerHeight + 'px');
    const available = viewport.clientWidth || holder.clientWidth || document.documentElement.clientWidth;
    const width = Math.max(1, Math.min(WIDTH, available - 24));
    holder.style.setProperty('--reader-page-width', width + 'px');
    if (anchor) restoreAnchor(anchor);
    schedulePrefetch();
  }
  function scrollToStep(requested = 0) {
    ensurePages();
    const step = boundedStep(requested);
    cancelPrefetch();
    layout(false);
    drawPage(step);
    if (visible()) restoreAnchor({ step, fraction: 0, screenY: headerBottom() + 12 });
    else updateStep(step);
    schedulePrefetch();
    return true;
  }
  function resize() {
    if (!pages.length) return;
    layout(true);
    scheduleScrollRead();
  }
  function setActive(value) {
    active = Boolean(value);
    if (!active) {
      cancelPrefetch();
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (adjustmentFrame) window.cancelAnimationFrame(adjustmentFrame);
      scrollFrame = 0;
      adjustmentFrame = 0;
      adjusting = false;
      observer?.disconnect();
      near.clear();
      for (const step of [...cache.keys()]) removeCanvas(step);
      holder.dataset.readerCachedPages = '0';
    } else {
      if (observer) for (const page of pages) observer.observe(page.leaf);
      if (visible() && current >= 0 && pages.length) drawPage(current);
      scheduleScrollRead();
    }
  }
  window.addEventListener('scroll', scheduleScrollRead, { passive: true });
  viewport.addEventListener('scroll', scheduleScrollRead, { passive: true });
  holder.addEventListener('focusin', event => {
    const leaf = event.target.closest?.('.reader-leaf');
    if (leaf) drawPage(Number(leaf.dataset.readerStep));
  });
  return { render: scrollToStep, scrollToStep, getStep: () => current, busy: () => adjusting, resize, setActive, getCache: () => cache.size };
};

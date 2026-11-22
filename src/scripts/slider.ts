/**
 * Swipeable slider with dots/arrows, used by ImageCarousel (item images) and
 * the mobile shop carousel. Same behaviour as the Projects carousel, but:
 *  - uses data-slider-* attributes (the Projects script grabs every
 *    [data-carousel] on the page, so sharing names would cross-wire them);
 *  - supports nesting (an image slider inside the shop slider): each slider
 *    only controls its *own* track/dots, never a nested one's.
 *
 * Markup: [data-slider] > [data-slider-track] > [data-slider-slide]…, plus
 * optional [data-slider-prev], [data-slider-next], [data-slider-dot],
 * [data-slider-status] (see CarouselControls.astro).
 */

function own<T extends HTMLElement>(root: HTMLElement, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector)).filter((el) => el.closest('[data-slider]') === root);
}

function setup(root: HTMLElement) {
  root.dataset.sliderReady = '';
  const [track] = own(root, '[data-slider-track]');
  const slides = own(root, '[data-slider-slide]');
  const [prev] = own<HTMLButtonElement>(root, '[data-slider-prev]');
  const [next] = own<HTMLButtonElement>(root, '[data-slider-next]');
  const dots = own<HTMLButtonElement>(root, '[data-slider-dot]');
  const [status] = own(root, '[data-slider-status]');
  const label = root.dataset.sliderLabel ?? 'Slide';
  if (!track || slides.length < 2) return;

  let current = 0;
  // Only announce changes the visitor asked for via the controls.
  let announce = false;

  // The track is position:relative, so slide.offsetLeft is measured from it.
  const goTo = (index: number, smooth = true) => {
    const target = slides[Math.max(0, Math.min(index, slides.length - 1))];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: target.offsetLeft, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  };

  const nearest = () => {
    let best = 0;
    let bestDistance = Infinity;
    slides.forEach((slide, i) => {
      const distance = Math.abs(slide.offsetLeft - track.scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  };

  const update = () => {
    const index = nearest();
    if (index === current) return;
    current = index;
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === slides.length - 1;
    dots.forEach((dot, i) =>
      i === current ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current'),
    );
    if (announce && status) {
      const title = slides[current].dataset.title;
      status.textContent = `${label} ${current + 1} of ${slides.length}${title ? `: ${title}` : ''}`;
      announce = false;
    }
  };

  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  });

  const step = (delta: number) => {
    announce = true;
    goTo(current + delta);
  };

  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  dots.forEach((dot, i) =>
    dot.addEventListener('click', () => {
      announce = true;
      goTo(i);
    }),
  );

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    // The innermost slider handles the key; don't let an outer one also move.
    event.stopPropagation();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });

  // Keep the current slide aligned after rotation / resize.
  window.addEventListener('resize', () => goTo(current, false));
}

export function initSliders() {
  document.querySelectorAll<HTMLElement>('[data-slider]:not([data-slider-ready])').forEach(setup);
}

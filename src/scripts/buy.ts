/**
 * Buy buttons for merch and tickets. Each Buy click runs a fresh, usually
 * invisible, Cloudflare Turnstile check, then asks the server for a Stripe
 * Checkout URL and redirects.
 *
 * Markup:
 *   <button data-buy data-sitekey="…" data-payload='{"slug":"tee"}'
 *           data-qty-input="qty-id" data-error="error-id">Buy</button>
 *   <div data-turnstile></div>   (one per page; stays empty unless a challenge is needed)
 *
 * Also wires quantity steppers:
 *   <div data-qty><button data-qty-dec/> <input data-qty-value min max/> <button data-qty-inc/></div>
 */

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(el: HTMLElement): void;
  reset(widgetId: string): void;
}
const getTurnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile;

function waitForTurnstile(timeoutMs = 10_000): Promise<Turnstile> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const ts = getTurnstile();
      if (ts) return resolve(ts);
      if (Date.now() - started > timeoutMs) return reject(new Error('Turnstile failed to load'));
      setTimeout(tick, 100);
    };
    tick();
  });
}

// Tokens are single-use, so each click runs a fresh check on one shared widget.
let widgetId: string | undefined;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

async function getTurnstileToken(sitekey: string, container: HTMLElement): Promise<string> {
  const ts = await waitForTurnstile();
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    if (!widgetId) {
      widgetId = ts.render(container, {
        sitekey,
        action: 'checkout',
        appearance: 'interaction-only',
        execution: 'execute',
        callback: (token: string) => pending?.resolve(token),
        'error-callback': () => pending?.reject(new Error('Turnstile error')),
        'expired-callback': () => pending?.reject(new Error('Turnstile expired')),
      });
    } else {
      ts.reset(widgetId);
    }
    ts.execute(container);
  });
}

const DEFAULT_ERROR = 'Something went wrong — please try again.';
let busy = false; // one checkout at a time per page

function setupBuyButton(button: HTMLButtonElement) {
  const label = button.textContent?.trim() || 'Buy';
  const errorEl = button.dataset.error ? document.getElementById(button.dataset.error) : null;
  const qtyInput = button.dataset.qtyInput
    ? (document.getElementById(button.dataset.qtyInput) as HTMLInputElement | null)
    : null;
  const container = document.querySelector<HTMLElement>('[data-turnstile]');

  const showError = (message: string) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.removeAttribute('hidden');
  };

  const reset = () => {
    busy = false;
    button.removeAttribute('disabled');
    button.removeAttribute('aria-busy');
    button.textContent = label;
  };

  button.addEventListener('click', async () => {
    if (busy || !container) return;
    busy = true;
    button.setAttribute('disabled', 'true');
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Checking…';
    errorEl?.setAttribute('hidden', 'true');

    try {
      const payload = JSON.parse(button.dataset.payload ?? '{}');
      const qty = qtyInput ? Number(qtyInput.value) : 1;
      const turnstileToken = await getTurnstileToken(button.dataset.sitekey ?? '', container);
      button.textContent = 'Redirecting…';

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, qty, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Gone between page load and click (or sales just closed).
        reset();
        showError(
          data.error === 'Sold out'
            ? 'Sold out — someone just got the last one. Check back shortly in case one is released.'
            : data.error || DEFAULT_ERROR,
        );
        return;
      }
      if (!res.ok || !data.url) {
        reset();
        // 503 = ticket-drop rush: nothing was reserved, safe to click again.
        showError(res.status === 503 && data.error ? data.error : DEFAULT_ERROR);
        return;
      }
      window.location.href = data.url;
    } catch {
      reset();
      showError(DEFAULT_ERROR);
    }
  });
}

function setupQtyStepper(group: HTMLElement) {
  const input = group.querySelector<HTMLInputElement>('[data-qty-value]');
  const dec = group.querySelector<HTMLButtonElement>('[data-qty-dec]');
  const inc = group.querySelector<HTMLButtonElement>('[data-qty-inc]');
  if (!input) return;
  const min = Number(input.min) || 1;
  const max = Number(input.max) || 1;

  const set = (value: number) => {
    const clamped = Math.max(min, Math.min(max, Math.round(value) || min));
    input.value = String(clamped);
    if (dec) dec.disabled = clamped <= min;
    if (inc) inc.disabled = clamped >= max;
  };

  dec?.addEventListener('click', () => set(Number(input.value) - 1));
  inc?.addEventListener('click', () => set(Number(input.value) + 1));
  input.addEventListener('change', () => set(Number(input.value)));
  set(Number(input.value));
}

export function initBuyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-buy]:not([data-buy-ready])').forEach((b) => {
    b.dataset.buyReady = '';
    setupBuyButton(b);
  });
  document.querySelectorAll<HTMLElement>('[data-qty]:not([data-qty-ready])').forEach((g) => {
    g.dataset.qtyReady = '';
    setupQtyStepper(g);
  });
}

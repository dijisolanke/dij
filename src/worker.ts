import { handle } from '@astrojs/cloudflare/handler';

/**
 * Custom Worker entry: Astro handles every web request as before (`fetch`),
 * and the Cron Trigger in wrangler.jsonc calls `scheduled`, which runs the
 * stale-reservation cleanup by sending an internal request straight into
 * Astro's handler (no network hop, no public exposure without the secret).
 */
interface CronEnv {
  CRON_SECRET?: string;
}
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  fetch: handle,

  async scheduled(_controller: unknown, env: CronEnv, ctx: Ctx) {
    const request = new Request('https://cron.internal/api/cron/release-stale', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    });
    ctx.waitUntil(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handle(request, env as any, ctx as any).then(async (res) => {
        if (!res.ok) console.error('Scheduled cleanup failed', res.status, await res.text());
      }),
    );
  },
};

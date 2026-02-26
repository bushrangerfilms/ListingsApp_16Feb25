/**
 * Lightweight error reporting to Sentry via HTTP Envelope API.
 * Zero SDK dependencies. Works on any Deno version.
 *
 * Usage in edge functions:
 *   import { reportToSentry } from '../_shared/sentry-report.ts';
 *   // In catch blocks:
 *   await reportToSentry(error, { functionName: 'my-function', extra: { listingId } });
 */

const SENTRY_DSN = Deno.env.get('SENTRY_DSN_LISTINGS') || Deno.env.get('SENTRY_DSN') || '';

function parseDsn(dsn: string) {
  const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return null;
  return { publicKey: match[1], host: match[2], projectId: match[3] };
}

export async function reportToSentry(
  error: unknown,
  context: { functionName: string; extra?: Record<string, unknown> },
): Promise<void> {
  const parsed = parseDsn(SENTRY_DSN);
  if (!parsed) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replace(/-/g, '');

  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    server_name: `edge-function:${context.functionName}`,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') || 'production',
    tags: {
      runtime: 'deno-edge',
      function_name: context.functionName,
    },
    exception: {
      values: [{
        type: err.name,
        value: err.message,
        stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
      }],
    },
    extra: context.extra || {},
  };

  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    dsn: SENTRY_DSN,
    sent_at: new Date().toISOString(),
  });
  const eventJson = JSON.stringify(event);
  const itemHeader = JSON.stringify({ type: 'event', length: eventJson.length });
  const envelope = `${envelopeHeader}\n${itemHeader}\n${eventJson}`;

  const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  try {
    await fetch(url, {
      method: 'POST',
      body: envelope,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    });
  } catch {
    // Never let Sentry failures break edge functions
  }
}

function parseStack(stack: string) {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return { function: match[1], filename: match[2], lineno: +match[3], colno: +match[4] };
      }
      const match2 = line.match(/at\s+(.+?):(\d+):(\d+)/);
      if (match2) {
        return { filename: match2[1], lineno: +match2[2], colno: +match2[3] };
      }
      return { filename: line.trim() };
    })
    .reverse();
}

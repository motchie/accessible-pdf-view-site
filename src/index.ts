/**
 * accessiblepdfview.org.
 *
 * A content site, served from `public/` by Workers Static Assets. The Worker
 * exists for two things the asset server does not do on its own, and for
 * nothing else — every request that is not one of these is handed straight to
 * `env.ASSETS`.
 *
 * **1. Response headers.** This site's whole subject is a tool that promises to
 * process documents locally and send nothing anywhere. A site making that claim
 * over an unrestricted CSP is not one a careful reader should believe, so the
 * policy is stated and is enforceable: one script, self-hosted, no frames, no
 * external loads of any kind.
 *
 * That one script (`theme.js`) exists for a tri-state light/dark/system
 * toggle — see its own header comment for why binary toggles are the wrong
 * shape. It touches only `localStorage` and a `data-theme` attribute; nothing
 * it does reaches the network, so `connect-src` is not opened for it. This is
 * the one exception to "the site is HTML and CSS" the project has made, and
 * it is made deliberately narrow: `script-src 'self'` admits this file and
 * nothing else — not an inline script, not a CDN, not a font loader.
 *
 * There is deliberately **no language redirect.** English is at `/`, Japanese
 * at `/ja/`, each links to the other, and neither is chosen for the reader from
 * their `Accept-Language`. Guessing sends people somewhere they did not ask to
 * be, makes a bookmarked URL mean different things on different machines, and
 * is worst for exactly the readers this project is for: someone navigating by
 * screen reader who lands on an unexpected language hears an unexpected voice
 * with no obvious explanation.
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/**
 * No scripts, no frames, no external loads of any kind. `default-src 'none'`
 * with only what the pages actually use added back: their own stylesheet and
 * their own images.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  // The one script this site ships, and nothing else — no inline script, no
  // CDN, no `'unsafe-inline'`. See the file header above for what it is.
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  ['content-security-policy', CONTENT_SECURITY_POLICY],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'no-referrer'],
  // Opt out of the whole permissions surface. The site uses none of it, and
  // saying so is cheaper than being asked to prove it.
  ['permissions-policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()'],
  ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Assets answer GET and HEAD; anything else is not a request this site has
    // a meaning for. Saying so directly beats letting it fall through.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  },
};

/**
 * Adds the headers without disturbing what the asset server decided — its
 * status, its `content-type`, its `etag` and its caching are all left alone.
 */
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of SECURITY_HEADERS) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

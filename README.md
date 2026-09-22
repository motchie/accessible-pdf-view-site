# accessiblepdfview.org

The website for [Accessible PDF View](https://github.com/motchie/accessible-pdf-view),
a browser extension that rebuilds PDFs as accessible, structured HTML. Separate
repository on purpose: the two share a licence and a subject and nothing else,
and a Worker has no business being type-checked against the extension's DOM
libraries.

Static HTML and CSS served by Workers Static Assets. No build step, no
framework — the Content-Security-Policy the Worker sends admits exactly one
script, `theme.js` (a tri-state light/dark/system toggle, `localStorage` only,
nothing over the network), and nothing else. That is a deliberate, narrow
exception to "the site sends nothing anywhere" — see the CSP note below for
how to verify it stays that way.

## Layout

    public/index.html          English
    public/ja/index.html       日本語
    public/privacy/            English
    public/ja/privacy/         日本語
    public/theme.js            the one script — see its own header comment
    public/404.html
    src/index.ts               response headers

English is at `/`, Japanese at `/ja/`, and each links to the other. There is
no `Accept-Language` redirect, on purpose: guessing sends people somewhere
they did not ask to be, makes a bookmarked URL mean different things on
different machines, and is worst for a screen reader user who lands on an
unexpected language and hears an unexpected voice with no explanation.

## Working on it

    pnpm install
    pnpm dev        # wrangler dev, http://localhost:8787
    pnpm compile    # tsc --noEmit

## Checking accessibility

    python3 -m http.server 8899 --directory public   # or `pnpm dev`, port 8787
    A11Y_BASE_URL=http://127.0.0.1:8899 pnpm a11y  # defaults to :8899

`a11y-check.mjs` runs axe-core in a real Chromium (not jsdom — axe-core's
colour-contrast rule needs real layout, which jsdom does not have), against
every page in all three themes, plus two things axe-core cannot check by
itself: that the theme toggle actually responds to arrow keys and survives a
reload, and that the `forced-colors` CSS is reached at all rather than being
dead code nobody's browser ever triggers.

A clean run is not a certificate. Automated tools catch roughly a third to
a half of WCAG failures by Deque's own account — what they are good at is
structural and contrast defects, not whether alt text is any good, whether the
reading order makes sense, or whether a screen reader actually makes sense of
the page. Those still want a human pass.

## Deploying

    pnpm deploy     # wrangler deploy

Needs, once, in the Cloudflare dashboard or via Wrangler:

- a Cloudflare account with `accessiblepdfview.org` as a zone,
- a custom domain route for the Worker on `accessiblepdfview.org`.

## Checking the headers after a deploy

    curl -sI https://accessiblepdfview.org/ | grep -i \
      -e content-security-policy -e strict-transport -e x-content-type

The CSP should still name `default-src 'none'`, and now also
`script-src 'self'` — exactly one first-party file, `theme.js`, and no
`'unsafe-inline'`. That is the whole surface: if this line ever grows to admit
a second script or a third-party host, that is a decision worth writing down
here with the same care this one got, because "the site that says it sends
nothing anywhere" is exactly the site people are entitled to check.

# Local bandwidth measurement

Measured 2026-10-09T12:52:45.135Z. Bootstrap: 162 PRs; refresh corpus: 185 PRs. The refresh corpus is a saved public API response from the earlier live-site measurement.

The actual new server handler returned HTTP 304 and a zero-byte body for unchanged data. No network load test or deployment was performed. Compression is applied locally with the same settings before and after.

## Gzip

| Scenario | Before | After | Saved | Bandwidth credits per 10,000, before → after |
| --- | ---: | ---: | ---: | ---: |
| First visit, bootstrap already current | 727.0 KB | 209.2 KB | 71.2% | 145.4 → 41.8 |
| First visit, newer research available | 734.2 KB | 321.9 KB | 56.2% | 146.8 → 64.4 |
| First visit, newer research + 3 typical descriptions | 734.2 KB | 328.5 KB | 55.3% | 146.8 → 65.7 |
| Returning visit, unchanged data | 313.2 KB | 0.0 KB | 100.0% | 62.6 → 0.0 |
| Refresh with changed data | 313.2 KB | 112.7 KB | 64.0% | 62.6 → 22.5 |

Compact snapshot: 104.9 KB; compact refresh: 112.7 KB; median full PR description: 2.2 KB.

## Brotli (quality 4)

| Scenario | Before | After | Saved | Bandwidth credits per 10,000, before → after |
| --- | ---: | ---: | ---: | ---: |
| First visit, bootstrap already current | 630.9 KB | 195.4 KB | 69.0% | 126.2 → 39.1 |
| First visit, newer research available | 646.3 KB | 292.9 KB | 54.7% | 129.3 → 58.6 |
| First visit, newer research + 3 typical descriptions | 646.3 KB | 299.5 KB | 53.7% | 129.3 → 59.9 |
| Returning visit, unchanged data | 274.7 KB | 0.0 KB | 100.0% | 54.9 → 0.0 |
| Refresh with changed data | 274.7 KB | 97.5 KB | 64.5% | 54.9 → 19.5 |

Compact snapshot: 89.5 KB; compact refresh: 97.5 KB; median full PR description: 2.2 KB.

## Scope of the estimate

Uses [Netlify’s rate of 20 credits per GB](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), with decimal GB. These are bandwidth estimates, not total billing credits. Request and compute charges are separate. An unchanged check still makes one request and sends response headers.

Initial JS/CSS are included using the current production build on both sides; this isolates the data-loading change. HTML, external fonts, Netlify-injected content, source images, lazy Markdown/KaTeX assets and HTTP headers are excluded. The description scenario adds three median description responses, not the one-time Markdown renderer/font download. Content-hashed assets now have an immutable browser cache.

Netlify compression settings, browser caches, how many descriptions users open, refresh frequency and changes in upstream data affect the actual result. The earlier 1.39 GB bill cannot be retroactively attributed from these measurements. Re-run after the build with `npm run measure:bandwidth`; optionally pass a saved full response path after `--`.

## Additional live check

A later local refresh at 2026-10-09T13:07:11Z loaded 195 upstream PRs. On-demand JSON export retained all full descriptions and README text. The local GitHub collector also encountered anonymous API rate limits on some fork requests; those coverage warnings remained visible.

That refresh also exposed a separate parser compatibility issue: the upstream [maintainer record](https://github.com/CrocSwap/integer-mult-bounds/blob/main/certificates/selected-result.json) had changed from a single-PR selection to `source_prs` and a combined construction. The subsequent local update supports both formats, keeps the combined κ as one event, and retains all source PRs, separate contribution roles and immutable evidence links. Individual PR badges still require an explicit matching reviewed head and κ. The bandwidth measurements above cover the earlier saved corpus; they are not a new measurement of the combined-result update.

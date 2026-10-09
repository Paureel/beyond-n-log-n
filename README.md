# Beyond n log n

An interactive research dashboard for [CrocSwap/integer-mult-bounds](https://github.com/CrocSwap/integer-mult-bounds). Built with React, TypeScript and Vite, with a Netlify Function for live GitHub updates. Published at [beyond-n-log-n.netlify.app](https://beyond-n-log-n.netlify.app).

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server runs the same `/api/research` handler used on Netlify. A real bundled GitHub snapshot appears immediately and remains available during API outages. Optional local token configuration:

```sh
GITHUB_TOKEN=your_read_only_token npm run dev
```

You can also keep the token in `.env` and start Vite using `node --env-file=.env node_modules/vite/bin/vite.js --host 127.0.0.1`. Never commit `.env`. The token must never use a `VITE_` prefix, which would expose it to browsers.

## Explore

- **Timeline:** defaults to upstream selections: the original OpenAI result, earlier first-parent main-branch README checkpoints from the first commit, then the commit history of `certificates/selected-result.json`. The headline uses the current maintainer selection. **PR claims** adds submitted bounds as points, without changing the selection line. Commit publication dates and PR opening dates, log/linear scales, source inspection and playback from the original result. Drag the separate start/end handles beneath the graph to choose a time window; κ automatically fits the points in that window. Zoom both axes with the +/− controls, hold Ctrl/⌘ and scroll at the area of interest, or pinch; drag to pan and use the fit control to reset. With the graph focused, +/− zoom, arrow keys pan, and Home resets. The recent-history preset shows the latest 12 points. Only OpenAI and the current leader have persistent name labels. Filters are linked to the contribution table. Lower-only claims and draft claims are visibly marked.
- **Idea lineage:** branching PR timelines with GitHub-user lanes, direct connections or full ancestry, user-to-user reuse summaries, source excerpts, keyboard inspection, zoom and fork scope. Explicit reuse language is distinguished from comparisons and credit lists. It recomputes automatically from every successful data refresh.
- **Field map:** mathematical fields connected by phrase-based approach co-mentions. Select or keyboard-activate a node to filter contributions. Zoom, pan and reset the graph.
- **Contributions:** all upstream PR states, optional fork-local PRs, contributor/field/state filters, search, sorting and full source descriptions. Every extracted bound and method includes its source phrase.
- **Forks:** direct and descendant public forks, upstream contributions, fork-local PRs and default-branch README claims. Research branches are linked from PR details.
- **Sources & scope:** methodology, refresh status, partial-coverage warnings and JSON export.

The footer links to [Paureel](https://github.com/Paureel). To change it, set `VITE_FOOTER_REPO` before building.

## Deploy updates to Netlify

This checkout is linked to the `beyond-n-log-n` project in the `aurel-prosz` Netlify team. After signing in with the official Netlify CLI:

```sh
npm test
npm run build
npx netlify-cli deploy --prod --no-build --site beyond-n-log-n --dir dist --functions netlify/functions --skip-functions-cache
```

To set up continuous deployment from Git instead:

1. Add this project to your own Git repository and connect it to Netlify.
2. Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`, function directory `netlify/functions`, Node 22.
3. Optionally set **`GITHUB_TOKEN`** in Netlify's environment variables, available to **Functions**. A token restricted to read-only public repository access is sufficient. Do not put it in `netlify.toml`, browser configuration or a `VITE_` variable. Redeploy after setting it.
4. Deploy through Netlify. `/api/research` is handled by the serverless function; no browser token, GitHub OAuth or separate database is needed.

Netlify Blobs automatically stores the last successful public research record. It contains public GitHub data only. If shared storage is unavailable, the function continues with its in-memory cache and bundled snapshot.

### Automatic updates

The dashboard requests fresh data on page load, when returning to the tab, and every 15 minutes while visible. A successful Netlify response is cached for 15 minutes in its durable CDN cache. A shared last-good record handles cold starts. A single in-flight collection is reused for concurrent requests. Refresh failures back off for five minutes and keep the previous data, visibly marked as a snapshot.

Upstream PRs, the maintainer selection and its commit history, first-parent main-branch README history and public fork discovery refresh every 15 minutes. First-parent main-branch README snapshots and the pinned OpenAI manuscript are collected once per immutable commit and reused on later refreshes. Fork-local PRs and fork READMEs refresh every 15 minutes with a token, or hourly without a token. These update without site rebuilds. Opening the site after an inactive period starts a refresh; this is request-driven, not a background scheduler.

A token is strongly recommended: [GitHub allows 60 unauthenticated REST requests per hour versus typically 5,000 authenticated requests](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). This dashboard reads multiple repositories; shared hosting and additional cold starts can exhaust the anonymous allowance. The token stays server-side. [Netlify environment-variable documentation](https://docs.netlify.com/build/functions/environment-variables/) explains the Functions scope.

### Refresh the bundled snapshot

```sh
npm run sync
```

Use `GITHUB_TOKEN=your_read_only_token npm run sync` if necessary. It reads all paginated upstream PRs, forks, descendant forks, fork-local PRs and default-branch READMEs. A failed collection does not overwrite the existing snapshot. The snapshot is not a substitute for the live Netlify endpoint.

## Research interpretation

κ is the conditional asymptotic saving in `O(n (log n)^(1−κ))`; higher is better. It is not a runtime benchmark. The headline and selection line follow the maintainer’s [selected-result.json](https://github.com/CrocSwap/integer-mult-bounds/blob/main/certificates/selected-result.json) on the upstream default branch. PR claims, including drafts, cannot become the selected result merely by stating a larger number. Tests, certificates and successful manuscript builds do not prove the full multiplication theorem.

- The current maintainer record is read at its latest publication on the upstream default branch. Merged branch commits are mapped to their first actual main-branch publication; multiple branch changes merged together yield the file state at integration, not invented intermediate selections. Its exact κ, source PR, reviewed head, scope, review and validation receipt are retained. Its history is pinned to immutable commits and cached. A newer selection replaces the old one even if κ decreases; withdrawal or deletion clears the current headline. API failures preserve the last successful snapshot and show staleness. Earlier README checkpoints show upstream-published bounds, not per-PR review receipts.
- A PR is tagged **Reviewed** only if its repository, number, current head and claimed κ match the current maintainer selection. A changed head does not inherit that tag. PR closure and maintainer withdrawal are separate events.
- Equalities in current PR headlines are preferred, then explicit κ equalities in descriptions. Fractions, scientific notation, dyadic expressions, Unicode superscripts and common TeX fractions are parsed without `eval`.
- Component savings and scoped ceilings are not intentionally plotted. Work explicitly claiming no new exponent remains in the table and map but has no new timeline point.
- The original OpenAI result and repository checkpoints use **commit publication timestamps** and **immutable source text**. OpenAI’s manuscript date (23 September 2026) is shown separately from its GitHub publication (6 October 2026). The first repository checkpoint is 7 October 2026 at 02:22 UTC.
- PRs use **opening times** and **current** titles and bodies. Edited PR claims are not a historical reconstruction of the date of discovery. Earlier witnesses bundled in one commit are not assigned invented individual dates.
- Idea-lineage arrows require explicit reuse, composition, inheritance or dependency language around a resolvable PR reference. Similar methods and general credit lists do not establish reuse. Later references in edited descriptions are shown separately and are excluded from ancestry. Quoted evidence is normalized only for Markdown and whitespace. The graph preserves PR opening order with uniform spacing; it does not claim a date of discovery or establish priority. Bare references in fork-local PRs resolve within that fork.
- Field tags are transparent phrase rules over descriptions, including inherited approaches. Edges indicate co-mentions, not proved composability. PR references may be dependencies, attribution or comparisons.
- Default-branch README claims can be inherited from upstream. Fork cards summarize that fork's upstream PR claims; fork-local PRs are separately available.
- Deleted/private/inaccessible repositories cannot be collected. Coverage and partial failures appear under Sources & scope.
- New notation or unrecognized claims may remain unparsed until `lib/research.mjs` is extended. The source description is always available, and the absence of a parsed κ does not mean a PR has no scientific contribution.

## Security

Only public GitHub research is returned by the API. The collector rejects private root repositories and excludes private or internal forks, even if a server-side token could read them. Unexpected server errors are replaced with public messages.

PR descriptions are treated as untrusted input: raw HTML is disabled, unsafe link protocols are filtered, and KaTeX uses `trust: false` with size and expansion limits. All KaTeX dependency paths use a patched release. Markdown images suppress referrers. A Content Security Policy restricts scripts to this origin, disables plugin content and form submissions, and prevents framing. Google Fonts and GitHub-hosted images are the permitted external content sources; Netlify may also display its hosting badge.

Credentials, environment files, local Netlify state, build output and tooling caches are excluded from Git. `.env.example` contains empty or public configuration only. The production frontend has no source maps. Run `npm audit` when updating dependencies.

## Validate

```sh
npm test
npm run build
```

Tests independently check important real-corpus exponents, Unicode/TeX parsing, non-improvement exclusions, formal-tool tagging, multi-parent idea reuse, comparison/credit exclusions, fork reference identity, chronological ancestry, pagination, descendant forks, fork-local PRs, refresh deduplication, persistent caching, outage fallback, maintainer-only selection, reductions/withdrawals and exact-head review attribution. The production build is written to `dist`.

Key files: `src/App.tsx`, `src/Timeline.tsx`, `src/FieldMap.tsx`, `lib/research.mjs` (classification/extraction), `lib/github.mjs` (collection), `lib/service.mjs` (cache and fallback), and `netlify/functions/research.mjs` (Netlify adapter).

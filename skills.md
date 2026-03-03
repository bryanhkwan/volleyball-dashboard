# Skills (Claude) — volleyball-dashboard

This repo is a single-file, GitHub-Pages-friendly NCAA Women's Volleyball scouting dashboard. The entire app lives in `index.html` (HTML + CSS + JS), with live data pulled from Google Sheets and all scoring/valuation computed client-side.

## How to work in this repo
- Keep it framework-free: **pure HTML/CSS/JS**, no build step.
- Prefer small, surgical edits; avoid large refactors unless requested.
- Don't add new dependencies unless absolutely necessary; if you must, use CDN scripts/styles that work on GitHub Pages.
- The code is minified/dense — read existing functions before modifying them.

## Local workflow
- Open `index.html` directly in a browser for basic UI work.
- For fetch/XHR quirks, use a simple static server (any of: VS Code Live Server, `python -m http.server`, etc.).

## Data source (Google Sheets)
- One sheet: `Women's Volleyball Data` (or similar — check `fetchSheet` around line 419).
- Data loads via the Google Sheets API `values:batchGet` and is normalized into array-of-arrays then row-objects assigned to `ALL`.
- Key column headers used in the model: `Player`, `Team`, `Pos`, `Sets`, `Kills`, `Atk`, `Atk Err`, `Hit %`, `Assists`, `BH Err`, `Digs`, `Aces`, `Serv Err`, `Total Blk`, `PTS`.
- If adding columns, keep headers stable and update any code that references header names.

## Core concepts (domain)
- **Positions**: OH (Outside Hitter), MB (Middle Blocker), S (Setter), L/DS (Libero/Defensive Specialist), OPP (Opposite Hitter). Normalized by `nP()`.
- **PerfScore** (`scoreP`): weighted composite score from stat normalization (min/max bounds per position, directionality). Stored as `p._score` (0–100).
- **Tier** (`gTier`): Elite (≥82), Starter (≥65), Rotation (≥45), Bench (≥28), Developmental.
- **Valuation** (`gVal`): exponential curve with an optional sets-played multiplier; configurable via `VS` settings.
- **Archetype tags** (`gTags`): labels based on per-position stat thresholds (e.g. "Ironwoman", "Wall", "Maestro", "6-Rotation Star").
- **Stat metrics** (`gm`): per-set rates computed from raw stats (kills/set, hit%, digs/set, etc.).
- **PCT** (percentile cache): built by `bPc(ALL)` — position-specific sorted arrays for percentile lookups.

## Structure map (index.html)
No labeled section comments yet — locate code by function name or approximate line:
- **~L283** `// ENGINE` — position normalizer `nP`, position/color maps, stat info `SI`/`TI`
- **~L322** default weights `DW`, live weights `W`, valuation settings `VS`
- **~L335** `gm`, `gPc`, `bPc`, `scoreP`, `gSP`, `gTier`, `gVal`, `gTags` — scoring + valuation math
- **~L385** `processData` — raw Google Sheets → `ALL` normalization
- **~L411** `calcAll`, `recalc` — recompute all scores/tiers/tags
- **~L416** `API_KEY` — Google Sheets API key (placeholder; user-provided)
- **~L419** `fetchSheet` — Google Sheets data loader
- **~L499** `initD`, `applyF`, `sortD` — state + DOM + filters
- **~L524** `buildTbl`, `renderAll`, `renderStats`, `renderPlayers`, `renderPos`, `renderRost` — table/grid rendering
- **~L554** `openP` — player profile modal
- **~L640** `addR`, `rmR`, `swpR`, `addAll`, `clearR` — roster management
- **~L740** `renderW`, `updWT`, `applyW`, `resetW` — weight editor
- **~L752** `renderVS`, `resetVS` — valuation settings editor
- **~L791** `openCompare` — side-by-side player comparison modal
- **~L857** `// AI CHAT — JARVIS MODE (Gemini)` — Scout AI chatbot

## Guardrails
- Don't change scoring weights or min/max bounds without updating the weight editor UI.
- Don't change stat semantics without updating `SI` (stat info tooltips) and `TI` (archetype tag descriptions).
- Be careful with secrets: `API_KEY` (Google Sheets) and `GEMINI_URL` (Cloudflare Worker proxy) should never be committed with real values — keep them as user-provided inputs or placeholders.
- `GEMINI_URL` proxies requests to Gemini to avoid exposing the Gemini API key client-side.

## When you need clarification
Ask before changing:
- valuation curve parameters (`VS`),
- scoring weights / min-max bounds in `DW`,
- sheet schema (header names, required columns),
- or anything that could invalidate historical comparisons.

---

## AI Chat system — current implementation (Scout AI / Jarvis Mode)

Lives in `// AI CHAT — JARVIS MODE (Gemini)` at ~L857.

### Architecture
- **Gemini function calling** with `AI_TOOLS` array passed in every API call.
- **Dynamic system prompt**: `sysPrompt()` returns `{parts:[{text}]}` with live roster state, sent as `systemInstruction` (separate from `contents`). Uses string concatenation — NOT template literals (HTML JS parser chokes on multi-line template literals with `${...}`).
- **Confirmation flow**: `CONFIRM_ACTIONS` set gates roster mutations behind Yes/No buttons.
- **Dashboard-first enforcement**: `processResp` defers `web_search` until after at least one dashboard tool has run.
- **Dual-source pipeline**: `runValuationComparePipeline` for valuation/news queries.
- **Action tags**: `[ACTION:filter|...]`, `[ACTION:open_player|...]`, `[ACTION:compare|...]`, `[ACTION:switch_tab|...]`, `[ACTION:settings]` still supported for non-roster actions in `execAction`.

### Gemini function calling tools (`AI_TOOLS`)
| Tool | Description |
|---|---|
| `get_dashboard_context` | Returns overall pool stats + current roster summary |
| `get_player_profile(name)` | Returns full stat line + score + tier + tags |
| `search_players(query, position?, maxValue?, sortBy?, limit?)` | Filter/keyword search across `ALL` |
| `get_top_players(position?, tier?, sortBy?, limit?)` | Top N players by criteria |
| `web_search(query)` | Routes through `GEMINI_URL` Cloudflare Worker proxy |
| `compare_players(player1, player2)` | Opens side-by-side compare modal directly |
| `add_players_to_roster(playerNames[], team?, limit?)` | Adds players; auto-expands RSIZE/PBUDGET/TBUDGET if needed |
| `remove_player_from_roster(playerName)` | Removes one player from roster |
| `swap_roster_player(dropPlayer, addPlayer)` | Swaps roster slot with swap validation guard |

### CONFIRM_ACTIONS (roster mutations require Yes/No)
`const CONFIRM_ACTIONS = new Set(['add_players_to_roster','remove_player_from_roster','swap_roster_player'])`

Flow:
1. `processResp` receives function call in `CONFIRM_ACTIONS`
2. **Swap guard**: if `swap_roster_player.addPlayer` not found in `ALL` → inject error + candidates + re-query Gemini
3. Store `pendingAction = {call, modelParts}` → pause conversation
4. Render Yes/No confirm buttons (`addMsg('system', html)`)
5. User clicks Yes/No OR types yes/no → `executeConfirm(bool)` → `window._aiConfirm(bool)`
6. Confirmed → `execCall` → push `modelParts` + `functionResponse` to `chatHist` → `callGemini(null)` → `processResp`

### Per-turn state variables (reset in `doSend`)
- `lastUserText` — current user prompt for orchestration fallback
- `turnHasDashboardLookup` — true after any non-web tool runs
- `turnWebSearchDeferred` — one-shot latch; prevents infinite deferral
- `turnHasWebSearch` — true after `web_search` runs
- `turnForcedWebForValuation` — one-shot latch for forced post-dashboard web pass

### `needsMandatoryWebReview(text)` gate
- **Search/filter guard (checked first)**: `find`/`search`/`show`/`list`/`get`/`recommend`/`suggest` → normal tool path
- **Valuation trigger**: `$`/`worth`/`valuat`/`invest`/`overpay`/`underpay`/`fair`/`steal`/`avoid`/`buy`/`sign`/`price`/`pay`
- **News/status trigger**: `latest`/`recent`/`today`/`news`/`injur`/`transfer`/`portal`/`available`/`rumor`/`status`/`commit`/`nil`/etc.

### `runValuationComparePipeline` — deterministic dual-source pipeline
1. Dashboard pass: inject `get_dashboard_context` → `get_player_profile` (if name found) or `search_players` → `renderDashboardEvidence`
2. Web pass: `buildForcedWebQuery` → `doWebSearch` → inject `web_search` result → `renderWebEvidence`
3. Combined Gemini call with structured verdict format

### Key helpers
- `escapeHtml(s)` — HTML entity escape
- `fmtText(t)` — markdown (`**bold**`) + `\n`→`<br>` + player name hyperlinks to `openP(id)`
- `extractTeamHint(text)` — parses `"from X"` / `"(X)"` team hints from text
- `matchLoadedPlayer(text)` — returns full player row with team disambiguation
- `statLine(r)` — structured volleyball stat summary for a player row

### Maintenance rules
- Do **not** remove the `processResp` web-search deferral guard.
- If new dashboard read tools are added, set `turnHasDashboardLookup=true` when they execute.
- Keep fail-open for web search errors (log, don't dead-end the UI).
- Tool schema names must stay in sync between `AI_TOOLS` declarations, `execCall` dispatcher, and all guard references.
- Any function querying the player pool must use `ALL`, never `FILT`.
- Use string concatenation (not template literals) for all multi-line dynamic strings in `<script>` blocks.

---

## Known bugs to watch for (ported from basketball-dashboard experience)

### Gemini API error: "function call turn must come immediately after a user turn"
**Root cause**: calling `callGemini(userText)` after `pushFnResult` calls appends a second consecutive `user` turn.
**Fix**: push the user message first, then `pushFnResult`, then call `callGemini(null)`.

### Player not found / 0 results in search
**Root cause 1**: passing full user sentence to player name search (e.g. `"Is Jane Smith worth $200k"` never matches a name).
**Fix**: strip the sentence to first 4 meaningful words before passing to `search_players`.

**Root cause 2**: raw `.toLowerCase()` comparison fails on names with periods or suffixes (e.g. `"Jane Smith Jr."` vs `"jane smith jr"`).
**Fix**: use `normalizeName(s)` that strips `.,` and `Jr/Sr/II/III/IV` before comparing.

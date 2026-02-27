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
- **Simple prompt injection** (no Gemini function calling). `buildContext(userMsg)` assembles a large system-prompt string with dashboard state, roster, relevant players, and top-by-position data, then sends it with the conversation history to Gemini via `GEMINI_URL`.
- **Action tag protocol**: Gemini returns `[ACTION:type|params]` tags in its text. `addMsg()` parses these into approve/reject buttons in the chat UI.
- **Conversation history**: `chatHist` array (last 10 turns sent as `contents`).

### Action types currently supported
| Action tag | Effect |
|---|---|
| `[ACTION:add_player\|Name]` | Adds player to `ROST` |
| `[ACTION:remove_player\|Name]` | Removes player from `ROST` |
| `[ACTION:swap\|Out\|In]` | Swaps one roster player for another |
| `[ACTION:add_team\|Team Name]` | Adds entire team within budget |
| `[ACTION:clear_roster]` | Clears `ROST` |
| `[ACTION:set_budget\|Amount]` | Sets `TBUDGET` |
| `[ACTION:set_max_player\|Amount]` | Sets `PBUDGET` |
| `[ACTION:set_roster_size\|N]` | Sets `RSIZE` |
| `[ACTION:filter\|pos=OH,tier=Elite]` | Calls `applyAiFilter` |
| `[ACTION:open_player\|Name]` | Opens player profile modal |
| `[ACTION:compare\|P1\|P2]` | Opens side-by-side comparison |
| `[ACTION:switch_tab\|tabname]` | Switches active tab |

### Context injected per turn (`buildContext`)
1. Role + action system instructions
2. Dashboard state: budget, roster, position counts, team average score, team strength profile
3. Team roster (if user mentions a team name)
4. Relevant players (name-matched from query + top-10 by score)
5. Top 8 players per position (if user mentions a position name)

---

## AI Chat features to develop — porting from basketball-dashboard

These features exist in the basketball-dashboard's skills.md and need to be built into this repo. They add **Gemini function calling** and a **deterministic dual-source pipeline** (dashboard-first, then web search) for valuation and player-status queries.

### 1. Per-turn state variables
Add to the AI CHAT section (reset at top of `sendChat` and on clear):
- `lastUserText` — captures current user prompt for tool-orchestration fallback
- `turnHasDashboardLookup` — true after any non-web tool executes this turn
- `turnWebSearchDeferred` — one-shot latch; prevents infinite deferral loops
- `turnHasWebSearch` — true after any `web_search` executes
- `turnForcedWebForValuation` — one-shot latch; forces one post-dashboard web lookup

### 2. Gemini function calling (tool declarations)
Replace the current simple `contents` send with a Gemini API call that includes a `tools` array. Required tool schemas:
- `get_dashboard_context` — returns overall pool stats + current roster
- `get_player_profile(name)` — returns full stat line + score + tier + tags for a player
- `search_players(query, position?, maxValue?, sortBy?, limit?)` — keyword/filter search across all players
- `get_top_players(position?, tier?, sortBy?, limit?)` — top N players by criteria
- `web_search(query)` — routes through `GEMINI_URL` to a Google Custom Search or SerpAPI endpoint

All dashboard tools must read from `ALL` (all loaded players), not just filtered view.

### 3. `pushFnResult(name, args, result)`
Injects synthetic `functionCall` + `functionResponse` pairs into `chatHistory`. Used to preload dashboard tool outputs before allowing `web_search`.

**History structure rule**: The original user message (with format instructions) must be pushed to `chatHistory` first, before any `pushFnResult` calls. The final Gemini call must use `callGemini(null)` (not appending another user turn) to avoid the "function call turn must come immediately after a user turn" API error.

Valid turn structure:
```
user: text("Is X worth $200k? ...format instructions...")
model: functionCall(get_dashboard_context)
user: functionResponse(get_dashboard_context)
model: functionCall(get_player_profile)
user: functionResponse(get_player_profile)
model: functionCall(web_search)
user: functionResponse(web_search)
← callGemini(null) fires here
```

### 4. `needsMandatoryWebReview(text)` — dual-trigger gate
Returns `true` when web search is required before a final answer.

- **Search/filter guard (checked first)**: if the query contains `find`, `search`, `show`, `list`, `get`, `recommend`, or `suggest`, treat as a player-search request — suppress valuation trigger, go through normal tool path (e.g. `get_top_players`).
- **Valuation trigger** (only when NOT a search request): keywords `$`, `worth`, `valuat`, `invest`, `overpay`, `underpay`, `fair`, `steal`, `avoid`, `buy`, `sign`, `price`, `priced`, `pay`.
- **Current status / news trigger** (always): keywords `latest`, `recent`, `today`, `yesterday`, `this week`, `last week`, `news`, `injur`, `hurt`, `suspend`, `transfer`, `portal`, `available`, `availability`, `out for`, `return`, `rumor`, `report`, `update`, `status`, `commit`, `nil`, `coaching`, `coach`, `minutes`, `role`, `lineup`, `starter`, `starting`.

### 5. `buildForcedWebQuery(text)` — intent-aware query builder
Builds Google search query for forced web passes. Tailors to question type:
- **Valuation + player name match** → `"[name] college volleyball NIL salary contract value 2025"`
- **News/status + player name match** → `"[name] college volleyball latest news injury transfer portal 2025"`
- **Valuation, no name match** → `"[raw query] college volleyball NIL value market 2025"`
- **News, no name match** → `"[raw query] college volleyball latest news 2025"`

Use a `normalizeName(s)` helper (strips `.,` punctuation and `Jr/Sr/II/III/IV` suffixes) for name matching in both this function and `matchLoadedPlayerName`.

### 6. `runValuationComparePipeline(userText)` — deterministic dual-source pipeline
Invoked from `sendChat` **before** the free-form Gemini path. Runs when `needsMandatoryWebReview` is true.

Flow:
1. **Dashboard pass** (only when players are loaded):
   - Inject `get_dashboard_context` → set `turnHasDashboardLookup = true`.
   - If player name found in prompt → inject `get_player_profile`.
   - Otherwise → inject `search_players` results.
   - Render evidence in chat UI (`renderDashboardEvidence`).
2. **Web pass** (always):
   - Call `buildForcedWebQuery` → run `doWebSearch` → inject `web_search` result → set `turnHasWebSearch = true`.
   - Render evidence in chat UI (`renderWebEvidence`).
3. **Combined verdict**: call Gemini with structured format prompt:
   - **Valuation** → `Dashboard evidence / Web evidence / Comparison / Verdict: steal|fair|overpay|avoid`
   - **News/status** → `Dashboard data / Web context / Summary`

Fail-open: any step that throws should log and continue so the chat doesn't dead-end.

### 7. Runtime enforcement in `processResp`
When a `functionCall` arrives during normal Gemini turns:
1. If call is `web_search` AND `!turnHasDashboardLookup` AND `!turnWebSearchDeferred`:
   - Inject `get_dashboard_context` + `get_player_profile`/`search_players`.
   - Re-call Gemini with injected local context (Gemini can then call `web_search` next).
   - Set `turnWebSearchDeferred = true`.
2. After dashboard lookup: if Gemini returns text-only and `needsMandatoryWebReview(lastUserText)` is true and `!turnHasWebSearch` → force one `web_search` pass (`turnForcedWebForValuation` latch).

### 8. Evidence rendering
- `renderDashboardEvidence(playerData)` — renders a collapsed evidence card in chat showing dashboard stats used.
- `renderWebEvidence(webData)` — renders a collapsed evidence card in chat showing web snippet used.

### Maintenance rules (once built)
- Do **not** remove the `processResp` web-search deferral guard unless replaced by equivalent deterministic orchestration.
- If new dashboard read tools are added, set `turnHasDashboardLookup = true` when they execute.
- Keep the fail-open path for web search to preserve UX resilience on tool errors.
- If tool schema names change, update both the `tools` declarations and all guard/injection references.
- Any function querying the player pool must use `ALL` (full loaded set), never a filtered view variable.

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

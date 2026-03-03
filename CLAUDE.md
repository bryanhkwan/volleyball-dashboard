# NCAA Volleyball Dashboard — CLAUDE.md

> **Hierarchical context reduction**: Read top-to-bottom. Stop when you have enough context for your task.

---

## L1 — What Is This? (5 lines)

NCAA Women's Volleyball scouting dashboard. **3 files**: `index.html` (shell), `styles.css`, `app.js` (~1100 lines). No build step, no modules, no npm.
Data from Google Sheets (`Sheet1` tab). Hosted on GitHub Pages.
**Key constraint: pure HTML/CSS/JS — do NOT add a build system, bundler, or npm packages.**
All globals (`ALL`, `ROST`, `FILT`, `RSIZE`, `PBUDGET`, `TBUDGET`, `OPPROST`, `ROST_SUB`, `OPP_SEARCH`, etc.) are declared with `let`/`const` at top of `app.js` — accessible everywhere.
AI chat (Gemini) is backed by a Cloudflare Worker proxy at `GEMINI_URL = 'https://dry-cell-b187.bryanhkwan.workers.dev'`.

---

## L2 — Architecture Map (1 page)

### File layout

| File | Purpose |
|---|---|
| `index.html` | ~65-line HTML shell: topbar, tab panels, modals, chat FAB. Links `styles.css` + `app.js`. |
| `styles.css` | All CSS (~300 lines). Includes H2H, roster sub-tabs, opponent search, chat styles. |
| `app.js` | All JS (~1100 lines). Engine → data → rendering → roster → H2H → AI chat. |

### app.js layout

| Region | Approx line | Purpose |
|---|---|---|
| ENGINE | ~L1 | `nP`, position/color maps, `SI`/`TI` stat info |
| Weights + scoring | ~L40 | `DW`, `W`, `VS`, `gm`, `gPc`, `bPc`, `scoreP`, `gTier`, `gVal`, `gTags` |
| Data loading | ~L100 | `processData`, `calcAll`, `recalc`, `fetchSheet` |
| Rendering | ~L200 | `buildTbl`, `renderAll`, `renderStats`, `renderPlayers` |
| Player profile modal | ~L250 | `openP`, `openCompare` |
| Roster management | ~L375 | `addR`, `rmR`, `swpR`, `addAll`, `clearR`, `addOpp`, `rmOpp`, `clearOpp` |
| H2H | ~L390 | `teamCats`, `rosterCategoryScores`, `getHeadToHead`, `renderH2HSection` |
| Roster rendering | ~L405 | `renderRost`, `updateOppDd`, `setRosterSub` |
| Weight editor | ~L450 | `renderW`, `updWT`, `applyW`, `resetW` |
| AI CHAT | ~L560 | Scout AI (Gemini function calling, 11 tools) |

### Data flow
```
Google Sheets API
  → fetchSheet()                   ~L419
  → processData(rows) → ALL[]      ~L385
  → calcAll() → scoreP/gTier/gVal  ~L411
  → renderAll() → table + roster   ~L524

AI Chat turn
  → sendChat() → doSend()
  → needsMandatoryWebReview?
    YES → runValuationComparePipeline() → processResp()
    NO  → callGemini(null) → processResp()
  → processResp() → execCall() / addMsg()
```

### Global state vars (key ones)
| Var | Purpose |
|---|---|
| `ALL` | All loaded players (never use filtered view in AI tools) |
| `FILT` | Currently visible/filtered players |
| `ROST` | Current roster array |
| `OPPROST` | Opponent roster array |
| `ROST_SUB` | Active roster sub-tab: `'myteam'` \| `'h2h'` \| `'opponent'` |
| `OPP_SEARCH` | Live opponent player search query (persists across re-renders) |
| `RSIZE` | Max roster size |
| `PBUDGET` | Per-player value cap |
| `TBUDGET` | Total team budget cap |
| `W` | Live scoring weights object |
| `VS` | Valuation settings object |

---

## L3 — Feature Reference

### Scoring engine (~L322–L384)
- `nP(pos)` — normalizes raw position string to OH/MB/S/L/DS/OPP
- `gm(r)` — computes per-set rate stats (kills/set, hit%, digs/set, etc.)
- `bPc(arr)` — builds position-specific percentile distribution cache `PCT`
- `scoreP(r)` → `r._score` (0–100 composite PerfScore)
- `gTier(r)` → `r._tier` (Elite/Starter/Rotation/Bench/Developmental)
- `gVal(r)` → `r._val` (dollar valuation via exponential curve)
- `gTags(r)` → `r._tags[]` (archetype labels e.g. "Ironwoman", "Wall", "Maestro")

### Roster management (~L375)
- `addR(id)` — adds player to `ROST` (respects RSIZE/PBUDGET/TBUDGET)
- `rmR(id)` — removes from `ROST` by `_id`
- `swpR(outId, inId)` — swaps roster slot
- `addAll()` — adds all filtered players within budget
- `clearR()` — empties `ROST`
- `addOpp(id)` — adds player to `OPPROST`, clears `OPP_SEARCH`
- `rmOpp(id)` / `clearOpp()` — remove from opponent roster
- `addOpponentTeamByName()` — reads `#oppTeamSearch`, adds all matching team players
- `setRosterSub(tab)` — switches active sub-tab, calls `renderRost()`
- `updateOppDd()` — updates opponent search dropdown in-place (no full re-render)
- All mutators call `renderAll()` after change

### Comparison modal (~L791)
- `openCompare(name1, name2)` — opens side-by-side comparison; `name1`/`name2` are player name strings
- Returns `true` on success (both players found in `ALL`)

### Player profile modal (~L554)
- `openP(id)` — opens modal; `id` is `r.id` (index into `ALL`)
- `openP` also accepts `r` (row object) directly if passed

---

## L4 — AI CHAT Critical Patterns

### Variable declarations (top of AI CHAT section)
```js
let chatHist=[], lastUserText='';
let turnHasDashboardLookup=false, turnWebSearchDeferred=false;
let turnHasWebSearch=false, turnForcedWebForValuation=false;
let pendingAction=null;
const CONFIRM_ACTIONS=new Set(['add_players_to_roster','remove_player_from_roster','swap_roster_player']);
```

### ALL rule
AI chat tools that query players MUST use `ALL` directly.
NEVER use `FILT` — that's only the filtered/visible table rows.

### CONFIRM_ACTIONS flow
1. `processResp` receives function call in `CONFIRM_ACTIONS`
2. Swap guard: if `swap_roster_player` and `addPlayer` not in `ALL` → inject error + candidates → re-query Gemini
3. Store `pendingAction = {call, modelParts}` — **pause conversation**
4. Render Yes/No confirm buttons via `addMsg('system', html)`
5. User clicks button → `window._aiConfirm(bool)` → `executeConfirm(bool)`
6. `executeConfirm(true)` → `execCall(call)` → push `modelParts` + `functionResponse` to `chatHist` → `callGemini(null)` → `processResp`
7. `executeConfirm(false)` → `pendingAction=null` → addMsg('ai', 'Cancelled.')

### pendingAction structure
```js
pendingAction = {
  call: {name, args},           // the function call object
  modelParts: [...]             // full model turn parts (may include text + functionCall)
}
```
Both `modelParts` and the `functionResponse` must be pushed as a single model+user pair to `chatHist`.

### systemInstruction (not in chatHist)
`callGemini` sends `systemInstruction: sysPrompt()` as a **separate** top-level parameter.
`sysPrompt()` returns `{parts:[{text: ...}]}` using string concatenation. Template literals are safe in `app.js` (the hazard only applied to inline `<script>` blocks in HTML).
`chatHist` never contains a system message.

### Dashboard-first enforcement
If Gemini calls `web_search` before any dashboard tool this turn:
1. Inject `get_dashboard_context` + `get_player_profile`/`search_players` synthetically
2. Re-call Gemini — it can then call `web_search` on its own
3. Set `turnWebSearchDeferred=true` (one-shot, prevents infinite loop)

### Tool dispatcher
`execCall(c)` is the single dispatcher for all 9 tools. Never call tool implementations directly from `processResp` — always go through `execCall`.

### fmtText(t)
Renders AI text responses: `**bold**` → `<b>`, `\n` → `<br>`, player names → `<span onclick="openP(id)" class="aiPlayerLink">name</span>`.
Always call `fmtText` before setting `innerHTML` for AI messages.

### matchLoadedPlayer(text)
Returns a full player row (not just a name string). Uses `extractTeamHint(text)` for disambiguation when multiple players share a name. Pass player name strings from AI tool args through this function.

### addPlayersToRoster constraint auto-expansion
When adding players would violate RSIZE/PBUDGET/TBUDGET, `addPlayersToRoster` auto-expands the globals before adding. Returns `{added, failed, rosterSize, adjustments}`.

### Template literals
Template literals with `${expression}` are safe in `app.js`. The old hazard only applied to inline `<script>` blocks inside HTML. Since the code is now in `app.js`, template literals are fine to use everywhere.

---

## L5 — Function Index (AI CHAT section)

### Per-turn state (reset in `doSend`)
`lastUserText`, `turnHasDashboardLookup`, `turnWebSearchDeferred`, `turnHasWebSearch`, `turnForcedWebForValuation`

### Entry points
`sendChat(preset?)` → handles user input, pending confirmation detection
`doSend(msg)` → resets turn state, pushes to chatHist, calls pipeline or Gemini

### Pipeline
`needsMandatoryWebReview(text)` → bool gate
`runValuationComparePipeline(userText)` → deterministic dual-source pipeline
`callGemini(extraText)` → fetch to `GEMINI_URL`, returns raw Gemini response data
`processResp(data)` → void; recursive response processor (function calls + text)

### Tool dispatcher + implementations (11 tools)
`execCall(c)` → dispatcher
`execGetDashboardContext()` — includes `roster` + `opponent` state
`execSearchPlayers(args)`, `execGetPlayerProfile(args)`, `execGetTopPlayers(args)`
`addPlayersToRoster(names, team, limit)`, `removeFromRoster(name)`, `swapPlayer(drop, add)`
`addPlayersToOpponent(names, team, limit)` — immediate, no CONFIRM_ACTIONS gate; sets `ROST_SUB='opponent'`
`getHeadToHead()` — returns per-category comparison data; sets `ROST_SUB='h2h'` on success
`comparePlayers(p1, p2)` → calls `openCompare()` directly
`doWebSearch(query)` → fetch via GEMINI_URL

### Confirmation flow
`executeConfirm(bool)` → executes or cancels `pendingAction`
`window._aiConfirm` = `executeConfirm` (called by confirm button `onclick`)

### Evidence rendering
`renderDashboardEvidence(data)` → system message with collapsed stat card
`renderWebEvidence(data)` → system message with collapsed web snippet card

### Helpers
`escapeHtml(s)`, `fmtText(t)`, `extractTeamHint(text)`, `matchLoadedPlayer(text)`, `statLine(r)`
`sysPrompt()` → `{parts:[{text}]}` dynamic system prompt with live roster state
`addMsg(role, text)` — roles: `'user'`, `'ai'`, `'system'`
`clearChat()` — resets `chatHist`, `pendingAction`, turn state vars
`addAiWelcome()` — initial welcome message

### CSS classes added for AI chat
`.chat-msg.system` — evidence / status messages (italic, muted)
`.aiPlayerLink` — clickable player name links in AI responses
`.aiConfirm`, `.aiConfirmBtn`, `.aiConfirmBtn.yes`, `.aiConfirmBtn.no` — confirmation button row

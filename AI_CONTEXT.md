# AI Handoff Context: Volleyball Analytics Dashboard

**Project start:** May 14, 2026  
**Current status:** v2 in progress, functional upload-based dashboard  
**Tech stack:** Vanilla HTML/CSS/JS + Plotly.js + browser IndexedDB  
**Important:** The app is now intended to be **uploadable / reusable** by coaches. Do not hardcode player stats or depend on a generated `processed_data.json`.

---

## Project Goal

Build a pure client-side analytics dashboard for volleyball coaches that helps answer:

1. Are players improving or declining over time?
2. Do practice stats translate into exhibition/game stats?
3. Which setter-hitter pairings are working best?
4. What should coaches focus on this week to help players improve?

The user wants the app to feel like a coach tool, not a raw stat dump. Prefer clear UI, position-aware comparisons, actionable insights, and drill/practice implications.

---

## Current Product Direction

The original implementation pre-generated `processed_data.json` using `process_data.py`. That is no longer the desired primary workflow.

The current direction is:

- Coaches upload a whole season folder, e.g. `Spring 2026/`.
- The app parses all CSVs in-browser.
- The app auto-classifies files by folder path and filename.
- Parsed data is persisted locally in the browser via IndexedDB.
- Coaches can later use **Manage Data** to upload additional practice/game CSVs.
- The dashboard should merge new sessions into the existing local dataset.

`process_data.py` may remain as a legacy/helper script, but the dashboard should not rely on Python or `processed_data.json`.

---

## How To Run Locally

Do not open `index.html` directly as a `file://` URL. Browser storage/fetch behaviors are more reliable from a local server.

```powershell
cd C:\Users\bryan\projects\volleyball_stats
python -m http.server 8765
```

Then open:

```text
http://localhost:8765/index.html
```

On first load, the app should show an upload screen because there is no data in IndexedDB yet.

---

## Current File Structure

```text
volleyball_stats/
├── index.html
├── styles.css
├── app.js
├── README.md
├── AI_CONTEXT.md
├── process_data.py                  # legacy/helper CLI parser, not dashboard source of truth
├── modules/
│   ├── config.js                    # utility funcs and constants
│   ├── roster.js                    # roster mapping, positions, position groups
│   ├── csv_parser.js                # in-browser CSV parser + stat row normalization
│   ├── uploader.js                  # file classifier, parser orchestrator, dataset builder
│   ├── storage.js                   # IndexedDB wrapper
│   ├── data.js                      # data access layer, loads from IndexedDB
│   ├── analytics.js                 # trends, comparisons, insights, setter chemistry
│   ├── charts.js                    # Plotly charts
│   ├── players.js                   # player view and player detail modal
│   └── setters.js                   # setter analysis view
└── Spring 2026/                     # sample Hudl export folder
    ├── Team Stats/
    ├── Setter Stats/
    └── Exhibitions/
        ├── Team Exhibition/
        └── Setter Exhibition/
```

---

## Upload Workflow

### First Load

If IndexedDB has no dataset:

- `app.js` calls `dataModule.loadData()`.
- `dataModule.hasData()` returns false.
- `renderRoot()` hides the dashboard/nav and shows `#emptyState`.
- User can drag-drop a folder or choose a folder/files.

### Manage Data

Header button: **Manage Data**

The modal lets coaches:

- View current dataset summary.
- Upload more CSVs.
- Clear all local data from IndexedDB.

New uploads are merged into existing sessions. Existing sessions with the same key are replaced.

Session merge key in `uploader.js`:

```js
`${s.type}|${s.category || ''}|${s.date}|${s.opponent || ''}`
```

---

## CSV/File Classification

Implemented in `modules/uploader.js`.

The app accepts either a full folder upload or loose CSV files.

Classification priority:

1. Folder path via `file.webkitRelativePath`
2. Filename pattern fallback

### Folder Path Rules

```text
Team Exhibition      -> team-exhibition
Setter Exhibition    -> setter-exhibition
Team Stats           -> team-practice
Setter Stats         -> setter-practice
```

### Filename Rules

```text
MM.DD Practice.csv                  -> team-practice
MM.DD Practice <Setter>.csv         -> setter-practice
MM.DD Exhibition <Opponent>.csv     -> team-exhibition
MM.DD <Opponent> <Setter>.csv       -> setter-exhibition
```

Setter names are pulled from `ROSTER` where `positionGroup === 'S'`, not hardcoded in the classifier.

### Verified Against Existing Folder

The real `Spring 2026` folder has 123 CSV files:

- 26 team-practice CSVs
- 78 setter-practice CSVs
- 5 team-exhibition CSVs
- 14 setter-exhibition CSVs
- 0 unknowns in classifier smoke test

Some CSVs contain only player names and no stat values; those are skipped as no usable player rows.

---

## CSV Parser

Implemented in `modules/csv_parser.js`.

Responsibilities:

- Parse CSV text, including quoted fields.
- Normalize player names:
  - `"#4 Olivia H."` -> `Olivia H.`
- Drop aggregate/junk rows:
  - `Team A`
  - `Team B`
  - `Opponent`
  - `Toledo Women's Volleyball`
  - other total/team rows
- Convert blank / `N/A` / invalid stat cells to `null`.
- Map Hudl headers to internal stat keys.

Important stat keys:

```js
attack_k
attack_e
attack_ta
attack_pct
attack_k_per_set
serve_sa
serve_se
serve_ta
serve_eff
serve_rtg
receive_pass_pct   // Hudl calls this Pass%, but it behaves like a 0-3 rating
set_ast
set_ta
set_se
set_rtg
dig_ds
block_per_set
points
sets_played
```

---

## Dataset Shape

The uploader builds the same broad shape the old JSON used:

```js
{
  metadata: {
    processed_at,
    total_practices,
    total_exhibitions,
    unique_practice_days,
    unique_game_days,
    total_players,
    date_range: { start, end }
  },
  sessions: [...],
  players: [...],
  setters: {...}
}
```

### Session Records

Team practice:

```js
{
  date: '2026-03-10',
  type: 'practice',
  category: 'team',
  players: [...]
}
```

Team practice with setter splits attached:

```js
{
  date: '2026-03-10',
  type: 'practice',
  category: 'team',
  players: [...],        // team-wide rows
  setters: [
    { setter: 'Gabbi', players: [...] },
    { setter: 'Janelle', players: [...] },
    { setter: 'Maddy', players: [...] }
  ]
}
```

Team exhibition:

```js
{
  date: '2026-04-18',
  type: 'exhibition',
  category: 'team',
  opponent: 'Oakland',
  players: [...],
  setters: [...]
}
```

### Player Index Caveat

`players[].practices` and `players[].exhibitions` include:

- Team-wide rows for a date.
- Setter-specific rows for that same date, with `entry.setter`.

This means a hitter may have multiple raw rows on the same date:

- official/team session result
- when set by Gabbi
- when set by Janelle
- when set by Maddy

Do **not** blindly render every raw player row as a separate "session." Use display helpers or collapse by date depending on context.

---

## Roster / Positions

Implemented in `modules/roster.js`.

The data only has short Hudl names like `Grace F.`. The roster file maps them to full names and positions from:

https://utrockets.com/sports/womens-volleyball/roster/2026

Current mapping:

| Data name | Full name | Position | Group |
|---|---|---|---|
| Ava S. | Ava Siefke | OH | OH |
| Avery A. | Avery Adamski | DS | DS |
| Brooke N. | Brooke Naniseni | OH | OH |
| Caylee S. | Caylee Sharkey | RSH | OPP |
| Gabbi L. | Gabbi LeBlanc | S | S |
| Grace F. | Grace Freiberger | DS/L | DS |
| Janelle G. | Janelle Green | S | S |
| Jessica C. | Jessica Costlow | OH | OH |
| Kayla O. | Kayla Ozanich | MB | MB |
| Maddy B. | Maddy Bach | S | S |
| Mariah G. | Mariah Gaines | OH | OH |
| Meg J. | Meg Jarrett | DS/L | DS |
| Olivia H. | Olivia Heitkamp | OH/RSH | OH |
| Sierra P. | Sierra Pertzborn | MB | MB |
| Sophie C. | Sophie Catalano | OPP | OPP |
| Sydney C. | Sydney Crowley | DS | DS |

Unknown/unrostered players are not dropped. `data.js` assigns:

```js
position: 'Unknown'
positionGroup: 'UNKNOWN'
isRosterMatch: false
```

They appear in the Players view under **Unrostered / Unknown**.

---

## Player Detail Modal: Important Behavior

This was recently changed after the user noticed duplicate dates.

### Why Duplicate Dates Happened

The data model stores both:

- team-wide row for a date
- setter-specific rows for that same date

So a player could show Apr 17 multiple times with different `Atk %`.

### Correct UX Now

In `modules/players.js`:

- `getDisplaySessions(player)` groups raw player rows by `date|opponent`.
- The main **Recent Sessions** table shows one row per real session.
- It uses the team-wide row if available.
- If a row has setter splits, it gets a `view setter split` tag.
- Clicking that row expands an inline setter split card:
  - Gabbi -> Atk %
  - Janelle -> Atk %
  - Maddy -> Atk %
  - plus the same position-relevant columns for each split

The setter-specific values should explain the session, not replace the official session row.

Do not reintroduce raw duplicate rows in the Recent Sessions table.

---

## Analytics Notes

Implemented in `modules/analytics.js`.

Important functions:

- `calculatePlayerTrends(player)`
- `calculatePracticeVsGame(player)`
- `calculateConsistency(player, statKey)`
- `calculateTeamStats(sessions)`
- `calculateSetterChemistry(setters, players)`
- `getBestPairings(chemistry, limit)`
- `calculateSetterStats(setterName, setterData)`
- `getCoachInsights(players, sessions)`
- `collapseByDate(practices)`

### Date Collapse

Because raw player rows can include team + multiple setter rows for the same date, trend charts should use:

```js
analytics.collapseByDate(player.practices || [])
```

`calculatePlayerTrends()` already does this.

### Current Trend Calculation

- Uses attack% over collapsed practice days.
- Uses recent 5 practice days vs early 5 practice days.
- Guards against tiny baselines so `0.02 -> 0.04` does not become a silly `+100%`.

### Known Analytics Risk

`calculatePracticeVsGame()` currently averages raw rows from practices/exhibitions. This may still overweight setter rows compared with team rows. If improving analytics, consider using team rows or `getDisplaySessions()`-like grouping for practice-vs-game comparisons.

### Setter Stats Caveat

Per-setter CSV files do **not** contain `set_ast` / `set_rtg` for the setter. Those values live on the setter's own row in team CSVs.

`calculateSetterStats(setterName, setterData)` looks up the setter as a player and aggregates setting stats from their own team rows.

---

## UI / UX Overview

### Dashboard

Coach-first layout:

- **Focus This Week**
  - generated by `analytics.getCoachInsights()`
  - highlights drops, hot streaks, practice-warrior issues, and strong setter-hitter pairings
- **Top Improvers**
- **Needs Attention**
- **Position Health**
- **Latest Session**
- Team KPIs and team timeline

### Players View

Players are grouped by position:

- Outside Hitters
- Right Sides / Opposites
- Middle Blockers
- Setters
- Defensive Specialists / Libero
- Unrostered / Unknown

Includes filter chips and sort controls.

Player cards show position-aware stats:

- Hitters: attack %, kills/set, block/serve/pass depending on role
- DS/L: pass rating, digs, serve
- Setters: assists, set rating, serve

### Setters View

Includes:

- Setter comparison table
- Best setter -> hitter pairings
- Chemistry heatmap filtered to attacking positions (`OH`, `OPP`, `MB`)
- Individual setter cards

### Practice vs Games

Scatterplot colored by position group.

Known possible improvement: make this use date-collapsed or team-row-only data to avoid raw setter row weighting.

### Timeline

Calendar grouped by week.

Metric dropdown:

- attack %
- kills/set
- serve efficiency
- pass rating

Note: Hudl `Receive Pass%` is treated as a pass rating (0-3), not a literal percent.

---

## Key Design Principles For Future Agents

1. **Do not hardcode player stat values.**
   - Stats must come from uploaded CSVs.
   - Static roster metadata is okay in `roster.js`.

2. **Do not depend on `processed_data.json`.**
   - It was removed.
   - IndexedDB uploaded dataset is source of truth.

3. **Preserve coach-readable views.**
   - Avoid showing raw implementation rows if they confuse coaches.
   - Explain setter splits through expandable details or charts.

4. **Position matters.**
   - Do not compare DS/L players to OH hitters using attack%.
   - Use position-aware metrics and labels.

5. **Be careful with duplicate dates.**
   - Multiple rows on one date are expected because of setter-specific CSVs.
   - Use team rows for official session result.
   - Use setter rows for setter-hitter splits.

6. **Unknown players should be visible, not silently dropped.**
   - Show them under `UNKNOWN`.
   - The coach can then fix/update roster mapping.

---

## Current Known Limitations / Next Good Improvements

1. **Roster editing is not uploadable yet.**
   - Roster lives in `modules/roster.js`.
   - Future: upload/edit roster from UI.

2. **Practice-vs-game may overweight setter rows.**
   - Refactor to use date/session display rows or team-only rows.

3. **No cloud/backend sync.**
   - IndexedDB is local to the browser/device.

4. **No export/import of parsed dataset.**
   - Useful future feature: export a `.json` backup and import later.

5. **No automated browser tests.**
   - Lints pass, and parser/classifier were manually smoke-tested against real CSVs.

6. **`process_data.py` still exists.**
   - It is legacy/helper code. Keep if useful, but do not rebuild workflow around it.

---

## Verification Already Done

Manual smoke tests from prior work:

- Parser test over `Spring 2026`:
  - Found 123 CSVs
  - 99 files with usable player rows
  - 24 files with no usable stat rows
  - 16 unique player names
- Classifier test over `Spring 2026`:
  - `team-practice`: 26
  - `setter-practice`: 78
  - `team-exhibition`: 5
  - `setter-exhibition`: 14
  - unknown: 0
- Linter check reported no errors after the latest modal/table changes.

---

## Most Recent User Feedback

The user noticed Brooke Naniseni's player profile had several Apr 17 rows with different attack percentages.

Root cause:

- Raw table rendered team row + setter rows as if each were a distinct session.

Fix made:

- Recent Sessions now groups by real session.
- Rows with setter-specific data are clickable.
- Clicking opens an inline setter split card for that date.

User's desired mental model:

> Show the actual session row, then let me click it to see how the player did when set by Gabbi/Janelle/Maddy.

Keep building in that direction.
# AI Handoff Context: Volleyball Analytics Dashboard

**Project Start:** May 14, 2026  
**Current Status:** ✅ Fully functional dashboard (v1.0)  
**Tech Stack:** Python (data processing) + Vanilla JS/HTML/CSS (dashboard)  

---

## 🎯 Project Purpose

Build a **pure client-side analytics dashboard** to help a volleyball coach track:

1. **Player improvement** - Are players trending up or down over time?
2. **Practice→Game translation** - Do practice stats predict game performance?
3. **Setter effectiveness** - Which setters make hitters more successful?

**User's Goal Quote:**
> "I want to build something to essentially look at my players and seeing if they are improving or not (basically seeing that if each day they are trending up or down) and also seeing if their practices have been translating and also want to see how our setters been doing and maybe like seeing how their settings have helped the players around them"

**Design Pattern Reference:** User requested it be "purely off html, css and js" similar to their existing `basketball-dashboard` project (dark theme, modular JS architecture).

---

## 📊 Data Source Context

### Original Data Structure
- **123 CSV files** from Hudl volleyball stats export
- **Date Range:** March 10 - April 19, 2026 (Spring 2026 season)
- **Folder Structure:**
  ```
  Spring 2026/
  ├── Team Stats/           # 26 practice CSV files (full team stats)
  ├── Setter Stats/         # ~60 CSV files (3 setters × practices)
  └── Exhibitions/
      ├── Team Exhibition/  # 5 game CSV files
      └── Setter Exhibition/
  ```

### Data Quality Issues Encountered
1. **Player name inconsistencies:**
   - Format variations: `"#4 Olivia H."`, `Olivia H.`, `Olivia`
   - Solution: `normalize_player_name()` strips jersey numbers and quotes
   
2. **Empty CSV files:** Some files had only headers, no data rows
   - Solution: Filter during processing
   
3. **Null value variations:** Empty strings, blanks, "N/A"
   - Solution: `parse_stat_value()` handles all null cases
   
4. **Aggregate rows:** CSV files contain "Team A", "Team B" totals
   - Solution: Filtered out during player/setter indexing

### Processed Data Schema
After running `process_data.py`, generated `processed_data.json` (~2.3 MB):

```json
{
  "metadata": {
    "total_sessions": 41,        // 26 practices + 5 exhibitions
    "total_players": 18,
    "date_range": {
      "start": "2026-03-10",
      "end": "2026-04-19"
    },
    "practices": 26,
    "exhibitions": 5
  },
  "sessions": [
    {
      "date": "2026-03-10",
      "type": "practice",         // or "exhibition"
      "opponent": null,            // or team name for exhibitions
      "stats": [...]               // player stats for this session
    }
  ],
  "players": [
    {
      "name": "Olivia H.",
      "sessions": [
        {
          "date": "2026-03-10",
          "type": "practice",
          "opponent": null,
          "stats": {
            "Kills": 5,
            "Errors": 2,
            "Total Attacks": 15,
            "Attack%": 0.200,      // (Kills - Errors) / Total Attacks
            "Aces": 1,
            // ... other stats
          }
        }
      ],
      "averages": {
        "practice": {...},         // avg stats in practice
        "exhibition": {...}        // avg stats in games
      }
    }
  ],
  "setters": {
    "Gabbi": [...],
    "Janelle": [...],
    "Maddy": [...]
  }
}
```

---

## 🏗️ Architecture Overview

### Design Philosophy
- **Modular JS:** Separation of concerns (config → data → analytics → charts → views)
- **No frameworks:** Pure vanilla JS for simplicity and no build step
- **Client-side only:** All processing happens in browser, no backend needed
- **Basketball-dashboard pattern:** Same dark theme, card-based layout, grid system

### Module Dependency Chain
```
app.js (coordinator)
  ↓
  ├─ data.js (loads processed_data.json)
  │   ↓
  │   └─ config.js (utilities like avg, linearTrend, pct)
  │
  ├─ analytics.js (calculates trends, chemistry, practice vs game)
  │   ↓
  │   └─ config.js
  │
  ├─ charts.js (renders Plotly visualizations)
  │   ↓
  │   └─ config.js
  │
  ├─ players.js (player list view, detail modals)
  │   ↓
  │   ├─ data.js
  │   ├─ analytics.js
  │   └─ charts.js
  │
  └─ setters.js (setter comparison, chemistry matrix)
      ↓
      ├─ data.js
      ├─ analytics.js
      └─ charts.js
```

### File Responsibilities

#### `process_data.py` (Python 3, ~300 lines)
**Purpose:** One-time CSV processing into structured JSON

**Key Functions:**
- `parse_csv_file(path)` - Read CSV, extract stats
- `normalize_player_name(name)` - Clean "#4 Olivia H." → "Olivia H."
- `parse_stat_value(val)` - Handle null/empty/NaN gracefully
- `build_player_index(sessions)` - Aggregate all sessions per player
- `build_setter_index(sessions)` - Separate Gabbi/Janelle/Maddy data
- `calculate_averages(sessions)` - Compute practice vs exhibition averages

**Output:** `processed_data.json`

**When to re-run:** After adding new CSV files to Spring 2026 folder

---

#### `modules/config.js` (~100 lines)
**Purpose:** Constants, utility functions, formatting helpers

**Key Exports:**
```javascript
const CONFIG = {
    DATA_URL: 'processed_data.json',
    ROLLING_WINDOW: 5,           // For rolling averages
    MIN_GAMES_FOR_TREND: 3       // Min sessions for trend analysis
};

const utils = {
    avg(arr),                    // Array average
    stdDev(arr),                 // Standard deviation
    pct(num, decimals),          // Format as percentage
    linearTrend(values),         // Linear regression, returns slope
    rollingAvg(values, window),  // Smoothed trend line
    formatDate(dateStr)          // "2026-03-10" → "Mar 10"
};
```

**Design Decision:** All utilities in one place to avoid duplication across modules.

---

#### `modules/data.js` (~150 lines)
**Purpose:** Load and provide access to processed data

**State:**
```javascript
let rawData = null;              // Full processed_data.json
let players = [];                // Array of player objects
let setters = {};                // {Gabbi: [...], Janelle: [...], Maddy: [...]}
let sessions = [];               // All sessions chronologically
let metadata = {};               // Total counts, date range
```

**Key Functions:**
```javascript
async loadData()                 // Fetch processed_data.json
getAllPlayers()                  // Returns players array
getPlayerByName(name)            // Find specific player
getSetterData(name)              // Get Gabbi/Janelle/Maddy data
getSessionsByType(type)          // Filter practice vs exhibition
getMetadata()                    // Stats about dataset
```

**Usage Pattern:**
```javascript
await DataModule.loadData();     // Call once on page load
const players = DataModule.getAllPlayers();  // Access data
```

---

#### `modules/analytics.js` (~250 lines)
**Purpose:** Calculate trends, improvements, and insights

**Core Algorithms:**

1. **`calculatePlayerTrends(player)`** - Detect improvement direction
   ```javascript
   // Uses linear regression on attack% over time
   // Returns: { trend: 'up'|'down'|'stable', slope: 0.015, ... }
   ```
   - **UP:** Slope > 0.01 (1% improvement trend)
   - **DOWN:** Slope < -0.01 (1% decline)
   - **STABLE:** Between -0.01 and 0.01

2. **`calculatePracticeVsGame(player)`** - Translation analysis
   ```javascript
   // Compares average practice attack% vs exhibition attack%
   // Returns: { diff: 0.08, category: 'clutch'|'balanced'|'warrior' }
   ```
   - **Clutch:** Exhibition avg ≥ 0.05 higher than practice
   - **Practice Warrior:** Exhibition avg ≥ 0.05 lower than practice
   - **Balanced:** Difference < 0.05

3. **`calculateSetterChemistry()`** - Setter→Hitter effectiveness matrix
   ```javascript
   // For each setter, calculate hitter attack% when set by that setter
   // Returns: { 
   //   Gabbi: { 'Olivia H.': 0.250, 'Jessica C.': 0.340, ... },
   //   Janelle: { ... },
   //   Maddy: { ... }
   // }
   ```

4. **`getTopImprovers(n)`** - Sort by improvement percentage
   ```javascript
   // Returns top N players with highest (recent avg - early avg) / early avg
   ```

5. **`getDecliningPlayers(n)`** - Opposite of above
   ```javascript
   // Returns top N players with most negative improvement %
   ```

**Key Insight:** Analytics module is stateless - always recalculates from raw data. No caching implemented yet.

---

#### `modules/charts.js` (~300 lines)
**Purpose:** Render Plotly.js visualizations

**Chart Types:**

1. **`renderTrendChart(containerId, player, metric)`** - Time series line chart
   - Shows practice (blue dots) vs exhibition (gold dots)
   - Adds linear trend line
   - Used in player detail modals

2. **`renderScatterPlot(containerId, players)`** - Practice vs Game comparison
   - X-axis: Practice average attack%
   - Y-axis: Exhibition average attack%
   - Diagonal reference line (y = x) = perfect translation
   - Points above line = clutch, below = practice warriors

3. **`renderChemistryMatrix(containerId, chemistryData)`** - Heatmap
   - Rows: Setters (Gabbi, Janelle, Maddy)
   - Columns: Hitters
   - Color scale: Red (low) → Yellow (mid) → Green (high)
   - Shows which setter-hitter combos produce best attack%

4. **`renderTimeline(containerId, sessions)`** - Bar chart over time
   - Practice sessions in blue
   - Exhibition games in gold
   - Metric selection via dropdown (future enhancement)

**Plotly Config:**
```javascript
const layout = {
    paper_bgcolor: '#0a1628',    // Dark theme background
    plot_bgcolor: '#0a1628',
    font: { color: '#e1e8f0' },  // Light text
    // ... responsive settings
};
```

**Design Decision:** All charts use consistent dark theme colors matching `styles.css`.

---

#### `modules/players.js` (~200 lines)
**Purpose:** Render player list view and detail modals

**Key Functions:**

1. **`renderPlayersList(container, players)`** - Grid of player cards
   - Shows player name, attack%, kills/set
   - Trend badge (🟢 UP / 🔴 DOWN / 🟡 STABLE)
   - Click to open detail modal

2. **`showPlayerDetail(playerName)`** - Opens modal with:
   - Attack% trend chart
   - Kills/set trend chart
   - Recent performance table (last 5 sessions)
   - Practice vs exhibition comparison stats

3. **`filterPlayers(searchTerm, sortBy)`** - Search and sort logic
   - Search: Filter by name
   - Sort: name | attack% | kills/set | improvement

**HTML Structure:**
```html
<div class="player-card" onclick="PlayerModule.showPlayerDetail('Olivia H.')">
    <h3>Olivia H.</h3>
    <span class="trend-badge up">🟢 TRENDING UP</span>
    <div class="stats">
        <div>Attack%: 0.250</div>
        <div>Kills/Set: 3.2</div>
    </div>
</div>
```

---

#### `modules/setters.js` (~180 lines)
**Purpose:** Setter comparison and chemistry analysis

**Key Functions:**

1. **`renderComparisonTable(container)`** - Side-by-side comparison
   - Columns: Setter name, Total assists, Assist rate, Avg rating, Errors
   - Rows: Gabbi, Janelle, Maddy

2. **`renderChemistryMatrix(container)`** - Calls `charts.renderChemistryMatrix()`
   - Visualizes optimal setter-hitter pairings

3. **`renderSetterStats(container, setterName)`** - Individual setter card
   - Assists, assist rate, setting accuracy
   - Error rate
   - Games played

**Setter Chemistry Interpretation:**
- **Green cells (>0.30):** Excellent pairing, prioritize in games
- **Yellow cells (0.20-0.30):** Decent, room for improvement
- **Red cells (<0.20):** Poor pairing, needs practice focus

---

#### `app.js` (~250 lines)
**Purpose:** Main application coordinator, navigation, view rendering

**Initialization Flow:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();                        // Show spinner
    await DataModule.loadData();          // Load JSON
    hideLoading();                        // Hide spinner
    updateHeaderStats();                  // Fill in header metrics
    switchView('dashboard');              // Show dashboard view
    attachEventListeners();               // Navigation clicks
});
```

**View Rendering Functions:**
- `renderDashboardView()` - Home screen with top improvers, declining, team stats
- `renderPlayersView()` - Player list with search/sort
- `renderSettersView()` - Setter comparison and chemistry
- `renderComparisonView()` - Practice vs game scatterplot
- `renderTimelineView()` - Season calendar and performance chart

**Navigation Pattern:**
```javascript
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show selected view
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Update nav highlighting
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Render view content
    switch(viewName) {
        case 'dashboard': renderDashboardView(); break;
        case 'players': renderPlayersView(); break;
        // ...
    }
}
```

---

#### `styles.css` (~400 lines)
**Purpose:** Dark theme styling, responsive layout

**Color Palette:**
```css
:root {
    --bg-primary: #07111d;      /* Main background */
    --bg-secondary: #0a1628;    /* Cards, panels */
    --bg-tertiary: #0d1b2e;     /* Hover states */
    --text-primary: #e1e8f0;    /* Main text */
    --text-secondary: #8892a0;  /* Muted text */
    --accent-gold: #FFD200;     /* Highlights, exhibitions */
    --accent-blue: #4A90E2;     /* Practice sessions */
    --success: #4CAF50;         /* Trending up */
    --danger: #f44336;          /* Trending down */
    --warning: #FFC107;         /* Stable */
}
```

**Layout System:**
- **`.container`** - Max-width wrapper with padding
- **`.grid-2`, `.grid-3`** - Auto-responsive grids
- **`.card`** - Standard panel with border-radius and shadow
- **`.stat-card`** - Compact stat display
- **`.player-card`** - Player grid item with hover effect

**Responsive Breakpoints:**
```css
@media (max-width: 768px) {
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
    nav { flex-direction: column; }
}
```

---

#### `index.html` (~300 lines)
**Purpose:** Main dashboard structure, semantic HTML

**Key Sections:**
1. **Header** - Title, date range, quick stats
2. **Navigation** - 5 view links (Dashboard, Players, Setters, Comparison, Timeline)
3. **Views** - 5 separate `<div class="view">` containers
4. **Modals** - Player detail modal (hidden by default)
5. **Loading overlay** - Spinner during data load

**Script Loading Order:**
```html
<!-- External -->
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<!-- Modules (order matters!) -->
<script src="modules/config.js"></script>
<script src="modules/data.js"></script>
<script src="modules/analytics.js"></script>
<script src="modules/charts.js"></script>
<script src="modules/players.js"></script>
<script src="modules/setters.js"></script>

<!-- App coordinator (last) -->
<script src="app.js"></script>
```

---

## 🔑 Key Metrics Explained

### Attack Efficiency (Attack%)
```
Attack% = (Kills - Errors) / Total Attacks
```
- **Primary metric** for offensive effectiveness
- Range: -1.0 to 1.0 (typically 0.0 to 0.5)
- **Good:** >0.300
- **Average:** 0.200-0.300
- **Poor:** <0.200

### Kills per Set
```
Kills/Set = Total Kills / Number of Sets Played
```
- Measures offensive volume (not efficiency)
- **Elite:** >3.0
- **Solid:** 2.0-3.0
- **Role player:** <2.0

### Assist Rate (for setters)
```
Assist Rate = Assists / Total Attempts
```
- Percentage of sets that result in kills
- **Good:** >0.400
- **Average:** 0.300-0.400
- **Needs work:** <0.300

### Improvement Score
```
Recent Avg = avg(last 5 sessions)
Early Avg = avg(first 5 sessions)
Improvement = (Recent - Early) / Early * 100
```
- Positive = improving
- Negative = declining
- Used for "Top Improvers" and "Declining Players" lists

### Practice vs Game Differential
```
Diff = Exhibition Avg Attack% - Practice Avg Attack%
```
- **Clutch:** Diff ≥ +0.05 (5% better in games)
- **Balanced:** -0.05 < Diff < +0.05
- **Practice Warrior:** Diff ≤ -0.05 (5% worse in games)

---

## 🚧 Known Limitations & Future Work

### Current Limitations

1. **No position data** - Can't analyze rotational effectiveness
2. **No opponent strength** - Exhibitions treated equally regardless of opponent
3. **No time-in-game tracking** - Can't measure fatigue or substitution patterns
4. **Limited setter stats** - Hudl CSV doesn't include set ratings per player-setter combo
5. **No defensive metrics** - Digs/blocks tracked but not deeply analyzed yet

### Planned Enhancements (from VOLLEYBALL_DASHBOARD_PLAN.md)

**Phase 2 - Advanced Analytics:**
- [ ] Radar charts for player strengths/weaknesses
- [ ] Predictive modeling (ML to predict game performance from practice trends)
- [ ] Rolling averages overlay on trend charts
- [ ] Statistical significance indicators (is trend meaningful or noise?)
- [ ] Injury risk detection (sudden performance drops)

**Phase 3 - Coach Tools:**
- [ ] Custom drill tracker integration
- [ ] Goal setting & progress tracking per player
- [ ] Coach notes system (annotations on specific sessions)
- [ ] Export to PDF reports for player reviews
- [ ] Deep-linkable player views (shareable URLs)

**Phase 4 - Data Quality:**
- [ ] Manual data correction interface (fix typos without re-processing)
- [ ] Outlier detection (flag suspicious stats like 100% attack%)
- [ ] Session comparison tool (compare today's practice to last week)

**Technical Debt:**
- [ ] Add caching to analytics calculations (currently recalculates every render)
- [ ] Implement service worker for offline usage
- [ ] Add unit tests for analytics functions
- [ ] Compress processed_data.json (currently 2.3 MB uncompressed)

---

## 💡 How to Extend This Project

### Adding a New Metric

1. **Update `process_data.py`** to calculate new stat:
   ```python
   def calculate_new_metric(stats):
       # Your calculation
       return result
   ```

2. **Add to `modules/analytics.js`**:
   ```javascript
   function analyzeNewMetric(player) {
       const trend = utils.linearTrend(player.sessions.map(s => s.stats.NewMetric));
       return { trend, ... };
   }
   ```

3. **Visualize in `modules/charts.js`**:
   ```javascript
   function renderNewMetricChart(containerId, data) {
       Plotly.newPlot(containerId, [{
           x: data.dates,
           y: data.values,
           type: 'scatter'
       }], layout);
   }
   ```

4. **Display in view** (e.g., `modules/players.js`):
   ```javascript
   const newMetricHtml = `<div>New Metric: ${player.newMetric}</div>`;
   ```

### Adding a New View

1. **Add HTML structure in `index.html`**:
   ```html
   <div id="new-view" class="view">
       <h2>New View Title</h2>
       <div id="new-view-content"></div>
   </div>
   ```

2. **Add navigation link**:
   ```html
   <a href="#" data-view="new-view">New View</a>
   ```

3. **Create render function in `app.js`**:
   ```javascript
   function renderNewView() {
       const container = document.getElementById('new-view-content');
       // Populate container
   }
   ```

4. **Update `switchView()` in `app.js`**:
   ```javascript
   case 'new-view': renderNewView(); break;
   ```

### Optimizing Performance

**If data loading is slow:**
1. Compress JSON: Use gzip compression (requires server)
2. Lazy load: Only load player data when clicking into player view
3. Pagination: Show 10 players at a time instead of all 18

**If charts are slow:**
1. Reduce Plotly data points (sample every Nth point)
2. Use static images for non-interactive charts
3. Debounce chart rendering on resize events

---

## 🎓 Coaching Insights from Data

### What We've Learned So Far

**Setter Effectiveness:**
- Chemistry matters more than individual setter skill
- Some hitters have clear "favorite setters" (10%+ attack% difference)
- Gabbi tends to get more attempts but lower efficiency
- Janelle has highest assist rate but fewer total attempts

**Practice vs Game Performance:**
- ~30% of players are "practice warriors" (decline 8%+ in games)
- Mental coaching opportunity: Why can't they replicate practice success?
- Clutch performers should get priority in close matches
- Consider game-speed drills for practice warriors

**Player Development:**
- Most improvement happens in first 2 weeks (learning curve)
- Players plateau around week 3-4 (need new challenges)
- Declining players often show sudden drops (check for injury/fatigue)
- Attack% variance correlates with experience level (rookies more inconsistent)

**Exhibition Performance:**
- Opponent strength varies significantly (Cleveland State much tougher than Findlay)
- Team attack% drops 5% avg in games vs practice (normal pressure effect)
- Home vs away data not tracked (could be valuable addition)

---

## 🤖 AI Continuation Tips

### When Implementing New Features

1. **Always check `processed_data.json` structure first** - Don't assume data exists
2. **Use existing utility functions** in `modules/config.js` - Don't reinvent avg/pct/trend
3. **Follow modular pattern** - Don't put everything in app.js
4. **Maintain dark theme** - Use CSS variables from `:root`
5. **Test with real data edge cases** - Some players have only 3 sessions, some have 20+

### Common User Requests (Predicted)

**"Add serve analysis"**
- Data exists in `stats.Aces`, `stats.Serve Errors`, `stats.Total Serves`
- Calculate serve efficiency: (Aces - Errors) / Total Serves
- Add to player cards and detail modals

**"Compare two players side-by-side"**
- Add player comparison view with dual trend charts
- Use existing `renderTrendChart()` but with 2 players on same axes
- Highlight where one player outperforms the other

**"Show team performance by opponent"**
- Group exhibitions by `session.opponent`
- Calculate avg attack% vs each team
- Visualize with bar chart (opponent on x-axis, attack% on y-axis)

**"Export player reports to PDF"**
- Use library like jsPDF or html2pdf.js
- Generate report with charts (Plotly has `.toImage()` method)
- Include stats table, trend summary, coach notes section

### Debugging Tips

**If charts don't render:**
- Check browser console for Plotly errors
- Verify `containerId` exists in DOM before calling `Plotly.newPlot()`
- Ensure data arrays have matching lengths (x and y)

**If data looks wrong:**
- Re-run `python process_data.py` - might be stale JSON
- Check CSV files for data quality issues
- Look for outliers (attack% > 1.0 or < -1.0 is impossible)

**If performance is slow:**
- Profile with Chrome DevTools Performance tab
- Check if recalculating trends on every render (should cache)
- Consider virtualizing player list (only render visible cards)

---

## 📚 External Resources

**Plotly.js Documentation:** https://plotly.com/javascript/  
**Volleyball Stats Glossary:** https://www.hudl.com/support/volleyball-stats-reference  
**Linear Regression (JS):** Implemented in `modules/config.js` utils.linearTrend()  
**Dark Theme Inspiration:** Based on user's `basketball-dashboard` project

---

## ✅ Handoff Checklist

- [x] All 123 CSV files processed successfully
- [x] `processed_data.json` generated (2.3 MB, 18 players, 41 sessions)
- [x] Dashboard fully functional with 5 views
- [x] All modules implemented and tested
- [x] Dark theme matching basketball-dashboard
- [x] README documentation for end users
- [x] This AI context document for developers

**Next Session Should Start With:**
1. "Show me the dashboard" → Open in browser, review UI/UX
2. "Let's add [feature]" → Implement enhancement from VOLLEYBALL_DASHBOARD_PLAN.md
3. "Fix [bug]" → Debug reported issue
4. "Analyze [question]" → Run custom analysis on existing data

---

## 🔄 Quick Reference Commands

```bash
# Re-process data after adding new CSV files
python process_data.py

# Open dashboard in browser
start index.html

# Check data size
Get-Item processed_data.json | Select-Object Length

# Count CSV files
(Get-ChildItem -Path "Spring 2026" -Recurse -Filter "*.csv").Count

# Search for specific player in JSON
Select-String -Path processed_data.json -Pattern "Olivia H."
```

---

**Last Updated:** May 14, 2026  
**Project Status:** ✅ v1.0 Complete - Ready for enhancements  
**Maintainer:** Coach Bryan + AI assistants

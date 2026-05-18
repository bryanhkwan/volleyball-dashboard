# Volleyball Stats Dashboard - Implementation Plan

## Project Overview
Build an HTML/CSS/JS dashboard to track volleyball player improvement trends, compare practice vs exhibition performance, and analyze setter effectiveness.

**Inspiration:** Similar to `C:\Users\bryan\projects\basketball-dashboard`

---

## 1. Core Objectives

### Primary Goals
1. **Player Improvement Tracking** - Show if players are trending up/down over time
2. **Practice vs Game Performance** - Compare practice stats with exhibition game stats
3. **Setter Analysis** - Evaluate setter performance and their impact on team offense
4. **Data Visualization** - Clean, modern UI to explore stats interactively

### Key Questions to Answer
- Is Player X improving week-over-week?
- Do practice performances translate to game performance?
- Which setter combinations work best with which hitters?
- What are each player's strengths/weaknesses?
- Which stats correlate most with winning?

---

## 2. Volleyball Stats Deep Dive

### Understanding the CSV Columns

Based on the Hudl export format, here's what each metric means:

#### **Attack Stats** (Hitting/Spiking)
- **K (Kills)** - Successful attacks that result in points
- **E (Errors)** - Attack mistakes (hit out, into net, blocked)
- **TA (Total Attacks)** - All attack attempts
- **Atk% (Attack %)** - Kill efficiency: `(K - E) / TA`
- **K/S (Kills per Set)** - Offensive output rate
- **Higher is better:** Kills, Atk%, K/S
- **Lower is better:** Errors

#### **Serve Stats**
- **SA (Service Aces)** - Unreturnable serves
- **SE (Service Errors)** - Serve into net or out
- **TA (Total Attempts)** - All serves
- **Pct** - Success rate
- **Eff (Efficiency)** - Overall serve effectiveness
- **Rtg. (Rating)** - Quality of serves (aggression vs control)
- **Higher is better:** Aces, Efficiency, Rating
- **Lower is better:** Errors

#### **Receive/Passing Stats**
- **3, 2, 1, 0** - Pass quality ratings (3 = perfect, 0 = error/overpass)
- **TA (Total Attempts)** - All pass attempts
- **Pass%** - Average pass rating: `(3×count3 + 2×count2 + 1×count1) / TA`
- **Higher is better:** 3's (perfect passes), Pass%
- **Lower is better:** 0's (errors)

#### **Set Stats** (Setters only)
- **Ast (Assists)** - Sets that result in kills
- **TA (Total Attempts)** - All sets
- **SE (Setting Errors)** - Bad sets
- **3, 2, 1, 0** - Set quality ratings
- **Rtg. (Rating)** - Overall setting quality
- **Higher is better:** Assists, Rating, 3's
- **Lower is better:** Errors

#### **Dig Stats** (Defense)
- **DS (Digs)** - Successful defensive saves
- **DE (Dig Errors)** - Failed defensive attempts
- **Higher is better:** Digs
- **Lower is better:** Errors

#### **Block Stats**
- **BS (Block Solos)** - Solo blocks
- **BA (Block Assists)** - Assisted blocks
- **BE (Block Errors)** - Blocking mistakes
- **B/S (Blocks per Set)** - Block rate
- **Higher is better:** BS, BA, B/S
- **Lower is better:** Errors

#### **Overall**
- **Pts (Points)** - Total points scored
- **+/-** - Point differential when player is on court
- **Sets Played** - Sets participated in

---

## 3. Key Performance Indicators (KPIs)

### Individual Player KPIs

#### **For Hitters (Non-setters)**
1. **Attack Efficiency Trend** - Is Atk% improving?
2. **Kill Consistency** - Standard deviation of K/S over time
3. **Error Rate** - Trending down?
4. **Practice→Game Transfer** - Correlation between practice Atk% and exhibition Atk%
5. **Serve Pressure** - Service aces trending up, errors stable/down
6. **Defensive Impact** - Digs per set trending up

#### **For Setters (Gabbi, Janelle, Maddy)**
1. **Assist Rate** - Assists / Total Attempts
2. **Setting Accuracy** - Percentage of 3-rated sets
3. **Error Management** - Setting errors trending down
4. **Hitter Empowerment** - Which setters make hitters more efficient?
5. **Distribution** - Who do they set most? (requires play-by-play data if available)
6. **Practice→Game Consistency** - Do their practice metrics predict game success?

#### **Universal Metrics**
1. **Overall Trend Score** - Composite metric (weighted avg of key stats)
2. **Consistency Score** - Lower variance = more reliable
3. **Clutch Factor** - Exhibition performance vs practice baseline
4. **Role Fit** - Performance in primary skill vs secondary skills

---

## 4. Data Processing Strategy

### Phase 1: Data Consolidation
```javascript
// Pseudo-structure for processed data
const processedData = {
  players: {
    "Olivia H.": {
      practices: [
        { date: "2026-03-10", stats: {...}, setter: null },
        { date: "2026-03-12", stats: {...}, setter: null },
        // ...
      ],
      exhibitions: [
        { date: "2026-03-28", opponent: "Cleveland State", stats: {...} },
        // ...
      ],
      trends: {
        attackEfficiency: [...],  // time-series
        killsPerSet: [...],
        // ...
      }
    },
    // ...
  },
  
  setters: {
    "Gabbi": {
      practices: [...],
      exhibitions: [...],
      hittersSupported: {
        "Olivia H.": { assists: 42, avgHitterAtk: 0.325 },
        // ...
      }
    },
    // ...
  },
  
  team: {
    practices: [...],
    exhibitions: [...],
    overallTrends: {...}
  }
}
```

### Phase 2: Metrics Calculation
- **Rolling Averages** (3-practice, 5-practice windows)
- **Trend Lines** (linear regression for each metric)
- **Percentile Rankings** (within team)
- **Practice vs Game Deltas**
- **Correlation Analysis** (which practice metrics predict game success?)

### Phase 3: Insights Generation
- **Improvement Flags** - Auto-detect upward/downward trends
- **Anomaly Detection** - Highlight unusually good/bad performances
- **Setter-Hitter Chemistry** - Calculate effectiveness of different combinations
- **Consistency Ratings** - Identify reliable vs volatile players

---

## 5. Dashboard UI Design

### Modular Architecture (like basketball dashboard)
```
volleyball-dashboard/
├── index.html
├── styles.css
├── app.js
├── modules/
│   ├── config.js          // Constants, utility functions
│   ├── data.js            // CSV parsing, data processing
│   ├── players.js         // Player list, filtering, sorting
│   ├── trends.js          // Trend calculation, time-series analysis
│   ├── setters.js         // Setter-specific analysis
│   ├── charts.js          // Chart rendering (Chart.js or D3.js)
│   ├── comparison.js      // Practice vs Exhibition comparison
│   └── filters.js         // Date range, player selection, etc.
├── data/
│   └── raw/               // Copy of original CSVs
│       ├── practices/
│       ├── exhibitions/
│       └── processed.json // Pre-processed data for faster loading
└── README.md
```

### UI Sections

#### **1. Dashboard Home**
- **Team Overview Card**
  - Total practices logged, exhibitions played
  - Team-wide trends (attack%, serve eff, etc.)
  - Recent highlights

- **Quick Player Cards**
  - Top 5 most improved players this week
  - Players needing attention (declining trends)

#### **2. Player Detail View**
- **Header:** Player name, position, photo (optional)
- **Trend Charts:**
  - Attack Efficiency over time (line chart)
  - Kills/Set over time
  - Serve efficiency over time
  - Color-coded: green (improving), yellow (stable), red (declining)
  
- **Practice vs Exhibition Comparison**
  - Side-by-side bar chart
  - Scatter plot: Practice Atk% (x) vs Exhibition Atk% (y)
  - Highlight "translation rate"

- **Recent Performance Table**
  - Last 10 practices/games
  - Sortable by any stat
  - Highlight personal bests

- **Strengths/Weaknesses Radar**
  - Spider/radar chart showing normalized scores:
    - Attack, Serve, Receive, Defense, Blocking

#### **3. Setter Analysis View**
- **Setter Comparison Table**
  - Gabbi vs Janelle vs Maddy
  - Assist rate, setting accuracy, error rate
  
- **Hitter Success by Setter**
  - Matrix: Setters (rows) × Hitters (columns) = Hitter Atk% when set by that setter
  - Identify optimal combinations
  
- **Timeline View**
  - Which setter played in each practice/game
  - Team performance correlation

#### **4. Practice vs Exhibition Hub**
- **Scatterplot Matrix**
  - X-axis: Practice avg
  - Y-axis: Exhibition avg
  - Dot per player per metric
  - Diagonal line = perfect translation
  - Above line = overperform in games
  - Below line = underperform in games

- **Translation Leaderboard**
  - Players ranked by "game-day boost" or "practice warrior"

#### **5. Timeline/Calendar View**
- Interactive calendar showing:
  - Practice dates (blue)
  - Exhibition dates (gold)
  - Click to see team stats for that day
  - Heat map overlay (team performance quality)

---

## 6. Technical Implementation Details

### Data Loading Strategy
```javascript
// modules/data.js
async function loadAllData() {
  // Option A: Parse CSVs client-side (use PapaParse library)
  const practiceFiles = await fetch('data/practices/manifest.json');
  const exhibitionFiles = await fetch('data/exhibitions/manifest.json');
  
  // Parse and merge all CSVs
  const allPractices = await Promise.all(
    practiceFiles.map(f => parsePracticeCSV(f))
  );
  
  // Option B: Pre-process server-side, load single JSON
  const processed = await fetch('data/processed.json');
  return processed.json();
}
```

### Recommended Libraries
- **PapaParse** - CSV parsing (client-side)
- **Chart.js** or **Plotly.js** - Interactive charts
- **date-fns** - Date manipulation
- **simple-statistics** - Regression, correlation, percentiles

### Performance Optimization
1. **Lazy Loading** - Load data only when needed
2. **Web Workers** - Heavy calculations off main thread
3. **IndexedDB** - Cache processed data locally
4. **Virtualization** - For long player lists (if roster grows)

---

## 7. Advanced Features (Phase 2)

### Machine Learning Insights
- **Predict Game Performance** from practice trends
- **Injury Risk Flags** - Detect performance drop patterns
- **Optimal Lineup Suggestions** - Based on chemistry analysis

### Coaching Tools
- **Custom Drills Tracker** - Log specific drills, correlate with improvement
- **Goal Setting** - Set targets, track progress
- **Report Generator** - Auto-generate player development reports

### Collaboration
- **Share Links** - Deep-linkable player views
- **Export to PDF** - Professional reports
- **Notes System** - Coaches can annotate player timelines

---

## 8. Implementation Roadmap

### Week 1: Foundation
- [ ] Set up project structure
- [ ] Build CSV parser (handle all 123 files)
- [ ] Create player roster (deduplicate names, handle "#4 Olivia H." format)
- [ ] Basic data processing pipeline (practices + exhibitions)
- [ ] Simple player list UI

### Week 2: Core Dashboard
- [ ] Dashboard home page with team stats
- [ ] Player detail page with basic stats table
- [ ] Implement filtering (date range, player name)
- [ ] Add first chart: Attack Efficiency over time

### Week 3: Analytics
- [ ] Trend calculation (rolling avg, regression)
- [ ] Practice vs Exhibition comparison charts
- [ ] Setter analysis module
- [ ] Improvement detection algorithm

### Week 4: Polish & Deploy
- [ ] Responsive design (mobile-friendly)
- [ ] Dark theme styling (match basketball dashboard aesthetic)
- [ ] Export features (CSV, PDF)
- [ ] Deploy (GitHub Pages or similar)

---

## 9. Data Quality Considerations

### Issues Found in Raw Data
1. **Inconsistent naming:** "oakland" vs "Oakland", "Michingan" (typo)
2. **Empty stat files:** Some CSVs have headers but no data
3. **Player name formats:** Quoted names with "#" prefix
4. **Missing values:** Empty cells vs 0 vs blank

### Cleaning Strategy
```javascript
function normalizePlayerName(raw) {
  // "#4 Olivia H." -> "Olivia H."
  return raw.replace(/^["']?#\d+\s+/, '').replace(/["']$/g, '');
}

function parseDate(filename) {
  // "03.10 Practice Gabbi.csv" -> Date(2026, 2, 10)
  const match = filename.match(/(\d{2})\.(\d{2})/);
  return new Date(2026, parseInt(match[1]) - 1, parseInt(match[2]));
}

function cleanStat(val) {
  if (val === '' || val === undefined || val === null) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}
```

---

## 10. Example Dashboard Insights

### Sample Outputs

#### **Player Improvement Report**
```
🟢 Olivia H. - Trending UP
  • Attack%: 0.25 → 0.32 (+28% over 3 weeks)
  • Kills/Set: 2.5 → 5.0 (+100%)
  • Recommendation: Increase attack opportunities in exhibitions

🔴 Brooke N. - Needs Attention
  • Attack%: 0.50 → 0.06 (-88% last 5 practices)
  • Error rate increased from 0.5 to 1.2/set
  • Recommendation: Review technique, focus on consistency drills
```

#### **Setter Chemistry Matrix**
```
                Olivia H.   Jessica C.   Brooke N.   Ava S.
Gabbi             0.325       0.275        0.410      0.290
Janelle           0.310       0.340        0.285      0.305  
Maddy             0.295       0.300        0.320      0.315

Best Pairings:
  ✨ Gabbi → Brooke N. (0.410 Atk%)
  ✨ Janelle → Jessica C. (0.340 Atk%)
```

#### **Practice→Game Translation**
```
🎯 Clutch Performers (Better in games):
  1. Jessica C. (+0.12 Atk% boost)
  2. Kayla O. (+0.08)

⚠️ Practice Warriors (Drop-off in games):
  1. Ava S. (-0.15 Atk% drop)
  2. Olivia H. (-0.08)
```

---

## 11. Next Steps - Your Decision Points

Before we start building, please decide:

### A. Data Processing Approach
- **Option 1:** Client-side CSV parsing (slower initial load, no server needed)
- **Option 2:** Pre-process CSVs into JSON (faster, one-time setup)
- **Recommended:** Option 2 for better UX

### B. Charting Library
- **Chart.js** - Simpler, good for basic charts
- **Plotly.js** - More interactive, better for advanced analytics
- **Recommended:** Plotly.js for volleyball analytics

### C. Hosting
- **GitHub Pages** - Free, simple
- **Cloudflare Pages** - Free, faster globally
- **Netlify** - Free, easy deployment
- **Recommended:** GitHub Pages (matches basketball dashboard)

### D. Feature Priority
Rank these features 1-5 (1 = most important):
- [ ] Player improvement trends
- [ ] Setter analysis
- [ ] Practice vs game comparison
- [ ] Team dashboard
- [ ] Export/sharing tools

---

## 12. Starter Code Structure

I can help you build this! Here's what I propose:

1. **Create project folder** at `C:\Users\bryan\projects\volleyball-dashboard`
2. **Copy CSV data** into organized structure
3. **Build data processor** (Node.js script or Python)
4. **Generate processed.json** (one-time data transformation)
5. **Build HTML/CSS/JS dashboard** (modular like basketball-dashboard)
6. **Iterate on features** based on your priorities

**Ready to start?** Let me know:
- Which features you want first
- Your preferred tech choices (A, B, C above)
- If you want me to write the initial code scaffolding

---

## Notes & Observations

### Volleyball-Specific Insights
- **Practice frequency:** ~26 practice dates from 03.10 to 04.17
- **Exhibition games:** 5 matches against different opponents
- **Setter rotation:** All 3 setters get practice reps (good for development)
- **Data gaps:** 04.10-04.13 (no practices logged - spring break?)

### Potential Challenges
1. **Small sample size** for exhibitions (only 5 games)
   - Solution: Weight practice trends more heavily
2. **Setter stats during practice** might not match game conditions
   - Solution: Normalize by "competitive setting" vs "drill setting"
3. **Player substitutions** complicate per-set calculations
   - Solution: Use rate stats (per-set) instead of totals

### Basketball Dashboard Parallels
- **Player cards** → Volleyball player profiles
- **Shot analytics** → Attack/serve heat maps (if position data available)
- **Team builder** → Optimal lineup generator
- **Value lab** → Player development impact calculator

---

**Questions for You:**
1. Do you have any video footage or play-by-play data? (Would enable deeper setter analysis)
2. What's the target audience? (Coach, players, both, recruiting?)
3. Any specific design preferences? (Match school colors, branding?)
4. Timeline expectations? (When do you need this ready?)

I'm ready to help you build this! Just tell me what you want to tackle first. 🏐

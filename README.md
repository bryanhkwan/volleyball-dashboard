# 🏐 Volleyball Performance Dashboard

A comprehensive analytics dashboard for tracking volleyball player development, setter performance, and practice-to-game translation.

## 🎯 Features

### ✅ Implemented

- **Player Improvement Tracking** - Identify trending players (up/down/stable)
- **Practice vs Exhibition Comparison** - See who performs better in games vs practice
- **Setter Analysis** - Compare Gabbi, Janelle, and Maddy's effectiveness
- **Setter-Hitter Chemistry Matrix** - Visual heatmap showing optimal pairings
- **Team Performance Timeline** - Track team trends over the season
- **Individual Player Deep Dives** - Detailed stats and trend charts per player
- **Responsive Dark Theme** - Modern UI matching basketball-dashboard aesthetic

### 📊 Key Metrics Tracked

#### Attack Stats
- **Attack Efficiency (Atk%)** - (Kills - Errors) / Total Attacks
- **Kills per Set** - Offensive output rate
- **Error Rate** - Tracking reduction over time

#### Setter Stats
- **Assist Rate** - Assists / Total Attempts
- **Setting Accuracy** - Quality of sets (3-rated sets percentage)
- **Hitter Empowerment** - Which setters make hitters more efficient

#### Performance Indicators
- **Improvement Score** - Recent vs early performance comparison
- **Consistency Rating** - Lower variance = more reliable
- **Practice→Game Translation** - Clutch performers vs practice warriors

## 🚀 Quick Start

### 1. Open the dashboard

You need to serve the files from a local web server (browsers refuse to do
`fetch` / `IndexedDB` operations on raw `file://` paths). Easiest way:

```powershell
# From the project root
python -m http.server 8765
# then open http://localhost:8765/index.html
```

### 2. Upload your season folder

On first launch you'll see an upload screen. Either:

- **Drag your `Spring 2026` folder** onto the dropzone, or
- Click **Choose folder** and pick the season directory.

The app auto-detects which CSV is what based on either the folder structure
(`Team Stats / Setter Stats / Exhibitions/...`) or the filename:

| Filename pattern                                | What it is              |
| ----------------------------------------------- | ----------------------- |
| `MM.DD Practice.csv`                            | Team practice           |
| `MM.DD Practice <Setter>.csv`                   | Per-setter practice     |
| `MM.DD Exhibition <Opponent>.csv`               | Team exhibition (game)  |
| `MM.DD <Opponent> <Setter>.csv`                 | Per-setter exhibition   |

Setter names are recognized from the roster mapping in `modules/roster.js`,
so adding a new setter just means adding them to that file.

### 3. Add new sessions later

Use **Manage Data** in the header to drop in more CSVs whenever you record a
new practice or game. Existing sessions with the same date/opponent/setter
are replaced; everything else is merged in. All data is stored locally in
your browser (IndexedDB) - it never leaves your computer.

## 📁 Project Structure

```
volleyball_stats/
├── index.html                 # Main dashboard HTML
├── styles.css                 # Dark theme styling
├── app.js                     # App coordinator
├── modules/
│   ├── config.js              # Utilities & constants
│   ├── roster.js              # Toledo roster (name + position mapping)
│   ├── csv_parser.js          # Browser CSV parser
│   ├── uploader.js            # File classifier + dataset builder
│   ├── storage.js             # IndexedDB persistence
│   ├── data.js                # Data loading & access
│   ├── analytics.js           # Metrics calculation
│   ├── charts.js              # Plotly chart rendering
│   ├── players.js             # Player view logic
│   └── setters.js             # Setter analysis logic
├── Spring 2026/               # Example CSV files (upload these to seed)
│   ├── Team Stats/
│   ├── Setter Stats/
│   └── Exhibitions/
│       ├── Team Exhibition/
│       └── Setter Exhibition/
├── process_data.py            # Optional CLI version of the parser (legacy)
└── README.md                  # This file
```

## 🎨 Dashboard Views

### 1. Dashboard Home
- **Top Improving Players** - Best attack efficiency gains
- **Players Needing Attention** - Declining trends
- **Team Stats** - Avg Attack %, Kills/Set, Serve Efficiency
- **Team Trend Chart** - Performance over time

### 2. Player Analysis
- **Searchable Player List** - Find players quickly
- **Sort Options** - By name, attack %, kills/set, or improvement
- **Player Cards** - Trend badges, key stats
- **Player Detail Modal** - Click any player for:
  - Attack efficiency trend chart
  - Kills/set trend chart
  - Recent performance table
  - Strengths/weaknesses radar (future)

### 3. Setter Analysis
- **Setter Comparison Table** - Gabbi vs Janelle vs Maddy
  - Total assists, assist rate, avg rating, errors
- **Chemistry Heatmap** - Best setter→hitter pairings
  - Color-coded: Red (poor) → Yellow (avg) → Green (excellent)
- **Individual Setter Cards** - Detailed stats for each

### 4. Practice vs Games
- **Scatterplot** - Practice avg (x) vs Exhibition avg (y)
  - Diagonal line = perfect translation
  - Above = clutch performers
  - Below = practice warriors
- **Clutch Performers List** - Players who elevate in games
- **Practice Warriors List** - Players to help translate better

### 5. Timeline
- **Season Calendar** - Visual timeline of practices & games
- **Performance Chart** - Metric selection, trends over time

## 📈 How to Interpret the Data

### Player Improvement

**🟢 Trending UP** - Attack% increasing, good sign!
- Example: Olivia H. went from 0.25 → 0.32 (+28%)
- Action: Give more opportunities in exhibitions

**🔴 Trending DOWN** - Attack% declining, needs attention
- Example: Brooke N. dropped from 0.50 → 0.06 (-88%)
- Action: Review technique, consistency drills

**🟡 STABLE** - Consistent performance
- Action: Maintain current training

### Setter Chemistry

The heatmap shows **Hitter Attack % when set by each setter**:

```
Best Pairings (Example):
✨ Gabbi → Brooke N. (0.410 Atk%)
✨ Janelle → Jessica C. (0.340 Atk%)
```

**How to use:**
1. Find your best hitters (columns)
2. See which setter (rows) gets them the best results
3. Use optimal pairings in competitive matches

### Practice vs Game Translation

**Clutch Performers** (+0.08 or higher boost):
- Perform better under pressure
- Trust them in close games

**Practice Warriors** (-0.08 or worse drop):
- Need mental coaching
- More game-speed drills in practice

## 🔧 Customization

### Update Data

After adding new CSV files:

```bash
python process_data.py
```

Refresh your browser to see new data.

### Adjust Settings

Edit `modules/config.js`:

```javascript
const CONFIG = {
    DATA_URL: 'processed_data.json',
    ROLLING_WINDOW: 5,        // Change trend window (default: 5 practices)
    MIN_GAMES_FOR_TREND: 3    // Min practices needed for trend analysis
};
```

### Modify Metrics

Edit `modules/analytics.js` to:
- Add new calculated metrics
- Change improvement thresholds
- Customize trend detection

## 📊 Data Source

All data sourced from **Hudl** exports in Spring 2026:
- **26 practice dates** (03.10 - 04.17)
- **5 exhibition games** (vs Cleveland State, Robert Morris, Findlay, Oakland, Michigan)
- **18 unique players** tracked
- **3 setters** (Gabbi, Janelle, Maddy)

## 🐛 Troubleshooting

### Dashboard won't load
1. Check browser console (F12) for errors
2. Ensure `processed_data.json` exists
3. Run `python process_data.py` if missing

### Charts not rendering
1. Verify Plotly.js loaded (check Network tab)
2. Check for JavaScript errors in console
3. Try refreshing the page

### Players missing
1. Check if player has minimum 3 practices
2. Verify CSV files have valid data (not empty)
3. Run data processor again

## 🚀 Future Enhancements

**Phase 2 Features** (from VOLLEYBALL_DASHBOARD_PLAN.md):
- [ ] Radar charts for player strengths/weaknesses
- [ ] Predictive modeling (predict game performance from practice)
- [ ] Custom drill tracker
- [ ] Goal setting & progress tracking
- [ ] Export to PDF reports
- [ ] Deep-linkable player views
- [ ] Coach notes system

**Advanced Analytics**:
- [ ] Serve pressure zones (if position data available)
- [ ] Receive quality heatmaps
- [ ] Rotation effectiveness
- [ ] Injury risk detection (performance drop patterns)

## 📝 Notes

### Data Quality
- Some CSV files had empty stats (headers only) - filtered out
- Player names cleaned: `"#4 Olivia H."` → `Olivia H.`
- Typos in opponent names corrected during processing

### Performance
- Initial load: ~200ms (2.3 MB JSON)
- Chart rendering: <100ms per chart
- Fully responsive, works on mobile

### Browser Compatibility
- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- IE11: ❌ Not supported (uses modern JS)

## 📞 Questions?

Refer to `VOLLEYBALL_DASHBOARD_PLAN.md` for:
- Detailed metric definitions
- Implementation roadmap
- Volleyball stats explanations
- Advanced feature ideas

## 🏐 Enjoy tracking your team's progress!

Built with ❤️ for volleyball development.

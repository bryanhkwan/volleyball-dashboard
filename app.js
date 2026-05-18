// Main application coordinator.
//
// The dashboard is the "front page" a coach lands on.  v2 replaces the simple
// "improvers + decliners" list with three things a coach actually wants:
//   1. Focus This Week  -- prioritized, plain-English actions.
//   2. Position Health  -- recent attack % grouped by line.
//   3. Latest Session   -- last practice / game with the day's top performers.

let currentView = 'dashboard';
let timelineMetricKey = 'attack_pct';

const COMPARISON_CHART_CONFIG = {
    hitters: {
        title: 'Hitters',
        metricLabel: 'Attack %',
        subtitle: 'Practice Attack % vs Exhibition Attack %',
        xTitle: 'Practice Attack %',
        yTitle: 'Exhibition Attack %',
        percentAxis: true,
        emptyText: 'No hitter comparison data yet.',
        getPlayers: players => players.filter(p => {
            const meta = window.POSITION_GROUPS[p.positionGroup];
            return meta && meta.attackingRole;
        })
    },
    setters: {
        title: 'Setters',
        metricLabel: 'Set Rating',
        subtitle: 'Practice Set Rating vs Exhibition Set Rating',
        xTitle: 'Practice Set Rating',
        yTitle: 'Exhibition Set Rating',
        emptyText: 'No setter comparison data yet.',
        getPlayers: players => players.filter(p => p.positionGroup === 'S')
    },
    defenders: {
        title: 'Defenders',
        metricLabel: 'Pass Rating',
        subtitle: 'Practice Pass Rating vs Exhibition Pass Rating',
        xTitle: 'Practice Pass Rating',
        yTitle: 'Exhibition Pass Rating',
        emptyText: 'No defender comparison data yet.',
        getPlayers: players => players.filter(p => p.positionGroup === 'DS')
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Volleyball Dashboard initializing...');

    const loadingOverlay = document.getElementById('loadingOverlay');

    // Attempt to hydrate from IndexedDB.  `hasData` tells us whether the
    // coach has uploaded anything yet.
    await window.dataModule.loadData();
    loadingOverlay.classList.add('hidden');

    window.playersModule.init();
    window.settersModule.init();

    initNavigation();
    initModals();
    initComparisonChartExpansion();
    initTimelineControls();
    initUpload();

    renderRoot();

    console.log('Dashboard ready');
});

// Decides between the empty-state upload screen and the full dashboard.
function renderRoot() {
    const hasData = window.dataModule.hasData();
    const empty = document.getElementById('emptyState');
    const main = document.getElementById('appMain');
    const nav = document.querySelector('.main-nav');
    if (!hasData) {
        empty.classList.remove('hidden');
        main.style.display = 'none';
        if (nav) nav.style.display = 'none';
        // Show known setters in the file-format help.
        const settersEl = document.getElementById('rosterSetters');
        if (settersEl && window.ROSTER) {
            const names = Object.values(window.ROSTER)
                .filter(r => r.positionGroup === 'S')
                .map(r => r.fullName.split(' ')[0]);
            settersEl.textContent = names.join(', ');
        }
        return;
    }
    empty.classList.add('hidden');
    main.style.display = '';
    if (nav) nav.style.display = '';
    switchView(currentView || 'dashboard');
    updateHeaderStats();
}

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewName + 'View');
    if (view) view.classList.add('active');

    switch (viewName) {
        case 'dashboard':   renderDashboardView();  break;
        case 'players':     window.playersModule.renderPlayersList(); break;
        case 'setters':     window.settersModule.renderSetterView(); break;
        case 'comparison':  renderComparisonView(); break;
        case 'timeline':    renderTimelineView();   break;
    }
}

// ---------- Dashboard view ----------

function renderDashboardView() {
    const players = window.dataModule.getAllPlayers();
    const sessions = window.dataModule.getAllSessions();

    renderFocusInsights(players, sessions);
    renderImproversAndDecliners(players);
    renderPositionHealth(players);
    renderLatestSession(sessions);
    renderTeamTrend(sessions);
    renderTeamKpis(sessions);
}

function renderFocusInsights(players, sessions) {
    const insights = window.analytics.getCoachInsights(players, sessions);
    const el = document.getElementById('focusInsights');
    if (!el) return;
    if (!insights.length) {
        el.innerHTML = '<p class="muted">No urgent issues detected - whole roster looks steady.</p>';
        return;
    }
    el.innerHTML = insights.slice(0, 4).map(insight => `
        <div class="insight-card ${insight.severity}" ${insight.playerName ? `onclick="window.playersModule.showPlayerDetail('${insight.playerName}')"` : ''}>
            <div class="insight-badge">${insight.severity === 'high' ? 'High priority' : insight.severity === 'medium' ? 'Medium' : 'Heads up'}</div>
            <div class="insight-head">${insight.headline}</div>
            <div class="insight-body">${insight.body}</div>
        </div>
    `).join('');
}

function renderImproversAndDecliners(players) {
    const improving = window.analytics.getTopImprovers(players, 5);
    const declining = window.analytics.getDecliningPlayers(players, 5);

    const renderRow = ({ player, trends }, isUp) => {
        const meta = window.POSITION_GROUPS[player.positionGroup] || { color: '#FFD200' };
        const sign = isUp ? '+' : '';
        return `
            <div class="mover-row" onclick="window.playersModule.showPlayerDetail('${player.name}')">
                <div class="mover-id">
                    <span class="position-dot small" style="background:${meta.color}"></span>
                    <span class="mover-name">${player.fullName || player.name}</span>
                    <span class="mover-pos">${player.position || ''}</span>
                </div>
                <span class="mover-delta ${isUp ? 'pos' : 'neg'}">${sign}${trends.improvement.toFixed(0)}%</span>
            </div>
        `;
    };

    const improvingEl = document.getElementById('improvingPlayers');
    if (improvingEl) {
        improvingEl.innerHTML = improving.length
            ? improving.map(p => renderRow(p, true)).join('')
            : '<p class="muted">No clear improvers yet.</p>';
    }
    const decliningEl = document.getElementById('decliningPlayers');
    if (decliningEl) {
        decliningEl.innerHTML = declining.length
            ? declining.map(p => renderRow(p, false)).join('')
            : '<p class="muted">No declining trends detected.</p>';
    }
}

function renderPositionHealth(players) {
    const container = document.getElementById('positionHealth');
    if (!container) return;
    const groups = window.getOrderedPositionGroups();
    container.innerHTML = groups.map(g => {
        const meta = window.POSITION_GROUPS[g];
        const inGroup = players.filter(p => p.positionGroup === g);
        if (!inGroup.length) return '';

        // Average each player's last 5 CALENDAR DAYS, then average across the
        // group.  Use position-appropriate metric.
        const recentValues = inGroup.flatMap(p => {
            const days = window.analytics.collapseByRealSession(p.practices || []).slice(-5);
            const key = meta.attackingRole ? 'attack_pct'
                : g === 'DS' ? 'receive_pass_pct'
                : 'set_rtg';
            return [window.analytics.weightedStat(days, key)];
        });
        let valueDisplay;
        let label;
        if (meta.attackingRole) {
            valueDisplay = window.utils.pct(window.utils.avg(recentValues));
            label = 'Recent attack %';
        } else if (g === 'DS') {
            valueDisplay = window.utils.num(window.utils.avg(recentValues));
            label = 'Recent pass rating';
        } else {
            valueDisplay = window.utils.num(window.utils.avg(recentValues));
            label = 'Recent set rating';
        }

        return `
            <div class="health-card" style="--pos-color:${meta.color}">
                <div class="health-head">
                    <span class="position-dot" style="background:${meta.color}"></span>
                    <strong>${meta.name}</strong>
                </div>
                <div class="health-stat">
                    <div class="health-value">${valueDisplay}</div>
                    <div class="health-label">${label}</div>
                </div>
                <div class="health-roster">${inGroup.map(p =>
                    `<span class="roster-chip" onclick="event.stopPropagation(); window.playersModule.showPlayerDetail('${p.name}')">${p.fullName.split(' ')[0]}</span>`
                ).join('')}</div>
            </div>
        `;
    }).join('');
}

function renderLatestSession(sessions) {
    const container = document.getElementById('latestSession');
    if (!container) return;
    const latest = window.dataModule.getLatestSession();
    if (!latest) {
        container.innerHTML = '<p class="muted">No sessions yet.</p>';
        return;
    }
    // Gather attacking players from this session, ranked by kills then attack%.
    const attackers = (latest.players || [])
        .filter(p => {
            const ros = window.ROSTER[p.name];
            const group = ros ? ros.positionGroup : null;
            return group && ['OH', 'OPP', 'MB'].includes(group);
        })
        .map(p => ({
            name: p.name,
            ros: window.ROSTER[p.name],
            kills: window.utils.getStat(p, 'attack_k') || 0,
            attackPct: window.utils.getStat(p, 'attack_pct'),
            kps: window.utils.getStat(p, 'attack_k_per_set')
        }))
        .filter(p => p.kills > 0 || (p.attackPct !== null && p.attackPct > 0))
        .sort((a, b) => (b.kills - a.kills) || ((b.attackPct || 0) - (a.attackPct || 0)))
        .slice(0, 5);

    const sessionLabel = latest.type === 'exhibition'
        ? `Game vs ${latest.opponent || 'Opponent'}`
        : 'Team practice';

    container.innerHTML = `
        <div class="latest-meta">
            <span class="muted">${window.utils.formatDate(latest.date)}</span>
            <span class="${latest.type === 'exhibition' ? 'tag accent' : 'tag'}">${sessionLabel}</span>
        </div>
        <div class="latest-list">
            ${attackers.length ? attackers.map(p => `
                <div class="latest-row" onclick="window.playersModule.showPlayerDetail('${p.name}')">
                    <div>
                        <strong>${p.ros ? p.ros.fullName : p.name}</strong>
                        <span class="muted small">${p.ros ? p.ros.position : ''}</span>
                    </div>
                    <div class="latest-stats">
                        <span><strong>${Math.round(p.kills)}</strong> K</span>
                        <span>${window.utils.pct(p.attackPct, 0)}</span>
                    </div>
                </div>
            `).join('') : '<p class="muted">No attacking data captured for this session.</p>'}
        </div>
    `;
}

function renderTeamTrend(sessions) {
    window.charts.renderTimeline('teamTrendChart', sessions);
}

function renderTeamKpis(sessions) {
    const teamStats = window.analytics.calculateTeamStats(sessions);
    document.getElementById('avgAttackPct').textContent = window.utils.pct(teamStats.avgAttackPct);
    document.getElementById('avgKillsPerSet').textContent = window.utils.num(teamStats.avgKillsPerSet);
    document.getElementById('avgServeEff').textContent = window.utils.num(teamStats.avgServeEff);
    const passEl = document.getElementById('avgPassPct');
    if (passEl) passEl.textContent = window.utils.num(teamStats.avgPassPct);
}

// ---------- Comparison view ----------

function renderComparisonView() {
    const players = window.dataModule.getAllPlayers();
    window.charts.renderScatterPlot(
        'comparisonHittersChart',
        COMPARISON_CHART_CONFIG.hitters.getPlayers(players),
        COMPARISON_CHART_CONFIG.hitters
    );
    window.charts.renderScatterPlot(
        'comparisonSettersChart',
        COMPARISON_CHART_CONFIG.setters.getPlayers(players),
        COMPARISON_CHART_CONFIG.setters
    );
    window.charts.renderScatterPlot(
        'comparisonDefendersChart',
        COMPARISON_CHART_CONFIG.defenders.getPlayers(players),
        COMPARISON_CHART_CONFIG.defenders
    );

    const withComp = players
        .map(player => ({ player, comparison: window.analytics.calculatePracticeVsGame(player) }))
        .filter(item => item.comparison !== null);

    const clutch = withComp
        .filter(i => i.comparison.isClutch)
        .sort((a, b) => b.comparison.normalizedDelta - a.comparison.normalizedDelta);
    const warriors = withComp
        .filter(i => i.comparison.isPracticeWarrior)
        .sort((a, b) => a.comparison.normalizedDelta - b.comparison.normalizedDelta);

    const renderList = (list) => list.length
        ? list.map(({ player, comparison }) => {
            const meta = window.POSITION_GROUPS[player.positionGroup] || { color: '#FFD200' };
            const sampleTitle = comparison.smallSampleReasons.length
                ? ` title="${comparison.smallSampleReasons.join('; ')}"`
                : '';
            return `
                <div class="mover-row" onclick="window.playersModule.showPlayerDetail('${player.name}')">
                    <div class="mover-id">
                        <span class="position-dot small" style="background:${meta.color}"></span>
                        <span class="mover-name">${player.fullName || player.name}</span>
                        <span class="mover-pos">${player.position || ''}</span>
                        <span class="tag accent">${comparison.metricLabel}</span>
                        ${comparison.isSmallSample ? `<span class="tag warn"${sampleTitle}>small sample</span>` : ''}
                    </div>
                    <span class="mover-delta ${comparison.delta >= 0 ? 'pos' : 'neg'}">${window.analytics.formatComparisonDelta(comparison)}</span>
                </div>
            `;
        }).join('')
        : '<p class="muted">No players in this category.</p>';

    const clutchEl = document.getElementById('clutchPlayers');
    if (clutchEl) clutchEl.innerHTML = renderList(clutch);
    const warriorsEl = document.getElementById('practiceWarriors');
    if (warriorsEl) warriorsEl.innerHTML = renderList(warriors);
}

function initComparisonChartExpansion() {
    const view = document.getElementById('comparisonView');
    if (!view) return;

    view.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-expand-chart]');
        if (!trigger || !view.contains(trigger)) return;
        e.preventDefault();
        openComparisonChart(trigger.dataset.expandChart);
    });

    view.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const trigger = e.target.closest('[data-expand-chart]');
        if (!trigger || !view.contains(trigger)) return;
        e.preventDefault();
        openComparisonChart(trigger.dataset.expandChart);
    });
}

function openComparisonChart(chartKey) {
    const config = COMPARISON_CHART_CONFIG[chartKey];
    const modal = document.getElementById('comparisonChartModal');
    if (!config || !modal) return;

    const title = document.getElementById('comparisonChartModalTitle');
    const subtitle = document.getElementById('comparisonChartModalSubtitle');
    if (title) title.textContent = `${config.title} - ${config.metricLabel}`;
    if (subtitle) subtitle.textContent = config.subtitle;

    modal.classList.add('active');
    requestAnimationFrame(() => {
        const players = config.getPlayers(window.dataModule.getAllPlayers());
        window.charts.renderScatterPlot('comparisonExpandedChart', players, Object.assign({}, config, {
            height: 620,
            emptyText: config.emptyText
        }));
    });
}

function closeComparisonChart() {
    const modal = document.getElementById('comparisonChartModal');
    const chart = document.getElementById('comparisonExpandedChart');
    if (modal) modal.classList.remove('active');
    if (chart && window.Plotly) Plotly.purge(chart);
}

// ---------- Timeline view ----------

function initTimelineControls() {
    const select = document.getElementById('timelineMetric');
    if (!select) return;
    select.addEventListener('change', (e) => {
        timelineMetricKey = e.target.value;
        if (currentView === 'timeline') renderTimelineView();
    });
}

function renderTimelineView() {
    const sessions = window.dataModule.getAllSessions();
    const metricKey = timelineMetricKey;
    const metricLabels = {
        attack_pct:        'Team Attack %',
        attack_k_per_set:  'Team Kills / Set',
        serve_eff:         'Team Serve Efficiency',
        receive_pass_pct:  'Team Pass Rating'
    };

    const metricFn = (session) => {
        const players = session.players || [];
        return window.analytics.weightedStat(players, metricKey);
    };

    // Hudl's "Pass%" column is actually a 0-3 rating, not a real percentage,
    // so only true % metrics get the percent formatter.
    const isPercentMetric = metricKey === 'attack_pct';
    window.charts.renderTimeline(
        'timelineChart',
        sessions,
        metricFn,
        metricLabels[metricKey] || 'Value',
        { percent: isPercentMetric }
    );

    renderCalendar(sessions);
}

function renderCalendar(sessions) {
    const container = document.getElementById('timelineCalendar');
    if (!container) return;

    // Group sessions by ISO week.
    const byWeek = {};
    sessions.forEach(s => {
        const d = window.utils.parseLocalDate(s.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.getFullYear(), d.getMonth(), diff);
        const key = monday.toISOString().slice(0, 10);
        if (!byWeek[key]) byWeek[key] = { weekStart: monday, sessions: [] };
        byWeek[key].sessions.push(s);
    });

    const weeks = Object.values(byWeek).sort((a, b) => a.weekStart - b.weekStart);

    container.innerHTML = `
        <div class="calendar">
            ${weeks.map(week => {
                const wkLabel = week.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `
                    <div class="calendar-week">
                        <div class="calendar-week-label">Wk of ${wkLabel}</div>
                        <div class="calendar-cells">
                            ${week.sessions.map(s => `
                                <div class="calendar-cell ${s.type}" title="${s.opponent || 'Practice'} - ${s.date}">
                                    <div class="cal-date">${window.utils.formatDate(s.date)}</div>
                                    <div class="cal-label">${s.opponent || (s.category === 'setter' ? 'Setter practice' : 'Practice')}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ---------- Header / modal ----------

function updateHeaderStats() {
    const meta = window.dataModule.getMetadata();
    document.getElementById('totalPlayers').textContent = meta.total_players || 0;
    document.getElementById('totalPractices').textContent = meta.unique_practice_days || meta.total_practices || 0;
    document.getElementById('totalGames').textContent = meta.unique_game_days || meta.total_exhibitions || 0;
}

function initModals() {
    const modal = document.getElementById('playerModal');
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    const dataModal = document.getElementById('dataModal');
    const dataModalClose = dataModal.querySelector('.modal-close');
    const dataBtn = document.getElementById('manageDataBtn');
    if (dataBtn) {
        dataBtn.addEventListener('click', () => {
            renderDataSummary();
            dataModal.classList.add('active');
        });
    }
    dataModalClose.addEventListener('click', () => dataModal.classList.remove('active'));
    dataModal.addEventListener('click', (e) => {
        if (e.target === dataModal) dataModal.classList.remove('active');
    });

    const chartModal = document.getElementById('comparisonChartModal');
    if (chartModal) {
        const chartModalClose = chartModal.querySelector('.modal-close');
        chartModalClose.addEventListener('click', closeComparisonChart);
        chartModal.addEventListener('click', (e) => {
            if (e.target === chartModal) closeComparisonChart();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modal.classList.remove('active');
            dataModal.classList.remove('active');
            closeComparisonChart();
        }
    });

    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (!confirm('Clear all uploaded data from this browser? This cannot be undone.')) return;
            await window.dataModule.clearData();
            dataModal.classList.remove('active');
            renderRoot();
        });
    }
}

// ---------- Upload pipeline ----------

function initUpload() {
    bindDropzone('dropzonePrimary', 'folderInputPrimary', 'fileInputPrimary');
    bindDropzone('dropzoneSecondary', 'folderInputSecondary', 'fileInputSecondary');
}

function bindDropzone(zoneId, folderInputId, fileInputId) {
    const zone = document.getElementById(zoneId);
    const folderInput = document.getElementById(folderInputId);
    const fileInput = document.getElementById(fileInputId);
    if (!zone) return;

    folderInput.addEventListener('change', (e) => handleUpload(e.target.files));
    fileInput.addEventListener('change', (e) => handleUpload(e.target.files));

    ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        zone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', async (e) => {
        const files = await collectDroppedFiles(e.dataTransfer);
        if (files.length) handleUpload(files);
    });
}

// Recursively collect File objects out of a DataTransfer (so folder drops
// work in Chromium/Edge/Safari, not just the input picker).
async function collectDroppedFiles(dataTransfer) {
    const files = [];
    const items = dataTransfer.items;
    if (items && items[0] && items[0].webkitGetAsEntry) {
        const walkers = [];
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) walkers.push(walkEntry(entry, ''));
        }
        const arrays = await Promise.all(walkers);
        arrays.forEach(arr => files.push(...arr));
        return files;
    }
    return Array.from(dataTransfer.files);
}

function walkEntry(entry, prefix) {
    return new Promise((resolve) => {
        if (entry.isFile) {
            entry.file(file => {
                // Persist the relative path so the classifier can use it.
                try { Object.defineProperty(file, 'webkitRelativePath', { value: prefix + entry.name }); }
                catch (_) {}
                resolve([file]);
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const results = [];
            const readBatch = () => reader.readEntries(async (entries) => {
                if (!entries.length) {
                    resolve(results);
                    return;
                }
                const arrs = await Promise.all(entries.map(e => walkEntry(e, prefix + entry.name + '/')));
                arrs.forEach(a => results.push(...a));
                readBatch();
            });
            readBatch();
        } else {
            resolve([]);
        }
    });
}

async function handleUpload(fileList) {
    const files = Array.from(fileList).filter(f => /\.csv$/i.test(f.name));
    if (!files.length) {
        alert('No CSV files found in your selection.');
        return;
    }
    const dataModal = document.getElementById('dataModal');
    dataModal.classList.add('active');

    const resultSection = document.getElementById('uploadResultSection');
    const resultEl = document.getElementById('uploadResult');
    resultSection.style.display = '';
    resultEl.innerHTML = `
        <div class="upload-progress">
            <div>Parsing <span id="uploadCounter">0 / ${files.length}</span> CSVs...</div>
            <div class="progress-bar"><div class="progress-bar-fill" id="progressFill" style="width: 0%"></div></div>
        </div>
    `;

    try {
        const existing = window.dataModule.getRawDataset();
        const existingSessions = (existing && existing.sessions) || [];

        const { dataset, ingested, skipped } = await window.uploader.ingest(
            files,
            existingSessions,
            (done, total) => {
                const counterEl = document.getElementById('uploadCounter');
                const fillEl = document.getElementById('progressFill');
                if (counterEl) counterEl.textContent = `${done} / ${total}`;
                if (fillEl) fillEl.style.width = `${(done / total) * 100}%`;
            }
        );

        await window.dataModule.setDataset(dataset);

        resultEl.innerHTML = renderUploadResult(ingested, skipped);
        renderDataSummary();
        renderRoot();
    } catch (err) {
        console.error('Upload failed:', err);
        resultEl.innerHTML = `<p style="color: var(--bad);">Upload failed: ${err.message || err}</p>`;
    }
}

function renderUploadResult(ingested, skipped) {
    const byKind = ingested.reduce((acc, r) => {
        acc[r.classification] = (acc[r.classification] || 0) + 1;
        return acc;
    }, {});
    const fmt = (k) => ({
        'team-practice':     'Team practices',
        'setter-practice':   'Setter practices',
        'team-exhibition':   'Team exhibitions',
        'setter-exhibition': 'Setter exhibitions'
    }[k] || k);

    const pills = [
        `<span class="pill good">${ingested.length} parsed</span>`,
        ...Object.keys(byKind).map(k => `<span class="pill">${byKind[k]} ${fmt(k)}</span>`),
        skipped.length ? `<span class="pill warn">${skipped.length} skipped</span>` : ''
    ].filter(Boolean).join('');

    const skippedList = skipped.length ? `
        <div class="skipped-list">
            ${skipped.map(s => `
                <div class="skipped-row">
                    <strong>${s.file.name}</strong>
                    <div class="reason">${s.reason}</div>
                </div>
            `).join('')}
        </div>
    ` : '';

    return `
        <div class="upload-summary">${pills}</div>
        ${skippedList}
    `;
}

function renderDataSummary() {
    const el = document.getElementById('dataSummary');
    if (!el) return;
    const meta = window.dataModule.getMetadata();
    const updatedAt = window.dataModule.getUpdatedAt();
    const updatedDisplay = updatedAt
        ? new Date(updatedAt).toLocaleString()
        : 'Never';

    const tiles = [
        ['Players', meta.total_players || 0],
        ['Practice days', meta.unique_practice_days || 0],
        ['Exhibitions', meta.unique_game_days || 0],
        ['Date range', meta.date_range && meta.date_range.start
            ? `${meta.date_range.start} to ${meta.date_range.end}`
            : '-'],
        ['Last upload', updatedDisplay]
    ];
    el.innerHTML = tiles.map(([lbl, val]) => `
        <div class="data-summary-tile">
            <div class="num">${val}</div>
            <div class="lbl">${lbl}</div>
        </div>
    `).join('');
}

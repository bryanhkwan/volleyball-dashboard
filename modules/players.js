// Player roster view and player-detail modal.
//
// Coach-facing changes from v1:
//   * Players are grouped by position (Outside Hitters, Middles, ...) so the
//     coach finds people the way they think about the team.
//   * Filter chips at the top let you isolate a position group.
//   * Each card shows POSITION-AWARE primary stats (a libero's card highlights
//     Pass% / Digs, a hitter's card highlights Attack%).
//   * Player modal now shows roster info (jersey, class, height), a rolling
//     trend overlay, and (for hitters) attack% broken down by setter.

const playersModule = {
    currentSearch: '',
    currentSort: 'improvement',
    currentGroupFilter: 'ALL',

    init: () => {
        const searchInput = document.getElementById('playerSearch');
        const sortSelect  = document.getElementById('playerSort');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                playersModule.currentSearch = e.target.value.toLowerCase();
                playersModule.renderPlayersList();
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                playersModule.currentSort = e.target.value;
                playersModule.renderPlayersList();
            });
        }

        playersModule.renderFilterChips();
    },

    renderFilterChips: () => {
        const container = document.getElementById('positionChips');
        if (!container) return;
        // Roster metadata already includes UNKNOWN so unrostered players stay filterable.
        const groups = window.getOrderedPositionGroups();
        const all = `<button class="chip ${playersModule.currentGroupFilter === 'ALL' ? 'active' : ''}" data-group="ALL">
            <span class="chip-dot" style="background:#fff"></span>All Players
        </button>`;
        const buttons = groups.map(g => {
            const meta = window.POSITION_GROUPS[g];
            if (!meta) return '';
            const count = window.dataModule.getPlayersByGroup(g).length;
            if (!count) return '';
            return `<button class="chip ${playersModule.currentGroupFilter === g ? 'active' : ''}" data-group="${g}">
                <span class="chip-dot" style="background:${meta.color}"></span>${meta.name} <span class="chip-count">${count}</span>
            </button>`;
        }).join('');
        container.innerHTML = all + buttons;

        container.querySelectorAll('.chip').forEach(btn => {
            btn.addEventListener('click', () => {
                playersModule.currentGroupFilter = btn.dataset.group;
                playersModule.renderFilterChips();
                playersModule.renderPlayersList();
            });
        });
    },

    renderPlayersList: () => {
        const container = document.getElementById('playersList');
        if (!container) return;

        const all = window.dataModule.getAllPlayers();

        // Apply filters.
        let pool = all;
        if (playersModule.currentGroupFilter !== 'ALL') {
            pool = pool.filter(p => p.positionGroup === playersModule.currentGroupFilter);
        }
        if (playersModule.currentSearch) {
            const q = playersModule.currentSearch;
            pool = pool.filter(p =>
                (p.fullName || '').toLowerCase().includes(q) ||
                (p.name || '').toLowerCase().includes(q) ||
                (p.position || '').toLowerCase().includes(q)
            );
        }

        // Annotate with trends so we can sort.
        const enriched = pool.map(player => ({
            player,
            trends: analytics.calculatePlayerTrends(player),
            comparison: analytics.calculatePracticeVsGame(player),
            career: analytics.calculateCareerTotals(player)
        }));

        // Group by position, then sort within group by chosen sort.
        const grouped = {};
        window.getOrderedPositionGroups().forEach(g => { grouped[g] = []; });
        enriched.forEach(item => {
            const g = item.player.positionGroup || 'OTHER';
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(item);
        });

        const sortFn = (a, b) => {
            switch (playersModule.currentSort) {
                case 'name':
                    return (a.player.fullName || a.player.name).localeCompare(b.player.fullName || b.player.name);
                case 'attackPct':
                    return (b.trends && b.trends.recentAttackAvg || 0) - (a.trends && a.trends.recentAttackAvg || 0);
                case 'killsPerSet':
                    return (b.trends && b.trends.recentKillsAvg || 0) - (a.trends && a.trends.recentKillsAvg || 0);
                case 'jersey':
                    return (a.player.jersey || 999) - (b.player.jersey || 999);
                case 'improvement':
                default:
                    return (b.trends && b.trends.roleImprovement || -Infinity) - (a.trends && a.trends.roleImprovement || -Infinity);
            }
        };
        Object.keys(grouped).forEach(g => grouped[g].sort(sortFn));

        // Render all known position buckets, including UNKNOWN for unrostered players.
        let html = '';
        const groupOrder = window.getOrderedPositionGroups();
        groupOrder.forEach(g => {
            const meta = window.POSITION_GROUPS[g];
            const items = grouped[g] || [];
            if (!items.length || !meta) return;
            html += `
                <section class="position-section">
                    <div class="position-header" style="--pos-color:${meta.color}">
                        <span class="position-dot"></span>
                        <h3>${meta.name}</h3>
                        <span class="position-count">${items.length} ${items.length === 1 ? 'player' : 'players'}</span>
                    </div>
                    <div class="players-grid">
                        ${items.map(item => playersModule.renderPlayerCard(item)).join('')}
                    </div>
                </section>
            `;
        });

        if (!html) {
            html = '<p class="empty-state">No players match your filters.</p>';
        }
        container.innerHTML = html;

        // Now that cards are in the DOM, draw the sparklines for hitter cards.
        requestAnimationFrame(() => {
            enriched.forEach(({ player, trends }) => {
                const sparkId = `spark-${player.name.replace(/[^\w]/g, '')}`;
                const el = document.getElementById(sparkId);
                if (!el || !trends) return;
                const meta = window.POSITION_GROUPS[player.positionGroup];
                const color = meta ? meta.color : window.CHART_COLORS.accent;
                const series = trends.roleValues;
                const clean = (series || []).filter(v => v !== null && !isNaN(v));
                if (clean.length >= 2) charts.renderSparkline(sparkId, clean, color);
            });
        });
    },

    renderPlayerCard: ({ player, trends, comparison, career }) => {
        const meta = window.POSITION_GROUPS[player.positionGroup] || { color: '#FFD200', primaryStats: ['attack_pct'] };
        const sparkId = `spark-${player.name.replace(/[^\w]/g, '')}`;
        const displaySessions = playersModule.getDisplaySessions(player);
        const gameCount = displaySessions.filter(s => s.opponent).length;

        const trendDir = trends ? trends.roleTrendDirection : null;
        const improvement = trends ? trends.roleImprovement : null;
        const trendBadge = (() => {
            if (!trendDir) return '<span class="trend-badge stable">Not enough data</span>';
            if (trendDir === 'up') return `<span class="trend-badge up">Trending up</span>`;
            if (trendDir === 'down') return `<span class="trend-badge down">Trending down</span>`;
            return `<span class="trend-badge stable">Stable</span>`;
        })();

        // Position-relevant primary stats (top 2).
        const statKeys = meta.primaryStats.slice(0, 4);
        const primaryHtml = statKeys.map(k => playersModule.statRow(player, k)).join('');

        const initials = (player.fullName || player.name).split(' ')
            .map(part => part[0]).join('').slice(0, 2).toUpperCase();

        return `
            <div class="player-card" data-group="${player.positionGroup}" onclick="playersModule.showPlayerDetail('${player.name}')">
                <div class="player-card-head">
                    <div class="avatar" style="background: linear-gradient(135deg, ${meta.color}, ${meta.color}88)">
                        ${initials}
                    </div>
                    <div class="player-id">
                        <div class="player-name">${player.fullName || player.name}</div>
                        <div class="player-meta">
                            <span class="position-pill" style="--pos-color:${meta.color}">${player.position || '?'}</span>
                            ${player.jersey ? `<span class="jersey">#${player.jersey}</span>` : ''}
                            ${player.class ? `<span class="muted">${player.class}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="card-trend-row">
                    ${trendBadge}
                    ${improvement !== null
                        ? `<span class="improvement ${improvement >= 0 ? 'pos' : 'neg'}">${improvement >= 0 ? '+' : ''}${improvement.toFixed(0)}%</span>`
                        : ''}
                </div>

                <div class="sparkline-wrap" id="${sparkId}"></div>

                <div class="card-stats">${primaryHtml}</div>

                <div class="card-footer">
                    <span>${trends ? trends.totalPractices : (player.practices || []).length} practices</span>
                    <span>|</span>
                    <span>${gameCount} games</span>
                    ${comparison && comparison.isClutch ? '<span class="tag good">Clutch</span>' : ''}
                    ${comparison && comparison.isPracticeWarrior ? '<span class="tag warn">Practice warrior</span>' : ''}
                </div>
            </div>
        `;
    },

    statRow: (player, statKey) => {
        const meta = (window.STAT_LABELS && window.STAT_LABELS[statKey])
            || { label: statKey, format: 'num' };
        // Average over the last 5 real practice sessions using the official
        // session row, with weighted math for ratio stats.
        const recent = analytics.collapseByRealSession(player.practices || []).slice(-5);
        const value = analytics.weightedStat(recent, statKey);
        let display;
        if (value === null) display = '-';
        else if (meta.format === 'pct') display = utils.pct(value);
        else if (meta.format === 'int') display = Math.round(value);
        else display = utils.num(value);
        return `
            <div class="card-stat">
                <span class="card-stat-label">${meta.label}</span>
                <span class="card-stat-value">${display}</span>
            </div>
        `;
    },

    showPlayerDetail: (playerName) => {
        const player = window.dataModule.getPlayerByName(playerName);
        if (!player) return;

        const modal = document.getElementById('playerModal');
        const meta = window.POSITION_GROUPS[player.positionGroup] || { color: '#FFD200', primaryStats: [] };

        const trends = analytics.calculatePlayerTrends(player);
        const comparison = analytics.calculatePracticeVsGame(player);
        const consistency = analytics.calculateConsistency(player);
        const career = analytics.calculateCareerTotals(player);
        const recentSessions = analytics.collapseByRealSession(player.practices || []).slice(-5);

        // Header.
        const headerEl = document.getElementById('modalPlayerHeader');
        if (headerEl) {
            const initials = (player.fullName || player.name).split(' ')
                .map(p => p[0]).join('').slice(0, 2).toUpperCase();
            headerEl.innerHTML = `
                <div class="modal-avatar" style="background: linear-gradient(135deg, ${meta.color}, ${meta.color}88)">${initials}</div>
                <div>
                    <h2>${player.fullName || player.name}</h2>
                    <div class="modal-meta">
                        <span class="position-pill" style="--pos-color:${meta.color}">${player.position || '?'}</span>
                        ${player.jersey ? `<span class="jersey">#${player.jersey}</span>` : ''}
                        ${player.class ? `<span>${player.class}</span>` : ''}
                        ${player.height ? `<span>${player.height}</span>` : ''}
                        ${player.hometown ? `<span class="muted">${player.hometown}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // Quick-summary KPIs.
        const kpisEl = document.getElementById('modalKpis');
        if (kpisEl) {
            kpisEl.innerHTML = playersModule.roleKpis(player, trends, consistency, recentSessions);
        }

        const flagsEl = document.getElementById('modalDataFlags');
        if (flagsEl) {
            flagsEl.innerHTML = playersModule.renderQualityFlags(player, trends, comparison);
            flagsEl.style.display = flagsEl.innerHTML ? 'flex' : 'none';
        }

        const roleTitleEl = document.getElementById('modalRoleBreakdownTitle');
        if (roleTitleEl) {
            roleTitleEl.textContent = player.positionGroup === 'DS'
                ? 'Serve Receive / Defense'
                : player.positionGroup === 'S'
                    ? 'Setting Breakdown'
                    : 'Attack Breakdown';
        }
        const roleBreakdownEl = document.getElementById('modalRoleBreakdown');
        if (roleBreakdownEl) {
            roleBreakdownEl.innerHTML = playersModule.renderRoleBreakdown(player, recentSessions);
        }

        // Practice vs game comparison strip.
        const pvgEl = document.getElementById('modalPvg');
        if (pvgEl) {
            if (!comparison) {
                pvgEl.innerHTML = '<p class="muted">No exhibition data yet.</p>';
            } else {
                const cls = comparison.isClutch ? 'good'
                    : comparison.isPracticeWarrior ? 'warn' : 'stable';
                const label = comparison.isClutch ? 'Clutch performer'
                    : comparison.isPracticeWarrior ? 'Practice warrior' : 'Translates well';
                const practiceValue = analytics.formatComparisonValue(comparison, comparison.practiceAvg);
                const gameValue = analytics.formatComparisonValue(comparison, comparison.exhibitionAvg);
                const deltaValue = analytics.formatComparisonDelta(comparison);
                pvgEl.innerHTML = `
                    <div class="pvg-row">
                        <div>${comparison.metricLabel} practice: <strong>${practiceValue}</strong> <span class="muted small">(${comparison.practiceCount} sessions / ${Math.round(comparison.practiceVolume)} ${comparison.volumeLabel})</span></div>
                        <div>${comparison.metricLabel} games: <strong>${gameValue}</strong> <span class="muted small">(${comparison.exhibitionCount} games / ${Math.round(comparison.exhibitionVolume)} ${comparison.volumeLabel})</span></div>
                        <div>Delta: <strong class="${comparison.delta >= 0 ? 'text-good' : 'text-bad'}">${deltaValue}</strong></div>
                        <span class="trend-badge ${cls}">${label}</span>
                    </div>
                `;
            }
        }

        modal.classList.add('active');

        // Draw the charts after layout settles. Use one official session row
        // per date so setter splits don't distort the player's main trend.
        requestAnimationFrame(() => {
            const practices = analytics.collapseByRealSession(player.practices || []);
            const dates = practices.map(p => p.date);
            const trendSpecs = meta.attackingRole ? [
                { id: 'modalAttackChart', titleId: 'modalPrimaryTrendTitle', noteId: 'modalPrimaryTrendNote', title: 'Attack Efficiency Trend', key: 'attack_pct', axis: 'Attack %', percentY: true },
                { id: 'modalKillsChart', titleId: 'modalSecondaryTrendTitle', noteId: 'modalSecondaryTrendNote', title: 'Kills / Set Trend', key: 'attack_k_per_set', axis: 'K/Set' }
            ] : player.positionGroup === 'DS' ? [
                { id: 'modalAttackChart', titleId: 'modalPrimaryTrendTitle', noteId: 'modalPrimaryTrendNote', title: 'Pass Rating Trend', key: 'receive_pass_pct', axis: 'Rating' },
                { id: 'modalKillsChart', titleId: 'modalSecondaryTrendTitle', noteId: 'modalSecondaryTrendNote', title: 'Digs Trend', key: 'dig_ds', axis: 'Digs' }
            ] : [
                { id: 'modalAttackChart', titleId: 'modalPrimaryTrendTitle', noteId: 'modalPrimaryTrendNote', title: 'Set Rating Trend', key: 'set_rtg', axis: 'Set Rating' },
                { id: 'modalKillsChart', titleId: 'modalSecondaryTrendTitle', noteId: 'modalSecondaryTrendNote', title: 'Assists Trend', key: 'set_ast', axis: 'Assists' }
            ];

            trendSpecs.forEach(spec => {
                const titleEl = document.getElementById(spec.titleId);
                if (titleEl) titleEl.textContent = spec.title;
                const noteEl = document.getElementById(spec.noteId);
                if (noteEl) {
                    noteEl.textContent = spec.key === 'attack_pct'
                        ? 'Yellow = official practice line. Blue = weighted 3-session average. Dashed = overall direction.'
                        : 'Yellow = official practice line. Blue = 3-session average. Dashed = overall direction.';
                }
                charts.renderTrendChart(
                    spec.id,
                    dates,
                    practices.map(p => utils.getStat(p.stats, spec.key)),
                    spec.title,
                    spec.axis,
                    {
                        percentY: spec.percentY,
                        rollingValues: analytics.rollingWeightedStat(practices, spec.key, 3),
                        rollingLabel: spec.key === 'attack_pct' ? 'Weighted 3-session avg' : '3-session avg'
                    }
                );
            });

            // Per-setter breakdown card (only meaningful for hitters).
            const perSetterEl = document.getElementById('modalPerSetter');
            if (meta.attackingRole) {
                const allSetters = window.dataModule.getAllSetters();
                const chemistry = analytics.calculateSetterChemistry(allSetters, window.dataModule.getAllPlayers());
                const perSetter = {};
                Object.keys(allSetters).forEach(setterName => {
                    perSetter[setterName] = (chemistry[setterName] && chemistry[setterName][player.name]) || {
                        attempts: 0,
                        attackAttempts: 0,
                        avgAttackPct: null,
                        baselineAttackPct: null,
                        lift: null
                    };
                });
                charts.renderPerSetterBreakdown('modalPerSetter', perSetter);
            } else {
                perSetterEl.innerHTML = '<p class="muted">Not applicable for this position.</p>';
            }

            playersModule.renderRecentStatsTable(player);
        });
    },

    kpiTile: (label, value, mood) => `
        <div class="kpi-tile ${mood || ''}">
            <div class="kpi-value">${value}</div>
            <div class="kpi-label">${label}</div>
        </div>
    `,

    roleMetric: (label, value) => `
        <div class="role-metric">
            <div class="role-metric-value">${value}</div>
            <div class="role-metric-label">${label}</div>
        </div>
    `,

    sumRecent: (sessions, key) => sessions.reduce((acc, session) => {
        const val = utils.getStat(session.stats, key);
        return val === null ? acc : acc + val;
    }, 0),

    roleKpis: (player, trends, consistency, recentSessions) => {
        const volume = analytics.getAttackVolume(recentSessions);
        const sets = playersModule.sumRecent(recentSessions, 'sets_played');
        const receiveAttempts = playersModule.sumRecent(recentSessions, 'receive_ta');
        const setAttempts = playersModule.sumRecent(recentSessions, 'set_ta');
        const assists = playersModule.sumRecent(recentSessions, 'set_ast');
        const setErrors = playersModule.sumRecent(recentSessions, 'set_se');

        if (player.positionGroup === 'DS') {
            return [
                playersModule.kpiTile('Recent Pass Rating', utils.num(analytics.weightedStat(recentSessions, 'receive_pass_pct'))),
                playersModule.kpiTile('Receive Attempts', Math.round(receiveAttempts)),
                playersModule.kpiTile('Digs / Session', utils.num(utils.avg(recentSessions.map(s => utils.getStat(s.stats, 'dig_ds'))))),
                playersModule.kpiTile('Serve Eff', utils.num(analytics.weightedStat(recentSessions, 'serve_eff')))
            ].join('');
        }

        if (player.positionGroup === 'S') {
            return [
                playersModule.kpiTile('Recent Set Rating', utils.num(analytics.weightedStat(recentSessions, 'set_rtg'))),
                playersModule.kpiTile('Assists', Math.round(assists)),
                playersModule.kpiTile('Assist Rate', utils.pct(setAttempts > 0 ? assists / setAttempts : null)),
                playersModule.kpiTile('Set Errors', Math.round(setErrors))
            ].join('');
        }

        return [
            playersModule.kpiTile('Recent Attack %', utils.pct(trends && trends.recentAttackAvg)),
            playersModule.kpiTile('Kills / Set', utils.num(trends && trends.recentKillsAvg)),
            playersModule.kpiTile('Attack Attempts', Math.round(volume.attempts)),
            playersModule.kpiTile('Error %', utils.pct(volume.attempts > 0 ? volume.errors / volume.attempts : null),
                volume.attempts > 0 && volume.errors / volume.attempts > 0.2 ? 'bad' : '')
        ].join('');
    },

    renderQualityFlags: (player, trends, comparison) => {
        const flags = [];
        if (comparison && comparison.isSmallSample) {
            const detail = comparison.smallSampleReasons.length
                ? ` title="${comparison.smallSampleReasons.join('; ')}"`
                : '';
            flags.push({
                mood: 'warn',
                text: comparison.sampleSummary,
                titleAttr: detail
            });
        }
        const isAttacker = ['OH', 'OPP', 'MB', 'UNKNOWN'].includes(player.positionGroup);
        if (trends && trends.missingAttackDays > 0 && isAttacker) {
            flags.push({
                mood: 'warn',
                text: `${trends.missingAttackDays} practice day${trends.missingAttackDays === 1 ? '' : 's'} missing attack stats`
            });
        }
        if (trends && trends.attackAttempts > 0 && trends.attackAttempts < 35 && isAttacker) {
            flags.push({
                mood: 'warn',
                text: `${Math.round(trends.attackAttempts)} total practice attempts`
            });
        }
        return flags.map(flag => `<span class="quality-flag ${flag.mood || ''}"${flag.titleAttr || ''}>${flag.text}</span>`).join('');
    },

    renderRoleBreakdown: (player, recentSessions) => {
        const volume = analytics.getAttackVolume(recentSessions);
        const sets = playersModule.sumRecent(recentSessions, 'sets_played');

        if (player.positionGroup === 'DS') {
            return [
                playersModule.roleMetric('Pass Rating', utils.num(analytics.weightedStat(recentSessions, 'receive_pass_pct'))),
                playersModule.roleMetric('Receive Attempts', Math.round(playersModule.sumRecent(recentSessions, 'receive_ta'))),
                playersModule.roleMetric('Digs / Session', utils.num(utils.avg(recentSessions.map(s => utils.getStat(s.stats, 'dig_ds'))))),
                playersModule.roleMetric('Serve Eff', utils.num(analytics.weightedStat(recentSessions, 'serve_eff')))
            ].join('');
        }

        if (player.positionGroup === 'S') {
            const assists = playersModule.sumRecent(recentSessions, 'set_ast');
            const attempts = playersModule.sumRecent(recentSessions, 'set_ta');
            return [
                playersModule.roleMetric('Set Rating', utils.num(analytics.weightedStat(recentSessions, 'set_rtg'))),
                playersModule.roleMetric('Set Attempts', Math.round(attempts)),
                playersModule.roleMetric('Assists', Math.round(assists)),
                playersModule.roleMetric('Assist Rate', utils.pct(attempts > 0 ? assists / attempts : null))
            ].join('');
        }

        return [
            playersModule.roleMetric('Kill %', utils.pct(volume.attempts > 0 ? volume.kills / volume.attempts : null)),
            playersModule.roleMetric('Error %', utils.pct(volume.attempts > 0 ? volume.errors / volume.attempts : null)),
            playersModule.roleMetric('Attempts / Set', utils.num(sets > 0 ? volume.attempts / sets : null)),
            playersModule.roleMetric('Recent Attempts', Math.round(volume.attempts))
        ].join('');
    },

    // The upload pipeline stores both team rows and per-setter rows. For the
    // coach-facing "Recent Sessions" table we show one row per real session,
    // not one row per CSV. The row itself uses the team-wide result when it
    // exists; clicking it expands the setter-specific split for that date.
    getDisplaySessions: (player) => {
        const raw = [...(player.practices || []), ...(player.exhibitions || [])];
        const grouped = new Map();

        raw.forEach(session => {
            const opponentKey = session.opponent
                ? utils.normalizeOpponentKey(session.opponent)
                : 'practice';
            const key = `${session.date}|${opponentKey}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    date: session.date,
                    opponent: utils.formatOpponent(session.opponent),
                    teamRow: null,
                    setterRows: []
                });
            }

            const bucket = grouped.get(key);
            if (session.setter) {
                if (!bucket.opponent && session.opponent) {
                    bucket.opponent = utils.formatOpponent(session.opponent);
                }
                bucket.setterRows.push(session);
            } else {
                bucket.opponent = utils.formatOpponent(session.opponent) || bucket.opponent;
                bucket.teamRow = session;
            }
        });

        return Array.from(grouped.values()).map(bucket => {
            const displayRow = bucket.teamRow || {
                date: bucket.date,
                opponent: bucket.opponent,
                stats: { name: player.name },
                splitOnly: true
            };

            return Object.assign({}, displayRow, {
                opponent: utils.formatOpponent(displayRow.opponent || bucket.opponent),
                setterRows: bucket.setterRows
            });
        }).sort((a, b) => b.date.localeCompare(a.date));
    },

    renderRecentStatsTable: (player) => {
        const table = document.getElementById('modalRecentStats');
        const meta = window.POSITION_GROUPS[player.positionGroup] || {};
        const recent = playersModule.getDisplaySessions(player).slice(0, 10);

        // Position-aware columns.
        let columns;
        if (player.positionGroup === 'S') {
            columns = [
                { key: 'set_ast', label: 'Assists' },
                { key: 'set_rtg', label: 'Set Rtg' },
                { key: 'serve_eff', label: 'Serve Eff' },
                { key: 'attack_pct', label: 'Atk %' }
            ];
        } else if (player.positionGroup === 'DS') {
            columns = [
                { key: 'receive_pass_pct', label: 'Pass' },
                { key: 'dig_ds', label: 'Digs' },
                { key: 'serve_eff', label: 'Serve Eff' },
                { key: 'serve_sa', label: 'Aces' }
            ];
        } else {
            columns = [
                { key: 'attack_pct', label: 'Atk %' },
                { key: 'attack_k', label: 'K' },
                { key: 'attack_e', label: 'E' },
                { key: 'attack_k_per_set', label: 'K/S' }
            ];
        }

        const format = (key, val) => {
            if (val === null || val === undefined) return '-';
            // attack_pct is a true 0-1 percentage; receive_pass_pct (despite
            // the column name) is actually a 0-3 rating from Hudl, so we use
            // utils.num for it.
            if (key === 'attack_pct') return utils.pct(val);
            if (key === 'receive_pass_pct' || key.includes('per_set') || key === 'set_rtg' || key === 'serve_eff' || key === 'serve_rtg') return utils.num(val);
            return Math.round(val);
        };

        const html = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Session</th>
                    ${columns.map(c => `<th>${c.label}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${recent.map((session, idx) => {
                    const hasDetails = session.setterRows && session.setterRows.length;
                    return `
                    <tr class="${hasDetails ? 'clickable-row' : ''}" data-session-idx="${idx}">
                        <td>${utils.formatDate(session.date)}</td>
                        <td>
                            ${session.opponent ? `<span class="tag accent">${session.opponent}</span>` : '<span class="muted">Practice</span>'}
                            ${session.splitOnly ? '<span class="tag warn">setter splits only</span>' : ''}
                            ${hasDetails ? '<span class="tag">view details</span>' : ''}
                        </td>
                        ${columns.map(c => `<td>${format(c.key, utils.getStat(session.stats, c.key))}</td>`).join('')}
                    </tr>
                    ${playersModule.renderSetterSplitRow(session, columns, format, idx)}
                `;}).join('')}
            </tbody>
        `;
        table.innerHTML = html;

        table.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const detailRow = table.querySelector(`[data-detail-for="${row.dataset.sessionIdx}"]`);
                if (!detailRow) return;
                detailRow.classList.toggle('open');
                row.classList.toggle('expanded');
            });
        });
    },

    renderSetterSplitRow: (session, columns, format, idx) => {
        if (!session.setterRows || !session.setterRows.length) return '';

        const sorted = session.setterRows.slice().sort((a, b) =>
            String(a.setter || '').localeCompare(String(b.setter || ''))
        );

        return `
            <tr class="setter-split-detail" data-detail-for="${idx}">
                <td colspan="${columns.length + 2}">
                    <div class="setter-split-card">
                        <div class="setter-split-title">
                            Session detail for ${utils.formatDate(session.date)}
                            ${session.opponent ? `vs ${session.opponent}` : 'practice'}
                        </div>
                        ${!session.splitOnly ? `
                            <div class="session-official-line">
                                <span>Official session line</span>
                                <div class="setter-metrics">
                                    ${columns.map(c => `
                                        <div class="setter-metric">
                                            <span>${c.label}</span>
                                            <strong>${format(c.key, utils.getStat(session.stats, c.key))}</strong>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="setter-split-grid">
                            ${sorted.map(row => `
                                <div class="setter-split-item">
                                    <div class="setter-name">${row.setter || 'Unknown setter'}</div>
                                    <div class="setter-metrics">
                                        ${columns.map(c => `
                                            <div class="setter-metric">
                                                <span>${c.label}</span>
                                                <strong>${format(c.key, utils.getStat(row.stats, c.key))}</strong>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }
};

window.playersModule = playersModule;

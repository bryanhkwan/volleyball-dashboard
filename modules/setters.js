// Setter analysis view.
//
// What's new:
//   * "Best pairings" leaderboard surfaced above the heatmap so coaches see
//     immediately which setter -> hitter combos to keep on the floor.
//   * Chemistry matrix is filtered to actual hitters (OH/OPP/MB) so we don't
//     visualize meaningless attack% for liberos / setters / defensive players.
//   * Each setter card shows practice vs game splits.

const settersModule = {
    chemistryFilter: 'all',

    sampleLabels: {
        all: 'all-session',
        practice: 'practice-only',
        exhibition: 'exhibition-only'
    },

    init: () => {
        const filter = document.getElementById('setterChemistryFilter');
        if (!filter) return;

        filter.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-chemistry-filter]');
            if (!btn) return;
            settersModule.chemistryFilter = btn.dataset.chemistryFilter || 'all';
            settersModule.syncChemistryFilterButtons();

            const view = document.getElementById('settersView');
            if (view && view.classList.contains('active')) {
                settersModule.renderSetterView();
            }
        });
    },

    renderSetterView: () => {
        const setters = window.dataModule.getAllSetters();
        const players = window.dataModule.getAllPlayers();
        const sample = settersModule.chemistryFilter || 'all';
        const sampleLabel = settersModule.sampleLabels[sample] || settersModule.sampleLabels.all;

        settersModule.renderComparisonTable(setters);

        settersModule.syncChemistryFilterButtons();
        settersModule.renderChemistrySubtitles(sampleLabel);

        const chemistry = analytics.calculateSetterChemistry(setters, players, { sample });
        charts.renderChemistryMatrix('chemistryMatrix', chemistry);
        settersModule.renderBestPairings(chemistry);

        settersModule.renderSetterCard('gabbiStats',   'Gabbi',   setters.Gabbi);
        settersModule.renderSetterCard('janelleStats', 'Janelle', setters.Janelle);
        settersModule.renderSetterCard('maddyStats',   'Maddy',   setters.Maddy);
    },

    syncChemistryFilterButtons: () => {
        document.querySelectorAll('[data-chemistry-filter]').forEach(btn => {
            const active = btn.dataset.chemistryFilter === settersModule.chemistryFilter;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    renderChemistrySubtitles: (sampleLabel) => {
        const best = document.getElementById('bestPairingsSubtitle');
        if (best) {
            best.textContent = `Best lift over each hitter's ${sampleLabel} attack baseline.`;
        }
        const matrix = document.getElementById('chemistryMatrixSubtitle');
        if (matrix) {
            matrix.textContent = `How much each setter raises or lowers each hitter from the ${sampleLabel} baseline. Hover for details.`;
        }
    },

    renderComparisonTable: (setters) => {
        const container = document.getElementById('setterComparisonTable');
        if (!container) return;

        const rows = Object.keys(setters).map(name => {
            const stats = analytics.calculateSetterStats(name, setters[name]);
            const info = Object.values(window.ROSTER)
                .find(r => r.fullName.split(' ')[0].toLowerCase() === name.toLowerCase());
            return { name, info, stats };
        });

        container.innerHTML = `
            <table class="setter-table">
                <thead>
                    <tr>
                        <th>Setter</th>
                        <th>Class</th>
                        <th>Assists</th>
                        <th>Assist Rate</th>
                        <th>Avg Rating</th>
                        <th>Errors</th>
                        <th>Practices</th>
                        <th>Games</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td>
                                <strong>${r.info ? r.info.fullName : r.name}</strong>
                                ${r.info ? `<div class="muted small">#${r.info.jersey} | ${r.info.height}</div>` : ''}
                            </td>
                            <td>${r.info ? r.info.class : '-'}</td>
                            <td>${r.stats.totalAssists}</td>
                            <td>${utils.pct(r.stats.assistRate)}</td>
                            <td>${utils.num(r.stats.avgRating)}</td>
                            <td>${r.stats.totalErrors}</td>
                            <td>${r.stats.practiceCount}</td>
                            <td>${r.stats.exhibitionCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderBestPairings: (chemistry) => {
        const container = document.getElementById('bestPairings');
        if (!container) return;
        const top = analytics.getBestPairings(chemistry, 6);
        if (!top.length) {
            container.innerHTML = '<p class="muted">Not enough data yet to identify best pairings.</p>';
            return;
        }
        container.innerHTML = top.map((p, i) => `
            <div class="pairing-row">
                <div class="pairing-rank">${i + 1}</div>
                <div class="pairing-names">
                    <strong>${p.setter}</strong>
                    <span class="arrow">to</span>
                    <strong>${p.hitter}</strong>
                </div>
                <div class="pairing-stats">
                    <span class="pairing-pct">${p.lift !== null ? `${p.lift >= 0 ? '+' : ''}${utils.pct(p.lift, 0)}` : utils.pct(p.avgAttackPct, 0)}</span>
                    <span class="muted small">${utils.pct(p.avgAttackPct, 0)} atk / ${Math.round(p.attackAttempts)} att</span>
                </div>
            </div>
        `).join('');
    },

    renderSetterCard: (elementId, setterName, setterData) => {
        const container = document.getElementById(elementId);
        if (!container || !setterData) return;

        const overall = analytics.calculateSetterStats(setterName, setterData);

        // For practice/game splits, use only that subset of dates against the
        // setter's player record so set_ast/set_rtg pull from team CSVs.
        const players = window.dataModule.getAllPlayers();
        const ownPlayer = players.find(p =>
            (p.fullName || '').split(' ')[0].toLowerCase() === setterName.toLowerCase()
        );
        const practiceDates = new Set((setterData.practices || []).map(s => s.date));
        const gameDates = new Set((setterData.exhibitions || []).map(s => s.date));

        const ratingsFromSessions = (sessions) => sessions
            .map(s => utils.getStat(s.stats, 'set_rtg'))
            .filter(v => v !== null);

        const ownPractices = ownPlayer ? analytics.collapseByRealSession(ownPlayer.practices || []) : [];
        const ownExhibitions = ownPlayer ? analytics.collapseByRealSession(ownPlayer.exhibitions || []) : [];
        const practiceRatings = ownPlayer
            ? ratingsFromSessions(ownPractices.filter(s => practiceDates.has(s.date)))
            : [];
        const gameRatings = ownPlayer
            ? ratingsFromSessions(ownExhibitions)
            : [];

        const practiceOnly = { avgRating: utils.avg(practiceRatings) };
        const gameOnly = { avgRating: utils.avg(gameRatings) };

        const info = Object.values(window.ROSTER || {})
            .find(r => r.fullName.split(' ')[0].toLowerCase() === setterName.toLowerCase()) || null;

        container.innerHTML = `
            ${info ? `
                <div class="setter-card-head">
                    <div class="player-meta">
                        <span class="position-pill" style="--pos-color:${window.POSITION_GROUPS.S.color}">${info.position}</span>
                        <span class="jersey">#${info.jersey}</span>
                        <span class="muted">${info.class} | ${info.height}</span>
                    </div>
                </div>
            ` : ''}
            <div class="kpi-tiles">
                <div class="kpi-tile">
                    <div class="kpi-value">${overall.totalAssists}</div>
                    <div class="kpi-label">Total assists</div>
                </div>
                <div class="kpi-tile">
                    <div class="kpi-value">${utils.pct(overall.assistRate)}</div>
                    <div class="kpi-label">Assist rate</div>
                </div>
                <div class="kpi-tile">
                    <div class="kpi-value">${utils.num(overall.avgRating)}</div>
                    <div class="kpi-label">Avg rating</div>
                </div>
                <div class="kpi-tile">
                    <div class="kpi-value">${overall.totalErrors}</div>
                    <div class="kpi-label">Set errors</div>
                </div>
            </div>
            <div class="splits">
                <div class="splits-row">
                    <span class="muted small">Practice avg rating</span>
                    <strong>${utils.num(practiceOnly.avgRating)}</strong>
                </div>
                <div class="splits-row">
                    <span class="muted small">Game avg rating</span>
                    <strong>${utils.num(gameOnly.avgRating)}</strong>
                </div>
                <div class="splits-row">
                    <span class="muted small">Practice / Games</span>
                    <strong>${overall.practiceCount} / ${overall.exhibitionCount}</strong>
                </div>
            </div>
        `;
    }
};

window.settersModule = settersModule;

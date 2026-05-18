// Chart rendering with Plotly.
// All charts share a dark layout - see `darkLayout()` below - so visuals stay
// consistent and a coach isn't fighting axis colors to read a number.

const CHART_COLORS = {
    accent:    '#FFD200',
    blue:      '#244f8f',
    blueLight: '#60a5fa',
    good:      '#34d399',
    warn:      '#fbbf24',
    bad:       '#f87171',
    purple:    '#a78bfa',
    pink:      '#f472b6',
    grid:      'rgba(255, 255, 255, 0.07)',
    text:      '#edf3ff',
    muted:     '#8ea4c5'
};

function darkLayout(extra = {}) {
    return Object.assign({
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: CHART_COLORS.text, family: 'Plus Jakarta Sans, system-ui, sans-serif' },
        margin: { t: 30, r: 16, b: 50, l: 56 },
        hoverlabel: { bgcolor: '#0d1b2e', font: { color: CHART_COLORS.text } }
    }, extra);
}

function darkAxis(extra = {}) {
    return Object.assign({
        color: CHART_COLORS.muted,
        gridcolor: CHART_COLORS.grid,
        zerolinecolor: CHART_COLORS.grid
    }, extra);
}

function trendLine(values) {
    const points = values
        .map((y, x) => ({ x, y }))
        .filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));
    if (points.length < 2) return null;

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return {
        slope,
        values: values.map((_, idx) => intercept + slope * idx)
    };
}

const charts = {

    // Single-line trend with an optional rolling-average overlay so coaches see
    // signal through the noise.
    renderTrendChart: (elementId, dates, values, title, yAxisTitle, opts = {}) => {
        const traces = [{
            x: dates,
            y: values,
            mode: 'lines+markers',
            name: title,
            line: { color: CHART_COLORS.accent, width: 2 },
            marker: { size: 7, color: CHART_COLORS.accent }
        }];

        if (opts.rolling !== false) {
            const window = opts.rollingWindow || 3;
            const rolling = opts.rollingValues || utils.rollingAvg(values, window);
            traces.push({
                x: dates,
                y: rolling,
                mode: 'lines',
                name: opts.rollingLabel || `${window}-session rolling avg`,
                line: { color: CHART_COLORS.blueLight, width: 3, dash: 'solid' },
                opacity: 0.85
            });
        }

        if (opts.trendline !== false) {
            const fit = trendLine(values);
            if (fit) {
                const color = Math.abs(fit.slope) < (opts.trendThreshold || 0.005)
                    ? CHART_COLORS.muted
                    : fit.slope > 0 ? CHART_COLORS.good : CHART_COLORS.bad;
                traces.push({
                    x: dates,
                    y: fit.values,
                    mode: 'lines',
                    name: fit.slope > 0 ? 'Overall trend up' : fit.slope < 0 ? 'Overall trend down' : 'Overall trend',
                    line: { color, width: 2, dash: 'dash' },
                    hoverinfo: 'skip'
                });
            }
        }

        const layout = darkLayout({
            title: { text: title, font: { color: CHART_COLORS.text, size: 14 }, x: 0, xanchor: 'left' },
            xaxis: darkAxis({ title: '' }),
            yaxis: darkAxis({
                title: yAxisTitle,
                tickformat: opts.percentY ? '.0%' : ''
            }),
            showlegend: true,
            legend: { orientation: 'h', y: -0.2, font: { color: CHART_COLORS.muted, size: 11 } },
            margin: { t: 36, r: 16, b: 60, l: 56 }
        });

        Plotly.newPlot(elementId, traces, layout, { responsive: true, displayModeBar: false });
    },

    // Tiny in-card trend strip for the player cards. Used only for hitters.
    renderSparkline: (elementId, values, color) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const xs = values.map((_, i) => i);

        const trace = {
            x: xs,
            y: values,
            mode: 'lines',
            line: { color: color || CHART_COLORS.accent, width: 2 },
            hoverinfo: 'skip'
        };
        const layout = {
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 2, r: 2, b: 2, l: 2 },
            xaxis: { visible: false, fixedrange: true },
            yaxis: { visible: false, fixedrange: true },
            showlegend: false
        };
        Plotly.newPlot(elementId, [trace], layout, {
            staticPlot: true, displayModeBar: false, responsive: true
        });
    },

    // Practice (x) vs Exhibition (y) role metric scatter, colored by position group.
    renderScatterPlot: (elementId, players, opts = {}) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        const groups = {};
        players.forEach(player => {
            const comp = analytics.calculatePracticeVsGame(player);
            if (!comp) return;
            const g = player.positionGroup || 'OTHER';
            if (!groups[g]) groups[g] = { x: [], y: [], text: [], delta: [], hover: [] };
            groups[g].x.push(comp.practiceAvg);
            groups[g].y.push(comp.exhibitionAvg);
            groups[g].text.push(player.fullName || player.name);
            groups[g].delta.push(comp.delta);
            groups[g].hover.push(
                `<b>${player.fullName || player.name}</b>` +
                `<br>${comp.metricLabel}` +
                `<br>Practice: ${analytics.formatComparisonValue(comp, comp.practiceAvg)} (${comp.practiceCount} sessions / ${Math.round(comp.practiceVolume)} ${comp.volumeLabel})` +
                `<br>Games: ${analytics.formatComparisonValue(comp, comp.exhibitionAvg)} (${comp.exhibitionCount} games / ${Math.round(comp.exhibitionVolume)} ${comp.volumeLabel})` +
                `<br>Delta: ${analytics.formatComparisonDelta(comp)}` +
                (comp.isSmallSample ? `<br>Sample: small (${comp.smallSampleReasons.join('; ')})` : '')
            );
        });

        const allX = [].concat(...Object.values(groups).map(g => g.x));
        const allY = [].concat(...Object.values(groups).map(g => g.y));
        if (!allX.length || !allY.length) {
            Plotly.purge(el);
            el.innerHTML = `<p class="chart-empty">${opts.emptyText || 'No comparison data yet.'}</p>`;
            return;
        }

        const hasRatingMetric = [...allX, ...allY].some(v => v > 1);
        const minVal = Math.min(0, ...allX, ...allY);
        const maxVal = Math.max(hasRatingMetric ? 3 : 0.5, ...allX, ...allY);

        const traces = [{
            x: [minVal, maxVal],
            y: [minVal, maxVal],
            mode: 'lines',
            name: 'Perfect translation',
            line: { color: CHART_COLORS.muted, dash: 'dash', width: 1 },
            hoverinfo: 'skip',
            showlegend: true
        }];

        Object.keys(groups).forEach(g => {
            const meta = (window.POSITION_GROUPS && window.POSITION_GROUPS[g])
                || { name: g, color: CHART_COLORS.accent };
            const d = groups[g];
            traces.push({
                x: d.x,
                y: d.y,
                text: d.text,
                mode: 'markers',
                type: 'scatter',
                name: meta.name,
                marker: { size: 14, color: meta.color, line: { color: '#0a1628', width: 2 } },
                hovertext: d.hover,
                hovertemplate: '%{hovertext}<extra></extra>'
            });
        });

        const layout = darkLayout({
            xaxis: darkAxis({
                title: opts.xTitle || 'Practice Role Metric',
                tickformat: opts.percentAxis ? '.0%' : ''
            }),
            yaxis: darkAxis({
                title: opts.yTitle || 'Exhibition Role Metric',
                tickformat: opts.percentAxis ? '.0%' : ''
            }),
            showlegend: true,
            legend: { font: { color: CHART_COLORS.muted, size: 11 } },
            margin: { t: 16, r: 16, b: 60, l: 60 },
            height: opts.height || 340
        });

        Plotly.newPlot(elementId, traces, layout, { responsive: true, displayModeBar: false });
    },

    // Setter-hitter chemistry: hitter columns only, shown as lift over each
    // hitter's baseline so high-efficiency positions don't get over-credited.
    renderChemistryMatrix: (elementId, chemistry) => {
        const setterNames = Object.keys(chemistry);
        const hitterSet = new Set();
        setterNames.forEach(setter => {
            Object.keys(chemistry[setter]).forEach(hitter => {
                const d = chemistry[setter][hitter];
                if (d.attempts >= 2 && d.attackAttempts >= 5 && ['OH', 'OPP', 'MB'].includes(d.positionGroup)) {
                    hitterSet.add(hitter);
                }
            });
        });
        const hitters = Array.from(hitterSet);
        const el = document.getElementById(elementId);
        if (!hitters.length) {
            if (el) {
                Plotly.purge(el);
                el.innerHTML = '<p class="chart-empty">Not enough setter-hitter attack data for this sample.</p>';
            }
            return;
        }

        // Sort columns so the biggest average positive lift is on the left.
        hitters.sort((a, b) => {
            const avg = (h) => {
                const vals = setterNames.map(s => {
                    const d = chemistry[s][h];
                    return d && d.attempts >= 2 && d.attackAttempts >= 5 ? d.lift : null;
                }).filter(v => v !== null);
                return utils.avg(vals) || 0;
            };
            return avg(b) - avg(a);
        });

        const zValues = [];
        const annotations = [];
        setterNames.forEach((setter) => {
            const row = [];
            hitters.forEach((hitter) => {
                const d = chemistry[setter][hitter];
                const val = d && d.attempts >= 2 && d.attackAttempts >= 5 ? d.lift : null;
                row.push(val);
                if (val !== null) {
                    annotations.push({
                        x: hitter,
                        y: setter,
                        text: `${val >= 0 ? '+' : ''}${utils.pct(val, 0)}`,
                        showarrow: false,
                        font: { color: '#0a1628', size: 12, family: 'Plus Jakarta Sans' }
                    });
                }
            });
            zValues.push(row);
        });

        const customdata = setterNames.map(setter => hitters.map(hitter => {
            const d = chemistry[setter][hitter] || {};
            return [
                d.avgAttackPct,
                d.baselineAttackPct,
                d.attackAttempts,
                d.attempts
            ];
        }));

        const trace = {
            x: hitters,
            y: setterNames,
            z: zValues,
            type: 'heatmap',
            customdata,
            zmin: -0.18, zmax: 0.18,
            colorscale: [
                [0,    '#f87171'],
                [0.5,  '#f8fafc'],
                [1,    '#34d399']
            ],
            showscale: true,
            colorbar: { tickformat: '.0%', tickfont: { color: CHART_COLORS.muted } },
            hovertemplate: '<b>%{y} -> %{x}</b><br>Lift: %{z:+.1%}<br>With setter: %{customdata[0]:.1%}<br>Baseline: %{customdata[1]:.1%}<br>Attempts: %{customdata[2]}<br>Sessions: %{customdata[3]}<extra></extra>'
        };

        const layout = darkLayout({
            xaxis: darkAxis({ tickangle: -35, automargin: true }),
            yaxis: darkAxis({ automargin: true }),
            annotations,
            margin: { t: 16, r: 40, b: 80, l: 80 }
        });

        Plotly.newPlot(elementId, [trace], layout, { responsive: true, displayModeBar: false });
    },

    // Team time series.  `metric` is a function (session) -> number, so the
    // timeline view can swap between metrics without rebuilding the function.
    renderTimeline: (elementId, sessions, metric, yLabel, opts = {}) => {
        const m = metric || ((s) => analytics.calculateTeamStats([s]).avgAttackPct);
        const label = yLabel || 'Attack %';
        // Default to percentage formatting unless the caller signals otherwise.
        const isPercent = opts.percent !== undefined ? opts.percent : true;

        const dates = sessions.map(s => s.date);
        const values = sessions.map(m);
        const colors = sessions.map(s => s.type === 'exhibition' ? CHART_COLORS.accent : CHART_COLORS.blue);
        const hoverText = sessions.map(s =>
            s.type === 'exhibition'
                ? `Game vs ${s.opponent || 'Opp'}`
                : 'Practice'
        );

        const valueFmt = isPercent ? '.1%' : '.2f';
        const trace = {
            x: dates,
            y: values,
            type: 'bar',
            marker: { color: colors, line: { color: 'rgba(255,255,255,0.08)', width: 1 } },
            text: hoverText,
            hovertemplate: '%{x}<br>%{text}<br>' + label + ': %{y:' + valueFmt + '}<extra></extra>'
        };

        const layout = darkLayout({
            xaxis: darkAxis({ tickangle: -35 }),
            yaxis: darkAxis({ title: label, tickformat: isPercent ? '.0%' : '' }),
            margin: { t: 16, r: 16, b: 70, l: 56 },
            showlegend: false
        });

        Plotly.newPlot(elementId, [trace], layout, { responsive: true, displayModeBar: false });
    },

    // Position-group bar of "recent avg attack% / pass%" so coaches see line
    // health at a glance.
    renderPositionHealth: (elementId, players) => {
        if (!window.getOrderedPositionGroups) return;
        const groups = window.getOrderedPositionGroups();

        const labels = [];
        const valuesAttack = [];
        const valuesPass = [];
        const colors = [];

        groups.forEach(g => {
            const meta = window.POSITION_GROUPS[g];
            const inGroup = players.filter(p => p.positionGroup === g);
            if (!inGroup.length) return;

            const recentAtk = inGroup.flatMap(p =>
                [analytics.weightedStat(analytics.collapseByRealSession(p.practices || []).slice(-5), 'attack_pct')]
            );
            const recentPass = inGroup.flatMap(p =>
                [analytics.weightedStat(analytics.collapseByRealSession(p.practices || []).slice(-5), 'receive_pass_pct')]
            );
            labels.push(meta.name);
            valuesAttack.push(utils.avg(recentAtk) || 0);
            valuesPass.push(utils.avg(recentPass) || 0);
            colors.push(meta.color);
        });

        const traceAtk = {
            x: labels,
            y: valuesAttack,
            type: 'bar',
            name: 'Attack %',
            marker: { color: colors },
            hovertemplate: '<b>%{x}</b><br>Attack %: %{y:.1%}<extra></extra>'
        };

        const layout = darkLayout({
            yaxis: darkAxis({ title: 'Recent Attack %', tickformat: '.0%' }),
            xaxis: darkAxis({}),
            showlegend: false,
            margin: { t: 16, r: 16, b: 50, l: 56 }
        });

        Plotly.newPlot(elementId, [traceAtk], layout, { responsive: true, displayModeBar: false });
    },

    // For the player modal: a hitter's attack% broken down by which setter
    // was on the court.
    renderPerSetterBreakdown: (elementId, perSetter) => {
        const setters = Object.keys(perSetter);
        if (!setters.length) {
            document.getElementById(elementId).innerHTML =
                '<p style="color: var(--muted); padding: 12px;">Not enough setter data yet.</p>';
            return;
        }

        const trace = {
            x: setters,
            y: setters.map(s => perSetter[s].avgAttackPct),
            text: setters.map(s => {
                const lift = perSetter[s].lift;
                return lift === null || lift === undefined ? ''
                    : `${lift >= 0 ? '+' : ''}${utils.pct(lift, 0)} lift`;
            }),
            customdata: setters.map(s => [
                perSetter[s].lift,
                perSetter[s].baselineAttackPct,
                perSetter[s].attackAttempts,
                perSetter[s].attempts
            ]),
            type: 'bar',
            marker: {
                color: setters.map(s => {
                    const v = perSetter[s].lift;
                    if (v === null || v === undefined) return CHART_COLORS.muted;
                    if (v >= 0.05) return CHART_COLORS.good;
                    if (v <= -0.05) return CHART_COLORS.bad;
                    return CHART_COLORS.warn;
                })
            },
            hovertemplate: '<b>%{x}</b><br>Attack %: %{y:.1%}<br>Lift: %{customdata[0]:+.1%}<br>Baseline: %{customdata[1]:.1%}<br>Attempts: %{customdata[2]}<br>Sessions: %{customdata[3]}<extra></extra>'
        };

        const layout = darkLayout({
            yaxis: darkAxis({ title: 'Attack %', tickformat: '.0%' }),
            xaxis: darkAxis({}),
            showlegend: false,
            margin: { t: 16, r: 16, b: 50, l: 56 }
        });

        Plotly.newPlot(elementId, [trace], layout, { responsive: true, displayModeBar: false });
    }
};

window.charts = charts;
window.CHART_COLORS = CHART_COLORS;

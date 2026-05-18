// Analytics & insight calculations.
//
// What's new vs v1:
//   * Volume-guarded improvement % so a 0.02 -> 0.04 jump doesn't show "+100%".
//   * Position-aware percentiles - we only compare a hitter to other hitters etc.
//   * Consistency (std-dev based) and recent rolling averages.
//   * `getCoachInsights` produces a short, prioritized list of *things to act on*
//     - this is what the dashboard's "Focus This Week" card renders.

const analytics = {

    // ---------- core per-player ----------

    weightedStat: (entries, statKey) => analytics._weightedStat(entries, statKey),
    _weightedStat: (entries, statKey) => {
        const rows = (entries || []).map(e => e.stats || e).filter(Boolean);
        if (!rows.length) return null;

        if (statKey === 'attack_pct') {
            let kills = 0, errors = 0, attempts = 0;
            rows.forEach(row => {
                const ta = utils.getStat(row, 'attack_ta');
                if (ta === null || ta <= 0) return;
                kills += utils.getStat(row, 'attack_k') || 0;
                errors += utils.getStat(row, 'attack_e') || 0;
                attempts += ta;
            });
            return attempts > 0 ? (kills - errors) / attempts : null;
        }

        if (statKey === 'attack_k_per_set') {
            let kills = 0, sets = 0;
            rows.forEach(row => {
                const setCount = utils.getStat(row, 'sets_played');
                const k = utils.getStat(row, 'attack_k');
                if (setCount === null || setCount <= 0 || k === null) return;
                kills += k;
                sets += setCount;
            });
            if (sets > 0) return kills / sets;
        }

        const weightBy = {
            receive_pass_pct: 'receive_ta',
            set_rtg: 'set_ta',
            serve_eff: 'serve_ta',
            serve_rtg: 'serve_ta'
        }[statKey];

        if (weightBy) {
            let total = 0, weight = 0;
            rows.forEach(row => {
                const val = utils.getStat(row, statKey);
                const w = utils.getStat(row, weightBy);
                if (val === null || w === null || w <= 0) return;
                total += val * w;
                weight += w;
            });
            if (weight > 0) return total / weight;
        }

        return utils.avg(rows.map(row => utils.getStat(row, statKey)));
    },

    rollingWeightedStat: (entries, statKey, window = 3) => {
        return (entries || []).map((_, idx) => {
            const start = Math.max(0, idx - window + 1);
            return analytics._weightedStat(entries.slice(start, idx + 1), statKey);
        });
    },

    getAttackVolume: (entries) => {
        return (entries || []).reduce((acc, entry) => {
            const stats = entry.stats || entry;
            const ta = utils.getStat(stats, 'attack_ta');
            const k = utils.getStat(stats, 'attack_k');
            const e = utils.getStat(stats, 'attack_e');
            if (ta !== null) acc.attempts += ta;
            if (k !== null) acc.kills += k;
            if (e !== null) acc.errors += e;
            return acc;
        }, { kills: 0, errors: 0, attempts: 0 });
    },

    getStatVolume: (entries, volumeKey) => {
        return (entries || []).reduce((sum, entry) => {
            const stats = entry.stats || entry;
            const val = utils.getStat(stats, volumeKey);
            return val === null ? sum : sum + val;
        }, 0);
    },

    getRoleComparisonSpec: (player) => {
        if (player.positionGroup === 'S') {
            return {
                statKey: 'set_rtg',
                metricLabel: 'Set Rating',
                metricFormat: 'num',
                volumeKey: 'set_ta',
                volumeLabel: 'set attempts',
                minPracticeSessions: 5,
                minGameSessions: 3,
                minPracticeVolume: 120,
                minGameVolume: 60,
                deltaThreshold: 0.15
            };
        }

        if (player.positionGroup === 'DS') {
            return {
                statKey: 'receive_pass_pct',
                metricLabel: 'Pass Rating',
                metricFormat: 'num',
                volumeKey: 'receive_ta',
                volumeLabel: 'receive attempts',
                minPracticeSessions: 5,
                minGameSessions: 3,
                minPracticeVolume: 40,
                minGameVolume: 25,
                deltaThreshold: 0.15
            };
        }

        const isMiddle = player.positionGroup === 'MB';
        return {
            statKey: 'attack_pct',
            metricLabel: 'Attack %',
            metricFormat: 'pct',
            volumeKey: 'attack_ta',
            volumeLabel: 'attack attempts',
            minPracticeSessions: 5,
            minGameSessions: 3,
            minPracticeVolume: isMiddle ? 40 : 60,
            minGameVolume: isMiddle ? 20 : 30,
            deltaThreshold: 0.05
        };
    },

    formatComparisonValue: (comparison, value) => {
        if (comparison.metricFormat === 'pct') return utils.pct(value, 1);
        return utils.num(value, 2);
    },

    formatComparisonDelta: (comparison) => {
        const sign = comparison.delta >= 0 ? '+' : '';
        if (comparison.metricFormat === 'pct') return sign + utils.pct(comparison.delta, 1);
        return sign + utils.num(comparison.delta, 2);
    },

    getMissingStatDays: (entries, statKey) => {
        return (entries || []).filter(entry => utils.getStat(entry.stats || {}, statKey) === null).length;
    },

    getRoleTrendKey: (player) => {
        if (player.positionGroup === 'S') return 'set_rtg';
        if (player.positionGroup === 'DS') return 'receive_pass_pct';
        return 'attack_pct';
    },

    calculateImprovement: (earlyValue, recentValue) => {
        if (earlyValue === null || earlyValue === undefined ||
            recentValue === null || recentValue === undefined) return null;
        if (Math.abs(earlyValue) < 0.05) {
            return (recentValue - earlyValue) * 100;
        }
        return ((recentValue - earlyValue) / Math.abs(earlyValue)) * 100;
    },

    // Each player has one entry per CSV they appear in - so a hitter who got
    // sets from all three setters on a single practice day shows up 4x for
    // that date (team CSV + 3 setter CSVs).  For trend analysis we want one
    // row per CALENDAR day, so we collapse same-date entries by averaging.
    collapseByDate: (practices) => analytics._collapseByDate(practices),
    _collapseByDate: (practices) => {
        const byDate = new Map();
        practices.forEach(p => {
            if (!byDate.has(p.date)) byDate.set(p.date, []);
            byDate.get(p.date).push(p);
        });
        const dates = Array.from(byDate.keys()).sort();
        return dates.map(date => {
            const rows = byDate.get(date).map(r => r.stats);
            const collapsed = { stats: {} };
            collapsed.date = date;
            ['attack_pct', 'attack_k_per_set', 'serve_eff', 'serve_rtg',
             'receive_pass_pct', 'set_rtg', 'attack_k', 'attack_e', 'attack_ta',
             'dig_ds', 'block_per_set', 'serve_sa', 'set_ast', 'set_ta']
                .forEach(key => {
                    const vals = rows.map(r => utils.getStat(r, key)).filter(v => v !== null);
                    collapsed.stats[key] = vals.length ? utils.avg(vals) : null;
                });
            return collapsed;
        });
    },

    // One row per real session, using the official team row when it exists.
    // If the upload only has setter-split files for that session, fall back to
    // an average of those split rows so the player still appears in analysis.
    collapseByRealSession: (entries) => analytics._collapseByRealSession(entries),
    _collapseByRealSession: (entries) => {
        const bySession = new Map();
        (entries || []).forEach(entry => {
            const opponentKey = entry.opponent ? utils.normalizeOpponentKey(entry.opponent) : 'practice';
            const key = `${entry.date}|${opponentKey}`;
            if (!bySession.has(key)) {
                bySession.set(key, {
                    date: entry.date,
                    opponent: entry.opponent ? utils.formatOpponent(entry.opponent) : null,
                    teamRow: null,
                    setterRows: []
                });
            }
            const bucket = bySession.get(key);
            if (entry.setter) {
                bucket.setterRows.push(entry);
            } else {
                bucket.teamRow = entry;
                bucket.opponent = entry.opponent ? utils.formatOpponent(entry.opponent) : bucket.opponent;
            }
        });

        return Array.from(bySession.values()).map(bucket => {
            if (bucket.teamRow) {
                return Object.assign({}, bucket.teamRow, { opponent: bucket.opponent });
            }

            const rows = bucket.setterRows;
            const keys = new Set();
            rows.forEach(row => {
                Object.keys(row.stats || {}).forEach(k => {
                    if (k !== 'name') keys.add(k);
                });
            });

            const stats = { name: rows[0] && rows[0].stats ? rows[0].stats.name : null };
            keys.forEach(k => {
                stats[k] = utils.avg(rows.map(row => utils.getStat(row.stats || {}, k)));
            });

            return {
                date: bucket.date,
                opponent: bucket.opponent,
                stats,
                splitOnly: true
            };
        }).sort((a, b) => a.date.localeCompare(b.date));
    },

    calculatePlayerTrends: (player) => {
        const rawPractices = player.practices || [];
        if (rawPractices.length < CONFIG.MIN_GAMES_FOR_TREND) return null;
        const practices = analytics._collapseByRealSession(rawPractices);
        if (practices.length < CONFIG.MIN_GAMES_FOR_TREND) return null;

        const dates = practices.map(p => p.date);
        const attackPcts = practices.map(p => utils.getStat(p.stats, 'attack_pct'));
        const killsPerSet = practices.map(p => utils.getStat(p.stats, 'attack_k_per_set'));
        const serveEff = practices.map(p => utils.getStat(p.stats, 'serve_eff'));
        const passPct = practices.map(p => utils.getStat(p.stats, 'receive_pass_pct'));
        const setRatings = practices.map(p => utils.getStat(p.stats, 'set_rtg'));
        const roleStatKey = analytics.getRoleTrendKey(player);
        const roleValues = practices.map(p => utils.getStat(p.stats, roleStatKey));

        const attackTrend = utils.linearTrend(attackPcts);
        const killsTrend = utils.linearTrend(killsPerSet);
        const serveTrend = utils.linearTrend(serveEff);
        const roleTrend = utils.linearTrend(roleValues);

        const recentWindow = Math.min(5, practices.length);
        const recent = practices.slice(-recentWindow);
        const early = practices.slice(0, recentWindow);

        const recentAttackAvg = analytics._weightedStat(recent, 'attack_pct');
        const earlyAttackAvg = analytics._weightedStat(early, 'attack_pct');
        const recentKillsAvg = analytics._weightedStat(recent, 'attack_k_per_set');
        const recentPassAvg = analytics._weightedStat(recent, 'receive_pass_pct');
        const recentRoleAvg = analytics._weightedStat(recent, roleStatKey);
        const earlyRoleAvg = analytics._weightedStat(early, roleStatKey);
        const attackVolume = analytics.getAttackVolume(practices);

        const improvement = analytics.calculateImprovement(earlyAttackAvg, recentAttackAvg);
        const roleImprovement = analytics.calculateImprovement(earlyRoleAvg, recentRoleAvg);

        return {
            attackTrend,
            killsTrend,
            serveTrend,
            roleTrend,
            attackTrendDirection: utils.getTrendDirection(attackTrend, 0.005),
            roleTrendDirection: utils.getTrendDirection(roleTrend, 0.005),
            roleStatKey,
            roleValues,
            recentRoleAvg,
            earlyRoleAvg,
            recentAttackAvg,
            earlyAttackAvg,
            recentKillsAvg,
            recentPassAvg,
            improvement,
            roleImprovement,
            totalPractices: practices.length,
            attackAttempts: attackVolume.attempts,
            attackValueDays: attackPcts.filter(v => v !== null).length,
            missingAttackDays: analytics.getMissingStatDays(practices, 'attack_pct'),
            dates,
            attackPcts,
            killsPerSet,
            passPct,
            setRatings
        };
    },

    calculatePracticeVsGame: (player) => {
        const practices = analytics._collapseByRealSession(player.practices || []);
        const exhibitions = analytics._collapseByRealSession(player.exhibitions || []);
        if (practices.length === 0 || exhibitions.length === 0) return null;

        const spec = analytics.getRoleComparisonSpec(player);
        const practiceAvg = analytics._weightedStat(practices, spec.statKey);
        const exhibitionAvg = analytics._weightedStat(exhibitions, spec.statKey);
        if (practiceAvg === null || exhibitionAvg === null) return null;

        const delta = exhibitionAvg - practiceAvg;
        const practiceVolume = analytics.getStatVolume(practices, spec.volumeKey);
        const exhibitionVolume = analytics.getStatVolume(exhibitions, spec.volumeKey);
        const smallSampleReasons = [];

        if (practices.length < spec.minPracticeSessions) {
            smallSampleReasons.push(`${practices.length} practice sessions`);
        }
        if (practiceVolume < spec.minPracticeVolume) {
            smallSampleReasons.push(`${Math.round(practiceVolume)} practice ${spec.volumeLabel}`);
        }
        if (exhibitions.length < spec.minGameSessions) {
            smallSampleReasons.push(`${exhibitions.length} game sessions`);
        }
        if (exhibitionVolume < spec.minGameVolume) {
            smallSampleReasons.push(`${Math.round(exhibitionVolume)} game ${spec.volumeLabel}`);
        }

        return {
            metricKey: spec.statKey,
            metricLabel: spec.metricLabel,
            metricFormat: spec.metricFormat,
            volumeKey: spec.volumeKey,
            volumeLabel: spec.volumeLabel,
            deltaThreshold: spec.deltaThreshold,
            practiceAvg,
            exhibitionAvg,
            delta,
            normalizedDelta: delta / spec.deltaThreshold,
            isClutch: delta >= spec.deltaThreshold,
            isPracticeWarrior: delta <= -spec.deltaThreshold,
            practiceCount: practices.length,
            exhibitionCount: exhibitions.length,
            practiceVolume,
            exhibitionVolume,
            practiceAttempts: practiceVolume,
            exhibitionAttempts: exhibitionVolume,
            minPracticeSessions: spec.minPracticeSessions,
            minGameSessions: spec.minGameSessions,
            minPracticeVolume: spec.minPracticeVolume,
            minGameVolume: spec.minGameVolume,
            smallSampleReasons,
            sampleSummary: `${exhibitions.length} game${exhibitions.length === 1 ? '' : 's'} / ${Math.round(exhibitionVolume)} ${spec.volumeLabel}`,
            isSmallSample: smallSampleReasons.length > 0
        };
    },

    // Lower std-dev means more reliable session-to-session performance.
    calculateConsistency: (player, statKey = 'attack_pct') => {
        const vals = analytics._collapseByRealSession(player.practices || [])
            .map(p => utils.getStat(p.stats, statKey))
            .filter(v => v !== null);
        if (vals.length < 3) return null;
        return {
            stdDev: utils.stdDev(vals),
            mean: utils.avg(vals),
            n: vals.length
        };
    },

    // Career totals across practice + exhibitions, used in player cards.
    calculateCareerTotals: (player) => {
        const all = [
            ...analytics._collapseByRealSession(player.practices || []),
            ...analytics._collapseByRealSession(player.exhibitions || [])
        ];
        const sum = (key) => all.reduce((acc, s) => {
            const v = utils.getStat(s.stats, key);
            return v === null ? acc : acc + v;
        }, 0);
        return {
            totalKills: sum('attack_k'),
            totalErrors: sum('attack_e'),
            totalAttacks: sum('attack_ta'),
            totalAces: sum('serve_sa'),
            totalDigs: sum('dig_ds'),
            totalAssists: sum('set_ast'),
            totalBlockSolos: sum('block_bs'),
            totalBlockAssists: sum('block_ba'),
            sessions: all.length
        };
    },

    // ---------- team / cohort level ----------

    calculateTeamStats: (sessions) => {
        const all = [];
        sessions.forEach(s => { if (s.players) all.push(...s.players); });
        return {
            avgAttackPct: analytics._weightedStat(all, 'attack_pct'),
            avgKillsPerSet: analytics._weightedStat(all, 'attack_k_per_set'),
            avgServeEff: analytics._weightedStat(all, 'serve_eff'),
            avgPassPct: analytics._weightedStat(all, 'receive_pass_pct')
        };
    },

    // Percentile of `value` within `samples` (0 - 100).
    percentile: (value, samples) => {
        const xs = samples.filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
        if (!xs.length || value === null || value === undefined || isNaN(value)) return null;
        const below = xs.filter(v => v < value).length;
        const equal = xs.filter(v => v === value).length;
        return ((below + 0.5 * equal) / xs.length) * 100;
    },

    // Compare `player` to all teammates in the same `positionGroup` on `statKey`.
    getPositionPercentile: (player, allPlayers, statKey) => {
        const peers = allPlayers.filter(p =>
            p.positionGroup === player.positionGroup && (p.practices || []).length >= 3
        );
        const peerAvgs = peers.map(p => {
            const recent = analytics._collapseByRealSession(p.practices || []).slice(-5);
            return analytics._weightedStat(recent, statKey);
        });
        const playerRecent = analytics._collapseByRealSession(player.practices || []).slice(-5);
        const playerAvg = analytics._weightedStat(playerRecent, statKey);
        return {
            playerAvg,
            percentile: analytics.percentile(playerAvg, peerAvgs),
            peerCount: peers.length
        };
    },

    getTopImprovers: (players, limit = 5) => {
        return players
            .map(player => ({ player, trends: analytics.calculatePlayerTrends(player) }))
            .filter(item => item.trends !== null
                && item.trends.improvement !== null
                && item.trends.improvement > 0
                // Need at least some attacking volume so a libero doesn't show up.
                && ['OH', 'OPP', 'MB', 'UNKNOWN'].includes(item.player.positionGroup))
            .sort((a, b) => b.trends.improvement - a.trends.improvement)
            .slice(0, limit);
    },

    getDecliningPlayers: (players, limit = 5) => {
        return players
            .map(player => ({ player, trends: analytics.calculatePlayerTrends(player) }))
            .filter(item => item.trends !== null
                && item.trends.improvement !== null
                && item.trends.improvement < 0
                && ['OH', 'OPP', 'MB', 'UNKNOWN'].includes(item.player.positionGroup))
            .sort((a, b) => a.trends.improvement - b.trends.improvement)
            .slice(0, limit);
    },

    // ---------- setters ----------

    calculateSetterChemistry: (setters, players, opts = {}) => {
        const sample = opts.sample || 'all';
        const pickPlayerEntries = (player) => {
            if (sample === 'practice') return analytics._collapseByRealSession(player.practices || []);
            if (sample === 'exhibition') return analytics._collapseByRealSession(player.exhibitions || []);
            return [
                ...(analytics._collapseByRealSession(player.practices || [])),
                ...(analytics._collapseByRealSession(player.exhibitions || []))
            ];
        };
        const pickSetterEntries = (setterData) => {
            if (sample === 'practice') return setterData.practices || [];
            if (sample === 'exhibition') return setterData.exhibitions || [];
            return [
                ...(setterData.practices || []),
                ...(setterData.exhibitions || [])
            ];
        };

        const chemistry = {};
        const playerInfo = {};
        players.forEach(p => {
            playerInfo[p.name] = Object.assign({}, p, {
                baselineAttackPct: analytics._weightedStat(pickPlayerEntries(p), 'attack_pct')
            });
        });

        Object.keys(setters).forEach(setterName => {
            chemistry[setterName] = {};
            const setterData = setters[setterName];
            const allSessions = pickSetterEntries(setterData);

            allSessions.forEach(session => {
                (session.players || []).forEach(playerStat => {
                    const playerName = playerStat.name;
                    if (window.dataModule && window.dataModule.isJunkName(playerName)) return;
                    if (!chemistry[setterName][playerName]) {
                        chemistry[setterName][playerName] = {
                            attempts: 0,
                            kills: 0,
                            errors: 0,
                            attackAttempts: 0,
                            attackPcts: []
                        };
                    }
                    const attackPct = utils.getStat(playerStat, 'attack_pct');
                    const ta = utils.getStat(playerStat, 'attack_ta') || 0;
                    const kills = utils.getStat(playerStat, 'attack_k') || 0;
                    const errors = utils.getStat(playerStat, 'attack_e') || 0;
                    if (attackPct !== null && ta > 0) {
                        chemistry[setterName][playerName].attackPcts.push(attackPct);
                        chemistry[setterName][playerName].attempts++;
                        chemistry[setterName][playerName].kills += kills;
                        chemistry[setterName][playerName].errors += errors;
                        chemistry[setterName][playerName].attackAttempts += ta;
                    }
                });
            });

            Object.keys(chemistry[setterName]).forEach(playerName => {
                const d = chemistry[setterName][playerName];
                d.avgAttackPct = d.attackAttempts > 0
                    ? (d.kills - d.errors) / d.attackAttempts
                    : utils.avg(d.attackPcts);
                d.baselineAttackPct = playerInfo[playerName] ? playerInfo[playerName].baselineAttackPct : null;
                d.lift = d.avgAttackPct !== null && d.baselineAttackPct !== null
                    ? d.avgAttackPct - d.baselineAttackPct
                    : null;
                d.positionGroup = (playerInfo[playerName] && playerInfo[playerName].positionGroup) || 'OTHER';
            });
        });

        return chemistry;
    },

    // Pull out the top setter-hitter pairings (>= 2 sessions together,
    // hitter is an attacking position).
    getBestPairings: (chemistry, limit = 5) => {
        const pairings = [];
        Object.keys(chemistry).forEach(setter => {
            Object.keys(chemistry[setter]).forEach(hitter => {
                const d = chemistry[setter][hitter];
                if (d.attempts >= 2 && d.attackAttempts >= 5 && d.avgAttackPct !== null
                    && d.lift !== null && d.lift > 0
                    && ['OH', 'OPP', 'MB'].includes(d.positionGroup)) {
                    pairings.push({
                        setter,
                        hitter,
                        attempts: d.attempts,
                        attackAttempts: d.attackAttempts,
                        avgAttackPct: d.avgAttackPct,
                        baselineAttackPct: d.baselineAttackPct,
                        lift: d.lift
                    });
                }
            });
        });
        return pairings
            .sort((a, b) => {
                const liftA = a.lift === null ? -Infinity : a.lift;
                const liftB = b.lift === null ? -Infinity : b.lift;
                return (liftB - liftA) || (b.avgAttackPct - a.avgAttackPct);
            })
            .slice(0, limit);
    },

    // The per-setter CSV exports DO NOT contain set_ast/set_rtg - those
    // numbers only appear on the setter's own row in the TEAM practice/game
    // CSVs.  So we look up the setter as a "player" and aggregate from there.
    // `setterData` is still used to count practice / exhibition sessions for
    // the setter (since one setter may not have run every team practice).
    calculateSetterStats: (setterName, setterData) => {
        const players = (window.dataModule && window.dataModule.getAllPlayers()) || [];
        const player = players.find(p =>
            (p.fullName || '').split(' ')[0].toLowerCase() === setterName.toLowerCase()
        );

        const own = player ? [
            ...analytics._collapseByRealSession(player.practices || []),
            ...analytics._collapseByRealSession(player.exhibitions || [])
        ] : [];
        const rows = own.map(s => s.stats);

        const assists = rows.map(s => utils.getStat(s, 'set_ast')).filter(v => v !== null);
        const totalSets = rows.map(s => utils.getStat(s, 'set_ta')).filter(v => v !== null);
        const errors = rows.map(s => utils.getStat(s, 'set_se')).filter(v => v !== null);
        const ratings = rows.map(s => utils.getStat(s, 'set_rtg')).filter(v => v !== null);

        const totalAssists = assists.reduce((a, b) => a + b, 0);
        const totalAttempts = totalSets.reduce((a, b) => a + b, 0);

        return {
            totalAssists,
            totalAttempts,
            assistRate: totalAttempts > 0 ? totalAssists / totalAttempts : null,
            avgRating: utils.avg(ratings),
            totalErrors: errors.reduce((a, b) => a + b, 0),
            practiceCount: (setterData && setterData.practices || []).length,
            exhibitionCount: (setterData && setterData.exhibitions || []).length
        };
    },

    // ---------- the "Focus This Week" intelligence ----------

    // Returns an ordered list of insights {severity, kind, headline, body, playerName}
    // that the dashboard renders as action cards.
    getCoachInsights: (players, sessions) => {
        const insights = [];

        // 1. Sharp recent drops in last 3 practices.
        players.forEach(player => {
            const practices = analytics._collapseByRealSession(player.practices || []);
            if (practices.length < 6 || player.positionGroup === 'DS') return;

            const last3 = practices.slice(-3);
            const prev3 = practices.slice(-6, -3);
            const last = analytics._weightedStat(last3, 'attack_pct');
            const prev = analytics._weightedStat(prev3, 'attack_pct');
            if (last === null || prev === null) return;
            const drop = prev - last;
            if (drop > 0.10) {
                insights.push({
                    severity: 'high',
                    kind: 'drop',
                    playerName: player.name,
                    fullName: player.fullName,
                    position: player.position,
                    headline: `${player.fullName || player.name} dropped sharply`,
                    body: `Attack % fell ${(drop * 100).toFixed(0)} pts over the last 3 practices (${utils.pct(prev, 0)} to ${utils.pct(last, 0)}). Worth a check-in.`
                });
            }
        });

        // 2. Hot streaks - big gains last 3 vs previous 3.
        players.forEach(player => {
            const practices = analytics._collapseByRealSession(player.practices || []);
            if (practices.length < 6 || player.positionGroup === 'DS') return;
            const last3 = practices.slice(-3);
            const prev3 = practices.slice(-6, -3);
            const last = analytics._weightedStat(last3, 'attack_pct');
            const prev = analytics._weightedStat(prev3, 'attack_pct');
            if (last === null || prev === null) return;
            const gain = last - prev;
            if (gain > 0.10) {
                insights.push({
                    severity: 'low',
                    kind: 'hot',
                    playerName: player.name,
                    fullName: player.fullName,
                    position: player.position,
                    headline: `${player.fullName || player.name} is heating up`,
                    body: `Attack % jumped ${(gain * 100).toFixed(0)} pts over the last 3 practices (${utils.pct(prev, 0)} to ${utils.pct(last, 0)}). Reward with reps.`
                });
            }
        });

        // 3. Strong practice warriors - perform well in practice, badly in games.
        players.forEach(player => {
            const comp = analytics.calculatePracticeVsGame(player);
            if (!comp) return;
            if (!comp.isSmallSample && comp.normalizedDelta < -1.5) {
                insights.push({
                    severity: 'medium',
                    kind: 'pw',
                    playerName: player.name,
                    fullName: player.fullName,
                    position: player.position,
                    headline: `${player.fullName || player.name} struggles in games`,
                    body: `${comp.metricLabel}: practice ${analytics.formatComparisonValue(comp, comp.practiceAvg)}, games ${analytics.formatComparisonValue(comp, comp.exhibitionAvg)} (${analytics.formatComparisonDelta(comp)}). Game-speed drills + mental prep.`
                });
            }
        });

        // 4. Setter-hitter pairing that's working well.
        const chemistry = analytics.calculateSetterChemistry(
            window.dataModule.getAllSetters(), players
        );
        const bestPair = analytics.getBestPairings(chemistry, 1)[0];
        if (bestPair && (bestPair.lift || 0) > 0.08) {
            insights.push({
                severity: 'low',
                kind: 'pairing',
                playerName: bestPair.hitter,
                headline: `Hot pairing: ${bestPair.setter} to ${bestPair.hitter}`,
                body: `${utils.pct(bestPair.avgAttackPct, 0)} attack efficiency, ${utils.pct(bestPair.lift, 0)} above baseline. Lean on this combo in close sets.`
            });
        }

        // Sort: high severity first, then medium, then low.
        const order = { high: 0, medium: 1, low: 2 };
        insights.sort((a, b) => order[a.severity] - order[b.severity]);
        return insights;
    }
};

window.analytics = analytics;

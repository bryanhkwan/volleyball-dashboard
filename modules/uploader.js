// Upload pipeline.
//
// Given a list of File objects (from a folder upload or drag-drop), we:
//   1. Classify each file into one of:
//        team-practice    "03.10 Practice.csv"
//        setter-practice  "03.10 Practice Gabbi.csv"
//        team-exhibition  "03.28 Exhibition Cleveland State.csv"
//        setter-exhibition "03.28 Cleveland State Janelle.csv"
//        unknown          (skipped, surfaced to the user)
//   2. Parse each file via window.csvParser.
//   3. Build the same session / player / setter index that processed_data.json
//      used to provide.
//
// We use the folder path (`file.webkitRelativePath`) when available, then fall
// back to filename heuristics, so the system works whether the coach uploads
// the whole "Spring 2026" folder or just drags individual CSVs in.

const uploader = (() => {

    function opponentKey(opponent) {
        return window.utils && window.utils.normalizeOpponentKey
            ? window.utils.normalizeOpponentKey(opponent)
            : String(opponent || '').trim().toLowerCase();
    }

    function displayOpponent(opponent) {
        return window.utils && window.utils.formatOpponent
            ? window.utils.formatOpponent(opponent)
            : (opponent || null);
    }

    function sessionKey(session) {
        return `${session.type}|${session.date}|${opponentKey(session.opponent)}`;
    }

    function cloneSetterBlock(block) {
        return {
            setter: block.setter,
            players: Array.isArray(block.players) ? block.players.slice() : []
        };
    }

    function mergeSetterBlocks(existing = [], incoming = []) {
        const bySetter = new Map();
        existing.forEach(block => {
            const key = String(block.setter || '').trim().toLowerCase();
            bySetter.set(key, cloneSetterBlock(block));
        });
        incoming.forEach(block => {
            const key = String(block.setter || '').trim().toLowerCase();
            bySetter.set(key, cloneSetterBlock(block));
        });
        return Array.from(bySetter.values())
            .sort((a, b) => String(a.setter || '').localeCompare(String(b.setter || '')));
    }

    // Fold team rows and setter-only rows for the same real date/opponent into
    // one coach-facing session. This also repairs older IndexedDB datasets
    // where "Oakland" and "oakland" were stored as separate sessions.
    function consolidateSessions(sessionList) {
        const map = new Map();

        (sessionList || []).forEach(session => {
            const key = sessionKey(session);
            const existing = map.get(key);
            const normalized = Object.assign({}, session, {
                opponent: displayOpponent(session.opponent),
                players: Array.isArray(session.players) ? session.players.slice() : undefined,
                setters: Array.isArray(session.setters) ? mergeSetterBlocks([], session.setters) : undefined
            });

            if (!existing) {
                normalized.category = normalized.players && normalized.players.length ? 'team' : (normalized.category || 'setter');
                map.set(key, normalized);
                return;
            }

            if (normalized.players && normalized.players.length) {
                existing.players = normalized.players;
                existing.category = 'team';
                existing.opponent = normalized.opponent || existing.opponent;
            } else if (!existing.opponent && normalized.opponent) {
                existing.opponent = normalized.opponent;
            }

            if (normalized.setters && normalized.setters.length) {
                existing.setters = mergeSetterBlocks(existing.setters || [], normalized.setters);
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            a.date < b.date ? -1 : a.date > b.date ? 1 : 0
        );
    }

    // Setter names come from the roster (everyone whose positionGroup is 'S').
    // That way next season's setters are picked up without a code change.
    function knownSetterFirstNames() {
        if (!window.ROSTER) return ['Gabbi', 'Janelle', 'Maddy'];
        return Object.values(window.ROSTER)
            .filter(r => r.positionGroup === 'S')
            .map(r => r.fullName.split(' ')[0]);
    }

    function dateFromFilename(name) {
        const m = name.match(/(\d{2})\.(\d{2})/);
        if (!m) return null;
        const month = m[1];
        const day = m[2];
        // Year is inferred from the season folder if present; default current.
        const year = (new Date()).getFullYear();
        return `${year}-${month}-${day}`;
    }

    function inferYearFromPath(relPath) {
        const m = (relPath || '').match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
    }

    function classifyByPath(relPath) {
        if (!relPath) return null;
        const lower = relPath.toLowerCase().replace(/\\/g, '/');
        if (lower.includes('team exhibition')) return 'team-exhibition';
        if (lower.includes('setter exhibition')) return 'setter-exhibition';
        if (lower.includes('team stats')) return 'team-practice';
        if (lower.includes('setter stats')) return 'setter-practice';
        return null;
    }

    function classifyByFilename(filename, setterFirstNames) {
        const base = filename.replace(/\.csv$/i, '').trim();
        // "MM.DD Exhibition <opponent>" -> team exhibition
        if (/^\d{2}\.\d{2}\s+Exhibition\b/i.test(base)) return 'team-exhibition';
        // "MM.DD Practice <Setter>" -> setter practice
        const setterPractice = base.match(/^\d{2}\.\d{2}\s+Practice\s+(\S+)\s*$/i);
        if (setterPractice && setterFirstNames.some(s => s.toLowerCase() === setterPractice[1].toLowerCase())) {
            return 'setter-practice';
        }
        // "MM.DD Practice" -> team practice (no setter)
        if (/^\d{2}\.\d{2}\s+Practice\s*$/i.test(base)) return 'team-practice';
        // "MM.DD <opponent...> <Setter>" -> setter exhibition
        const tokens = base.split(/\s+/);
        const lastToken = tokens[tokens.length - 1];
        if (tokens.length >= 3 && setterFirstNames.some(s => s.toLowerCase() === lastToken.toLowerCase())) {
            return 'setter-exhibition';
        }
        return null;
    }

    function classifyFile(file) {
        const setters = knownSetterFirstNames();
        const path = file.webkitRelativePath || file.fullPath || '';
        return classifyByPath(path) || classifyByFilename(file.name, setters) || 'unknown';
    }

    // Parse the date + setter / opponent labels out of a filename for a given
    // classification.
    function extractMeta(filename, classification, setterFirstNames, year) {
        const base = filename.replace(/\.csv$/i, '').trim();
        const dateMatch = base.match(/^(\d{2})\.(\d{2})/);
        if (!dateMatch) return null;
        const month = dateMatch[1];
        const day = dateMatch[2];
        const y = year || (new Date()).getFullYear();
        const date = `${y}-${month}-${day}`;

        if (classification === 'team-practice') {
            return { date };
        }
        if (classification === 'setter-practice') {
            const m = base.match(/^\d{2}\.\d{2}\s+Practice\s+(\S+)\s*$/i);
            return { date, setter: m ? m[1] : null };
        }
        if (classification === 'team-exhibition') {
            const m = base.match(/^\d{2}\.\d{2}\s+Exhibition\s+(.+?)\s*$/i);
            return { date, opponent: m ? m[1].trim() : null };
        }
        if (classification === 'setter-exhibition') {
            // Last token is the setter name; everything between date and last
            // token is the opponent.
            const stripped = base.replace(/^\d{2}\.\d{2}\s+/, '');
            const tokens = stripped.split(/\s+/);
            const setter = tokens.pop();
            const opponent = tokens.join(' ').trim();
            return { date, setter, opponent };
        }
        return null;
    }

    async function readFileText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // Run the parser over each file, return classified + parsed result.
    // `onProgress(done, total, file)` is optional.
    async function parseFiles(fileList, onProgress) {
        const files = Array.from(fileList).filter(f => /\.csv$/i.test(f.name));
        const setters = knownSetterFirstNames();
        const inferredYear = inferYearFromPath(files.length ? (files[0].webkitRelativePath || '') : '');
        const results = [];
        const skipped = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (onProgress) onProgress(i, files.length, file);
            const classification = classifyFile(file);
            if (classification === 'unknown') {
                skipped.push({ file, reason: 'Could not classify (folder/filename did not match expected patterns)' });
                continue;
            }
            const meta = extractMeta(file.name, classification, setters, inferredYear);
            if (!meta || !meta.date) {
                skipped.push({ file, reason: 'No MM.DD date in filename' });
                continue;
            }
            try {
                const text = await readFileText(file);
                const players = window.csvParser.parseCsvFile(text);
                if (!players.length) {
                    skipped.push({ file, reason: 'No usable player rows' });
                    continue;
                }
                results.push({
                    classification,
                    meta,
                    players,
                    fileName: file.name,
                    relPath: file.webkitRelativePath || file.name
                });
            } catch (err) {
                skipped.push({ file, reason: 'Parse error: ' + err.message });
            }
        }
        if (onProgress) onProgress(files.length, files.length, null);
        return { results, skipped };
    }

    // Convert the parsed results into the session structure the rest of the
    // dashboard expects (same shape as the old processed_data.json).
    function buildSessions(results) {
        // Team practices (one CSV per date).
        const teamPractices = {};
        // Setter practices keyed by date, each with array of setter blocks.
        const setterPractices = {};
        // Team exhibitions keyed by date+opponent.
        const teamExhibitions = {};
        // Setter exhibitions keyed by date+opponent, each with setter blocks.
        const setterExhibitions = {};

        results.forEach(r => {
            const { classification, meta, players } = r;
            if (classification === 'team-practice') {
                teamPractices[meta.date] = {
                    date: meta.date,
                    type: 'practice',
                    category: 'team',
                    players
                };
            } else if (classification === 'setter-practice') {
                if (!setterPractices[meta.date]) {
                    setterPractices[meta.date] = {
                        date: meta.date,
                        type: 'practice',
                        category: 'setter',
                        setters: []
                    };
                }
                setterPractices[meta.date].setters.push({ setter: meta.setter, players });
            } else if (classification === 'team-exhibition') {
                const key = `${meta.date}__${opponentKey(meta.opponent)}`;
                teamExhibitions[key] = {
                    date: meta.date,
                    type: 'exhibition',
                    category: 'team',
                    opponent: displayOpponent(meta.opponent),
                    players
                };
            } else if (classification === 'setter-exhibition') {
                const key = `${meta.date}__${opponentKey(meta.opponent)}`;
                if (!setterExhibitions[key]) {
                    setterExhibitions[key] = {
                        date: meta.date,
                        type: 'exhibition',
                        category: 'setter',
                        opponent: displayOpponent(meta.opponent),
                        setters: []
                    };
                }
                setterExhibitions[key].setters.push({ setter: meta.setter, players });
            }
        });

        // Merge setter-exhibition block INTO the matching team-exhibition so
        // each game is one session with player rows + per-setter breakdowns.
        Object.values(setterExhibitions).forEach(setterBlock => {
            const matchKey = `${setterBlock.date}__${opponentKey(setterBlock.opponent)}`;
            const team = teamExhibitions[matchKey];
            if (team) {
                team.setters = mergeSetterBlocks(team.setters || [], setterBlock.setters);
            } else {
                // No matching team CSV - keep it as a standalone session.
                teamExhibitions[matchKey] = setterBlock;
            }
        });

        // Same for practices: attach setter blocks to the team practice on
        // that date so the session has both team-wide + per-setter views.
        Object.values(setterPractices).forEach(block => {
            const team = teamPractices[block.date];
            if (team) {
                team.setters = block.setters;
            } else {
                teamPractices[block.date] = block;
            }
        });

        const all = [
            ...Object.values(teamPractices),
            ...Object.values(teamExhibitions)
        ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

        return consolidateSessions(all);
    }

    // Merge new sessions into existing sessions, replacing same-key entries.
    function mergeSessions(existing, incoming) {
        const map = new Map();
        consolidateSessions(existing || []).forEach(s => map.set(sessionKey(s), s));
        consolidateSessions(incoming || []).forEach(s => map.set(sessionKey(s), s));
        return consolidateSessions(Array.from(map.values()));
    }

    // Build player-centric and setter-centric indices from a sessions list.
    function buildIndices(sessions) {
        const players = {};

        const ensure = (name) => {
            if (!players[name]) players[name] = { name, practices: [], exhibitions: [] };
            return players[name];
        };

        sessions.forEach(session => {
            const isExh = session.type === 'exhibition';
            // Team-level rows.
            if (Array.isArray(session.players)) {
                session.players.forEach(ps => {
                    const p = ensure(ps.name);
                    const entry = { date: session.date, stats: ps };
                    if (isExh) {
                        entry.opponent = session.opponent;
                        p.exhibitions.push(entry);
                    } else {
                        p.practices.push(entry);
                    }
                });
            }
            // Setter sub-blocks (with per-setter player rows).
            if (Array.isArray(session.setters)) {
                session.setters.forEach(block => {
                    block.players.forEach(ps => {
                        const p = ensure(ps.name);
                        const entry = { date: session.date, setter: block.setter, stats: ps };
                        if (isExh) {
                            entry.opponent = session.opponent;
                            p.exhibitions.push(entry);
                        } else {
                            p.practices.push(entry);
                        }
                    });
                });
            }
        });

        // Sort each player's lists by date.
        const playerList = Object.values(players)
            .map(p => {
                p.practices.sort((a, b) => a.date.localeCompare(b.date));
                p.exhibitions.sort((a, b) => a.date.localeCompare(b.date));
                return p;
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        // Setter-centric index keyed by setter first name.
        const setterFirstNames = knownSetterFirstNames();
        const setters = {};
        setterFirstNames.forEach(n => setters[n] = { practices: [], exhibitions: [] });
        sessions.forEach(session => {
            if (!Array.isArray(session.setters)) return;
            session.setters.forEach(block => {
                const name = block.setter;
                if (!name) return;
                if (!setters[name]) setters[name] = { practices: [], exhibitions: [] };
                const entry = { date: session.date, players: block.players };
                if (session.type === 'exhibition') {
                    entry.opponent = session.opponent;
                    setters[name].exhibitions.push(entry);
                } else {
                    setters[name].practices.push(entry);
                }
            });
        });

        return { players: playerList, setters };
    }

    function buildMetadata(sessions, players) {
        const practiceDays = new Set();
        const gameDays = new Set();
        sessions.forEach(s => {
            if (s.type === 'practice') practiceDays.add(s.date);
            else if (s.type === 'exhibition') gameDays.add(s.date);
        });
        const sortedDates = sessions.map(s => s.date).sort();
        return {
            processed_at: new Date().toISOString(),
            total_practices: sessions.filter(s => s.type === 'practice').length,
            total_exhibitions: sessions.filter(s => s.type === 'exhibition').length,
            unique_practice_days: practiceDays.size,
            unique_game_days: gameDays.size,
            total_players: players.length,
            date_range: {
                start: sortedDates[0] || null,
                end: sortedDates[sortedDates.length - 1] || null
            }
        };
    }

    function buildDataset(sessions) {
        const consolidated = consolidateSessions(sessions);
        const { players, setters } = buildIndices(consolidated);
        const metadata = buildMetadata(consolidated, players);
        return { metadata, sessions: consolidated, players, setters };
    }

    // Top-level pipeline used by the upload UI.
    async function ingest(fileList, existingSessions, onProgress) {
        const { results, skipped } = await parseFiles(fileList, onProgress);
        const newSessions = buildSessions(results);
        const merged = mergeSessions(existingSessions || [], newSessions);
        const dataset = buildDataset(merged);
        return { dataset, ingested: results, skipped };
    }

    return {
        classifyFile,
        parseFiles,
        buildSessions,
        mergeSessions,
        consolidateSessions,
        buildIndices,
        buildDataset,
        ingest
    };
})();

window.uploader = uploader;

// CSV parsing + Hudl-row normalization for the browser.
// Replaces what process_data.py used to do on the server side, so we can
// accept CSV uploads directly in the dashboard.
//
// The Hudl exports look like:
//   Name,Attack K,Attack E,Attack TA,Attack Atk%,...,Sets Sets Played
//   "#4 Olivia H.",9,3,13,0.462,...
// We need to:
//   1. Strip jersey-number / quote crud from the player name.
//   2. Drop aggregate rows ("Team A", "Toledo Women's Volleyball", "Opponent").
//   3. Coerce blank / non-numeric cells to null so charts don't blow up.

const csvParser = (() => {

    const AGGREGATE_NAMES = new Set([
        'team a', 'team b', 'team', 'team total', 'totals', 'total',
        'opponent', 'opponents', 'toledo', 'toledo womens volleyball',
        "toledo women's volleyball", ''
    ]);

    function normalizePlayerName(raw) {
        if (raw === null || raw === undefined) return null;
        let name = String(raw);
        // strip leading quote/#NN
        name = name.replace(/^["']*#?\d+\s+/, '');
        // strip trailing quote
        name = name.replace(/["']$/, '');
        name = name.trim();
        const lower = name.toLowerCase();
        if (AGGREGATE_NAMES.has(lower)) return null;
        if (lower.includes('toledo') && lower.includes('volleyball')) return null;
        return name;
    }

    function parseStatValue(val) {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        if (s === '' || s === 'N/A' || s.toLowerCase() === 'nan') return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    // Minimal correct CSV parser that handles double-quoted fields with
    // embedded commas and escaped double quotes ("" -> ").  More predictable
    // than a regex.
    function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { cell += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    cell += c;
                }
            } else {
                if (c === '"') {
                    inQuotes = true;
                } else if (c === ',') {
                    row.push(cell); cell = '';
                } else if (c === '\n') {
                    row.push(cell); rows.push(row);
                    row = []; cell = '';
                } else if (c === '\r') {
                    // skip; \n will terminate
                } else {
                    cell += c;
                }
            }
        }
        // Flush last cell / row.
        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }
        // Drop trailing empty rows.
        while (rows.length && rows[rows.length - 1].every(v => v === '')) {
            rows.pop();
        }
        return rows;
    }

    // Column map: Hudl CSV header -> our stat key.
    const COLUMN_MAP = {
        'Attack K':           'attack_k',
        'Attack E':           'attack_e',
        'Attack TA':          'attack_ta',
        'Attack Atk%':        'attack_pct',
        'Attack K/S':         'attack_k_per_set',
        'Serve SA':           'serve_sa',
        'Serve SE':           'serve_se',
        'Serve TA':           'serve_ta',
        'Serve Pct':          'serve_pct',
        'Serve Eff':          'serve_eff',
        'Serve Rtg.':         'serve_rtg',
        'Receive 3':          'receive_3',
        'Receive 2':          'receive_2',
        'Receive 1':          'receive_1',
        'Receive 0':          'receive_0',
        'Receive TA':         'receive_ta',
        'Receive Pass%':      'receive_pass_pct',
        'Set Ast':            'set_ast',
        'Set TA':             'set_ta',
        'Set SE':             'set_se',
        'Set 3':              'set_3',
        'Set 2':              'set_2',
        'Set 1':              'set_1',
        'Set 0':              'set_0',
        'Set Rtg.':           'set_rtg',
        'Dig DS':             'dig_ds',
        'Dig DE':             'dig_de',
        'Block BS':           'block_bs',
        'Block BA':           'block_ba',
        'Block BE':           'block_be',
        'Block B/S':          'block_per_set',
        'Points Pts +/-':     'points',
        'Sets Sets Played':   'sets_played'
    };

    // Returns array of player-stat objects, one per real player row.
    function parseCsvFile(text) {
        const rows = parseCsv(text);
        if (!rows.length) return [];

        const header = rows[0];
        // Build index map: column index -> our stat key (or null).
        const colKeys = header.map(h => COLUMN_MAP[h.trim()] || null);
        const nameIdx = header.findIndex(h => h.trim().toLowerCase() === 'name');
        if (nameIdx < 0) return [];

        const out = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const playerName = normalizePlayerName(row[nameIdx]);
            if (!playerName) continue;

            const stats = { name: playerName };
            let hasAny = false;
            for (let c = 0; c < row.length; c++) {
                const key = colKeys[c];
                if (!key) continue;
                const val = parseStatValue(row[c]);
                stats[key] = val;
                if (val !== null) hasAny = true;
            }
            if (hasAny) out.push(stats);
        }
        return out;
    }

    return { parseCsv, parseCsvFile, normalizePlayerName, parseStatValue };
})();

window.csvParser = csvParser;

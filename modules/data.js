// Data loading and access layer.
//
// Data source priority:
//   1. IndexedDB (whatever the coach has uploaded - source of truth)
//   2. Nothing - the UI prompts to upload a season folder.
//
// Players not in the static ROSTER still appear in the dashboard.  They get
// position 'Unknown' so they're not silently dropped but they're also clearly
// flagged in the UI.

let rawData = null;
let players = [];
let setters = {};
let sessions = [];
let metadata = {};
let updatedAt = null;

const JUNK_NAMES = new Set([
    'opponent', 'opponents', "toledo women's volleyball",
    'toledo womens volleyball', 'toledo', 'team', 'team a', 'team b',
    'team total', 'totals', 'total', ''
]);

function isJunkName(name) {
    if (!name) return true;
    const lower = String(name).trim().toLowerCase();
    if (JUNK_NAMES.has(lower)) return true;
    if (lower.includes('toledo') && lower.includes('volleyball')) return true;
    return false;
}

function attachRoster(player) {
    const info = (window.ROSTER && window.ROSTER[player.name]) || null;
    if (info) {
        return Object.assign({}, player, {
            fullName: info.fullName,
            position: info.position,
            positionGroup: info.positionGroup,
            jersey: info.jersey,
            class: info.class,
            height: info.height,
            hometown: info.hometown,
            isRosterMatch: true
        });
    }
    return Object.assign({}, player, {
        fullName: player.name,
        position: 'Unknown',
        positionGroup: 'UNKNOWN',
        isRosterMatch: false
    });
}

function cleanSessionPlayers(playersList) {
    if (!Array.isArray(playersList)) return playersList;
    return playersList.filter(p => !isJunkName(p && p.name));
}

function cleanSession(session) {
    const cleaned = Object.assign({}, session);
    if (Array.isArray(cleaned.players)) {
        cleaned.players = cleanSessionPlayers(cleaned.players);
    }
    if (Array.isArray(cleaned.setters)) {
        cleaned.setters = cleaned.setters.map(s => Object.assign({}, s, {
            players: cleanSessionPlayers(s.players)
        }));
    }
    return cleaned;
}

// Apply the cleaning + roster enrichment to a dataset that came either from
// the uploader pipeline or out of IndexedDB storage.
function applyDataset(dataset) {
    rawData = dataset;
    const cleanedSessions = (dataset.sessions || []).map(cleanSession);
    sessions = window.uploader && window.uploader.consolidateSessions
        ? window.uploader.consolidateSessions(cleanedSessions)
        : cleanedSessions;

    const rebuilt = window.uploader && window.uploader.buildIndices
        ? window.uploader.buildIndices(sessions)
        : null;

    const rawPlayers = ((rebuilt && rebuilt.players) || dataset.players || [])
        .filter(p => !isJunkName(p && p.name));
    players = rawPlayers.map(attachRoster);

    setters = (rebuilt && rebuilt.setters) || dataset.setters || {};
    Object.keys(setters).forEach(name => {
        const s = setters[name];
        if (s && Array.isArray(s.practices)) {
            s.practices = s.practices.map(e => Object.assign({}, e, {
                players: cleanSessionPlayers(e.players)
            }));
        }
        if (s && Array.isArray(s.exhibitions)) {
            s.exhibitions = s.exhibitions.map(e => Object.assign({}, e, {
                players: cleanSessionPlayers(e.players)
            }));
        }
    });

    metadata = Object.assign({}, dataset.metadata || {});
    metadata.total_players = players.length;
    metadata.unique_practice_days = new Set(
        sessions.filter(s => s.type === 'practice').map(s => s.date)
    ).size;
    metadata.unique_game_days = new Set(
        sessions.filter(s => s.type === 'exhibition').map(s => s.date)
    ).size;
    updatedAt = dataset.updatedAt || null;
}

// Load from IndexedDB.  Returns true if a dataset was loaded, false if empty.
async function loadData() {
    try {
        const stored = await window.storage.get();
        if (stored && stored.sessions) {
            applyDataset(stored);
            console.log('Data loaded from storage:', metadata);
            return true;
        }
        // Nothing yet - leave dashboard in empty state.
        applyDataset({ sessions: [], players: [], setters: {}, metadata: {} });
        return false;
    } catch (error) {
        console.error('Error loading data:', error);
        applyDataset({ sessions: [], players: [], setters: {}, metadata: {} });
        return false;
    }
}

// Called by the uploader after a successful ingest.  Persists + refreshes.
async function setDataset(dataset) {
    const stamped = await window.storage.set(dataset);
    applyDataset(stamped);
    return stamped;
}

async function clearData() {
    await window.storage.clear();
    applyDataset({ sessions: [], players: [], setters: {}, metadata: {} });
}

function getAllPlayers() { return players; }
function getPlayerByName(name) {
    return players.find(p => p.name === name || p.fullName === name);
}
function getPlayersByGroup(group) {
    return players.filter(p => p.positionGroup === group);
}
function getPlayersGroupedByPosition() {
    const groups = {};
    (window.getOrderedPositionGroups ? window.getOrderedPositionGroups() : [])
        .forEach(g => groups[g] = []);
    players.forEach(p => {
        const key = groups[p.positionGroup] ? p.positionGroup : (p.positionGroup || 'UNKNOWN');
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => (a.jersey || 999) - (b.jersey || 999));
    });
    return groups;
}
function getAllSetters() { return setters; }
function getSetterData(setterName) {
    return setters[setterName] || { practices: [], exhibitions: [] };
}
function getAllSessions() { return sessions; }
function getPracticeSessions() { return sessions.filter(s => s.type === 'practice'); }
function getExhibitionSessions() { return sessions.filter(s => s.type === 'exhibition'); }
function getMetadata() { return metadata; }
function getUpdatedAt() { return updatedAt; }
function hasData() { return sessions.length > 0; }
function getRawDataset() { return rawData; }

function getLatestSession() {
    if (!sessions.length) return null;
    return sessions.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
}

window.dataModule = {
    loadData,
    setDataset,
    clearData,
    hasData,
    getAllPlayers,
    getPlayerByName,
    getPlayersByGroup,
    getPlayersGroupedByPosition,
    getAllSetters,
    getSetterData,
    getAllSessions,
    getPracticeSessions,
    getExhibitionSessions,
    getMetadata,
    getUpdatedAt,
    getLatestSession,
    getRawDataset,
    isJunkName
};

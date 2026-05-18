// Toledo Women's Volleyball Roster - 2026
// Maps short names that appear in the Hudl CSV exports ("first name + last initial")
// to full roster info from https://utrockets.com/sports/womens-volleyball/roster/2026
//
// The Hudl exports only contain a short name like "Olivia H." so this is how we
// recover the player's full name, position, jersey number, class, and height
// without modifying the underlying data files.

const ROSTER = {
    'Ava S.':     { fullName: 'Ava Siefke',        position: 'OH',     positionGroup: 'OH',  jersey: 14, class: 'Sr.',    height: "6'1\"",  hometown: 'Cincinnati, Ohio' },
    'Avery A.':   { fullName: 'Avery Adamski',     position: 'DS',     positionGroup: 'DS',  jersey: 7,  class: 'Sr.',    height: "5'8\"",  hometown: 'Perrysburg, Ohio' },
    'Brooke N.':  { fullName: 'Brooke Naniseni',   position: 'OH',     positionGroup: 'OH',  jersey: 11, class: 'Sr.',    height: "6'1\"",  hometown: 'Mililani, Hawaii' },
    'Caylee S.':  { fullName: 'Caylee Sharkey',    position: 'RSH',    positionGroup: 'OPP', jersey: 18, class: 'Sr.',    height: "6'2\"",  hometown: 'Sycamore, Ill.' },
    'Gabbi L.':   { fullName: 'Gabbi LeBlanc',     position: 'S',      positionGroup: 'S',   jersey: 12, class: 'Sr.',    height: "5'8\"",  hometown: 'Phoenix, Ariz.' },
    'Grace F.':   { fullName: 'Grace Freiberger',  position: 'DS/L',   positionGroup: 'DS',  jersey: 1,  class: 'Jr.',    height: "5'7\"",  hometown: 'Lima, Ohio' },
    'Janelle G.': { fullName: 'Janelle Green',     position: 'S',      positionGroup: 'S',   jersey: 3,  class: 'R-So.',  height: "5'10\"", hometown: 'Leawood, Kan.' },
    'Jessica C.': { fullName: 'Jessica Costlow',   position: 'OH',     positionGroup: 'OH',  jersey: 6,  class: 'So.',    height: "5'11\"", hometown: 'Monroe, Mich.' },
    'Kayla O.':   { fullName: 'Kayla Ozanich',     position: 'MB',     positionGroup: 'MB',  jersey: 10, class: 'R-Jr.',  height: "6'3\"",  hometown: 'Okemos, Mich.' },
    'Maddy B.':   { fullName: 'Maddy Bach',        position: 'S',      positionGroup: 'S',   jersey: 15, class: 'So.',    height: "5'9\"",  hometown: 'Chesterfield, Mo.' },
    'Mariah G.':  { fullName: 'Mariah Gaines',     position: 'OH',     positionGroup: 'OH',  jersey: 2,  class: 'So.',    height: "5'10\"", hometown: 'Cincinnati, Ohio' },
    'Meg J.':     { fullName: 'Meg Jarrett',       position: 'DS/L',   positionGroup: 'DS',  jersey: 21, class: 'Jr.',    height: "5'8\"",  hometown: 'Madison, Ala.' },
    'Olivia H.':  { fullName: 'Olivia Heitkamp',   position: 'OH/RSH', positionGroup: 'OH',  jersey: 4,  class: 'Jr.',    height: "6'1\"",  hometown: 'New Bremen, Ohio' },
    'Sierra P.':  { fullName: 'Sierra Pertzborn',  position: 'MB',     positionGroup: 'MB',  jersey: 22, class: 'R-Jr.',  height: "6'3\"",  hometown: 'Middleton, Wis.' },
    'Sophie C.':  { fullName: 'Sophie Catalano',   position: 'OPP',    positionGroup: 'OPP', jersey: 16, class: 'R-Sr.',  height: "5'10\"", hometown: 'Pittsburgh, Pa.' },
    'Sydney C.':  { fullName: 'Sydney Crowley',    position: 'DS',     positionGroup: 'DS',  jersey: 5,  class: 'So.',    height: "5'7\"",  hometown: 'Cincinnati, Ohio' }
};

// Position groups define HOW we evaluate and display a player.
// `attackingRole = true` means we expect them to put balls down (attacks/kills).
// `primaryStats` drives which numbers we show on their player card and what
// percentiles we compute against position peers.
const POSITION_GROUPS = {
    OH:      { name: 'Outside Hitters',         short: 'OH',      color: '#FFD200', attackingRole: true,  order: 1, primaryStats: ['attack_pct', 'attack_k_per_set', 'receive_pass_pct', 'serve_eff'] },
    OPP:     { name: 'Right Sides / Opposites', short: 'OPP',     color: '#f472b6', attackingRole: true,  order: 2, primaryStats: ['attack_pct', 'attack_k_per_set', 'block_per_set', 'serve_eff'] },
    MB:      { name: 'Middle Blockers',         short: 'MB',      color: '#34d399', attackingRole: true,  order: 3, primaryStats: ['attack_pct', 'attack_k_per_set', 'block_per_set'] },
    S:       { name: 'Setters',                 short: 'S',       color: '#60a5fa', attackingRole: false, order: 4, primaryStats: ['set_ast', 'set_rtg', 'serve_eff', 'attack_pct'] },
    DS:      { name: 'Defensive Specialists / Libero', short: 'DS/L', color: '#a78bfa', attackingRole: false, order: 5, primaryStats: ['receive_pass_pct', 'dig_ds', 'serve_eff', 'serve_rtg'] },
    UNKNOWN: { name: 'Unrostered / Unknown',    short: '?',       color: '#64748b', attackingRole: false, order: 99, primaryStats: ['attack_pct', 'attack_k_per_set'] }
};

const STAT_LABELS = {
    attack_pct:          { label: 'Attack %',       format: 'pct',  good: 'high', desc: '(K-E)/TA' },
    attack_k_per_set:    { label: 'Kills/Set',      format: 'num',  good: 'high', desc: 'Kills per set played' },
    attack_k:            { label: 'Kills',          format: 'int',  good: 'high' },
    attack_e:            { label: 'Errors',         format: 'int',  good: 'low'  },
    serve_eff:           { label: 'Serve Eff',      format: 'num',  good: 'high', desc: 'Serve efficiency rating' },
    serve_rtg:           { label: 'Serve Rating',   format: 'num',  good: 'high' },
    serve_sa:            { label: 'Aces',           format: 'int',  good: 'high' },
    receive_pass_pct:    { label: 'Pass Rating',    format: 'num',  good: 'high', desc: 'Average pass rating (0-3)' },
    dig_ds:              { label: 'Digs',           format: 'int',  good: 'high' },
    block_per_set:       { label: 'Blocks/Set',     format: 'num',  good: 'high' },
    set_ast:             { label: 'Assists',        format: 'int',  good: 'high' },
    set_rtg:             { label: 'Set Rating',     format: 'num',  good: 'high' }
};

function getRosterInfo(shortName) {
    return ROSTER[shortName] || null;
}

function getPositionMeta(groupCode) {
    return POSITION_GROUPS[groupCode] || null;
}

function getOrderedPositionGroups() {
    return Object.keys(POSITION_GROUPS)
        .sort((a, b) => POSITION_GROUPS[a].order - POSITION_GROUPS[b].order);
}

function getAttackingGroups() {
    return getOrderedPositionGroups().filter(g => POSITION_GROUPS[g].attackingRole);
}

window.ROSTER = ROSTER;
window.POSITION_GROUPS = POSITION_GROUPS;
window.STAT_LABELS = STAT_LABELS;
window.getRosterInfo = getRosterInfo;
window.getPositionMeta = getPositionMeta;
window.getOrderedPositionGroups = getOrderedPositionGroups;
window.getAttackingGroups = getAttackingGroups;

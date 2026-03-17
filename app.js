// ═══════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════
function nP(p){if(!p)return'?';const u=p.trim().toUpperCase();if(u==='OH')return'OH';if(u==='MB'||u==='MH')return'MB';if(u==='S')return'S';if(u==='L'||u==='L/DS'||u==='DS')return'L/DS';if(u==='OPP'||u==='RS')return'OPP';return'?'}
const PN={'OH':'Outside Hitter','MB':'Middle Blocker','S':'Setter','L/DS':'Libero / DS','OPP':'Opposite Hitter'};
const PC={'OH':'var(--ac)','MB':'var(--bl)','S':'var(--gn)','L/DS':'var(--pu)','OPP':'var(--rd)'};

const SI={kills_per_set:{n:'Kills/Set',dir:'up',d:'A kill = successful attack scoring a point. Higher = more productive scorer. The bread-and-butter for attackers (OH, OPP, MB).'},hit_pct:{n:'Hit %',dir:'up',d:'(Kills − Errors) / Attempts. Measures attacking efficiency. Elite = .300+. Like batting average in baseball.'},digs_per_set:{n:'Digs/Set',dir:'up',d:'Successfully passing a hard-driven attack. Best proxy for serve-receive passing ability — the two skills are highly correlated. Critical for L/DS, important for OH/OPP.'},aces_per_set:{n:'Aces/Set',dir:'up',d:'Serves that directly score points. Higher = more dangerous server who pressures opponents from the service line.'},blk_per_set:{n:'Blocks/Set',dir:'up',d:'Deflecting/stopping attacks at the net. THE defining stat for middle blockers. Great blockers change how opponents attack.'},atk_err_rate:{n:'Atk Err Rate',dir:'down',d:'% of attacks resulting in errors. LOWER is better — high error rate = giving away free points. Penalized.'},serv_err_rate:{n:'Serv Err Rate',dir:'down',d:'Service errors per set. LOWER is better. Aggressive serving creates aces, but too many errors negate value. Penalized.'},pts_per_set:{n:'Points/Set',dir:'up',d:'Total points per set (kills + aces + solo blocks). Bottom-line scoring output.'},consistency:{n:'Consistency',dir:'up',d:'Sets played relative to full season (~110 sets). Coaches keep best players on floor — a trust/durability metric.'},assists_per_set:{n:'Assists/Set',dir:'up',d:'Sets/passes leading directly to kills. THE key setter stat — volleyball equivalent of basketball assists. Elite setters: 10+/set.'},bh_err_rate:{n:'BH Err Rate',dir:'down',d:'Ball-handling errors/set (double contacts, lifts). LOWER is better. Critical for setters — high BH errors disrupt offense. Penalized.'}};

const TI={
  'Ironwoman':'100+ sets played this season — incredible durability. In a typical 30-match season (~3.5 sets/match), this player was on court for nearly every point.',
  'Point Machine':'4.5+ points per set — elite-level scorer contributing heavily through kills, aces, and/or blocks.',
  'Ace Server':'0.35+ aces per set — roughly one ace every 3 sets. Elite serving rate that directly pressures opposing passing.',
  'Clean Server':'Very low service error rate. This player rarely gives away free points on serve.',
  'Elite Scorer':'3.5+ kills/set (OH) or 3.0+ (OPP). Among the top offensive producers at their position — the go-to option.',
  '6-Rotation Star':'OH excelling in BOTH offense (2.5+ K/S) AND defense (2.5+ D/S). Plays all 6 rotations effectively — one of the most valuable player types.',
  'Floor General':'3.0+ digs/set — anchors the defense and keeps rallies alive. Named for their ability to read the game and position perfectly. For setters: 8.0+ assists/set running an efficient offense.',
  'Efficient Hitter':'Hitting .300+ (OH/OPP) or .350+ (MB). Converts a high % of attacks into kills with minimal errors.',
  'Error Prone':'Attack error rate above 20%. Has offensive tools but gives back too many points on unforced errors.',
  'Defensive Specialist':'High digs/set but low hitting efficiency — primary value comes from back-row passing and defense.',
  'Wall':'MB averaging 1.0+ blocks/set. Elite shot-blocker who changes how opponents attack.',
  'Elite Efficiency':'MB hitting .400+. Exceptional attack conversion rate — rarely makes errors on quick-tempo swings.',
  'Dual Threat':'MB with strong kills AND blocks — dangerous both offensively and defensively at the net.',
  'Undersized':'Low blocking output for a middle blocker — may indicate height/reach disadvantage.',
  'Maestro':'Setter with 10.0+ assists/set. Running the offense at the highest level — orchestrates the entire attack.',
  'Defensive Setter':'Setter who also digs 2.0+ per set. Contributing defensively while running offense = exceptionally versatile.',
  'Blocking Setter':'Setter with 0.4+ blocks/set. Contributing at the net is a bonus most setters can\'t offer.',
  'Clean Hands':'Near-zero ball handling errors — elite hand technique. Rarely called for doubles or lifts.',
  'Loose Hands':'High BH error rate. Needs improved technique to run a clean offense.',
  'Elite Passer':'L/DS averaging 4.5+ digs/set — gold standard for back-row defense. Almost certainly an elite serve-receive passer.',
  'Lockdown Defender':'L/DS with 3.5+ digs/set. Strong defensive presence keeping the ball alive.',
  'Playmaker Libero':'Libero with 1.0+ assists/set — makes smart overhand sets, adding offensive dimension.',
  'Every-Set Player':'Libero playing 110+ sets — coaches trust this player for virtually every rally.',
  'Scoring Opposite':'3.0+ kills/set from right side. Legitimate offensive weapon, not just a blocking specialist.',
  'Blocking Opposite':'OPP with 0.8+ blocks/set. Strong net presence on right side, slowing opposing OHs.',
  'Complete Player':'OPP who scores (2.5+ K/S), blocks (0.7+ B/S), AND digs (1.5+ D/S). Most well-rounded opposite — rare and extremely valuable.'
};

// DEFAULT WEIGHTS {w: weight 0-50, min, max, dir}
// WEIGHTS: Each position sums to EXACTLY 100. Min/Max from real NCAA D1 2025 data (p10/p95).
const DW={
  'OH':{kills_per_set:{w:24,min:0.43,max:3.88,dir:'up'},hit_pct:{w:17,min:0.04,max:0.28,dir:'up'},digs_per_set:{w:17,min:0.33,max:2.69,dir:'up'},aces_per_set:{w:9,min:0.00,max:0.36,dir:'up'},blk_per_set:{w:5,min:0.05,max:0.68,dir:'up'},atk_err_rate:{w:8,min:0.12,max:0.25,dir:'down'},serv_err_rate:{w:5,min:0.00,max:0.53,dir:'down'},pts_per_set:{w:9,min:0.61,max:4.33,dir:'up'},consistency:{w:6,min:0.25,max:1.00,dir:'up'}},
  'MB':{kills_per_set:{w:14,min:0.66,max:2.45,dir:'up'},hit_pct:{w:24,min:0.13,max:0.39,dir:'up'},digs_per_set:{w:3,min:0.13,max:0.70,dir:'up'},aces_per_set:{w:6,min:0.00,max:0.29,dir:'up'},blk_per_set:{w:24,min:0.45,max:1.29,dir:'up'},atk_err_rate:{w:6,min:0.10,max:0.23,dir:'down'},serv_err_rate:{w:4,min:0.00,max:0.42,dir:'down'},pts_per_set:{w:12,min:1.08,max:3.14,dir:'up'},consistency:{w:7,min:0.26,max:1.00,dir:'up'}},
  'S':{kills_per_set:{w:2,min:0.01,max:0.94,dir:'up'},hit_pct:{w:4,min:0.00,max:0.37,dir:'up'},digs_per_set:{w:14,min:0.77,max:2.65,dir:'up'},aces_per_set:{w:11,min:0.06,max:0.38,dir:'up'},blk_per_set:{w:5,min:0.00,max:0.57,dir:'up'},atk_err_rate:{w:2,min:0.00,max:0.25,dir:'down'},serv_err_rate:{w:5,min:0.10,max:0.50,dir:'down'},assists_per_set:{w:38,min:1.19,max:10.15,dir:'up'},bh_err_rate:{w:7,min:0.00,max:0.04,dir:'down'},pts_per_set:{w:3,min:0.14,max:1.45,dir:'up'},consistency:{w:9,min:0.27,max:1.00,dir:'up'}},
  'L/DS':{kills_per_set:{w:1,min:0.00,max:0.06,dir:'up'},hit_pct:{w:1,min:-0.17,max:0.50,dir:'up'},digs_per_set:{w:44,min:0.51,max:4.42,dir:'up'},aces_per_set:{w:16,min:0.03,max:0.34,dir:'up'},blk_per_set:{w:0,min:0.00,max:0.01,dir:'up'},atk_err_rate:{w:1,min:0.00,max:0.33,dir:'down'},serv_err_rate:{w:8,min:0.07,max:0.45,dir:'down'},assists_per_set:{w:11,min:0.06,max:1.21,dir:'up'},pts_per_set:{w:2,min:0.04,max:0.38,dir:'up'},consistency:{w:16,min:0.30,max:1.00,dir:'up'}},
  'OPP':{kills_per_set:{w:21,min:0.73,max:3.29,dir:'up'},hit_pct:{w:17,min:0.06,max:0.31,dir:'up'},digs_per_set:{w:12,min:0.23,max:1.99,dir:'up'},aces_per_set:{w:9,min:0.00,max:0.31,dir:'up'},blk_per_set:{w:14,min:0.22,max:0.88,dir:'up'},atk_err_rate:{w:7,min:0.12,max:0.25,dir:'down'},serv_err_rate:{w:5,min:0.00,max:0.42,dir:'down'},pts_per_set:{w:9,min:0.91,max:3.84,dir:'up'},consistency:{w:6,min:0.20,max:1.00,dir:'up'}}};
let W=JSON.parse(JSON.stringify(DW));

// VALUATION SETTINGS
let VS={avgPay:25000,minPay:3000,maxPay:85000,starValue:70000,starPctile:.95,setsAdj:'on',setsPctile:.90};
const VS_DEF={...VS};

function gm(p){const s=Math.max(p.Sets||1,1),a=Math.max(p.Atk||1,1);return{kills_per_set:(p.Kills||0)/s,hit_pct:parseFloat(p['Hit %'])||0,digs_per_set:(p.Digs||0)/s,aces_per_set:(p.Aces||0)/s,blk_per_set:(p['Total Blk']||0)/s,atk_err_rate:(p['Atk Err']||0)/a,serv_err_rate:(p['Serv Err']||0)/s,assists_per_set:(p.Assists||0)/s,bh_err_rate:(p['BH Err']||0)/s,pts_per_set:(p.PTS||0)/s,consistency:Math.min(s/110,1)}}
function gPc(v,arr,inv){if(!arr||!arr.length)return .5;let c=0;for(const x of arr)if(v>=x)c++;let p=c/arr.length;if(inv)p=1-p;return Math.max(0,Math.min(1,p))}
function bPc(pl){const g={};for(const p of pl){const pos=p._np;if(!W[pos])continue;const m=gm(p);for(const st of Object.keys(W[pos])){const k=`${pos}_${st}`;if(!g[k])g[k]=[];g[k].push(m[st]||0)}}for(const k of Object.keys(g))g[k].sort((a,b)=>a-b);return g}

function scoreP(p,pct){const w=W[p._np];if(!w)return 0;const m=gm(p);let sc=0;for(const[st,cfg]of Object.entries(w)){const arr=pct[`${p._np}_${st}`];if(!arr)continue;sc+=cfg.w/100*gPc(m[st]||0,arr,cfg.dir==='down')}return Math.round(sc*100)}

function gSP(p,pct){const w=W[p._np];if(!w)return{};const m=gm(p);const r={};for(const[st,cfg]of Object.entries(w)){const arr=pct[`${p._np}_${st}`];if(!arr)continue;r[st]={value:m[st]||0,pctile:Math.round(gPc(m[st]||0,arr,cfg.dir==='down')*100),weight:cfg.w,dir:cfg.dir}}return r}

function gTier(s){if(s>=82)return'Elite';if(s>=65)return'Starter';if(s>=45)return'Rotation';if(s>=28)return'Bench';return'Developmental'}

// VALUATION with sets adjustment
function gVal(p){
  const rawScore=p._score/100;
  // Sets adjustment: sqrt(min(1, sets/sets_p90))
  let adj=1;
  if(VS.setsAdj==='on'){
    const setsThresh=ALL.length?quantile(ALL.map(x=>x.Sets),VS.setsPctile):100;
    adj=Math.sqrt(Math.min(1,(p.Sets||1)/setsThresh));
  }
  const adjustedScore=rawScore*adj;
  // Exponential curve anchored at avgPay
  // At starPctile score (e.g. .95), value = avgPay + starValue
  // val = minPay + (maxPay - minPay) * (adjustedScore ^ exponent)
  // Solve exponent so that at starPctile, val ~ avgPay + starValue (capped at maxPay)
  const exponent=2.2;
  let val=VS.minPay+(VS.maxPay-VS.minPay)*Math.pow(adjustedScore,exponent);
  val=Math.max(VS.minPay,Math.min(VS.maxPay,val));
  return Math.round(val/100)*100;
}

function quantile(arr,q){const s=[...arr].sort((a,b)=>a-b);const i=Math.floor(s.length*q);return s[Math.min(i,s.length-1)]}

function gTags(p){const tags=[];const s=Math.max(p.Sets||1,1);const kps=(p.Kills||0)/s,dps=(p.Digs||0)/s,aps=(p.Assists||0)/s,bps=(p['Total Blk']||0)/s,acps=(p.Aces||0)/s,hp=parseFloat(p['Hit %'])||0,pps=(p.PTS||0)/s,aerr=(p['Atk Err']||0)/Math.max(p.Atk||1,1);
  if(p.Sets>=100)tags.push({t:'Ironwoman',c:'var(--yw)',bg:'var(--yd)'});
  if(pps>=4.5)tags.push({t:'Point Machine',c:'var(--ac)',bg:'var(--ad)'});
  if(acps>=0.35)tags.push({t:'Ace Server',c:'var(--cy)',bg:'var(--cd)'});
  if((p['Serv Err']||0)/s<0.08&&p.Sets>=60)tags.push({t:'Clean Server',c:'var(--gn)',bg:'var(--gd)'});
  const pos=p._np;
  if(pos==='OH'){if(kps>=3.5)tags.push({t:'Elite Scorer',c:'var(--ac)',bg:'var(--ad)'});if(kps>=2.5&&dps>=2.5)tags.push({t:'6-Rotation Star',c:'var(--yw)',bg:'var(--yd)'});if(dps>=3.0)tags.push({t:'Floor General',c:'var(--pu)',bg:'var(--pd)'});if(hp>=.300)tags.push({t:'Efficient Hitter',c:'var(--gn)',bg:'var(--gd)'});if(aerr>=.20)tags.push({t:'Error Prone',c:'var(--rd)',bg:'var(--rdd)'})}
  if(pos==='MB'){if(bps>=1.0)tags.push({t:'Wall',c:'var(--bl)',bg:'var(--bld)'});if(hp>=.400)tags.push({t:'Elite Efficiency',c:'var(--yw)',bg:'var(--yd)'});else if(hp>=.350)tags.push({t:'Efficient Hitter',c:'var(--gn)',bg:'var(--gd)'});if(kps>=2.0&&bps>=0.8)tags.push({t:'Dual Threat',c:'var(--ac)',bg:'var(--ad)'});if(bps<0.3&&p.Sets>=60)tags.push({t:'Undersized',c:'var(--rd)',bg:'var(--rdd)'})}
  if(pos==='S'){if(aps>=10.0)tags.push({t:'Maestro',c:'var(--gn)',bg:'var(--gd)'});else if(aps>=8.0)tags.push({t:'Floor General',c:'var(--gn)',bg:'var(--gd)'});if(dps>=2.0)tags.push({t:'Defensive Setter',c:'var(--pu)',bg:'var(--pd)'});if(bps>=0.4)tags.push({t:'Blocking Setter',c:'var(--bl)',bg:'var(--bld)'});if((p['BH Err']||0)/s<=0.002&&p.Sets>=60)tags.push({t:'Clean Hands',c:'var(--cy)',bg:'var(--cd)'});if((p['BH Err']||0)/s>=0.05)tags.push({t:'Loose Hands',c:'var(--rd)',bg:'var(--rdd)'})}
  if(pos==='L/DS'){if(dps>=4.5)tags.push({t:'Elite Passer',c:'var(--yw)',bg:'var(--yd)'});else if(dps>=3.5)tags.push({t:'Lockdown Defender',c:'var(--pu)',bg:'var(--pd)'});if(aps>=1.0)tags.push({t:'Playmaker Libero',c:'var(--gn)',bg:'var(--gd)'});if(acps>=0.25)tags.push({t:'Ace Server',c:'var(--cy)',bg:'var(--cd)'});if(p.Sets>=110)tags.push({t:'Every-Set Player',c:'var(--yw)',bg:'var(--yd)'})}
  if(pos==='OPP'){if(kps>=3.0)tags.push({t:'Scoring Opposite',c:'var(--ac)',bg:'var(--ad)'});if(bps>=0.8)tags.push({t:'Blocking Opposite',c:'var(--bl)',bg:'var(--bld)'});if(kps>=2.5&&bps>=0.7&&dps>=1.5)tags.push({t:'Complete Player',c:'var(--yw)',bg:'var(--yd)'});if(hp>=.300)tags.push({t:'Efficient Hitter',c:'var(--gn)',bg:'var(--gd)'})}
  return tags}

// ═══════════════════════════════════════
// DATA
// ═══════════════════════════════════════
let ALL=[],FILT=[],ROST=[],OPPROST=[],PCT={},HIST={};let SC='score',SD='desc';let RSIZE=14,TBUDGET=250000,PBUDGET=85000;let ROST_SUB='myteam';let OPP_SEARCH='';

function processData(raw){
  // Build history map: player name -> array of all season rows (all years)
  HIST={};
  for(const r of raw){
    const name=r.Player;if(!name)continue;
    if(!HIST[name])HIST[name]=[];
    const row={...r};
    row.Season=parseFloat(row.Season)||0;
    row['Hit %']=parseFloat(row['Hit %'])||0;
    row.Sets=parseFloat(row.Sets)||0;row.Matches=parseFloat(row.Matches)||0;
    row.Kills=parseFloat(row.Kills)||0;row['Atk Err']=parseFloat(row['Atk Err'])||0;
    row.Atk=parseFloat(row.Atk)||0;row.Assists=parseFloat(row.Assists)||0;
    row.Aces=parseFloat(row.Aces)||0;row['Serv Err']=parseFloat(row['Serv Err'])||0;
    row.Digs=parseFloat(row.Digs)||0;row['Total Blk']=parseFloat(row['Total Blk'])||0;
    row['BH Err']=parseFloat(row['BH Err'])||0;row.PTS=parseFloat(row.PTS)||0;
    row._np=nP(row.Pos);
    HIST[name].push(row);
  }
  // Sort each player's history by season
  for(const name of Object.keys(HIST))HIST[name].sort((a,b)=>a.Season-b.Season);

  // Auto-detect latest season in the data (no hardcoded year)
  const latestSeason=Math.max(...raw.map(r=>parseFloat(r.Season)||0));
  const pl=raw.filter(r=>(parseFloat(r.Season)||0)===latestSeason).map((r,i)=>{r._np=nP(r.Pos);r._id=i;r['Hit %']=parseFloat(r['Hit %'])||0;r.Sets=parseFloat(r.Sets)||0;r.Matches=parseFloat(r.Matches)||0;r.Kills=parseFloat(r.Kills)||0;r['Atk Err']=parseFloat(r['Atk Err'])||0;r.Atk=parseFloat(r.Atk)||0;r.Assists=parseFloat(r.Assists)||0;r.Aces=parseFloat(r.Aces)||0;r['Serv Err']=parseFloat(r['Serv Err'])||0;r.Digs=parseFloat(r.Digs)||0;r['Total Blk']=parseFloat(r['Total Blk'])||0;r['BH Err']=parseFloat(r['BH Err'])||0;r.PTS=parseFloat(r.PTS)||0;return r}).filter(p=>W[p._np]&&p.Sets>=15);
  const seen={},ded=[];for(const p of pl){if(seen[p.Player]){if(p.Sets>(seen[p.Player].Sets||0)){ded[ded.indexOf(seen[p.Player])]=p;seen[p.Player]=p}}else{seen[p.Player]=p;ded.push(p)}}
  return ded}

function calcAll(){PCT=bPc(ALL);for(const p of ALL){p._score=scoreP(p,PCT);p._tier=gTier(p._score);p._val=gVal(p);p._tags=gTags(p);const s=Math.max(p.Sets||1,1);p._kps=((p.Kills||0)/s).toFixed(2);p._dps=((p.Digs||0)/s).toFixed(2);p._aps=((p.Assists||0)/s).toFixed(2);p._bps=((p['Total Blk']||0)/s).toFixed(2);p._acps=((p.Aces||0)/s).toFixed(2);p._pps=((p.PTS||0)/s).toFixed(2)}}
function recalc(){calcAll();applyF()}

// ─── DATA SOURCE: stats.ncaa.org (via data/players.json) ───────────────────
// Populated weekly by scripts/scraper.py via GitHub Actions.
// To refresh manually: python scripts/scraper.py
const DATA_URL='./data/players.json';

async function fetchData(){
  const status=document.getElementById('load-status');
  const errEl=document.getElementById('load-error');
  try{
    status.textContent='Loading player data...';
    const resp=await fetch(DATA_URL+'?t='+Date.now());
    if(!resp.ok)throw new Error(`HTTP ${resp.status} loading ${DATA_URL}`);
    const json=await resp.json();

    // Handle empty / not-yet-populated file
    if(!json.players||json.players.length===0){
      throw new Error(
        'Player data file is empty. Run the scraper first:\n  python scripts/scraper.py\n'+
        'Or trigger the "Update NCAA Volleyball Stats" GitHub Action.'
      );
    }

    // Show data freshness in status
    const updated=json.meta?.updated||'';
    const dateStr=updated?new Date(updated).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
    const inferred=json.meta?.posInferred||0;
    status.textContent=`Processing ${json.players.length} players${dateStr?' (updated '+dateStr+')':''}...`;

    // Store meta for display
    window._dataMeta=json.meta||{};

    setTimeout(()=>{
      // processData auto-detects the latest season in the data
      ALL=processData(json.players);calcAll();FILT=[...ALL];
      status.textContent='Done!';
      setTimeout(()=>{
        document.getElementById('US').style.display='none';
        document.getElementById('DB').style.display='block';
        initD();
        // Show position-inferred notice if applicable
        if(inferred>0){
          const pct=Math.round(inferred/json.players.length*100);
          console.info(`[data] ${inferred} positions inferred from stats (${pct}% of players). Run scraper to improve.`);
        }
      },300);
    },50);
  }catch(err){
    document.getElementById('spinner').style.display='none';
    status.style.display='none';
    errEl.style.display='block';
    errEl.innerHTML='<b>Data load error:</b><br>'+err.message.replace(/\n/g,'<br>')
      +'<br><br><small>Run <code>python scripts/scraper.py</code> to populate data.</small>';
  }
}

// Auto-load on page ready
document.addEventListener('DOMContentLoaded',fetchData);

// DASHBOARD
function initD(){document.getElementById('tpc').textContent=ALL.length.toLocaleString();document.getElementById('ttc').textContent=new Set(ALL.map(p=>p.Team)).size;
  document.getElementById('fp').addEventListener('change',applyF);document.getElementById('ft').addEventListener('change',applyF);document.getElementById('fs').addEventListener('input',applyF);
  document.querySelectorAll('.tbtn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tbtn').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tp').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('p-'+b.dataset.tab).classList.add('active')}));
  applyF();renderW();renderVS();renderMeth()}

function applyF(){const pos=document.getElementById('fp').value,tier=document.getElementById('ft').value,search=document.getElementById('fs').value.toLowerCase().trim();
  FILT=ALL.filter(p=>{if(pos!=='all'&&p._np!==pos)return false;if(tier!=='all'&&p._tier!==tier)return false;if(search&&!p.Player.toLowerCase().includes(search)&&!p.Team.toLowerCase().includes(search))return false;return true});PG=0;sortD();renderAll()}
function sortD(){FILT.sort((a,b)=>{let av,bv;switch(SC){case'score':av=a._score;bv=b._score;break;case'val':av=a._val;bv=b._val;break;case'kills':av=+a._kps;bv=+b._kps;break;case'digs':av=+a._dps;bv=+b._dps;break;case'assists':av=+a._aps;bv=+b._aps;break;case'blocks':av=+a._bps;bv=+b._bps;break;case'aces':av=+a._acps;bv=+b._acps;break;case'hitpct':av=a['Hit %'];bv=b['Hit %'];break;case'pts':av=+a._pps;bv=+b._pps;break;case'player':av=a.Player;bv=b.Player;break;default:av=a._score;bv=b._score}if(SC==='player')return SD==='asc'?av.localeCompare(bv):bv.localeCompare(av);return SD==='asc'?av-bv:bv-av})}
function setS(c){if(SC===c)SD=SD==='desc'?'asc':'desc';else{SC=c;SD='desc'}PG=0;sortD();renderAll()}

// RENDER HELPERS
function pbH(pos){const c=pos.toLowerCase().replace('/','');return `<span class="pb ${c}">${pos}</span>`}
const TIER_INFO={
  'Elite':'Score 82–100. Top ~5% of players at their position. These are All-Conference / All-American caliber players who dominate in their key stats. They\'re the players who change games and are worth premium NIL investment.',
  'Starter':'Score 65–81. Above-average players who are reliable starters on most rosters. They perform well across their key stats and are consistent contributors. Solid NIL value — they start and produce.',
  'Rotation':'Score 45–64. Average-range players who contribute in a rotation role. They may start on some teams or come in for specific situations. Good developmental upside — could become starters with improvement in 1–2 areas.',
  'Bench':'Score 28–44. Below-average production relative to position peers. These players see limited court time or are early in development. Low NIL value currently but may have potential if they improve.',
  'Developmental':'Score 0–27. Minimal statistical production — either very limited playing time, freshmen getting their first reps, or players whose skills haven\'t translated to stats yet. Lowest NIL tier but could be future contributors.'
};
function tbH(t){return `<span class="tb ${t.toLowerCase()}" style="cursor:pointer" onclick="event.stopPropagation();showTierTT(this,'${t}')">${t}</span>`}
function showTierTT(el,tier){const tt=document.getElementById('ttp');const r=el.getBoundingClientRect();document.getElementById('ttt').textContent=tier+' Tier';document.getElementById('ttb').textContent=TIER_INFO[tier]||'No info.';tt.style.top=Math.min(r.bottom+6,window.innerHeight-180)+'px';tt.style.left=Math.min(r.left,window.innerWidth-320)+'px';tt.classList.add('show')}
function sBarH(s){const p=Math.min(s,100);let c='var(--t3)';if(s>=82)c='var(--yw)';else if(s>=65)c='var(--gn)';else if(s>=45)c='var(--bl)';else if(s>=28)c='var(--pu)';return `<div class="sb"><span class="sn" style="color:${c}">${s}</span><div class="bar"><div class="bi" style="width:${p}%;background:${c}"></div></div></div>`}
function thSH(l,c){const a=SC===c;return `<th class="${a?'sorted':''}" onclick="setS('${c}')">${l}${a?(SD==='desc'?' ▼':' ▲'):''}</th>`}
function tagHH(tags,click){return tags.map(t=>`<span class="tag" style="background:${t.bg};color:${t.c}" ${click?`onclick="event.stopPropagation();showTT(this,'${t.t.replace(/'/g,"\\'")}')"`:``}>${t.t}</span>`).join('')}

function buildTbl(pl,mode,offset){
  const o=offset||0;
  let h=`<table><thead><tr><th>#</th>${thSH('Player','player')}<th>Pos</th>${thSH('Score','score')}<th>Tier</th>${thSH('Value','val')}<th>Tags</th>${thSH('K/S','kills')}${thSH('Hit%','hitpct')}${thSH('D/S','digs')}${thSH('A/S','assists')}${thSH('B/S','blocks')}${thSH('Ace/S','aces')}<th>Sets</th>${mode==='add'?'<th></th>':''}</tr></thead><tbody>`;
  pl.forEach((p,i)=>{const inR=ROST.some(r=>r._id===p._id);
    h+=`<tr onclick="openP(${p._id})"><td class="mono" style="color:var(--t3);font-size:.62rem">${o+i+1}</td><td><span class="pn">${p.Player}</span><br><span class="tn">${p.Team}</span></td><td>${pbH(p._np)}</td><td>${sBarH(p._score)}</td><td>${tbH(p._tier)}</td><td class="vc">$${p._val.toLocaleString()}</td><td style="max-width:160px;white-space:normal">${tagHH(p._tags.slice(0,3),false)}</td><td class="mono" style="font-size:.68rem">${p._kps}</td><td class="mono" style="font-size:.68rem">${(p['Hit %']||0).toFixed(3)}</td><td class="mono" style="font-size:.68rem">${p._dps}</td><td class="mono" style="font-size:.68rem">${p._aps}</td><td class="mono" style="font-size:.68rem">${p._bps}</td><td class="mono" style="font-size:.68rem">${p._acps}</td><td class="mono" style="font-size:.68rem;color:var(--t3)">${p.Sets}</td>${mode==='add'?`<td onclick="event.stopPropagation()">${inR?'<span style="color:var(--gn);font-size:.58rem">✓</span>':`<button class="btn-ad" onclick="addR(${p._id})">+</button>`}</td>`:''}</tr>`});
  return h+'</tbody></table>'}

function renderAll(){renderStats();renderPlayers();renderPos();renderRost()}
function renderStats(){const c=document.getElementById('ostats');const avg=FILT.length?(FILT.reduce((s,p)=>s+p._score,0)/FILT.length).toFixed(1):0;const avgV=FILT.length?Math.round(FILT.reduce((s,p)=>s+p._val,0)/FILT.length):0;const el=FILT.filter(p=>p._tier==='Elite').length;const top=FILT.length?FILT.reduce((a,b)=>a._score>b._score?a:b):null;const spent=ROST.reduce((s,p)=>s+p._val,0);
  c.innerHTML=`<div class="sc"><div class="lb">Players</div><div class="vl mono">${FILT.length.toLocaleString()}</div></div><div class="sc"><div class="lb">Avg Score</div><div class="vl mono">${avg}</div></div><div class="sc"><div class="lb">Avg Value</div><div class="vl mono">$${avgV.toLocaleString()}</div></div><div class="sc"><div class="lb">Elite</div><div class="vl mono" style="color:var(--yw)">${el}</div></div><div class="sc"><div class="lb">#1 Player</div><div class="vl" style="font-size:.82rem;font-family:'DM Sans'">${top?top.Player:'—'}</div><div class="su">${top?top.Team+' · '+top._score:''}</div></div><div class="sc acc"><div class="lb">Budget Left</div><div class="vl mono">$${(TBUDGET-spent).toLocaleString()}</div><div class="su">${ROST.length}/${RSIZE}</div></div>`}
let PG=0,PG_SIZE=200;
function renderPlayers(){
  const total=FILT.length;const pages=Math.ceil(total/PG_SIZE);PG=Math.min(PG,pages-1);PG=Math.max(PG,0);
  const start=PG*PG_SIZE;const slice=FILT.slice(start,start+PG_SIZE);
  document.getElementById('plt').innerHTML=buildTbl(slice,'none',start);
  document.getElementById('plc').textContent=`${start+1}–${Math.min(start+PG_SIZE,total)} of ${total.toLocaleString()}`;
  // Pagination nav
  const nav=document.getElementById('pgnav');
  if(pages<=1){nav.innerHTML='';return}
  let h=`<button class="btn-s" onclick="PG=0;renderPlayers()" ${PG===0?'disabled style="opacity:.3"':''}>«</button>`;
  h+=`<button class="btn-s" onclick="PG=Math.max(0,PG-1);renderPlayers()" ${PG===0?'disabled style="opacity:.3"':''}>‹</button>`;
  h+=`<span style="font-size:.65rem;color:var(--t2);padding:0 .3rem">${PG+1}/${pages}</span>`;
  h+=`<button class="btn-s" onclick="PG=Math.min(${pages-1},PG+1);renderPlayers()" ${PG>=pages-1?'disabled style="opacity:.3"':''}>›</button>`;
  h+=`<button class="btn-s" onclick="PG=${pages-1};renderPlayers()" ${PG>=pages-1?'disabled style="opacity:.3"':''}>»</button>`;
  nav.innerHTML=h;
}
function renderPos(){const g=document.getElementById('pgd');g.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:.7rem;margin-top:.7rem';
  g.innerHTML=['OH','MB','S','L/DS','OPP'].map(pos=>{const pp=[...FILT].filter(p=>p._np===pos).sort((a,b)=>b._score-a._score).slice(0,10);return `<div style="background:var(--sf);border:1px solid var(--bd);border-radius:12px;overflow:hidden"><div style="padding:.6rem .8rem;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between"><h4 style="font-size:.8rem;font-weight:600">${pbH(pos)} ${PN[pos]}</h4><span style="font-size:.62rem;color:var(--t3)">${FILT.filter(p=>p._np===pos).length}</span></div><div style="padding:.15rem 0">${pp.map((p,i)=>`<div style="display:flex;align-items:center;padding:.35rem .8rem;gap:.5rem;cursor:pointer;transition:background .1s" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''" onclick="openP(${p._id})"><span class="mono" style="font-size:.62rem;color:var(--t3);min-width:16px">${i+1}</span><div style="flex:1;min-width:0;overflow:hidden"><div style="font-weight:600;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.Player}</div><div style="font-size:.6rem;color:var(--t3)">${p.Team} · ${p._score}</div></div><span class="mono" style="font-size:.7rem;font-weight:700;color:var(--gn)">$${p._val.toLocaleString()}</span></div>`).join('')}</div></div>`}).join('')}

// PLAYER MODAL
function openP(id){const p=ALL.find(x=>x._id===id);if(!p)return;const stats=gSP(p,PCT);const sorted=Object.entries(stats).sort((a,b)=>b[1].pctile-a[1].pctile);const str=sorted.filter(([k,v])=>v.pctile>=70&&v.weight>0).slice(0,5);const wk=sorted.filter(([k,v])=>v.pctile<=35&&v.weight>0).slice(0,4);
  const setsThresh=ALL.length?quantile(ALL.map(x=>x.Sets),VS.setsPctile):100;const adjFactor=VS.setsAdj==='on'?Math.sqrt(Math.min(1,(p.Sets||1)/setsThresh)):1;
  const hist=HIST[p.Player]||[];const prevTeams=[...new Set(hist.filter(h=>h.Season!==2025&&h.Team!==p.Team).map(h=>h.Team))];const yearsActive=hist.length>1?`${hist[0].Season}–2025`:'2025';
  document.getElementById('mh').innerHTML=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">${pbH(p._np)} ${tbH(p._tier)}${hist.length>1?` <span style="font-size:.6rem;color:var(--t3);background:var(--s2);padding:.12rem .35rem;border-radius:4px">${yearsActive} · ${hist.length} seasons</span>`:''}</div><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem"><div><div style="font-size:1.3rem;font-weight:700">${p.Player}</div><div style="color:var(--t2);font-size:.8rem">${p.Team}${prevTeams.length?' <span style="color:var(--cy);font-size:.68rem">(prev: '+prevTeams.join(', ')+')</span>':''}  · ${PN[p._np]} · ${p.Sets} sets / ${p.Matches} matches${VS.setsAdj==='on'?` · Sets adj: ${(adjFactor*100).toFixed(0)}%`:''}</div></div><button class="cmp-btn" onclick="showCmpPicker(${id})" style="margin-top:.15rem;white-space:nowrap;flex-shrink:0">⚔️ Compare</button></div><div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.2rem">${tagHH(p._tags,true)}</div>`;
  document.getElementById('mb').innerHTML=`<div class="pgrid">
    <div class="psec" style="text-align:center"><h4>Score</h4><div class="mono" style="font-size:2.5rem;font-weight:700;color:${p._score>=82?'var(--yw)':p._score>=65?'var(--gn)':p._score>=45?'var(--bl)':'var(--pu)'}">${p._score}</div><div style="font-size:.7rem;color:var(--t2)">/ 100</div><div class="mono" style="margin-top:.5rem;font-size:1.3rem;font-weight:700;color:var(--gn)">$${p._val.toLocaleString()}</div><div style="font-size:.6rem;color:var(--t3)">Predicted Value</div></div>
    <div class="psec"><h4>Raw Stats</h4><table style="width:100%;font-size:.72rem">${[['Kills',p.Kills,p._kps+'/s'],['Hit %',(p['Hit %']||0).toFixed(3)],['Digs',p.Digs,p._dps+'/s'],['Assists',p.Assists,p._aps+'/s'],['Blocks',p['Total Blk'],p._bps+'/s'],['Aces',p.Aces,p._acps+'/s'],['Points',p.PTS,p._pps+'/s'],['Atk Err',p['Atk Err'],((p['Atk Err']||0)/Math.max(p.Atk||1,1)*100).toFixed(1)+'%'],['Serv Err',p['Serv Err']],['BH Err',p['BH Err']]].map(([l,v,sub])=>`<tr><td style="color:var(--t2);padding:.18rem 0">${l}</td><td style="text-align:right" class="mono">${v}${sub?` <span style="color:var(--t3);font-size:.58rem">${sub}</span>`:''}</td></tr>`).join('')}</table></div>
    <div class="psec full"><h4>Percentile Breakdown <span style="font-size:.6rem;font-weight:400;color:var(--t3)">vs ${p._np} — click stat for info</span></h4><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.3rem">${Object.entries(stats).map(([st,v])=>{let c='var(--t3)';if(v.pctile>=80)c='var(--yw)';else if(v.pctile>=60)c='var(--gn)';else if(v.pctile>=40)c='var(--bl)';else if(v.pctile>=20)c='var(--pu)';else c='var(--rd)';return `<div style="flex:1;min-width:68px;text-align:center;cursor:pointer" onclick="event.stopPropagation();showSTT(this,'${st}')"><div style="font-size:.55rem;color:var(--t3);text-transform:uppercase;margin-bottom:.15rem">${SI[st]?.n||st}</div><div style="height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-bottom:.12rem"><div style="height:100%;border-radius:2px;width:${v.pctile}%;background:${c}"></div></div><div class="mono" style="font-size:.68rem;font-weight:700;color:${c}">${v.pctile}%</div></div>`}).join('')}</div></div>
    <div class="psec"><h4>💪 Strengths</h4>${str.length?str.map(([st,v])=>`<div style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;padding:.15rem 0"><span style="color:var(--gn)">▲</span>${SI[st]?.n||st}: <b style="color:var(--gn)">${v.pctile}th</b></div>`).join(''):'<div style="color:var(--t3);font-size:.75rem">None</div>'}</div>
    <div class="psec"><h4>⚠️ Weaknesses</h4>${wk.length?wk.map(([st,v])=>`<div style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;padding:.15rem 0"><span style="color:var(--rd)">▼</span>${SI[st]?.n||st}: <b style="color:var(--rd)">${v.pctile}th</b></div>`).join(''):'<div style="color:var(--t3);font-size:.75rem">None</div>'}</div>
    <div class="psec full"><h4>📅 Career History</h4>${(()=>{
      const hist=HIST[p.Player];
      if(!hist||hist.length<=1) return '<div style="color:var(--t3);font-size:.75rem">No prior season data available.</div>';
      // Build per-set rates for each season
      const seasons=hist.map(h=>{const s=Math.max(h.Sets||1,1);return{yr:h.Season,team:h.Team,pos:h.Pos||h._np,sets:h.Sets,matches:h.Matches,kps:((h.Kills||0)/s),hp:h['Hit %']||0,dps:((h.Digs||0)/s),aps:((h.Assists||0)/s),bps:((h['Total Blk']||0)/s),acps:((h.Aces||0)/s),pps:((h.PTS||0)/s),kills:h.Kills||0,digs:h.Digs||0,assists:h.Assists||0,pts:h.PTS||0,current:h.Season===2025}});
      const cur=seasons.find(s=>s.current);const prev=seasons.filter(s=>!s.current);
      // Trend arrows
      function trend(cur,prev){if(!prev)return'';const diff=cur-prev;if(Math.abs(diff)<0.01)return' <span style="color:var(--t3)">—</span>';return diff>0?' <span style="color:var(--gn)">▲</span>':' <span style="color:var(--rd)">▼</span>'}
      const lastPrev=prev.length?prev[prev.length-1]:null;
      return `<div style="overflow-x:auto"><table style="width:100%;font-size:.7rem;border-collapse:collapse">
        <thead><tr><th style="text-align:left;padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3)">Season</th><th style="text-align:left;padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3)">Team</th><th style="text-align:left;padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3)">Pos</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">Sets</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">K/S</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">Hit%</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">D/S</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">A/S</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">B/S</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">Ace/S</th><th style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);font-size:.6rem;color:var(--t3);text-align:right">PTS/S</th></tr></thead>
        <tbody>${seasons.map((s,i)=>{const prevS=i>0?seasons[i-1]:null;const isCur=s.current;return `<tr style="${isCur?'background:var(--ad);font-weight:600':'cursor:pointer'};transition:background .1s" ${!isCur?`onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''" onclick="openHist('${p.Player.replace(/'/g,"\\'")}',${s.yr})"`:''} title="${isCur?'Current season':'Click to view '+s.yr+' profile'}"><td style="padding:.3rem .4rem;border-bottom:1px solid var(--bd)">${s.yr}${isCur?' ★':''}</td><td style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.team}${(prevS&&s.team!==prevS.team)?' <span style="color:var(--cy);font-size:.55rem">↗ transfer</span>':''}</td><td style="padding:.3rem .4rem;border-bottom:1px solid var(--bd)">${s.pos}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.sets}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.kps.toFixed(2)}${isCur&&lastPrev?trend(s.kps,lastPrev.kps):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.hp.toFixed(3)}${isCur&&lastPrev?trend(s.hp,lastPrev.hp):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.dps.toFixed(2)}${isCur&&lastPrev?trend(s.dps,lastPrev.dps):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.aps.toFixed(2)}${isCur&&lastPrev?trend(s.aps,lastPrev.aps):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.bps.toFixed(2)}${isCur&&lastPrev?trend(s.bps,lastPrev.bps):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.acps.toFixed(2)}${isCur&&lastPrev?trend(s.acps,lastPrev.acps):''}</td><td class="mono" style="padding:.3rem .4rem;border-bottom:1px solid var(--bd);text-align:right">${s.pps.toFixed(2)}${isCur&&lastPrev?trend(s.pps,lastPrev.pps):''}</td></tr>`}).join('')}</tbody>
      </table></div>
      ${lastPrev&&cur?`<div style="margin-top:.5rem;font-size:.68rem;color:var(--t2)">Compared to ${lastPrev.yr}${lastPrev.team!==cur.team?' ('+lastPrev.team+')':''}: ${(()=>{const changes=[];const d=(n,l,c,p)=>{const diff=c-p;if(Math.abs(diff)>=0.01)changes.push({stat:n,diff,pct:p?((diff/Math.abs(p))*100).toFixed(0):0})};d('K/S','kps',cur.kps,lastPrev.kps);d('Hit%','hp',cur.hp,lastPrev.hp);d('D/S','dps',cur.dps,lastPrev.dps);d('A/S','aps',cur.aps,lastPrev.aps);d('B/S','bps',cur.bps,lastPrev.bps);d('PTS/S','pps',cur.pps,lastPrev.pps);return changes.length?changes.map(c=>`<span style="color:${c.diff>0?'var(--gn)':'var(--rd)'}"><b>${c.diff>0?'+':''}${c.diff.toFixed(2)}</b> ${c.stat}</span>`).join(' · '):'No significant changes'})()}</div>`:''}`
    })()}</div>
    <div class="psec full"><h4>🔄 Similar Players</h4><div style="display:flex;gap:.35rem;flex-wrap:wrap">${ALL.filter(x=>x._np===p._np&&x._id!==p._id&&Math.abs(x._score-p._score)<=8).sort((a,b)=>Math.abs(a._score-p._score)-Math.abs(b._score-p._score)).slice(0,6).map(x=>`<div style="background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:.35rem .55rem;cursor:pointer" onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--bd)'" onclick="openP(${x._id})"><div style="font-weight:600;font-size:.72rem">${x.Player}</div><div style="font-size:.58rem;color:var(--t3)">${x.Team} · ${x._score} · $${x._val.toLocaleString()}</div></div>`).join('')||'<span style="color:var(--t3);font-size:.72rem">None</span>'}</div></div>
  </div>`;
  document.getElementById('pm').classList.add('show');document.getElementById('pm').onclick=e=>{if(e.target===document.getElementById('pm'))closeM()}
  document.getElementById('cmpPicker').classList.remove('open');document.getElementById('cmpSearch').value='';document.getElementById('cmpResults').innerHTML='';}
function closeM(){document.getElementById('pm').classList.remove('show');document.getElementById('cmpPicker').classList.remove('open')}

// ── COMPARE PICKER ──
let _cmpFromId=null;
function showCmpPicker(fromId){
  _cmpFromId=fromId;
  const pk=document.getElementById('cmpPicker');
  if(pk.classList.toggle('open')){
    const inp=document.getElementById('cmpSearch');inp.value='';filterCmpPicker('');
    setTimeout(()=>inp.focus(),50);}}
function filterCmpPicker(q){
  const res=document.getElementById('cmpResults');
  const t=(q||'').toLowerCase().trim();
  const matches=ALL.filter(p=>p._id!==_cmpFromId&&(!t||p.Player.toLowerCase().includes(t)||p.Team.toLowerCase().includes(t)))
    .sort((a,b)=>b._score-a._score).slice(0,8);
  if(!matches.length){res.innerHTML='<div style="font-size:.72rem;color:var(--t3);padding:.3rem 0">No players found</div>';return;}
  res.innerHTML=matches.map(p=>`<div class="cmp-pk-row" onclick="pickCmpPlayer(${p._id})"><span><b style="font-size:.73rem">${p.Player}</b> <span style="color:var(--t3);font-size:.62rem">${p.Team}</span></span><span style="display:flex;gap:.3rem;align-items:center">${pbH(p._np)}<span class="mono" style="font-size:.66rem;color:var(--t2)">${p._score}</span><span style="font-size:.6rem;color:var(--gn)">$${p._val.toLocaleString()}</span></span></div>`).join('');}
function pickCmpPlayer(toId){document.getElementById('cmpPicker').classList.remove('open');closeM();openCompare(_cmpFromId,toId);}

// Open historical season profile
function openHist(playerName,season){
  const hist=HIST[playerName];if(!hist)return;
  const h=hist.find(x=>x.Season===season);if(!h)return;
  // Build a temporary player object from historical data
  const p={...h,Player:playerName,_np:nP(h.Pos)};
  if(!W[p._np])return;
  // Score this historical season against current 2025 percentiles
  const m=gm(p);
  const stats={};
  for(const[st,cfg]of Object.entries(W[p._np])){
    const arr=PCT[`${p._np}_${st}`];if(!arr)continue;
    stats[st]={value:m[st]||0,pctile:Math.round(gPc(m[st]||0,arr,cfg.dir==='down')*100),weight:cfg.w,dir:cfg.dir};
  }
  const score=scoreP(p,PCT);const tier=gTier(score);const val=gVal({...p,_score:score});
  const tags=gTags({...p,_score:score});
  const sorted=Object.entries(stats).sort((a,b)=>b[1].pctile-a[1].pctile);
  const str=sorted.filter(([k,v])=>v.pctile>=70&&v.weight>0).slice(0,5);
  const wk=sorted.filter(([k,v])=>v.pctile<=35&&v.weight>0).slice(0,4);
  const s=Math.max(p.Sets||1,1);
  const kps=((p.Kills||0)/s).toFixed(2),dps=((p.Digs||0)/s).toFixed(2),aps=((p.Assists||0)/s).toFixed(2),bps=((p['Total Blk']||0)/s).toFixed(2),acps=((p.Aces||0)/s).toFixed(2),pps=((p.PTS||0)/s).toFixed(2);

  // Find 2025 entry for comparison
  const cur25=ALL.find(x=>x.Player===playerName);
  const compHTML=cur25?`<div class="psec full"><h4>📊 vs 2025 Season</h4><div style="display:flex;gap:.8rem;flex-wrap:wrap;font-size:.72rem">${[
    ['Score',score,cur25._score],['Value','$'+val.toLocaleString(),'$'+cur25._val.toLocaleString()],
    ['K/S',kps,cur25._kps],['Hit%',(p['Hit %']||0).toFixed(3),(cur25['Hit %']||0).toFixed(3)],
    ['D/S',dps,cur25._dps],['A/S',aps,cur25._aps],['B/S',bps,cur25._bps],['Ace/S',acps,cur25._acps]
  ].map(([label,old,now])=>{
    const nOld=parseFloat(String(old).replace(/[$,]/g,'')),nNow=parseFloat(String(now).replace(/[$,]/g,''));
    const diff=nNow-nOld;const better=diff>0;const neutral=Math.abs(diff)<0.01;
    return `<div style="background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:.4rem .6rem;min-width:80px;text-align:center"><div style="font-size:.55rem;color:var(--t3);text-transform:uppercase;margin-bottom:.15rem">${label}</div><div class="mono" style="font-size:.7rem;color:var(--t2)">${old}</div><div style="font-size:.55rem;margin-top:.1rem;color:var(--t3)">→</div><div class="mono" style="font-size:.7rem;font-weight:700;color:${neutral?'var(--t2)':better?'var(--gn)':'var(--rd)'}">${now} ${neutral?'':better?'▲':'▼'}</div></div>`
  }).join('')}</div></div>`:'';

  // Build the full history table for navigation
  const allSeasons=hist.map(x=>x.Season);

  document.getElementById('mh').innerHTML=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">${pbH(p._np)} ${tbH(tier)} <span style="font-size:.62rem;color:var(--yw);background:var(--yd);padding:.12rem .4rem;border-radius:4px;font-weight:600">${season} Season</span>${cur25?` <button class="btn-s" onclick="openP(${cur25._id})" style="font-size:.58rem;padding:.15rem .4rem">→ View 2025</button>`:''}</div><div style="font-size:1.3rem;font-weight:700">${playerName}</div><div style="color:var(--t2);font-size:.8rem">${h.Team} · ${PN[p._np]||p.Pos} · ${p.Sets} sets / ${p.Matches||'?'} matches</div><div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.2rem">${tagHH(tags,true)}${allSeasons.length>1?` <span style="font-size:.55rem;color:var(--t3);padding:.1rem .3rem">| Other seasons: ${allSeasons.filter(y=>y!==season).map(y=>`<span style="color:var(--cy);cursor:pointer;text-decoration:underline" onclick="openHist('${playerName.replace(/'/g,"\\'")}',${y})">${y}</span>`).join(' ')}</span>`:''}</div>`;

  document.getElementById('mb').innerHTML=`<div class="pgrid">
    <div class="psec" style="text-align:center"><h4>${season} Score <span style="font-size:.58rem;color:var(--t3);font-weight:400">scored vs 2025 peers</span></h4><div class="mono" style="font-size:2.5rem;font-weight:700;color:${score>=82?'var(--yw)':score>=65?'var(--gn)':score>=45?'var(--bl)':'var(--pu)'}">${score}</div><div style="font-size:.7rem;color:var(--t2)">/ 100</div><div class="mono" style="margin-top:.5rem;font-size:1.3rem;font-weight:700;color:var(--gn)">$${val.toLocaleString()}</div><div style="font-size:.6rem;color:var(--t3)">Projected Predicted Value</div></div>
    <div class="psec"><h4>${season} Raw Stats</h4><table style="width:100%;font-size:.72rem">${[['Kills',p.Kills||0,kps+'/s'],['Hit %',(p['Hit %']||0).toFixed(3)],['Digs',p.Digs||0,dps+'/s'],['Assists',p.Assists||0,aps+'/s'],['Blocks',p['Total Blk']||0,bps+'/s'],['Aces',p.Aces||0,acps+'/s'],['Points',p.PTS||0,pps+'/s'],['Atk Err',p['Atk Err']||0,((p['Atk Err']||0)/Math.max(p.Atk||1,1)*100).toFixed(1)+'%'],['Serv Err',p['Serv Err']||0],['BH Err',p['BH Err']||0]].map(([l,v,sub])=>`<tr><td style="color:var(--t2);padding:.18rem 0">${l}</td><td style="text-align:right" class="mono">${v}${sub?` <span style="color:var(--t3);font-size:.58rem">${sub}</span>`:''}</td></tr>`).join('')}</table></div>
    <div class="psec full"><h4>Percentile Breakdown <span style="font-size:.6rem;font-weight:400;color:var(--t3)">vs 2025 ${p._np} players</span></h4><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.3rem">${Object.entries(stats).map(([st,v])=>{let c='var(--t3)';if(v.pctile>=80)c='var(--yw)';else if(v.pctile>=60)c='var(--gn)';else if(v.pctile>=40)c='var(--bl)';else if(v.pctile>=20)c='var(--pu)';else c='var(--rd)';return `<div style="flex:1;min-width:68px;text-align:center;cursor:pointer" onclick="event.stopPropagation();showSTT(this,'${st}')"><div style="font-size:.55rem;color:var(--t3);text-transform:uppercase;margin-bottom:.15rem">${SI[st]?.n||st}</div><div style="height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-bottom:.12rem"><div style="height:100%;border-radius:2px;width:${v.pctile}%;background:${c}"></div></div><div class="mono" style="font-size:.68rem;font-weight:700;color:${c}">${v.pctile}%</div></div>`}).join('')}</div></div>
    <div class="psec"><h4>💪 Strengths</h4>${str.length?str.map(([st,v])=>`<div style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;padding:.15rem 0"><span style="color:var(--gn)">▲</span>${SI[st]?.n||st}: <b style="color:var(--gn)">${v.pctile}th</b></div>`).join(''):'<div style="color:var(--t3);font-size:.75rem">None</div>'}</div>
    <div class="psec"><h4>⚠️ Weaknesses</h4>${wk.length?wk.map(([st,v])=>`<div style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;padding:.15rem 0"><span style="color:var(--rd)">▼</span>${SI[st]?.n||st}: <b style="color:var(--rd)">${v.pctile}th</b></div>`).join(''):'<div style="color:var(--t3);font-size:.75rem">None</div>'}</div>
    ${compHTML}
  </div>`;
  document.getElementById('pm').classList.add('show');document.getElementById('pm').onclick=e=>{if(e.target===document.getElementById('pm'))closeM()}}

// TOOLTIPS
function showTT(el,name){const tt=document.getElementById('ttp');const r=el.getBoundingClientRect();document.getElementById('ttt').textContent=name;document.getElementById('ttb').textContent=TI[name]||'No info.';tt.style.top=Math.min(r.bottom+6,window.innerHeight-180)+'px';tt.style.left=Math.min(r.left,window.innerWidth-320)+'px';tt.classList.add('show')}
function showSTT(el,st){const tt=document.getElementById('ttp');const r=el.getBoundingClientRect();const i=SI[st];document.getElementById('ttt').textContent=(i?.n||st)+(i?.dir==='down'?' (Lower = Better)':' (Higher = Better)');document.getElementById('ttb').textContent=i?.d||'No info.';tt.style.top=Math.min(r.bottom+6,window.innerHeight-180)+'px';tt.style.left=Math.min(r.left,window.innerWidth-320)+'px';tt.classList.add('show')}
function closeTT(){document.getElementById('ttp').classList.remove('show')}
document.addEventListener('click',e=>{if(!e.target.closest('.ttpop')&&!e.target.closest('.tag'))closeTT()})

// ROSTER
function addR(id){const p=ALL.find(x=>x._id===id);if(!p||ROST.some(r=>r._id===id))return;if(ROST.length>=RSIZE)return alert(`Roster full (${RSIZE}).`);ROST.push(p);renderAll()}
function rmR(id){ROST=ROST.filter(r=>r._id!==id);SWAPPED.delete(id);renderAll()}
function swpR(out,inn){ROST=ROST.filter(r=>r._id!==out);const p=ALL.find(x=>x._id===inn);if(p){ROST.push(p);SWAPPED.add(inn)}renderAll()}
function addAll(){const avail=FILT.filter(p=>!ROST.some(r=>r._id===p._id)).sort((a,b)=>b._score-a._score);for(const p of avail){if(ROST.length>=RSIZE)break;const spent=ROST.reduce((s,r)=>s+r._val,0);if(p._val<=TBUDGET-spent&&p._val<=PBUDGET)ROST.push(p)}renderAll()}
function clearR(){ROST=[];SWAPPED.clear();renderAll()}
function addOpp(id){const p=ALL.find(x=>x._id===id);if(!p||OPPROST.some(r=>r._id===id))return;OPPROST.push(p);OPP_SEARCH='';renderAll()}
function rmOpp(id){OPPROST=OPPROST.filter(r=>r._id!==id);renderAll()}
function clearOpp(){OPPROST=[];renderAll()}
function setRosterSub(tab){ROST_SUB=tab;renderRost()}
function updateOppDd(){
  const dd=document.getElementById('oppDd');if(!dd)return;
  const q=OPP_SEARCH.trim();
  if(!q){dd.className='opp-dd';dd.innerHTML='';return;}
  const matches=ALL.filter(p=>!OPPROST.some(r=>r._id===p._id)&&((p.Player||'').toLowerCase().includes(q.toLowerCase())||(p.Team||'').toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b._score-a._score).slice(0,8);
  dd.className='opp-dd'+(matches.length?' open':'');
  dd.innerHTML=matches.map(p=>`<div class="opp-dd-row" onclick="addOpp(${p._id})"><span><b>${escQ(p.Player)}</b> <span class="tn">${escQ(p.Team)} · ${p._np}</span></span><button class="btn-ad" style="padding:.18rem .45rem" onclick="event.stopPropagation();addOpp(${p._id})">+ Add</button></div>`).join('');
}
function addOpponentTeamByName(){const input=document.getElementById('oppTeamSearch');const team=(input?.value||'').trim();if(!team)return;const pool=ALL.filter(r=>(r.Team||'').toLowerCase().includes(team.toLowerCase())).sort((a,b)=>b._score-a._score);if(!pool.length){alert('No matching team found.');return;}const existing=new Set(OPPROST.map(r=>r._id));pool.forEach(p=>{if(!existing.has(p._id))OPPROST.push(p)});if(input)input.value='';ROST_SUB='opponent';renderAll()}
let SWAPPED=new Set(); // Track players swapped in via recommendation — they won't be suggested for further swaps

function escQ(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function teamCats(){return{offense:{l:'Offense',i:'🏐',s:['kills_per_set','hit_pct','pts_per_set']},defense:{l:'Defense',i:'🛡️',s:['digs_per_set']},blocking:{l:'Blocking',i:'🧱',s:['blk_per_set']},serving:{l:'Serving',i:'🎯',s:['aces_per_set']},serv_ctrl:{l:'Serve Control',i:'🎛️',s:['serv_err_rate']},setting:{l:'Setting',i:'🤲',s:['assists_per_set']},durability:{l:'Durability',i:'💪',s:['consistency']},efficiency:{l:'Efficiency',i:'📈',s:['hit_pct','atk_err_rate']}}}
function rosterCategoryScores(roster){const cats=teamCats(),scores={};for(const[cat,info]of Object.entries(cats)){let tot=0,cnt=0;for(const p of roster){const sp=gSP(p,PCT);for(const st of info.s){if(sp[st]){tot+=sp[st].pctile;cnt++}}}scores[cat]=cnt?Math.round(tot/cnt):50}return scores}
function rosterProfileColor(s){if(s>=75)return'var(--yw)';if(s>=60)return'var(--gn)';if(s>=45)return'var(--bl)';if(s>=30)return'var(--ac)';return'var(--rd)'}
function rosterProfileTag(cat,s){const cats=teamCats();if(s>=70)return{t:`Strong: ${cats[cat].l}`,c:'var(--gn)',bg:'var(--gd)'};if(s>=50)return{t:`Avg: ${cats[cat].l}`,c:'var(--bl)',bg:'var(--bld)'};return{t:`Weak: ${cats[cat].l}`,c:'var(--rd)',bg:'var(--rdd)'}}
function renderRosterProfile(title,scores){const cats=teamCats();return`<div class="tprof"><h3>${title}</h3>${Object.entries(scores).map(([cat,s])=>`<div class="tpr"><span class="tpi">${cats[cat].i}</span><span class="tpl">${cats[cat].l}</span><div class="tpb"><div class="tpf" style="width:${s}%;background:${rosterProfileColor(s)}"></div></div><span class="tpv" style="color:${rosterProfileColor(s)}">${s}th</span></div>`).join('')}<div class="tptags">${Object.entries(scores).map(([cat,s])=>{const t=rosterProfileTag(cat,s);return `<span class="tag" style="background:${t.bg};color:${t.c}">${t.t}</span>`}).join('')}</div></div>`}
function getHeadToHead(){if(!ROST.length||!OPPROST.length)return{error:'Need players in both rosters.'};const cats=teamCats();const myScores=rosterCategoryScores(ROST),oppScores=rosterCategoryScores(OPPROST);const comparison=Object.entries(cats).map(([key,info])=>({key,category:info.l,icon:info.i,myTeam:myScores[key],opponent:oppScores[key],edge:myScores[key]>oppScores[key]?'my_team':myScores[key]<oppScores[key]?'opponent':'even',margin:Math.abs(myScores[key]-oppScores[key])}));const myEdges=comparison.filter(r=>r.edge==='my_team').length;const oppEdges=comparison.filter(r=>r.edge==='opponent').length;return{comparison,myTeamSize:ROST.length,oppTeamSize:OPPROST.length,myTeamName:ROST[0]?.Team||'My Team',oppTeamName:OPPROST[0]?.Team||'Opponent',myEdges,oppEdges,strengths:comparison.filter(r=>r.edge==='my_team'&&r.margin>=8),vulnerabilities:comparison.filter(r=>r.edge==='opponent'&&r.margin>=8)}}
function renderH2HSection(){
  const h2h=getHeadToHead();
  if(h2h.error)return`<div class="tw"><div class="thb"><h3>⚔️ Head-to-Head</h3><span class="cnt">Build both rosters first</span></div><div class="h2h-wrap"><div class="h2h-empty">Add players to <b>My Team</b> and <b>Opponent</b> tabs to unlock matchup analysis.</div></div></div>`;
  const verdictClass=h2h.myEdges>h2h.oppEdges?'adv':h2h.myEdges<h2h.oppEdges?'tough':'even';
  const verdictText=h2h.myEdges>h2h.oppEdges?h2h.myTeamName+' holds the statistical edge.':h2h.myEdges<h2h.oppEdges?h2h.oppTeamName+' has the advantage right now.':'Statistically even — could go either way.';
  const verdictSub=h2h.myEdges+' categories for you • '+h2h.oppEdges+' for the opponent';
  const rows=h2h.comparison.map(row=>{
    const ec=row.edge==='my_team'?' edge-my':row.edge==='opponent'?' edge-opp':'';
    return`<div class="h2h-row${ec}"><div class="h2h-row-label">${row.icon} ${row.category}</div><div class="h2h-dual"><span class="h2h-grade my">${row.myTeam}</span><div class="h2h-track-l"><div class="h2h-fill-l" style="width:${row.myTeam}%"></div></div><div class="h2h-divider"></div><div class="h2h-track-r"><div class="h2h-fill-r" style="width:${row.opponent}%"></div></div><span class="h2h-grade opp">${row.opponent}</span></div></div>`;
  }).join('');
  const strengths=h2h.strengths.length?h2h.strengths.map(r=>`<div class="h2h-sw-item">${r.icon} ${r.category}<b>+${r.margin}</b></div>`).join(''):`<div class="h2h-sw-item dim">No edge above 8 pts yet</div>`;
  const vulns=h2h.vulnerabilities.length?h2h.vulnerabilities.map(r=>`<div class="h2h-sw-item">${r.icon} ${r.category}<b>-${r.margin}</b></div>`).join(''):`<div class="h2h-sw-item dim">No major gap right now</div>`;
  return`<div class="tw"><div class="thb"><h3>⚔️ Head-to-Head</h3><span class="cnt">${h2h.myTeamName} vs ${h2h.oppTeamName}</span></div><div class="h2h-wrap"><div class="h2h-verdict ${verdictClass}">⚖️ <div><div>${verdictText}</div><div class="vd-sub">${verdictSub}</div></div></div><div class="h2h-col-headers"><span style="color:var(--ac)">My Team</span><span></span><span style="color:var(--bl)">Opponent</span></div>${rows}<div class="h2h-summary"><div class="h2h-sw-box str"><h4>✅ Strengths</h4>${strengths}</div><div class="h2h-sw-box wk"><h4>⚠️ Pressure Points</h4>${vulns}</div></div><div class="h2h-legend"><span><i class="h2h-dot" style="background:var(--ac)"></i>My Team (orange)</span><span><i class="h2h-dot" style="background:var(--bl)"></i>Opponent (blue)</span></div></div></div>`;
}

function renderRost(){
  const z=document.getElementById('rz');const spent=ROST.reduce((s,p)=>s+p._val,0);const rem=TBUDGET-spent;
  const pc={OH:0,MB:0,S:0,'L/DS':0,OPP:0};ROST.forEach(p=>pc[p._np]=(pc[p._np]||0)+1);
  const ideal={OH:3,MB:2,S:1,'L/DS':2,OPP:1};
  const cats=teamCats();
  const cs=rosterCategoryScores(ROST),oppCs=rosterCategoryScores(OPPROST);
  const oppMatches=OPP_SEARCH?ALL.filter(p=>!OPPROST.some(r=>r._id===p._id)&&((p.Player||'').toLowerCase().includes(OPP_SEARCH.toLowerCase())||(p.Team||'').toLowerCase().includes(OPP_SEARCH.toLowerCase()))).sort((a,b)=>b._score-a._score).slice(0,8):[];

  let alerts='';const pn=[],po=[];
  for(const[pos,need]of Object.entries(ideal))if((pc[pos]||0)<need)pn.push({pos,need,have:pc[pos]||0});
  for(const[pos,cnt]of Object.entries(pc))if(cnt>(ideal[pos]||0)+1)po.push({pos,cnt,ideal:ideal[pos]||0});
  if(po.length)alerts+=`<div class="alert alert-w"><h4>⚠️ Too many ${po.map(o=>`${o.pos} (${o.cnt}, typical ${o.ideal})`).join(', ')}</h4><p>Consider swapping for ${pn.length?pn.map(n=>n.pos).join('/'):'other positions'}.</p></div>`;
  if(pn.length&&ROST.length>=2)alerts+=`<div class="alert alert-i"><h4>📋 Need: ${pn.map(n=>`${n.need-n.have} ${n.pos}`).join(', ')}</h4></div>`;
  const weakest=ROST.length>=3?Object.entries(cs).sort((a,b)=>a[1]-b[1])[0]:null;
  if(weakest&&weakest[1]<45)alerts+=`<div class="alert alert-e"><h4>📉 Weakest: ${cats[weakest[0]].l} (${weakest[1]}th)</h4><p>See swap suggestions below.</p></div>`;

  let recs='';
  if(pn.length&&ROST.length>=1){for(const need of pn.slice(0,2)){const cands=ALL.filter(p=>p._np===need.pos&&!ROST.some(r=>r._id===p._id)&&p._val<=rem&&p._val<=PBUDGET).sort((a,b)=>b._score-a._score).slice(0,3);if(cands.length)recs+=`<div style="margin-bottom:.5rem"><div style="font-size:.72rem;font-weight:600;color:var(--t2);margin-bottom:.2rem">Recommend ${need.pos} (${PN[need.pos]}):</div>${cands.map(p=>`<div class="rec" onclick="openP(${p._id})" style="cursor:pointer"><div class="ri"><div class="rn">${p.Player}</div><div class="rt">${p.Team} · ${p._score}</div></div>${pbH(p._np)}<span class="vc">$${p._val.toLocaleString()}</span><button class="btn-ad" onclick="event.stopPropagation();addR(${p._id})">+ Add</button></div>`).join('')}</div>`}}

  let swaps='';
  if(ROST.length>=5){
    const teamAvg=ROST.reduce((s,p)=>s+p._score,0)/ROST.length;
    const swapThreshold=teamAvg*0.75;
    const weakPlayers=[...ROST].filter(p=>p._score<swapThreshold&&!SWAPPED.has(p._id)).sort((a,b)=>a._score-b._score).slice(0,2);
    for(const wp of weakPlayers){
      const budget=rem+wp._val;
      const samePosUp=ALL.filter(p=>p._np===wp._np&&!ROST.some(r=>r._id===p._id)&&p._score>wp._score&&p._val<=budget&&p._val<=PBUDGET).sort((a,b)=>{const aD=a._score-wp._score,bD=b._score-wp._score;return(bD/Math.max(b._val-wp._val,1))-(aD/Math.max(a._val-wp._val,1))}).slice(0,2);
      let crossPosUp=[];let crossLabel='';const wpPosCount=pc[wp._np]||0;const wpPosIdeal=ideal[wp._np]||0;const altPositions=[];
      for(const n of pn)altPositions.push({pos:n.pos,reason:`team needs ${n.need-n.have} more ${PN[n.pos]}`});
      if(wpPosCount>wpPosIdeal&&!altPositions.length){for(const[pos,id]of Object.entries(ideal)){if(pos!==wp._np&&(pc[pos]||0)<=id)altPositions.push({pos,reason:`balance roster (${pos}: ${pc[pos]||0}/${id})`})}}
      if(altPositions.length){const best=altPositions[0];crossPosUp=ALL.filter(p=>p._np===best.pos&&!ROST.some(r=>r._id===p._id)&&p._val<=budget&&p._val<=PBUDGET).sort((a,b)=>b._score-a._score).slice(0,2);crossLabel=`Switch to ${best.pos} instead (${best.reason})`}
      if(samePosUp.length||crossPosUp.length){swaps+=`<div style="margin-bottom:.7rem;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:.8rem"><div style="font-size:.75rem;font-weight:600;margin-bottom:.15rem">🔄 ${wp.Player} <span style="color:var(--t3);font-weight:400">(${wp._np}, score ${wp._score} — team avg ${Math.round(teamAvg)})</span></div>${samePosUp.length?`<div style="font-size:.65rem;color:var(--t2);margin:.35rem 0 .2rem">Same position upgrade (${wp._np}):</div>${samePosUp.map(p=>`<div class="rec"><div class="ri"><div class="rn">${p.Player}</div><div class="rt">${p.Team} · ${p._score} (+${p._score-wp._score}) · Δ$${(p._val-wp._val).toLocaleString()}</div></div>${pbH(p._np)}<span class="vc">$${p._val.toLocaleString()}</span><button class="btn-sw" onclick="event.stopPropagation();swpR(${wp._id},${p._id})">⇄ Swap</button></div>`).join('')}`:''}${crossPosUp.length?`<div style="font-size:.65rem;color:var(--cy);margin:.35rem 0 .2rem">💡 ${crossLabel}:</div>${crossPosUp.map(p=>`<div class="rec"><div class="ri"><div class="rn">${p.Player}</div><div class="rt">${p.Team} · ${p._score} · Δ$${(p._val-wp._val).toLocaleString()}</div></div>${pbH(p._np)}<span class="vc">$${p._val.toLocaleString()}</span><button class="btn-sw" onclick="event.stopPropagation();swpR(${wp._id},${p._id})">⇄ Swap</button></div>`).join('')}`:''}</div>`}
    }
    if(!weakPlayers.length&&ROST.length>=5)swaps=`<div style="font-size:.75rem;color:var(--t2);padding:.5rem 0">✅ All roster players are within acceptable range of team average — no swaps recommended.</div>`;
  }

  const subNav=`<div class="rtabs"><button class="rtab ${ROST_SUB==='myteam'?'active':''}" onclick="setRosterSub('myteam')">🏐 My Team</button><button class="rtab ${ROST_SUB==='h2h'?'active':''}" onclick="setRosterSub('h2h')">⚔️ Head-to-Head</button><button class="rtab ${ROST_SUB==='opponent'?'active':''}" onclick="setRosterSub('opponent')">🎯 Opponent</button></div>`;
  const myTeamHtml=`<div class="rcfg"><div class="cg"><label>Team Budget</label><input class="ninput" value="${TBUDGET}" onchange="TBUDGET=+this.value||250000;renderAll()"></div><div class="cg"><label>Max/Player</label><input class="ninput" value="${PBUDGET}" onchange="PBUDGET=+this.value||85000;renderAll()"></div><div class="cg"><label>Roster Size</label><input class="ninput" value="${RSIZE}" style="width:55px" onchange="RSIZE=+this.value||14;renderAll()"></div><div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center"><div class="pill" style="border-color:${rem>=0?'var(--gn)':'var(--rd)'}"><b style="color:${rem>=0?'var(--gn)':'var(--rd)'}">$${rem.toLocaleString()}</b> left</div><div class="pill"><b>$${spent.toLocaleString()}</b> spent</div><div class="pill"><b>${ROST.length}</b>/${RSIZE}</div></div><div style="display:flex;gap:.3rem;margin-left:auto"><button class="btn-sel" onclick="addAll()">⊕ Select All Filtered</button><button class="btn-s" onclick="clearR()" style="border-color:var(--rd);color:var(--rd)">✕ Clear Roster</button></div></div>${ROST.length>=3?renderRosterProfile('TEAM STAT PROFILE',cs):''}${alerts}${recs?`<div style="margin-bottom:.6rem">${recs}</div>`:''}${swaps?`<div style="margin-bottom:.6rem">${swaps}</div>`:''}<div class="tw"><div class="thb"><h3>🏗️ Roster</h3><span class="cnt">${ROST.length} · $${spent.toLocaleString()}</span></div>${ROST.length?ROST.map(p=>`<div style="display:flex;align-items:center;padding:.45rem .7rem;gap:.5rem;border-bottom:1px solid var(--bd)"><button style="background:var(--rdd);border:none;color:var(--rd);width:20px;height:20px;border-radius:5px;cursor:pointer;font-size:.65rem" onclick="rmR(${p._id})">✕</button><div style="flex:1;cursor:pointer" onclick="openP(${p._id})"><span class="pn" style="font-size:.75rem">${p.Player}</span> <span class="tn">${p.Team}</span></div>${pbH(p._np)} ${tbH(p._tier)} <span class="mono" style="font-size:.68rem;color:var(--t2)">${p._score}</span><span class="vc" style="min-width:62px;text-align:right">$${p._val.toLocaleString()}</span></div>`).join(''):'<div style="padding:2rem;text-align:center;color:var(--t3);font-size:.8rem">Add players from below or use “Select All Filtered” to bulk-add.</div>'}</div><div class="tw" style="margin-top:.7rem"><div class="thb"><h3>Available Players</h3><span class="cnt" id="avc"></span></div><div class="tscr" id="avt"></div></div>`;
  const oppHtml=`<div class="rcfg"><div class="cg" style="min-width:280px"><label>Quick Add Player</label><div class="opp-search-wrap"><input id="oppSearch" type="text" value="${escQ(OPP_SEARCH)}" placeholder="Search player or team..." oninput="OPP_SEARCH=this.value;updateOppDd()"><div class="opp-dd${oppMatches.length?' open':''}" id="oppDd">${oppMatches.map(p=>`<div class="opp-dd-row" onclick="addOpp(${p._id})"><span><b>${escQ(p.Player)}</b> <span class="tn">${escQ(p.Team)} · ${p._np}</span></span><button class="btn-ad" style="padding:.18rem .45rem" onclick="event.stopPropagation();addOpp(${p._id})">+ Add</button></div>`).join('')}</div></div></div><div class="cg" style="min-width:220px"><label>Add Full Team</label><div style="display:flex;gap:.35rem"><input id="oppTeamSearch" type="text" placeholder="School name..."><button class="btn-sel" onclick="addOpponentTeamByName()">+ Team</button></div></div><div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center"><div class="pill"><b>${OPPROST.length}</b> opponent players</div>${OPPROST.length?`<div class="pill"><b>${new Set(OPPROST.map(p=>p.Team)).size}</b> teams</div>`:''}</div><div style="display:flex;gap:.3rem;margin-left:auto"><button class="btn-s" onclick="clearOpp()" style="border-color:var(--rd);color:var(--rd)">✕ Clear Opponent</button></div></div><div class="tw"><div class="thb"><h3>🎯 Opponent Roster</h3><span class="cnt">${OPPROST.length?(OPPROST[0]?.Team||'Custom scout'):'Empty'}</span></div>${OPPROST.length?OPPROST.map(p=>`<div style="display:flex;align-items:center;padding:.45rem .7rem;gap:.5rem;border-bottom:1px solid var(--bd)"><button style="background:var(--rdd);border:none;color:var(--rd);width:20px;height:20px;border-radius:5px;cursor:pointer;font-size:.65rem" onclick="rmOpp(${p._id})">✕</button><div style="flex:1;cursor:pointer" onclick="openP(${p._id})"><span class="pn" style="font-size:.75rem">${p.Player}</span> <span class="tn">${p.Team}</span></div>${pbH(p._np)} ${tbH(p._tier)} <span class="mono" style="font-size:.68rem;color:var(--t2)">${p._score}</span><span class="vc" style="min-width:62px;text-align:right">$${p._val.toLocaleString()}</span></div>`).join(''):'<div style="padding:2rem;text-align:center;color:var(--t3);font-size:.8rem">Search by player or add an entire school to build the opponent scouting board.</div>'}</div>${OPPROST.length>=2?renderRosterProfile('OPPONENT STAT PROFILE',oppCs):'<div class="tw" style="margin-top:.7rem"><div class="thb"><h3>Opponent Stat Profile</h3><span class="cnt">Need at least 2 players</span></div><div style="padding:1.2rem;color:var(--t3);font-size:.78rem">Once you add a few players, this panel mirrors the same percentile-based team profile used for your roster.</div></div>'}`;
  const activeHtml=ROST_SUB==='h2h'?renderH2HSection():ROST_SUB==='opponent'?oppHtml:myTeamHtml;
  z.innerHTML=subNav+activeHtml;
  if(ROST_SUB==='myteam'){const aff=FILT.filter(p=>p._val<=rem&&p._val<=PBUDGET&&!ROST.some(r=>r._id===p._id)).sort((a,b)=>b._score-a._score).slice(0,200);const avt=document.getElementById('avt');const avc=document.getElementById('avc');if(avt)avt.innerHTML=buildTbl(aff,'add');if(avc)avc.textContent=`${aff.length} within budget`}}

// WEIGHT EDITOR
let WP='OH';
function renderW(){const z=document.getElementById('wz');const w=W[WP];const tot=Object.values(w).reduce((s,c)=>s+c.w,0);
  z.innerHTML=`<div class="wtp"><h3>Weights / Min / Max</h3><div class="wsub">Adjust per-position stat weights. Click stat names for explanation. Direction: ↑ higher better, ↓ lower better.</div>
    <div class="wtabs">${['OH','MB','S','L/DS','OPP'].map(p=>`<button class="wtab ${p===WP?'active':''}" onclick="WP='${p}';renderW()">${pbH(p)} ${PN[p]}</button>`).join('')}</div>
    <table class="wtt"><thead><tr><th>Stat</th><th>W</th><th>Min</th><th>Max</th><th>Dir</th></tr></thead><tbody>
    ${Object.entries(w).map(([st,cfg])=>`<tr style="${cfg.w>0?'':'opacity:.5'}"><td><span style="cursor:help;border-bottom:1px dotted var(--t3);color:var(--tx);font-weight:500" onclick="event.stopPropagation();showSTT(this,'${st}')">${SI[st]?.n||st}</span></td><td><input type="number" value="${cfg.w}" min="0" max="50" id="ww_${st}" onchange="W['${WP}']['${st}'].w=+this.value;updWT()"></td><td><input type="number" value="${cfg.min}" step="0.01" id="wn_${st}" onchange="W['${WP}']['${st}'].min=+this.value" style="width:50px"></td><td><input type="number" value="${cfg.max}" step="0.01" id="wx_${st}" onchange="W['${WP}']['${st}'].max=+this.value" style="width:50px"></td><td style="color:${cfg.dir==='up'?'var(--gn)':'var(--rd)'}"><span title="${cfg.dir==='up'?'Higher is better':'Lower is better'}" style="cursor:help">${cfg.dir==='up'?'↑':'↓'}</span></td></tr>`).join('')}
    </tbody></table>
    <div class="wft"><div class="wtot">Total: <b id="wts">${tot}</b>/100 &nbsp; Remaining: <b id="wtr" style="color:${100-tot===0?'var(--gn)':'var(--ac)'}">${100-tot}</b></div><div class="wbtns"><button class="btn-a" onclick="applyW()">Apply & Recalculate</button><button class="btn-r" onclick="resetW()">Reset</button></div></div></div>`}
function updWT(){const w=W[WP];let t=0;for(const st of Object.keys(w)){const el=document.getElementById('ww_'+st);if(el)t+=+el.value}document.getElementById('wts').textContent=t;const r=100-t;document.getElementById('wtr').textContent=r;document.getElementById('wtr').style.color=r===0?'var(--gn)':'var(--ac)'}
function applyW(){for(const st of Object.keys(W[WP])){const we=document.getElementById('ww_'+st),mn=document.getElementById('wn_'+st),mx=document.getElementById('wx_'+st);if(we)W[WP][st].w=+we.value;if(mn)W[WP][st].min=+mn.value;if(mx)W[WP][st].max=+mx.value}recalc()}
function resetW(){W=JSON.parse(JSON.stringify(DW));renderW();recalc()}

// VALUATION SETTINGS
function renderVS(){const z=document.getElementById('vz');
  z.innerHTML=`<div class="vsp"><h3>Valuation Settings <button class="btn-r" onclick="resetVS()" style="font-size:.62rem;padding:.2rem .5rem">Reset</button></h3>
    <div class="vsub">Editable. Controls how scores translate to dollar valuations.</div>
    <div class="vsg">
      <div class="vi"><label>Average Pay</label><input type="number" id="vs-avg" value="${VS.avgPay}" onchange="VS.avgPay=+this.value;recalc()"></div>
      <div class="vi"><label>Min Pay</label><input type="number" id="vs-min" value="${VS.minPay}" onchange="VS.minPay=+this.value;recalc()"></div>
      <div class="vi"><label>Max Pay</label><input type="number" id="vs-max" value="${VS.maxPay}" onchange="VS.maxPay=+this.value;recalc()"></div>
      <div class="vi"><label>Star Value ($)</label><input type="number" id="vs-star" value="${VS.starValue}" onchange="VS.starValue=+this.value;recalc()"></div>
      <div class="vi"><label>Star Percentile</label><input type="number" id="vs-spct" value="${VS.starPctile}" step="0.01" min="0.5" max="1" onchange="VS.starPctile=+this.value;recalc()"></div>
      <div class="vi"><label>Sets Adjust</label><select id="vs-sadj" onchange="VS.setsAdj=this.value;recalc()"><option value="on" ${VS.setsAdj==='on'?'selected':''}>On (√(min(1, Sets/Sets_p)))</option><option value="off" ${VS.setsAdj==='off'?'selected':''}>Off</option></select></div>
      <div class="vi"><label>Sets Percentile (P)</label><input type="number" id="vs-sp" value="${VS.setsPctile}" step="0.01" min="0.5" max="1" onchange="VS.setsPctile=+this.value;recalc()"></div>
    </div>
    <div class="vsnote">
      <b>Sets Adjustment:</b> Players with fewer sets get a valuation penalty. Formula: <code style="background:var(--s3);padding:.1rem .3rem;border-radius:3px;font-size:.65rem">√(min(1, playerSets / p${(VS.setsPctile*100).toFixed(0)}Sets))</code>. This prevents players with very few sets from being overvalued due to inflated per-set rates. At the current p${(VS.setsPctile*100).toFixed(0)} threshold (~${ALL.length?quantile(ALL.map(x=>x.Sets),VS.setsPctile):100} sets), a player with 50 sets would get ~${ALL.length?(Math.sqrt(Math.min(1,50/quantile(ALL.map(x=>x.Sets),VS.setsPctile)))*100).toFixed(0):'71'}% of their full valuation.<br><br>
      <b>Star Value:</b> Increasing this spreads valuations further apart at the top end — higher star value = bigger gap between elite and average players, while average stays anchored near Average Pay.
    </div>
  </div>`}
function resetVS(){VS={...VS_DEF};renderVS();recalc()}

// METHODOLOGY
function renderMeth(){const g=document.getElementById('mz');g.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.7rem;margin-top:.7rem';let h='';
  // Position weight cards with explanation
  for(const[pos,w]of Object.entries(W)){const c=PC[pos];h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:.3rem"></span>${pos} — ${PN[pos]}</h4><table style="width:100%;font-size:.7rem">${Object.entries(w).map(([st,cfg])=>{const isDown=cfg.dir==='down';return `<tr><td style="color:${isDown?'var(--rd)':'var(--t2)'};padding:.15rem 0">${SI[st]?.n||st}${isDown?' ↓':''}</td><td style="text-align:right" class="mono">${cfg.w}%</td></tr>`}).join('')}<tr style="border-top:1px solid var(--bd)"><td style="padding:.3rem 0;font-weight:600">Total</td><td style="text-align:right;font-weight:600" class="mono">${Object.values(w).reduce((s,c)=>s+c.w,0)}%</td></tr></table></div>`}
  // Why red ↓ stats
  h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--rd);margin-right:.3rem"></span>Why Red ↓ Stats?</h4><p style="font-size:.72rem;color:var(--t2);line-height:1.5">Stats in <span style="color:var(--rd)">red with ↓</span> are <b>penalty stats</b> — for these, <b>lower is better</b>. The model inverts the percentile: a player with a LOW error rate gets a HIGH percentile score.<br><br>• <b>Atk Err Rate ↓</b> — % of attacks that are errors. A player hitting .250 error rate is giving away 1 in 4 attacks as free points.<br>• <b>Serv Err Rate ↓</b> — service errors per set. Free points gifted to opponents.<br>• <b>BH Err Rate ↓</b> (setters) — ball handling errors. Disrupts the entire offense.<br><br>These stats are penalized proportionally — the weight (e.g., 8%) represents how much it hurts the score. A player with a high error rate loses points from their total.</p></div>`;
  // Min/Max explanation
  h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--bl);margin-right:.3rem"></span>Min / Max Values</h4><p style="font-size:.72rem;color:var(--t2);line-height:1.5">Min and Max values come from real 2025 NCAA D1 data:<br>• <b>Min</b> = 10th percentile (what a below-average player does)<br>• <b>Max</b> = 95th percentile (what an elite player does)<br><br>These define the realistic range for each stat at each position. For example, OH Kills/Set ranges from 0.43 (bench player) to 3.88 (elite scorer). Values outside this range still work but are capped at 0% or 100% percentile. Coaches can adjust these to change how the model evaluates outliers.</p></div>`;
  // Receiving proxy
  h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--cy);margin-right:.3rem"></span>Receiving Proxy</h4><p style="font-size:.72rem;color:var(--t2);line-height:1.5">This dataset has no serve-receive stat, so <b>Digs/Set</b> is the proxy. Data analysis confirmed: BH Err has near-zero variance for liberos (avg 0.001/set), making composite formulas useless. The correlation between digs and BH errors is actually <i>positive</i> (more touches = more errors). Digs/Set is the strongest signal: 44% for L/DS, 17% for OH, 12% for OPP.</p></div>`;
  // How scoring works
  h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ac);margin-right:.3rem"></span>How Scoring Works</h4><p style="font-size:.72rem;color:var(--t2);line-height:1.5">1. <b>Normalize:</b> Raw stats → per-set rates (e.g., 300 kills in 100 sets = 3.0 K/S)<br>2. <b>Percentile:</b> Compare against all players at the same position. 3.0 K/S might be 85th percentile for OH.<br>3. <b>Weight:</b> Multiply each percentile by position weight (e.g., 85% × 24% = 20.4 points)<br>4. <b>Sum:</b> Add all weighted percentiles → score 0–100<br>5. <b>Valuation:</b> Apply exponential curve ($3K–$85K) with sets adjustment</p></div>`;
  // Sets adjustment
  h+=`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:1rem"><h4 style="font-size:.8rem;font-weight:600;margin-bottom:.4rem"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--yw);margin-right:.3rem"></span>Sets Adjustment</h4><p style="font-size:.72rem;color:var(--t2);line-height:1.5">Players with fewer sets get a valuation discount to prevent inflation. A player with 25 sets who averages 4.0 K/S looks amazing, but we can't trust that small sample like someone who sustained it over 110 sets.<br><br>Formula: <code style="background:var(--s3);padding:.1rem .2rem;border-radius:3px;font-size:.62rem">√(min(1, sets / p90_sets))</code><br>At p90 ≈ 112 sets: 50 sets → 67% valuation, 80 sets → 85%, 112+ → 100%.</p></div>`;
  g.innerHTML=h}
// ═══════════════════════════════════════
// COMPARISON MODAL
// ═══════════════════════════════════════
function closeCM(){document.getElementById('cm').classList.remove('show')}

function openCompare(id1,id2){
  const p1=typeof id1==='number'?ALL.find(x=>x._id===id1):ALL.find(x=>x.Player.toLowerCase()===id1.toLowerCase().trim());
  const p2=typeof id2==='number'?ALL.find(x=>x._id===id2):ALL.find(x=>x.Player.toLowerCase()===id2.toLowerCase().trim());
  if(!p1||!p2)return;
  const s1=gSP(p1,PCT),s2=gSP(p2,PCT);

  function sc(v){return v>=82?'var(--yw)':v>=65?'var(--gn)':v>=45?'var(--bl)':v>=28?'var(--pu)':'var(--rd)'}

  // All stats to compare
  const statKeys=Object.keys({...s1,...s2});
  function statRows(stats,other){
    return statKeys.map(st=>{
      if(!stats[st])return'';
      const v=stats[st].pctile;const ov=other[st]?other[st].pctile:0;
      const win=v>ov;const c=v>=80?'var(--yw)':v>=60?'var(--gn)':v>=40?'var(--bl)':v>=20?'var(--pu)':'var(--rd)';
      return `<div class="cmp-row"><span class="cmp-lbl">${SI[st]?.n||st}</span><div class="cmp-bar"><div class="cmp-bf" style="width:${v}%;background:${c}"></div></div><span class="cmp-v ${win?'cmp-win':''}" style="color:${c}">${v}%</span></div>`;
    }).join('');
  }

  function rawStats(p){
    return [['K/S',p._kps],['Hit%',(p['Hit %']||0).toFixed(3)],['D/S',p._dps],['A/S',p._aps],['B/S',p._bps],['Ace/S',p._acps],['PTS/S',p._pps],['Sets',p.Sets]]
      .map(([l,v])=>`<span style="font-size:.62rem;color:var(--t3)">${l}:</span> <span class="mono" style="font-size:.66rem">${v}</span>`).join(' &nbsp;');
  }

  // Verdict
  const diff=p1._score-p2._score;
  let verdict='';
  if(Math.abs(diff)<=5)verdict=`Very close matchup — only ${Math.abs(diff)} points apart. Decision should come down to team needs and fit.`;
  else if(diff>0)verdict=`<b>${p1.Player}</b> scores ${diff} points higher overall. `;
  else verdict=`<b>${p2.Player}</b> scores ${Math.abs(diff)} points higher overall. `;

  // Find what each player wins
  const p1wins=[],p2wins=[];
  for(const st of statKeys){
    if(s1[st]&&s2[st]){
      if(s1[st].pctile>s2[st].pctile+8)p1wins.push(SI[st]?.n||st);
      if(s2[st].pctile>s1[st].pctile+8)p2wins.push(SI[st]?.n||st);
    }
  }
  if(p1wins.length)verdict+=`${p1.Player} is better at ${p1wins.join(', ')}. `;
  if(p2wins.length)verdict+=`${p2.Player} is better at ${p2wins.join(', ')}. `;
  if(p1._val!==p2._val)verdict+=`Value difference: $${Math.abs(p1._val-p2._val).toLocaleString()} (${p1._val<p2._val?p1.Player:p2.Player} is cheaper).`;

  document.getElementById('cmh').innerHTML=`<div style="font-size:1rem;font-weight:700">⚔️ Player Comparison</div><div style="font-size:.72rem;color:var(--t2);margin-top:.15rem">Side-by-side percentile comparison scored against 2025 ${p1._np===p2._np?p1._np+' peers':'all positions'}</div>`;

  document.getElementById('cmb').innerHTML=`<div class="cmp-grid">
    <div class="cmp-col">
      <div class="cmp-hdr"><div style="display:flex;align-items:center;justify-content:center;gap:.3rem;margin-bottom:.2rem">${pbH(p1._np)} ${tbH(p1._tier)}</div><div class="cmp-name">${p1.Player}</div><div class="cmp-sub">${p1.Team}</div><div style="margin-top:.15rem;font-size:.62rem;color:var(--t3)">${rawStats(p1)}</div></div>
      <div class="cmp-score"><div class="big" style="color:${sc(p1._score)}">${p1._score}</div><div class="val">$${p1._val.toLocaleString()}</div></div>
      ${statRows(s1,s2)}
      <div class="cmp-tags">${tagHH(p1._tags,true)}</div>
    </div>
    <div class="cmp-col">
      <div class="cmp-hdr"><div style="display:flex;align-items:center;justify-content:center;gap:.3rem;margin-bottom:.2rem">${pbH(p2._np)} ${tbH(p2._tier)}</div><div class="cmp-name">${p2.Player}</div><div class="cmp-sub">${p2.Team}</div><div style="margin-top:.15rem;font-size:.62rem;color:var(--t3)">${rawStats(p2)}</div></div>
      <div class="cmp-score"><div class="big" style="color:${sc(p2._score)}">${p2._score}</div><div class="val">$${p2._val.toLocaleString()}</div></div>
      ${statRows(s2,s1)}
      <div class="cmp-tags">${tagHH(p2._tags,true)}</div>
    </div>
    <div class="cmp-verdict"><h4>📊 Verdict</h4><p>${verdict}</p><div style="margin-top:.5rem;display:flex;gap:.3rem"><button class="btn-s" onclick="closeCM();openP(${p1._id})">View ${p1.Player.split(' ')[0]}'s Profile</button><button class="btn-s" onclick="closeCM();openP(${p2._id})">View ${p2.Player.split(' ')[0]}'s Profile</button></div></div>
  </div>`;

  document.getElementById('cm').classList.add('show');
  document.getElementById('cm').onclick=e=>{if(e.target===document.getElementById('cm'))closeCM()};
}

// ═══════════════════════════════════════
// AI CHAT — SCOUT AI (Gemini Function Calling)
// ═══════════════════════════════════════
const GEMINI_URL='https://dry-cell-b187.bryanhkwan.workers.dev';
let chatHist=[];
let chatOpen=false;
let pendingActions=[];
let actionIdCounter=0;
let pendingAction=null;

// Per-turn state (reset each message)
let lastUserText='';
let turnHasDashboardLookup=false;
let turnWebSearchDeferred=false;
let turnHasWebSearch=false;
let turnForcedWebForValuation=false;

// Roster mutations that require Yes/No confirmation
const CONFIRM_ACTIONS=new Set(['add_players_to_roster','remove_player_from_roster','swap_roster_player']);

// ── TOOL DECLARATIONS (Gemini function calling) ──
const AI_TOOLS=[{functionDeclarations:[
  {name:'get_dashboard_context',description:'Get overall volleyball dashboard state: player pool, my roster, opponent roster, and budget settings.',parameters:{type:'OBJECT',properties:{}}},
  {name:'get_player_profile',description:'Get full stats, score, tier, valuation, and archetype tags for a player by name.',parameters:{type:'OBJECT',properties:{name:{type:'STRING',description:'Player name'}},required:['name']}},
  {name:'search_players',description:'Search/filter players by keyword, position, tier, or budget. Returns ranked results.',parameters:{type:'OBJECT',properties:{query:{type:'STRING',description:'Keyword (name or team)'},position:{type:'STRING',description:'OH | MB | S | L/DS | OPP'},maxValue:{type:'NUMBER',description:'Max valuation $'},minScore:{type:'NUMBER',description:'Min score 0-100'},sortBy:{type:'STRING',description:'score | val | kills | digs | assists | blocks | aces | hitpct'},limit:{type:'NUMBER',description:'Max results, default 10'}}}},
  {name:'get_top_players',description:'Get top-ranked players by position, tier, or stat. Use for best/elite player queries.',parameters:{type:'OBJECT',properties:{position:{type:'STRING',description:'OH | MB | S | L/DS | OPP'},tier:{type:'STRING',description:'Elite | Starter | Rotation | Bench'},sortBy:{type:'STRING',description:'score | val | kills | digs | assists | blocks | aces | hitpct'},limit:{type:'NUMBER',description:'Max results, default 10'},maxValue:{type:'NUMBER',description:'Max valuation $'}}}},
  {name:'compare_players',description:'Compare two players side-by-side with the visual modal. ALWAYS use this for player-vs-player questions.',parameters:{type:'OBJECT',properties:{player1:{type:'STRING',description:'First player name'},player2:{type:'STRING',description:'Second player name'}},required:['player1','player2']}},
  {name:'add_players_to_roster',description:'Add players to my roster. Use playerNames for specific players, or team to add an entire school. The UI handles coach confirmation automatically.',parameters:{type:'OBJECT',properties:{playerNames:{type:'ARRAY',items:{type:'STRING'},description:'Specific player names to add'},team:{type:'STRING',description:'Add all players from this team'},limit:{type:'NUMBER',description:'Max players when using team (optional)'}}}},
  {name:'remove_player_from_roster',description:'Remove a player from my roster. The UI handles coach confirmation automatically.',parameters:{type:'OBJECT',properties:{playerName:{type:'STRING',description:'Player name to remove'}},required:['playerName']}},
  {name:'swap_roster_player',description:'Swap one roster player for another dashboard player. ONLY use players you already saw in dashboard tool results. The UI handles coach confirmation automatically.',parameters:{type:'OBJECT',properties:{dropPlayer:{type:'STRING',description:'Player on roster to drop'},addPlayer:{type:'STRING',description:'Player from dashboard to add'}},required:['dropPlayer','addPlayer']}},
  {name:'add_players_to_opponent',description:'Add players to the opponent roster for matchup prep. Executes immediately with no confirmation.',parameters:{type:'OBJECT',properties:{playerNames:{type:'ARRAY',items:{type:'STRING'},description:'Specific opponent players'},team:{type:'STRING',description:'Add all players from this opponent school'},limit:{type:'NUMBER',description:'Max players when using team (optional)'}}}},
  {name:'get_head_to_head',description:'Get percentile-based category comparison between my roster and the opponent roster. ALWAYS call this for matchup, scouting, or head-to-head requests.',parameters:{type:'OBJECT',properties:{}}},
  {name:'web_search',description:'Search the web for current news, NIL market data, transfer portal updates, injury reports, or other time-sensitive context. Call AFTER dashboard tools.',parameters:{type:'OBJECT',properties:{query:{type:'STRING',description:'Search query'}},required:['query']}}
]}];

// â”€â”€ HELPERS â”€â”€
function escapeHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function normalizeName(s){return(s||'').toLowerCase().replace(/[.,]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/gi,'').replace(/\s+/g,' ').trim()}
function extractTeamHint(text){
  const patterns=[
    /\b(?:from|at|of|for)\s+([A-Za-z][A-Za-z\s\-']{1,40}?)(?=\s+(?:worth|is|was|will|can|should|playing|plays|player|volleyball|\$|\d)|[,.]|$)/i,
    /\(([A-Za-z][A-Za-z\s\-']{1,40}?)\)/i
  ];
  const teams=[...new Set(ALL.map(r=>r.Team).filter(Boolean))];
  for(const pat of patterns){const m=(text||'').match(pat);if(m){const hl=m[1].trim().toLowerCase();const best=teams.find(tm=>tm.toLowerCase().includes(hl));if(best)return best;}}
  return null;}
function matchLoadedPlayer(text){
  const ql=normalizeName(text);const teamHint=extractTeamHint(text);
  const matches=ALL.filter(r=>r.Player&&ql.includes(normalizeName(r.Player)));
  if(!matches.length)return null;
  if(teamHint&&matches.length>1){const specific=matches.find(r=>(r.Team||'').toLowerCase().includes(teamHint.toLowerCase()));if(specific)return specific;}
  return matches.sort((a,b)=>(b.Player||'').length-(a.Player||'').length)[0];}
function statLine(r){
  if(!r)return{};const s=Math.max(r.Sets||1,1);
  return{player:r.Player,team:r.Team,position:r._np,score:r._score,tier:r._tier,value:r._val,sets:r.Sets,
    kills_per_set:+((r.Kills||0)/s).toFixed(2),hit_pct:+(r['Hit %']||0).toFixed(3),
    digs_per_set:+((r.Digs||0)/s).toFixed(2),assists_per_set:+((r.Assists||0)/s).toFixed(2),
    blocks_per_set:+((r['Total Blk']||0)/s).toFixed(2),aces_per_set:+((r.Aces||0)/s).toFixed(2),
    pts_per_set:+((r.PTS||0)/s).toFixed(2),tags:r._tags?r._tags.map(t=>t.t):[]};}
function fmtText(t){
  let html=t.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n- /g,'\n• ').replace(/\n/g,'<br>').replace(/`([^`]+)`/g,'<code>$1</code>');
  if(ALL.length){
    const names=[...new Set(ALL.map(r=>r.Player).filter(Boolean))].sort((a,b)=>b.length-a.length);
    for(const name of names){
      if(name.length<5)continue;
      const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      try{const re=new RegExp('\\b('+esc+')\\b','g');
        html=html.replace(re,(m,p1,offset,str)=>{
          const before=str.slice(0,offset);const openCount=(before.match(/</g)||[]).length,closeCount=(before.match(/>/g)||[]).length;
          if(openCount>closeCount)return m;
          const pid=ALL.find(r=>r.Player===name)?._id;
          return pid!=null?`<span class="aiPlayerLink" onclick="openP(${pid})">${p1}</span>`:m;});}catch(e){}}}
  return html;}

// â”€â”€ DASHBOARD TOOL IMPLEMENTATIONS â”€â”€
function execGetDashboardContext(){
  const posC={};ALL.forEach(p=>{posC[p._np]=(posC[p._np]||0)+1});
  const spent=ROST.reduce((s,p)=>s+p._val,0);
  return{totalPlayers:ALL.length,teams:new Set(ALL.map(p=>p.Team)).size,positionBreakdown:posC,activeRosterTab:ROST_SUB,
    averageScore:ALL.length?Math.round(ALL.reduce((s,p)=>s+p._score,0)/ALL.length):0,
    roster:{count:ROST.length,maxSize:RSIZE,budget:TBUDGET,perPlayerCap:PBUDGET,spent,remaining:TBUDGET-spent,
      members:ROST.map(p=>({name:p.Player,pos:p._np,team:p.Team,score:p._score,tier:p._tier,value:p._val}))},
    opponent:{count:OPPROST.length,members:OPPROST.map(p=>({name:p.Player,pos:p._np,team:p.Team,score:p._score,tier:p._tier,value:p._val}))}}}
function execGetPlayerProfile(args){
  const player=matchLoadedPlayer(args.name||'');
  const p=player||ALL.find(x=>{const n=normalizeName(args.name||'');return normalizeName(x.Player)===n})||
    ALL.find(x=>{const n=normalizeName(args.name||'');const last=normalizeName(x.Player).split(' ').pop();return last.length>3&&n.includes(last)});
  if(!p)return{error:`"${args.name}" not found. Try search_players.`};
  return{...statLine(p),percentiles:Object.fromEntries(Object.entries(gSP(p,PCT)).map(([k,v])=>[k,v.pctile]))};}
function execSearchPlayers(args){
  const{query='',position,maxValue,minScore,sortBy='score',limit=10}=args;
  const words=(query||'').toLowerCase().split(/\s+/).filter(w=>w.length>2).slice(0,4);
  let res=ALL.filter(p=>{
    if(position&&p._np!==position)return false;
    if(maxValue&&p._val>maxValue)return false;
    if(minScore&&p._score<minScore)return false;
    if(words.length&&!words.some(w=>p.Player.toLowerCase().includes(w)||p.Team.toLowerCase().includes(w)))return false;
    return true;});
  res.sort((a,b)=>{switch(sortBy){
    case'val':return b._val-a._val;case'kills':return+b._kps-+a._kps;case'digs':return+b._dps-+a._dps;
    case'assists':return+b._aps-+a._aps;case'blocks':return+b._bps-+a._bps;case'aces':return+b._acps-+a._acps;
    case'hitpct':return(parseFloat(b['Hit %'])||0)-(parseFloat(a['Hit %'])||0);default:return b._score-a._score}});
  return res.slice(0,limit).map(p=>statLine(p));}
function execGetTopPlayers(args){
  const tierMin={Elite:82,Starter:65,Rotation:45,Bench:28};
  return execSearchPlayers({...args,query:'',minScore:args.tier?tierMin[args.tier]:args.minScore});}
function addPlayersToRoster(names,team,limit){
  const toAdd=[],notFound=[];
  if(team){
    let pool=ALL.filter(r=>(r.Team||'').toLowerCase().includes(team.toLowerCase())).sort((a,b)=>b._score-a._score);
    if(limit)pool=pool.slice(0,limit);
    pool.forEach(r=>toAdd.push(r));
    if(!toAdd.length)return{added:0,failed:['No players found for team="'+team+'"'],rosterSize:ROST.length,adjustments:{}};}
  else{
    (names||[]).forEach(n=>{const m=matchLoadedPlayer(n)||ALL.find(r=>normalizeName(r.Player).includes(normalizeName(n)));if(m)toAdd.push(m);else notFound.push(n);});
    if(!toAdd.length)return{added:0,failed:notFound,rosterSize:ROST.length,adjustments:{}};}
  const rosterKeys=new Set(ROST.map(r=>r.Player+'|'+r.Team));
  const valid=[],skipped=[];
  toAdd.forEach(r=>{if(rosterKeys.has(r.Player+'|'+r.Team)){skipped.push(r.Player);return;}valid.push(r);});
  const adjustments={};
  const neededRoster=ROST.length+valid.length;
  if(neededRoster>RSIZE){adjustments.rosterSize={from:RSIZE,to:neededRoster};RSIZE=neededRoster;}
  const maxVal=valid.length?Math.max(...valid.map(r=>r._val||0)):0;
  if(maxVal>PBUDGET){adjustments.playerCap={from:PBUDGET,to:Math.ceil(maxVal/1000)*1000};PBUDGET=Math.ceil(maxVal/1000)*1000;}
  const usedCost=ROST.reduce((s,r)=>s+(r._val||0),0),addCost=valid.reduce((s,r)=>s+(r._val||0),0);
  if(usedCost+addCost>TBUDGET){adjustments.budget={from:TBUDGET,to:Math.ceil((usedCost+addCost)/1000)*1000};TBUDGET=Math.ceil((usedCost+addCost)/1000)*1000;}
  valid.forEach(r=>ROST.push(r));renderAll();
  return{added:valid.length,failed:[...notFound,...skipped],rosterSize:ROST.length,adjustments};}
function addPlayersToOpponent(names,team,limit){
  const toAdd=[],notFound=[];
  if(team){
    let pool=ALL.filter(r=>(r.Team||'').toLowerCase().includes(team.toLowerCase())).sort((a,b)=>b._score-a._score);
    if(limit)pool=pool.slice(0,limit);
    pool.forEach(r=>toAdd.push(r));
    if(!toAdd.length)return{added:0,failed:['No players found for team="'+team+'"'],oppRosterSize:OPPROST.length};}
  else{
    (names||[]).forEach(n=>{const m=matchLoadedPlayer(n)||ALL.find(r=>normalizeName(r.Player).includes(normalizeName(n)));if(m)toAdd.push(m);else notFound.push(n);});
    if(!toAdd.length)return{added:0,failed:notFound,oppRosterSize:OPPROST.length};}
  const oppKeys=new Set(OPPROST.map(r=>r.Player+'|'+r.Team));
  const valid=[],skipped=[];
  toAdd.forEach(r=>{if(oppKeys.has(r.Player+'|'+r.Team)){skipped.push(r.Player);return;}valid.push(r);});
  valid.forEach(r=>OPPROST.push(r));ROST_SUB='opponent';renderAll();
  return{added:valid.length,failed:[...notFound,...skipped],oppRosterSize:OPPROST.length};}
function removeFromRoster(name){
  const idx=ROST.findIndex(r=>normalizeName(r.Player).includes(normalizeName(name)));
  if(idx===-1)return{success:false,message:name+' not on roster.'};
  const removed=ROST[idx].Player;ROST.splice(idx,1);renderAll();
  return{success:true,removed,rosterSize:ROST.length};}
function swapPlayer(drop,add){
  const di=ROST.findIndex(r=>normalizeName(r.Player).includes(normalizeName(drop)));
  if(di===-1)return{success:false,message:drop+' not on roster.'};
  const ap=matchLoadedPlayer(add)||ALL.find(r=>normalizeName(r.Player).includes(normalizeName(add)));
  if(!ap)return{success:false,message:add+' not found in database.'};
  const dropped=ROST[di].Player;ROST.splice(di,1,ap);renderAll();
  return{success:true,dropped,added:ap.Player,rosterSize:ROST.length};}
function comparePlayers(n1,n2){
  const p1=matchLoadedPlayer(n1)||ALL.find(r=>normalizeName(r.Player).includes(normalizeName(n1)));
  const p2=matchLoadedPlayer(n2)||ALL.find(r=>normalizeName(r.Player).includes(normalizeName(n2)));
  if(!p1||!p2)return{error:'Player not found: '+(!p1?n1:'')+((!p1&&!p2)?', ':'')+(!p2?n2:'')};
  openCompare(p1._id,p2._id);
  return{opened:true,player1:statLine(p1),player2:statLine(p2)};}

// â”€â”€ EXEC DISPATCHER â”€â”€
function execCall(c){const a=c.args||{};
  switch(c.name){
    case'get_dashboard_context':return execGetDashboardContext();
    case'get_player_profile':return execGetPlayerProfile(a);
    case'search_players':return execSearchPlayers(a);
    case'get_top_players':return execGetTopPlayers(a);
    case'compare_players':return comparePlayers(a.player1||'',a.player2||'');
    case'add_players_to_roster':return addPlayersToRoster(a.playerNames||[],a.team,a.limit);
    case'remove_player_from_roster':return removeFromRoster(a.playerName||'');
    case'swap_roster_player':return swapPlayer(a.dropPlayer||'',a.addPlayer||'');
    case'add_players_to_opponent':return addPlayersToOpponent(a.playerNames||[],a.team,a.limit);
    case'get_head_to_head':return getHeadToHead();
    case'web_search':return doWebSearch(a.query||buildForcedWebQuery(lastUserText));
    default:return{error:'Unknown tool: '+c.name};}}
async function doWebSearch(query){
  try{
    const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(GEMINI_URL+'/search',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({query}),signal:ctrl.signal});
    clearTimeout(tid);if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    if(data.error)return{error:typeof data.error==='string'?data.error:(data.error.message||JSON.stringify(data.error))};
    let result=data.summary||data.searchResults||'No results found.';
    if(data.sources&&data.sources.length)result+='\n\nSources:\n'+data.sources.map((s,i)=>`${i+1}. ${s.title} — ${s.url}`).join('\n');
    return{searchResults:result,query};
  }catch(e){return{error:'Web search unavailable: '+e.message};}}

function renderDashboardEvidence(data){
  const d=document.createElement('div');d.className='chat-msg system';
  let html='<b>📊 Dashboard data</b><br>';
  if(data&&data.player){
    html+=`${escapeHtml(data.player)} (${escapeHtml(data.team||'')}) | Score:<b>${data.score}</b> | Val:<b>$${(data.value||0).toLocaleString()}</b> | ${escapeHtml(data.position||'')}`;
    if(data.kills_per_set!=null)html+=`<br>K/S:${data.kills_per_set} Hit%:${(data.hit_pct||0).toFixed(3)} D/S:${data.digs_per_set} A/S:${data.assists_per_set} B/S:${data.blocks_per_set} Ace/S:${data.aces_per_set}`;
  }else if(Array.isArray(data)){
    html+=`${data.length} players found`;
    if(data.length)html+='<br>'+data.slice(0,4).map(p=>`${escapeHtml(p.player||'')} (${escapeHtml(p.team||'')}) Score:${p.score} Val:$${(p.value||0).toLocaleString()}`).join('<br>');
  }else html+='Context loaded';
  d.innerHTML=html;document.getElementById('chatMsgs').appendChild(d);document.getElementById('chatMsgs').scrollTop=document.getElementById('chatMsgs').scrollHeight;}
function renderWebEvidence(data){
  const d=document.createElement('div');d.className='chat-msg system';
  if(data&&data.error){d.innerHTML='<b>🌐 Web:</b> '+escapeHtml(data.error);}
  else{
    const blob=(data&&data.searchResults)?String(data.searchResults):'';
    const pts=blob.split('\n\nSources:\n');
    const summary=pts[0]||'';const sources=pts.length>1?pts[1].split('\n').filter(Boolean).slice(0,3):[];
    let html='<b>🌐 Web context</b><br>'+escapeHtml(summary).slice(0,500).replace(/\n/g,'<br>');
    if(sources.length)html+='<br><b>Sources:</b><br>'+sources.map(s=>escapeHtml(s)).join('<br>');
    d.innerHTML=html;}
  document.getElementById('chatMsgs').appendChild(d);document.getElementById('chatMsgs').scrollTop=document.getElementById('chatMsgs').scrollHeight;}

// ── MANDATORY WEB REVIEW GATE ──
function needsMandatoryWebReview(text){
  const t=(text||'').toLowerCase();if(!t)return false;
  const isSearch=/\b(find|search|show|list|get|recommend|suggest)\b/.test(t);
  const valKw=/(\$[\d,.k]+|worth|valuat|invest|overpay|underpay|fair|steal|avoid|buy|sign|price|priced|\bpay\b)/.test(t);
  const newsKw=/(latest|recent|today|yesterday|this week|last week|news|injur|hurt|suspend|transfer|portal|available|availability|out for|return(ing)?|rumor|report|update|status|commit|nil\b|coaching|coach\b|minutes|role|lineup|start(er|ing)?)/.test(t);
  if(!isSearch&&valKw)return true;
  if(newsKw)return true;
  return false;}
function buildForcedWebQuery(text){
  const t=(text||'').toLowerCase();
  const isNews=/(latest|recent|today|news|injur|hurt|suspend|transfer|portal|return|rumor|update|status|coach|minutes|role|lineup|start)/.test(t);
  const player=matchLoadedPlayer(text);const name=player?player.Player:null;
  if(name&&!isNews)return`${name} college volleyball NIL salary contract value 2025`;
  if(name&&isNews)return`${name} college volleyball latest news injury transfer portal 2025`;
  if(!isNews)return`${text} college volleyball NIL value market 2025`;
  return`${text} college volleyball latest news 2025`;}

// ── DYNAMIC SYSTEM PROMPT ──
function sysPrompt(){
  const ctx=execGetDashboardContext();
  const myRoster=ctx.roster.members;
  const oppRoster=ctx.opponent.members;
  const myText=myRoster.length?'MY ROSTER:\n'+myRoster.map((r,i)=>(i+1)+'. '+r.name+' ('+r.team+', '+r.pos+', Score:'+r.score+', Val:$'+r.value.toLocaleString()+')').join('\n'):'MY ROSTER: empty';
  const oppText=oppRoster.length?'OPPONENT:\n'+oppRoster.map((r,i)=>(i+1)+'. '+r.name+' ('+r.team+', '+r.pos+', Score:'+r.score+', Val:$'+r.value.toLocaleString()+')').join('\n'):'OPPONENT: empty';
  const txt=
    'You are Scout AI, an NCAA volleyball scouting and roster-building assistant embedded in this dashboard. You think like an opinionated assistant coach.\n\n'+
    'STATE: '+ctx.totalPlayers+' players loaded | '+ctx.teams+' teams | Active roster tab: '+ctx.activeRosterTab+'\n'+
    'BUDGET: $'+ctx.roster.budget.toLocaleString()+' total | $'+ctx.roster.perPlayerCap.toLocaleString()+' max/player | '+ctx.roster.count+'/'+ctx.roster.maxSize+' roster spots used\n'+
    myText+'\n'+oppText+'\n\n'+
    'RULES (strict):\n'+
    '1) Use dashboard tools first. Only use web_search after dashboard evidence when the question is time-sensitive or asks about valuation/news.\n'+
    '2) For player-vs-player requests, ALWAYS call compare_players. Do not hand-compare raw stats when the visual modal exists.\n'+
    '3) Never invent player names. Only recommend players you already saw in a dashboard tool result during this conversation.\n'+
    '4) For roster actions, give the recommendation and then immediately call add_players_to_roster, remove_player_from_roster, or swap_roster_player. The UI will handle confirmation.\n'+
    '5) For opponent scouting, use add_players_to_opponent. If the user says one team is playing another, the first team is usually my roster and the second is the opponent unless the wording clearly says otherwise.\n'+
    '6) For head-to-head, matchup analysis, or scouting an opponent, ALWAYS call get_head_to_head once both rosters are populated. Then explain who leads each category, the biggest matchup edges, and 2-3 practical coaching adjustments.\n'+
    '7) If the user asks about latest, recent, today, injuries, transfer portal, NIL value, worth, fair price, overpay, or underpay, you MUST call web_search after the dashboard pass and cite concrete dates in the answer.\n'+
    '8) Be concise, direct, and useful. Use **bold** for emphasis and format money like $25,000.';
  return{parts:[{text:txt}]};}

// â”€â”€ CALL GEMINI â”€â”€
async function callGemini(extraText){
  const contents=chatHist.map(h=>h.parts?h:{role:h.role==='ai'?'model':'user',parts:[{text:h.text||''}]});
  if(extraText)contents.push({role:'user',parts:[{text:extraText}]});
  const body={contents,tools:AI_TOOLS,systemInstruction:sysPrompt(),generationConfig:{maxOutputTokens:2048,temperature:0.7}};
  const r=await fetch(GEMINI_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('Gemini error '+r.status);
  return r.json();}

// â”€â”€ PROCESS RESPONSE (tool-call loop) â”€â”€
async function processResp(data,depth){
  depth=depth||0;
  if(depth>8){addMsg('ai','[Scout AI reached max reasoning depth — try rephrasing]');return;}
  const cand=data.candidates?.[0];
  if(!cand?.content){
    const reason=data.promptFeedback?.blockReason||'';
    addMsg('ai',reason?'Response blocked: '+reason:(data.error?.message||'No response from Scout AI'));return;}
  const parts=cand.content.parts||[];
  if(!parts.length){addMsg('ai','Empty response. Try rephrasing.');return;}
  const textParts=parts.filter(p=>p.text);
  const fnCalls=parts.filter(p=>p.functionCall);
  if(!fnCalls.length){
    const text=textParts.map(p=>p.text).join('');
    if(needsMandatoryWebReview(lastUserText)&&!turnHasWebSearch&&!turnForcedWebForValuation){
      turnForcedWebForValuation=true;const q=buildForcedWebQuery(lastUserText);
      addMsg('system','Searching the web...');
      let wr;try{wr=await doWebSearch(q);}catch(e){wr={error:e.message};}
      turnHasWebSearch=true;renderWebEvidence(wr);
      chatHist.push({role:'model',parts:[{functionCall:{name:'web_search',args:{query:q}}}]});
      chatHist.push({role:'user',parts:[{functionResponse:{name:'web_search',response:{result:wr}}}]});
      try{await processResp(await callGemini(null),depth+1);return;}catch(e){}
    }
    if(text){chatHist.push({role:'model',parts:[{text}]});addMsg('ai',fmtText(text));}
    return;}
  if(fnCalls.some(c=>c.functionCall.name==='web_search')&&!turnHasDashboardLookup&&!turnWebSearchDeferred&&ALL.length){
    turnWebSearchDeferred=true;turnHasDashboardLookup=true;
    addMsg('system','Looking up data...');
    const mP2=[],uP2=[];
    const pl=matchLoadedPlayer(lastUserText);
    if(pl){const prof=execGetPlayerProfile({name:pl.Player});mP2.push({functionCall:{name:'get_player_profile',args:{name:pl.Player}}});uP2.push({functionResponse:{name:'get_player_profile',response:{result:prof}}});}
    else{const q=lastUserText.split(/\s+/).slice(0,4).join(' ');const sr=execSearchPlayers({query:q,limit:5});mP2.push({functionCall:{name:'search_players',args:{query:q}}});uP2.push({functionResponse:{name:'search_players',response:{result:sr}}});}
    const ctx=execGetDashboardContext();mP2.push({functionCall:{name:'get_dashboard_context',args:{}}});uP2.push({functionResponse:{name:'get_dashboard_context',response:{result:ctx}}});
    chatHist.push({role:'model',parts:mP2});chatHist.push({role:'user',parts:uP2});
    try{await processResp(await callGemini(null),depth+1);}catch(e){addMsg('ai','Error: '+e.message);}
    return;}
  let textStr=textParts.map(p=>p.text).join('');
  let activeFnCalls=fnCalls.slice();
  const hasConfirm=activeFnCalls.some(c=>CONFIRM_ACTIONS.has(c.functionCall.name));
  if(hasConfirm){
    const opponentCalls=activeFnCalls.filter(c=>c.functionCall.name==='add_players_to_opponent');
    if(opponentCalls.length){
      if(textStr){addMsg('ai',fmtText(textStr));textStr='';}
      for(const fnPart of opponentCalls){
        const call=fnPart.functionCall;addMsg('system','Setting opponent roster...');
        let result;try{const r=execCall(call);result=(r&&typeof r.then==='function')?await r:r;}catch(e){result={error:e.message};}
        turnHasDashboardLookup=true;
        chatHist.push({role:'model',parts:[{functionCall:call}]});
        chatHist.push({role:'user',parts:[{functionResponse:{name:call.name,response:{result}}}]});
        addMsg('ai',result.error?'Error: '+result.error:'Added '+(result.added||0)+' player(s) to the opponent roster.');
      }
      activeFnCalls=activeFnCalls.filter(c=>c.functionCall.name!=='add_players_to_opponent');
    }
  }
  const modelParts=[];
  if(textStr)modelParts.push({text:textStr});
  activeFnCalls.forEach(c=>modelParts.push({functionCall:c.functionCall}));
  const confirmCall=activeFnCalls.find(c=>CONFIRM_ACTIONS.has(c.functionCall.name));
  if(confirmCall){
    const call=confirmCall.functionCall;
    if(call.name==='swap_roster_player'){
      const addName=(call.args?.addPlayer||'').trim();
      const exists=addName&&ALL.some(r=>normalizeName(r.Player).includes(normalizeName(addName)));
      if(!exists&&addName){
        const dropRow=ROST.find(r=>normalizeName(r.Player).includes(normalizeName(call.args?.dropPlayer||'')));
        const candidates=execGetTopPlayers({position:dropRow?dropRow._np:undefined,limit:10,maxValue:PBUDGET});
        chatHist.push({role:'model',parts:modelParts});
        chatHist.push({role:'user',parts:[{functionResponse:{name:'swap_roster_player',response:{result:{success:false,error:'"'+call.args.addPlayer+'" is not in the dashboard database. Only recommend players confirmed in dashboard results. Top available candidates:',availablePlayers:candidates}}}}]});
        turnHasDashboardLookup=true;
        addMsg('system','Not in database: '+escapeHtml(call.args.addPlayer)+' — finding real candidates...');
        try{await processResp(await callGemini(null),depth+1);}catch(e){addMsg('ai','Error: '+e.message);}
        return;}}
    if(textStr)addMsg('ai',fmtText(textStr));
    pendingAction={call,modelParts};
    const cb='<div class="aiConfirm"><button class="aiConfirmBtn yes" onclick="window._aiConfirm(true)">&#10003; Yes, do it</button><button class="aiConfirmBtn no" onclick="window._aiConfirm(false)">&#10005; Cancel</button></div>';
    const names=(call.args?.playerNames||[]).join(', ');
    const tl=call.args?.team?'all <b>'+escapeHtml(call.args.team)+'</b> players':names?'<b>'+escapeHtml(names)+'</b>':'players';
    const desc=call.name==='add_players_to_roster'?'Add '+tl+' to roster':call.name==='remove_player_from_roster'?'Remove <b>'+escapeHtml(call.args?.playerName||'')+'</b> from roster':'Swap <b>'+escapeHtml(call.args?.dropPlayer||'')+'</b> &rarr; <b>'+escapeHtml(call.args?.addPlayer||'')+'</b>';
    if(!textStr)addMsg('ai','I\'d like to: '+desc+'.'+cb);else addMsg('ai',cb);
    return;}
  const cmpCall=activeFnCalls.find(c=>c.functionCall.name==='compare_players');
  if(cmpCall){
    const call=cmpCall.functionCall;let result;try{result=execCall(call);}catch(e){result={error:e.message};}
    if(textStr)addMsg('ai',fmtText(textStr));
    if(result&&result.opened){
      chatHist.push({role:'model',parts:modelParts});
      chatHist.push({role:'user',parts:[{functionResponse:{name:'compare_players',response:{result:{opened:true}}}}]});
      if(!textStr)addMsg('ai','Opened comparison: <b>'+escapeHtml(result.player1?.player||call.args?.player1||'')+'</b> vs <b>'+escapeHtml(result.player2?.player||call.args?.player2||'')+'</b>.');
    }else addMsg('ai',result?.error||'Could not find one or both players.');
    return;}
  const uParts=[];
  for(const fnPart of activeFnCalls){
    const call=fnPart.functionCall;
    addMsg('system',call.name==='web_search'?'Searching the web...':call.name==='add_players_to_opponent'?'Setting opponent roster...':'Looking up data...');
    let result;try{const r=execCall(call);result=(r&&typeof r.then==='function')?await r:r;}catch(e){result={error:e.message};}
    if(call.name==='web_search'){turnHasWebSearch=true;if(!result.error)renderWebEvidence(result);}
    else turnHasDashboardLookup=true;
    if(call.name==='get_head_to_head'&&!result.error){ROST_SUB='h2h';renderAll();}
    if(call.name==='add_players_to_opponent'&&!result.error){ROST_SUB='opponent';renderAll();}
    uParts.push({functionResponse:{name:call.name,response:{result}}});}
  chatHist.push({role:'model',parts:modelParts});chatHist.push({role:'user',parts:uParts});
  try{await processResp(await callGemini(null),depth+1);}catch(err){addMsg('ai','Error: '+err.message);}}

async function runValuationComparePipeline(userText){
  // User message already pushed to chatHist by doSend
  const mParts=[],uParts=[];
  if(ALL.length){
    const player=matchLoadedPlayer(userText);
    if(player){
      const prof=execGetPlayerProfile({name:player.Player});
      mParts.push({functionCall:{name:'get_player_profile',args:{name:player.Player}}});
      uParts.push({functionResponse:{name:'get_player_profile',response:{result:prof}}});
      renderDashboardEvidence(prof);
    }else{
      const q=userText.split(/\s+/).filter(w=>w.length>2).slice(0,4).join(' ');
      const sr=execSearchPlayers({query:q,limit:5});
      mParts.push({functionCall:{name:'search_players',args:{query:q}}});
      uParts.push({functionResponse:{name:'search_players',response:{result:sr}}});
      renderDashboardEvidence(sr);}
    const ctx=execGetDashboardContext();
    mParts.push({functionCall:{name:'get_dashboard_context',args:{}}});
    uParts.push({functionResponse:{name:'get_dashboard_context',response:{result:ctx}}});
    turnHasDashboardLookup=true;}
  addMsg('system','Searching the web...');
  const wq=buildForcedWebQuery(userText);
  let wr;try{wr=await doWebSearch(wq);}catch(e){wr={error:e.message};}
  mParts.push({functionCall:{name:'web_search',args:{query:wq}}});
  uParts.push({functionResponse:{name:'web_search',response:{result:wr}}});
  turnHasWebSearch=true;renderWebEvidence(wr);
  chatHist.push({role:'model',parts:mParts});chatHist.push({role:'user',parts:uParts});
  return callGemini(null);}

// ── CONFIRM EXECUTION ──
async function executeConfirm(confirmed){
  if(!pendingAction)return;
  document.querySelectorAll('.aiConfirmBtn').forEach(b=>{b.disabled=true;b.style.opacity='0.4';});
  if(confirmed){
    addMsg('system','Executing...');
    let result;try{result=execCall(pendingAction.call);}catch(e){result={error:e.message};}
    const pa=pendingAction;pendingAction=null;
    const r=(result&&typeof result.then==='function')?await result:result;
    chatHist.push({role:'model',parts:pa.modelParts});
    chatHist.push({role:'user',parts:[{functionResponse:{name:pa.call.name,response:{result:r}}}]});
    document.getElementById('chatSend').disabled=true;
    try{
      const d=await callGemini(null);const ps=d?.candidates?.[0]?.content?.parts||[];
      if(!ps.length){const added=r.added||0,failed=r.failed?.length||0;
        addMsg('ai',r.error?'Error: '+escapeHtml(r.error):'Done! Added '+added+' player'+(added!==1?'s':'')+' to the roster.'+(failed?' ('+failed+' skipped)':''));
      }else await processResp(d);
    }catch(err){addMsg('ai','Done! '+(r.error||''));}
    document.getElementById('chatSend').disabled=false;
  }else{pendingAction=null;addMsg('ai','Cancelled. What else?');}
}
window._aiConfirm=executeConfirm;

// ── CLEAR CHAT ──
function clearChat(){
  chatHist=[];pendingActions=[];actionIdCounter=0;pendingAction=null;
  lastUserText='';turnHasDashboardLookup=false;turnWebSearchDeferred=false;
  turnHasWebSearch=false;turnForcedWebForValuation=false;
  document.getElementById('chatMsgs').innerHTML='';addAiWelcome();}

// ── TOGGLE + WELCOME ──
function toggleChat(){chatOpen=!chatOpen;document.getElementById('chatPanel').classList.toggle('open',chatOpen);document.getElementById('chatFab').classList.toggle('has-panel',chatOpen);document.getElementById('chatFab').textContent=chatOpen?'✕':'🤖';if(chatOpen&&!document.getElementById('chatMsgs').children.length)addAiWelcome()}
function addAiWelcome(){addMsg('ai','Hey Coach! I\'m <b>Scout AI</b> -- your volleyball recruiting and game-prep assistant.\n\nI can <b>run the dashboard for you</b>:\n• <b>"Show me elite setters under $40k"</b> -- I\'ll search the data\n• <b>"Compare Player A vs Player B"</b> -- I open the side-by-side modal\n• <b>"Add the entire Pitt roster"</b> -- I queue the roster move for approval\n• <b>"Scout Louisville as the opponent"</b> -- I build the opponent board\n• <b>"Show head-to-head vs Nebraska"</b> -- I break down the matchup by category\n• <b>"Is Jane Smith worth $150k?"</b> -- I combine dashboard stats with current web context\n\nEvery change to <b>your</b> roster still needs your approval.');}

// ── ACTION EXECUTION ENGINE (non-roster action tags only) ──
function execAction(actionId){
  const act=pendingActions.find(a=>a.id===actionId);
  if(!act||act.done)return;
  act.done=true;
  const btn=document.getElementById('abtn-'+actionId);
  if(btn)btn.innerHTML='<span class="chat-act done">Done</span>';
  switch(act.type){
    case 'filter':{applyAiFilter(act.params);break;}
    case 'open_player':{const p=ALL.find(x=>x.Player.toLowerCase()===act.name.toLowerCase().trim());if(p)openP(p._id);break;}
    case 'compare':{const p1=ALL.find(x=>x.Player.toLowerCase()===act.p1.toLowerCase().trim());const p2=ALL.find(x=>x.Player.toLowerCase()===act.p2.toLowerCase().trim());if(p1&&p2)openCompare(p1._id,p2._id);break;}
    case 'switch_tab':{document.querySelectorAll('.tbtn').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tp').forEach(x=>x.classList.remove('active'));const tab=document.querySelector('[data-tab="'+act.tab+'"]');const panel=document.getElementById('p-'+act.tab);if(tab)tab.classList.add('active');if(panel)panel.classList.add('active');break;}
    case 'set_budget':{TBUDGET=act.value;renderAll();break;}
    case 'set_max_player':{PBUDGET=act.value;renderAll();break;}
    case 'set_roster_size':{RSIZE=act.value;renderAll();break;}
    case 'clear_roster':{clearR();break;}}
  addMsg('ai','Done! '+(act.desc||'Action completed.'));}
function rejectAction(actionId){const act=pendingActions.find(a=>a.id===actionId);if(!act||act.done)return;act.done=true;const btn=document.getElementById('abtn-'+actionId);if(btn)btn.innerHTML='<span class="chat-act done">Skipped</span>';}
function execAllPending(){pendingActions.filter(a=>!a.done).forEach(a=>execAction(a.id));}
function rejectAllPending(){pendingActions.filter(a=>!a.done).forEach(a=>rejectAction(a.id));}

// ── MESSAGE RENDERING ──
function addMsg(role,text){
  const c=document.getElementById('chatMsgs');const d=document.createElement('div');d.className='chat-msg '+role;
  if(role==='system'){d.innerHTML=text;c.appendChild(d);c.scrollTop=c.scrollHeight;return;}
  if(role==='ai'){
    let html=text;
    // Non-roster [ACTION:...] tags (filter, open_player, compare, switch_tab, settings)
    html=html.replace(/\[ACTION:([^\]]+)\]/g,(m,content)=>{
      const pts=content.split('|').map(s=>s.trim());const type=pts[0];const aid=++actionIdCounter;let act=null;let label='';
      switch(type){
        case 'filter':{const fp=Object.fromEntries(pts[1].split(',').map(p=>p.split('=')));act={id:aid,type,params:fp,desc:'Applied filter'};label='Apply filter';break;}
        case 'open_player':act={id:aid,type,name:pts[1],desc:'Opened '+pts[1]+"'s profile"};label='View '+pts[1];break;
        case 'compare':act={id:aid,type,p1:pts[1],p2:pts[2],desc:'Compared '+pts[1]+' vs '+pts[2]};label='Compare '+pts[1]+' vs '+pts[2];break;
        case 'switch_tab':act={id:aid,type,tab:pts[1],desc:'Switched to '+pts[1]+' tab'};label='Go to '+pts[1];break;
        case 'set_budget':act={id:aid,type,value:parseInt(pts[1]),desc:'Set budget to $'+parseInt(pts[1]).toLocaleString()};label='Set budget to $'+parseInt(pts[1]).toLocaleString();break;
        case 'set_max_player':act={id:aid,type,value:parseInt(pts[1]),desc:'Set max/player to $'+parseInt(pts[1]).toLocaleString()};label='Set max/player to $'+parseInt(pts[1]).toLocaleString();break;
        case 'set_roster_size':act={id:aid,type,value:parseInt(pts[1]),desc:'Set roster size to '+pts[1]};label='Set roster size to '+pts[1];break;
        case 'clear_roster':act={id:aid,type,desc:'Cleared roster'};label='Clear roster';break;
        default:return m;}
      if(act){pendingActions.push(act);return '<span id="abtn-'+aid+'" class="chat-actions"><button class="chat-act confirm" onclick="execAction('+aid+')">&#10003; '+escapeHtml(label)+'</button><button class="chat-act reject" onclick="rejectAction('+aid+')">&#10005;</button></span>';}
      return m;});
    html=fmtText(html);
    d.innerHTML=html;
  }else{d.textContent=text;}
  c.appendChild(d);c.scrollTop=c.scrollHeight;}

// ── FILTER HELPER ──
function applyAiFilter(params){
  if(params.pos)document.getElementById('fp').value=params.pos==='all'?'all':params.pos;
  if(params.tier)document.getElementById('ft').value=params.tier==='all'?'all':params.tier;
  if(params.search!==undefined)document.getElementById('fs').value=params.search;
  applyF();
  document.querySelectorAll('.tbtn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tp').forEach(x=>x.classList.remove('active'));
  document.querySelector('[data-tab="players"]').classList.add('active');
  document.getElementById('p-players').classList.add('active');}

// ── SEND MESSAGE ──
async function sendChat(preset){
  const inp=document.getElementById('chatInput');
  const msg=preset||inp.value.trim();if(!msg)return;
  inp.value='';addMsg('user',msg);
  // Handle yes/no text replies when awaiting confirm
  if(pendingAction){
    const yes=/^(yes|yep|yeah|sure|do it|go ahead|proceed|ok|confirm|absolutely)/i.test(msg);
    const no=/^(no|nah|nope|cancel|don't|stop|skip)/i.test(msg);
    if(yes){await executeConfirm(true);return;}
    if(no){await executeConfirm(false);return;}
    pendingAction=null;}
  await doSend(msg);}
async function doSend(msg){
  document.getElementById('chatSend').disabled=true;
  lastUserText=msg;turnHasDashboardLookup=false;turnWebSearchDeferred=false;
  turnHasWebSearch=false;turnForcedWebForValuation=false;
  const typing=document.createElement('div');typing.className='chat-typing';typing.textContent='Scout AI is thinking...';
  document.getElementById('chatMsgs').appendChild(typing);
  document.getElementById('chatMsgs').scrollTop=document.getElementById('chatMsgs').scrollHeight;
  try{
    chatHist.push({role:'user',parts:[{text:msg}]});
    if(needsMandatoryWebReview(msg)){
      const data=await runValuationComparePipeline(msg);
      await processResp(data);
    }else{
      const data=await callGemini(null);
      await processResp(data);}
  }catch(err){addMsg('ai','Connection error: '+err.message);console.error('Scout AI error:',err);}
  typing.remove();
  document.getElementById('chatSend').disabled=false;document.getElementById('chatInput').focus();}

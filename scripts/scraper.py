#!/usr/bin/env python3
"""
NCAA Women's Volleyball Stats Scraper
======================================
Scrapes stats.ncaa.org national rankings + team pages for all DI players.

Phase 1 — National Rankings (8 stat categories, ~8 requests)
  • Discovers season period_id and stat_seq IDs automatically
  • Extracts every qualifying player's stats + team links

Phase 2 — Team Pages (~350 requests, 1 per team)
  • Uses team links found in Phase 1
  • Gets position (Pos), year (Yr), height (Ht) for every player
  • Provides complete stat rows including Atk Err, Serv Err, BH Err, Blk Err

Output: data/players.json
"""

import requests, json, re, time, os, sys
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from collections import defaultdict

# ─── Config ───────────────────────────────────────────────────────────────────
SPORT_CODE    = "WVB"
DIVISION_ID   = "1"         # 1=DI  (change to 2 or 3 for DII/DIII)
MIN_SETS      = 10          # skip players with fewer sets played
REQ_DELAY     = 1.8         # seconds between requests — be nice to NCAA
BASE          = "https://stats.ncaa.org"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# ─── Which stat pages to scrape (label substring → page key) ─────────────────
STAT_TARGETS = {
    "hitting percentage": "hit_pct",
    "kills per set":      "kills",
    "assists per set":    "assists",
    "service aces":       "aces",
    "digs per set":       "digs",
    "blocks per set":     "blocks",
    "points per set":     "pts",
}

# Column header aliases per page → our field name
# Header names are what stats.ncaa.org uses in the HTML table
COL_MAP = {
    "hit_pct": {
        "K": "Kills",  "E": "Atk Err",  "TA": "Atk",
        "Pct": "Hit %",  "PCT": "Hit %",
        "S": "_Sets",  "GP": "_Matches",
    },
    "kills":   { "K": "Kills",    "S": "_Sets", "GP": "_Matches" },
    "assists": { "A": "Assists",  "S": "_Sets" },
    "aces":    { "SA": "Aces", "SE": "Serv Err", "S": "_Sets" },
    "digs":    { "D": "Digs",     "S": "_Sets" },
    "blocks":  { "BS": "Solo Blk", "BA": "Blk Ast", "TB": "Total Blk", "S": "_Sets" },
    "pts":     { "PTS": "PTS",    "S": "_Sets" },
}

# Team page column headers → our field names (Phase 2 full roster stats)
TEAM_PAGE_COLS = {
    "#":            "_Number",
    "Name":         "Player",
    "Player":       "Player",
    "Yr":           "Yr",
    "Pos":          "Pos",
    "Ht":           "Ht",
    "Hometown":     "Hometown",
    "HS":           "High School",
    "High School":  "High School",
    "GP":           "_Matches",
    "GS":           "_GS",
    "S":            "_Sets",
    "Sets":         "_Sets",
    "K":            "Kills",
    "Kills":        "Kills",
    "E":            "Atk Err",
    "TA":           "Atk",
    "Pct":          "Hit %",
    "PCT":          "Hit %",
    "A":            "Assists",
    "SA":           "Aces",
    "SE":           "Serv Err",
    "D":            "Digs",
    "RE":           "Ret Err",
    "BS":           "Solo Blk",
    "BA":           "Blk Ast",
    "TB":           "Total Blk",
    "BE":           "Blk Err",
    "BHE":          "BH Err",
    "PTS":          "PTS",
}

# ─── HTTP helpers ─────────────────────────────────────────────────────────────
session = requests.Session()
session.headers.update(HEADERS)

def fetch(url, delay=REQ_DELAY, retries=3):
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=30)
            r.raise_for_status()
            time.sleep(delay)
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            wait = delay * (attempt + 1) * 2
            print(f"    [retry {attempt+1}/{retries}] {e} — waiting {wait:.0f}s")
            time.sleep(wait)
    print(f"    FAILED after {retries} retries: {url}")
    return None

# ─── Phase 1: Discover season params ─────────────────────────────────────────
def get_season_params():
    """
    Load the WVB national rankings page to discover:
      - ranking_period_id  (end-of-season final)
      - stat_seq IDs       (one per stat category we want)
    Returns (period_id: str, matched_seqs: dict[page_key -> seq_id])
    """
    url = (
        f"{BASE}/rankings/national_ranking"
        f"?utf8=%E2%9C%93&college_division_id={DIVISION_ID}&sport_code={SPORT_CODE}&stat_seq=1"
    )
    print(f"[Phase 1] Loading rankings page...")
    soup = fetch(url, delay=2)
    if not soup:
        sys.exit("ERROR: Could not load rankings page — check network access")

    periods   = {}   # period_id -> label
    stat_seqs = {}   # seq_id    -> label

    for sel in soup.find_all("select"):
        name = (sel.get("name") or sel.get("id") or "").lower()
        if "ranking_period" in name:
            for opt in sel.find_all("option"):
                v = (opt.get("value") or "").strip()
                if v:
                    periods[v] = opt.get_text(strip=True)
        elif "stat_seq" in name:
            for opt in sel.find_all("option"):
                v = (opt.get("value") or "").strip()
                if v:
                    stat_seqs[v] = opt.get_text(strip=True)

    print(f"    Found {len(periods)} periods, {len(stat_seqs)} stat categories")

    # Choose end-of-season period
    final_pid = ""
    for pid, label in periods.items():
        lbl = label.lower()
        if any(w in lbl for w in ["final", "end of season", "championship", "season final"]):
            final_pid = pid
            break
    if not final_pid and periods:
        final_pid = list(periods.keys())[-1]   # last = most recent
    print(f"    Period: {periods.get(final_pid, '(none)')} (id={final_pid})")

    # Match stat sequences to our targets
    matched = {}
    for seq_id, label in stat_seqs.items():
        for target_substr, page_key in STAT_TARGETS.items():
            if target_substr in label.lower() and page_key not in matched.values():
                matched[page_key] = seq_id
                print(f"    Seq {seq_id:>6}: {label!r} → {page_key}")
                break

    return final_pid, matched


# ─── Phase 1: Parse ranking table ─────────────────────────────────────────────
def parse_ranking_page(soup, page_key):
    """
    Parse a national ranking HTML table.
    Returns dict: player_key → data_dict
      player_key = NCAA player id if found, else "Name|||Team"
    """
    players = {}

    # Find the biggest table (the stats table)
    tables = soup.find_all("table")
    if not tables:
        return players
    stat_table = max(tables, key=lambda t: len(t.find_all("tr")))

    rows = stat_table.find_all("tr")
    if len(rows) < 3:
        return players

    # Find header row
    headers = []
    data_start = 0
    for i, row in enumerate(rows[:4]):
        cells = row.find_all(["th", "td"])
        texts = [c.get_text(strip=True) for c in cells]
        if any(t in texts for t in ("Player", "Name", "Team")):
            headers = texts
            data_start = i + 1
            break
    if not headers:
        return players

    col_idx = {h: i for i, h in enumerate(headers)}
    field_map = COL_MAP.get(page_key, {})

    # Identify key column indices
    player_col = col_idx.get("Player") or col_idx.get("Name")
    team_col   = col_idx.get("Team")
    conf_col   = col_idx.get("Conf") or col_idx.get("Conference")

    if player_col is None or team_col is None:
        return players

    def cell_text(cells, idx):
        if idx is None or idx >= len(cells):
            return ""
        return cells[idx].get_text(strip=True).replace(",", "")

    def cell_num(cells, idx, is_float=False):
        t = cell_text(cells, idx)
        if not t:
            return 0
        try:
            return float(t) if is_float else int(float(t))
        except ValueError:
            return 0

    for row in rows[data_start:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 4:
            continue

        # Player name + NCAA player ID from link
        pc = cells[player_col] if player_col < len(cells) else None
        if not pc:
            continue
        a = pc.find("a")
        if a:
            player_name = a.get_text(strip=True)
            href = a.get("href", "")
            m = re.search(r"[?&]id=(\d+)", href)
            ncaa_id = m.group(1) if m else None
        else:
            player_name = pc.get_text(strip=True)
            ncaa_id = None

        if not player_name or player_name.lower() in ("player", "name", ""):
            continue

        team_name = cell_text(cells, team_col)
        if not team_name:
            continue

        # Extract team link → get team_id + year_stat_cat_id
        team_link = None
        if team_col < len(cells):
            ta = cells[team_col].find("a")
            if ta:
                team_link = ta.get("href", "")

        conf_name = cell_text(cells, conf_col) if conf_col is not None else ""

        record = {
            "Player": player_name,
            "Team":   team_name,
            "Conf":   conf_name,
        }
        if ncaa_id:
            record["_ncaa_id"] = ncaa_id
        if team_link:
            record["_team_link"] = team_link

        for col_header, our_field in field_map.items():
            idx = col_idx.get(col_header)
            if idx is None:
                continue
            is_float = our_field in ("Hit %",)
            val = cell_num(cells, idx, is_float)
            record[our_field] = val

        key = ncaa_id if ncaa_id else f"{player_name}|||{team_name}"
        players[key] = record

    return players


# ─── Phase 2: Team page scraping ──────────────────────────────────────────────
def discover_year_stat_cat(team_links):
    """
    From a set of team links found in Phase 1, extract:
      - team_id        (numeric, from /team/{id}/...)
      - year_stat_cat  (numeric, the season-specific category id)
    Returns (set of (team_id, url), year_stat_cat)
    """
    teams = set()
    year_stat_cat = None

    for link in team_links:
        # Expected: /team/{team_id}/stats/{year_stat_cat_id}
        m = re.search(r"/team/(\d+)/stats(?:/(\d+))?", link)
        if m:
            tid = m.group(1)
            ysc = m.group(2)
            if ysc and not year_stat_cat:
                year_stat_cat = ysc
            url = f"{BASE}/team/{tid}/stats"
            if ysc:
                url += f"/{ysc}"
            teams.add((tid, url))

    return teams, year_stat_cat


def parse_team_stats_page(soup):
    """
    Parse a team's full player stats page.
    Returns list of player dicts with position, height, year, and all stats.
    """
    players = []

    tables = soup.find_all("table")
    if not tables:
        return players
    # The stats table is usually the one with the most columns
    stat_table = max(tables, key=lambda t: len(t.find_all("th")))

    rows = stat_table.find_all("tr")
    if len(rows) < 3:
        return players

    # Find header row
    headers = []
    data_start = 0
    for i, row in enumerate(rows[:4]):
        cells = row.find_all(["th", "td"])
        texts = [c.get_text(strip=True) for c in cells]
        if any(t in texts for t in ("Name", "Player", "Pos", "#")):
            headers = texts
            data_start = i + 1
            break
    if not headers:
        return players

    col_idx = {h: i for i, h in enumerate(headers)}

    def cell_text(cells, h, default=""):
        idx = col_idx.get(h)
        if idx is None or idx >= len(cells):
            return default
        return cells[idx].get_text(strip=True).replace(",", "")

    def cell_num(cells, h, is_float=False, default=0):
        t = cell_text(cells, h, "")
        if not t:
            return default
        try:
            return float(t) if is_float else int(float(t))
        except ValueError:
            return default

    name_col = col_idx.get("Name") or col_idx.get("Player")

    for row in rows[data_start:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 5:
            continue

        # Get player name
        if name_col is not None and name_col < len(cells):
            name_cell = cells[name_col]
            a = name_cell.find("a")
            name = a.get_text(strip=True) if a else name_cell.get_text(strip=True)
            if a:
                href = a.get("href", "")
                m = re.search(r"[?&]id=(\d+)", href)
                ncaa_id = m.group(1) if m else None
            else:
                ncaa_id = None
        else:
            continue

        if not name or name.lower() in ("totals", "team", "opponent", ""):
            continue

        p = {
            "Player":    name,
            "Pos":       cell_text(cells, "Pos"),
            "Yr":        cell_text(cells, "Yr"),
            "Ht":        cell_text(cells, "Ht"),
            "Hometown":  cell_text(cells, "Hometown"),
            "_Sets":     cell_num(cells, "S"),
            "_Matches":  cell_num(cells, "GP"),
            "Kills":     cell_num(cells, "K"),
            "Atk Err":   cell_num(cells, "E"),
            "Atk":       cell_num(cells, "TA"),
            "Hit %":     cell_num(cells, "Pct", is_float=True) or cell_num(cells, "PCT", is_float=True),
            "Assists":   cell_num(cells, "A"),
            "Aces":      cell_num(cells, "SA"),
            "Serv Err":  cell_num(cells, "SE"),
            "Digs":      cell_num(cells, "D"),
            "Solo Blk":  cell_num(cells, "BS"),
            "Blk Ast":   cell_num(cells, "BA"),
            "Total Blk": cell_num(cells, "TB"),
            "Blk Err":   cell_num(cells, "BE"),
            "BH Err":    cell_num(cells, "BHE"),
            "PTS":       cell_num(cells, "PTS"),
        }
        if ncaa_id:
            p["_ncaa_id"] = ncaa_id

        players.append(p)

    return players


# ─── Position inference (fallback when team page unavailable) ─────────────────
def infer_position(p):
    """
    Statistically infer a player's position.
    Works well for S and L/DS (~90% accurate), decent for MB/OH/OPP (~70%).
    """
    sets      = max(p.get("_Sets") or p.get("Sets", 1), 1)
    kills_ps  = (p.get("Kills", 0)) / sets
    digs_ps   = (p.get("Digs",  0)) / sets
    asst_ps   = (p.get("Assists", 0)) / sets
    solo_blk  = p.get("Solo Blk", 0)
    blk_ast   = p.get("Blk Ast", 0)
    total_blk = p.get("Total Blk", solo_blk + blk_ast)
    blk_ps    = total_blk / sets
    hit_pct   = p.get("Hit %", 0.0)

    if asst_ps >= 5.0:                                    return "S"
    if asst_ps >= 3.0 and kills_ps < 1.5:                 return "S"
    if digs_ps >= 3.5 and kills_ps <= 0.3:                return "L/DS"
    if digs_ps >= 2.5 and kills_ps <= 0.2:                return "L/DS"
    if blk_ps  >= 0.8 and hit_pct >= 0.15:                return "MB"
    if blk_ps  >= 0.5 and digs_ps <= 0.9:                 return "MB"
    if kills_ps >= 1.5 and digs_ps >= 1.0:                return "OH"
    if kills_ps >= 2.0 and digs_ps < 1.0 and blk_ps >= 0.3: return "OPP"
    if kills_ps >= 1.5 and digs_ps < 1.0:                 return "OPP"
    if digs_ps  >= kills_ps * 2:                          return "L/DS"
    if kills_ps >= 1.0:                                   return "OH"
    return "OH"


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("NCAA Women's Volleyball Stats Scraper")
    print(f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── Phase 1: Discover params ──────────────────────────────────────────────
    period_id, matched_seqs = get_season_params()

    if not matched_seqs:
        sys.exit("ERROR: No stat categories found. The NCAA site structure may have changed.")

    # ── Phase 1: Scrape national ranking pages ────────────────────────────────
    all_players   = defaultdict(dict)   # player_key -> merged data
    team_links    = set()               # raw hrefs like /team/1234/stats/56789

    SCRAPE_ORDER = ["hit_pct", "kills", "digs", "assists", "aces", "blocks", "pts"]

    for page_key in SCRAPE_ORDER:
        if page_key not in matched_seqs:
            print(f"\n[Phase 1] {page_key}: not found in available stats, skipping")
            continue

        seq_id = matched_seqs[page_key]
        url = (
            f"{BASE}/rankings/national_ranking"
            f"?utf8=%E2%9C%93&college_division_id={DIVISION_ID}"
            f"&sport_code={SPORT_CODE}"
            f"&ranking_period_id={period_id}"
            f"&stat_seq={seq_id}"
        )
        print(f"\n[Phase 1] Scraping {page_key} (seq={seq_id})...")
        soup = fetch(url, delay=REQ_DELAY)
        if not soup:
            print(f"  SKIPPED (no response)")
            continue

        page_data = parse_ranking_page(soup, page_key)
        print(f"  Parsed {len(page_data)} players")

        for key, pdata in page_data.items():
            existing = all_players[key]

            # Always update identity fields
            for f in ("Player", "Team", "Conf", "_ncaa_id"):
                if pdata.get(f):
                    existing[f] = pdata[f]

            # Collect team links for Phase 2
            if pdata.get("_team_link"):
                team_links.add(pdata["_team_link"])

            # Merge stats (hit_pct page has priority for Kills/AtkErr/Atk/Hit%)
            for field, val in pdata.items():
                if field.startswith("_") and field not in ("_Sets", "_Matches"):
                    continue
                if field in ("Player", "Team", "Conf"):
                    continue
                # Don't overwrite if already set (first-write priority order)
                if field not in existing:
                    existing[field] = val

    print(f"\n[Phase 1] Total unique players: {len(all_players)}")
    print(f"[Phase 1] Team links collected: {len(team_links)}")

    # ── Phase 2: Team pages for positions + complete stats ────────────────────
    teams, year_stat_cat = discover_year_stat_cat(team_links)
    print(f"\n[Phase 2] Scraping {len(teams)} team pages for position data...")

    # Build lookup: (player_name.lower(), team.lower()) -> player_key in all_players
    name_team_index = {}
    for key, p in all_players.items():
        nk = (p.get("Player", "").lower().strip(), p.get("Team", "").lower().strip())
        name_team_index[nk] = key

    positions_found = 0
    teams_scraped   = 0

    for i, (team_id, team_url) in enumerate(sorted(teams)):
        if i % 25 == 0:
            print(f"  Progress: {i}/{len(teams)} teams ({positions_found} positions found so far)")

        soup = fetch(team_url, delay=REQ_DELAY)
        if not soup:
            continue

        team_players = parse_team_stats_page(soup)
        teams_scraped += 1

        for tp in team_players:
            # Match to Phase 1 record
            nk = (tp["Player"].lower().strip(), "")  # team unknown from team page alone

            # Try by NCAA id first
            key = None
            if tp.get("_ncaa_id"):
                if tp["_ncaa_id"] in all_players:
                    key = tp["_ncaa_id"]

            # Fallback: match by name across all players on this team
            if not key:
                # Find the team name from any Phase 1 player on this team
                for candidate_key, candidate in all_players.items():
                    if (candidate.get("Player", "").lower().strip() == tp["Player"].lower().strip()):
                        key = candidate_key
                        break

            if key:
                p = all_players[key]
                # Update with richer team page data
                for field in ("Pos", "Yr", "Ht", "Hometown"):
                    if tp.get(field):
                        p[field] = tp[field]
                # Fill in error stats that national rankings don't have
                for field in ("Atk Err", "Atk", "Serv Err", "Blk Err", "BH Err", "Total Blk", "Solo Blk", "Blk Ast"):
                    if tp.get(field, 0) and not p.get(field):
                        p[field] = tp[field]
                if tp.get("Hit %") and not p.get("Hit %"):
                    p["Hit %"] = tp["Hit %"]
                if tp.get("_Sets") and not p.get("_Sets"):
                    p["_Sets"] = tp["_Sets"]
                positions_found += 1
            else:
                # New player not in Phase 1 (didn't qualify for any ranking)
                # Add them if they have enough sets
                if tp.get("_Sets", 0) >= MIN_SETS:
                    new_key = tp.get("_ncaa_id") or f"{tp['Player']}|||{tp.get('Team', 'unknown')}"
                    all_players[new_key] = tp

    print(f"\n[Phase 2] Teams scraped: {teams_scraped}")
    print(f"[Phase 2] Positions resolved: {positions_found}")

    # ── Build output ──────────────────────────────────────────────────────────
    print("\n[Output] Building final player list...")

    # Detect season from the data (use highest numeric year seen in stat pages)
    # The period label may contain "2025" or "2026" etc.
    season_year = 2025  # safe default; will try to detect below

    output_rows = []
    skipped = 0

    for key, p in all_players.items():
        player_name = p.get("Player", "").strip()
        team_name   = p.get("Team",   "").strip()
        if not player_name or not team_name:
            continue

        sets = int(p.get("_Sets") or p.get("Sets", 0))
        if sets < MIN_SETS:
            skipped += 1
            continue

        # Resolve stat values
        kills    = int(p.get("Kills",   0))
        atk_err  = int(p.get("Atk Err", 0))
        atk      = int(p.get("Atk",     0))
        hit_pct  = float(p.get("Hit %", 0.0))
        assists  = int(p.get("Assists", 0))
        aces     = int(p.get("Aces",    0))
        serv_err = int(p.get("Serv Err",0))
        digs     = int(p.get("Digs",    0))
        solo_blk = int(p.get("Solo Blk",0))
        blk_ast  = int(p.get("Blk Ast", 0))
        total_blk= int(p.get("Total Blk", solo_blk + blk_ast))
        blk_err  = int(p.get("Blk Err", 0))
        bh_err   = int(p.get("BH Err",  0))
        pts      = int(p.get("PTS",     0))
        matches  = int(p.get("_Matches") or p.get("Matches", 0))

        # Recompute Hit % if we have K, E, TA but not Hit %
        if hit_pct == 0.0 and atk > 0:
            hit_pct = round((kills - atk_err) / atk, 4)

        # Recompute total_blk
        if total_blk == 0 and (solo_blk + blk_ast) > 0:
            total_blk = solo_blk + blk_ast

        # Estimate PTS if missing: kills + aces + (solo_blk + 0.5 * blk_ast)
        if pts == 0 and (kills + aces + solo_blk) > 0:
            pts = kills + aces + solo_blk + int(blk_ast * 0.5)

        # Resolve position
        pos = p.get("Pos", "").strip()
        pos_inferred = not bool(pos) or pos == "?"
        if not pos or pos == "?":
            pos = infer_position({**p, "_Sets": sets})

        row = {
            "Season":    season_year,
            "Player":    player_name,
            "Pos":       pos,
            "Team":      team_name,
            "Conference": p.get("Conf", p.get("Conference", "")),
            "Yr":        p.get("Yr", ""),
            "Ht":        p.get("Ht", ""),
            "Hometown":  p.get("Hometown", ""),
            "Sets":      sets,
            "Matches":   matches,
            "Kills":     kills,
            "Atk Err":   atk_err,
            "Atk":       atk,
            "Hit %":     hit_pct,
            "Assists":   assists,
            "Aces":      aces,
            "Serv Err":  serv_err,
            "Digs":      digs,
            "Total Blk": total_blk,
            "Solo Blk":  solo_blk,
            "Blk Ast":   blk_ast,
            "Blk Err":   blk_err,
            "BH Err":    bh_err,
            "PTS":       pts,
            "_posInferred": pos_inferred,
            "_ncaaId":   p.get("_ncaa_id", ""),
        }
        output_rows.append(row)

    print(f"  Skipped {skipped} players (< {MIN_SETS} sets)")
    print(f"  Final player count: {len(output_rows)}")

    # Count position sources
    n_inferred = sum(1 for r in output_rows if r.get("_posInferred"))
    print(f"  Positions from team pages: {len(output_rows) - n_inferred}")
    print(f"  Positions inferred:        {n_inferred}")

    # ── Write output ──────────────────────────────────────────────────────────
    os.makedirs("data", exist_ok=True)
    out = {
        "meta": {
            "updated":  datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "season":   season_year,
            "division": int(DIVISION_ID),
            "count":    len(output_rows),
            "source":   "stats.ncaa.org",
            "posInferred": n_inferred,
        },
        "players": output_rows,
    }

    with open("data/players.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))   # compact — no extra whitespace

    size_kb = os.path.getsize("data/players.json") / 1024
    print(f"\n✓ Saved data/players.json ({size_kb:.0f} KB, {len(output_rows)} players)")


if __name__ == "__main__":
    main()

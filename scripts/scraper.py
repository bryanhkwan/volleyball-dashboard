#!/usr/bin/env python3
"""
NCAA Women's Volleyball Stats Scraper v2
=========================================
Uses ncaa-api.henrygd.me — a public JSON proxy for ncaa.com data.
This avoids the 403 blocks that stats.ncaa.org serves to datacenter IPs
(GitHub Actions, etc.).

Stat pages fetched (IDs on ncaa.com):
  1 = Hitting %       (K, E, TA, Pct)  ← most complete, covers errors
  2 = Kills/Set       (K, S)
  3 = Assists/Set     (A, S)
  4 = Service Aces    (SA, SE, S)       ← also gets service errors
  5 = Digs/Set        (D, S)
  6 = Blocks/Set      (BS, BA, TB, S)   ← solo + assist + total
  7 = Points/Set      (PTS, S)

Pages are paginated (25 players per page).
Positions are inferred from stats since ncaa.com rankings don't include them.
"""

import requests, json, re, time, os, sys
from datetime import datetime, timezone
from collections import defaultdict

# ─── Config ────────────────────────────────────────────────────────────────────
BASE         = "https://ncaa-api.henrygd.me"
SPORT        = "volleyball-women"
DIV          = "d1"
SEASON_YEAR  = 2025     # Label written into JSON (Fall 2024 season)
MIN_SETS     = 10
MAX_PAGES    = 60       # Safety cap — 60 pages × 25 players = 1500 players max
REQ_DELAY    = 0.8      # seconds between requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; vball-scraper/2.0)",
    "Accept": "application/json",
}

# Stat category IDs to fetch from ncaa.com via the proxy
# Each returns a different set of columns
STAT_IDS = [1, 2, 3, 4, 5, 6, 7]

# ─── HTTP ──────────────────────────────────────────────────────────────────────
def fetch(url, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code == 404:
                return None          # no more pages
            r.raise_for_status()
            time.sleep(REQ_DELAY)
            return r.json()
        except requests.exceptions.HTTPError as e:
            print(f"    HTTP {r.status_code} — {url}")
            return None
        except Exception as e:
            wait = REQ_DELAY * (attempt + 1) * 2
            print(f"    retry {attempt+1}/{retries}: {e} — waiting {wait:.0f}s")
            time.sleep(wait)
    print(f"    FAILED: {url}")
    return None

# ─── JSON response parser ──────────────────────────────────────────────────────
def extract_rows(data):
    """
    ncaa-api can return various shapes. Try to find the list of row dicts.
    """
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "rows", "players", "results", "items", "stats"):
            if key in data and isinstance(data[key], list):
                return data[key]
        # Fall back: return the first list value found
        for v in data.values():
            if isinstance(v, list) and len(v) > 0:
                return v
    return []

def num(row, *keys, is_float=False):
    """Extract a numeric value from a row dict, trying multiple key names."""
    for k in keys:
        for variant in (k, k.lower(), k.upper(), k.title()):
            v = row.get(variant)
            if v is not None and str(v).strip() not in ("", "-", "—"):
                try:
                    return float(str(v).replace(",", "")) if is_float \
                           else int(float(str(v).replace(",", "")))
                except (ValueError, TypeError):
                    pass
    return 0.0 if is_float else 0

def str_val(row, *keys):
    for k in keys:
        for variant in (k, k.lower(), k.upper(), k.title()):
            v = row.get(variant)
            if v and str(v).strip():
                return str(v).strip()
    return ""

def parse_row(row, stat_id):
    """
    Parse one player row from a stat page.
    Returns a partial player dict with whatever columns that page provides.
    """
    name = str_val(row, "Player", "Name", "player", "name")
    team = str_val(row, "Team", "team")
    conf = str_val(row, "Conf", "Conference", "conf", "conference")

    if not name or not team:
        return None
    if name.lower() in ("player", "name", "totals", "team", "opponent"):
        return None

    p = {
        "Player":   name,
        "Team":     team,
        "Conf":     conf,
        "_Sets":    num(row, "S", "Sets", "sets"),
        "_Matches": num(row, "GP", "G", "Matches", "matches"),
    }

    if stat_id == 1:   # Hitting %: K E TA Pct
        p["Kills"]   = num(row, "K", "Kills")
        p["Atk Err"] = num(row, "E", "Errors", "Err")
        p["Atk"]     = num(row, "TA", "Total Att", "Att")
        p["Hit %"]   = num(row, "Pct", "PCT", "HitPct", is_float=True)

    elif stat_id == 2: # Kills/Set
        p["Kills"]   = num(row, "K", "Kills")

    elif stat_id == 3: # Assists/Set
        p["Assists"] = num(row, "A", "Assists", "Ast")

    elif stat_id == 4: # Service Aces (also has service errors)
        p["Aces"]     = num(row, "SA", "Aces")
        p["Serv Err"] = num(row, "SE", "SErr", "Serv Err", "Service Errors")

    elif stat_id == 5: # Digs/Set
        p["Digs"]    = num(row, "D", "Digs")

    elif stat_id == 6: # Blocks/Set: BS BA TB
        p["Solo Blk"]  = num(row, "BS", "Block Solos", "BSolo")
        p["Blk Ast"]   = num(row, "BA", "Block Assists", "BAst")
        p["Total Blk"] = num(row, "TB", "Total Blocks", "TBlk")

    elif stat_id == 7: # Points/Set
        p["PTS"] = num(row, "PTS", "Pts", "Points")

    return p

# ─── Position inference ────────────────────────────────────────────────────────
def infer_position(p):
    """
    Infer volleyball position from season stats.
    Accuracy: S ~95%, L/DS ~92%, MB ~80%, OH/OPP ~70%.
    """
    sets     = max(p.get("Sets", 1), 1)
    kills_s  = p.get("Kills",     0) / sets
    digs_s   = p.get("Digs",      0) / sets
    asst_s   = p.get("Assists",   0) / sets
    solo     = p.get("Solo Blk",  0)
    ast      = p.get("Blk Ast",   0)
    blk_s    = (p.get("Total Blk", solo + ast)) / sets
    hit_pct  = p.get("Hit %",     0.0)
    aces_s   = p.get("Aces",      0) / sets

    # Setter: dominant assists
    if asst_s >= 5.0:                                    return "S"
    if asst_s >= 3.0 and kills_s < 1.5:                  return "S"

    # Libero/DS: dominant digs, near-zero attack
    if digs_s >= 3.5 and kills_s <= 0.3:                 return "L/DS"
    if digs_s >= 2.5 and kills_s <= 0.2:                 return "L/DS"

    # Middle Blocker: high blocks + efficient hitting + low digs
    if blk_s >= 0.8 and hit_pct >= 0.15 and digs_s <= 1.2: return "MB"
    if blk_s >= 0.5 and digs_s <= 0.9:                   return "MB"

    # Opposite: strong offense, limited back-row
    if kills_s >= 2.0 and digs_s < 1.0 and blk_s >= 0.3:  return "OPP"
    if kills_s >= 1.5 and digs_s < 0.8:                  return "OPP"

    # Outside Hitter: balanced offense + defense
    if kills_s >= 1.5 and digs_s >= 1.0:                 return "OH"

    # Fallback
    if digs_s >= kills_s * 2:                            return "L/DS"
    if kills_s >= 1.0:                                   return "OH"
    if asst_s >= 1.5:                                    return "S"
    return "OH"

# ─── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("NCAA WVB Scraper v2  —  using ncaa-api.henrygd.me")
    print(f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # player_key -> merged data dict
    # key = "PlayerName|||TeamName" (best we can do without player IDs from this API)
    all_players = defaultdict(dict)

    for stat_id in STAT_IDS:
        total_rows = 0
        print(f"\n[stat_id={stat_id}] Fetching pages...")

        for page in range(1, MAX_PAGES + 1):
            if page == 1:
                url = f"{BASE}/stats/{SPORT}/{DIV}/current/individual/{stat_id}"
            else:
                url = f"{BASE}/stats/{SPORT}/{DIV}/current/individual/{stat_id}/p{page}"

            data = fetch(url)
            if data is None:
                print(f"  page {page}: no data — stopping")
                break

            rows = extract_rows(data)
            if not rows:
                print(f"  page {page}: empty — stopping")
                break

            page_count = 0
            for row in rows:
                parsed = parse_row(row, stat_id)
                if not parsed:
                    continue

                key = f"{parsed['Player']}|||{parsed['Team']}"
                existing = all_players[key]

                # Identity fields
                existing["Player"] = parsed["Player"]
                existing["Team"]   = parsed["Team"]
                if parsed.get("Conf"):
                    existing["Conf"] = parsed["Conf"]

                # Sets/Matches — keep highest value seen
                if parsed.get("_Sets", 0) > existing.get("_Sets", 0):
                    existing["_Sets"] = parsed["_Sets"]
                if parsed.get("_Matches", 0) > existing.get("_Matches", 0):
                    existing["_Matches"] = parsed["_Matches"]

                # Stats — first write wins (stat_id=1 has highest priority for K/E/TA/Hit%)
                for field in ("Kills", "Atk Err", "Atk", "Hit %",
                              "Assists", "Aces", "Serv Err", "Digs",
                              "Solo Blk", "Blk Ast", "Total Blk", "PTS"):
                    if field in parsed and field not in existing:
                        existing[field] = parsed[field]

                page_count += 1

            total_rows += page_count
            print(f"  page {page}: {page_count} players (running total: {total_rows})")

            # If we got fewer than 20 rows this page, this is the last page
            if page_count < 20:
                break

        print(f"  → stat_id={stat_id} complete: {total_rows} player rows")

    print(f"\n[merge] Total unique players: {len(all_players)}")

    # ── Build final output ────────────────────────────────────────────────────
    output_rows = []
    skipped = 0

    for key, p in all_players.items():
        if not p.get("Player") or not p.get("Team"):
            continue

        sets = int(p.get("_Sets", 0))
        if sets < MIN_SETS:
            skipped += 1
            continue

        kills    = int(p.get("Kills",     0))
        atk_err  = int(p.get("Atk Err",   0))
        atk      = int(p.get("Atk",       0))
        hit_pct  = float(p.get("Hit %",   0.0))
        assists  = int(p.get("Assists",   0))
        aces     = int(p.get("Aces",      0))
        serv_err = int(p.get("Serv Err",  0))
        digs     = int(p.get("Digs",      0))
        solo_blk = int(p.get("Solo Blk",  0))
        blk_ast  = int(p.get("Blk Ast",   0))
        total_blk= int(p.get("Total Blk", solo_blk + blk_ast))
        pts      = int(p.get("PTS",       0))
        matches  = int(p.get("_Matches",  0))

        # Recompute Hit % if we have K, E, TA but hit% is 0
        if hit_pct == 0.0 and atk > 0:
            hit_pct = round((kills - atk_err) / atk, 4)

        # Recompute total_blk
        if total_blk == 0 and (solo_blk + blk_ast) > 0:
            total_blk = solo_blk + blk_ast

        # Estimate PTS if missing
        if pts == 0 and (kills + aces + solo_blk) > 0:
            pts = kills + aces + solo_blk + round(blk_ast * 0.5)

        row = {
            "Season":     SEASON_YEAR,
            "Player":     p["Player"],
            "Pos":        "",          # filled below
            "Team":       p["Team"],
            "Conference": p.get("Conf", ""),
            "Sets":       sets,
            "Matches":    matches,
            "Kills":      kills,
            "Atk Err":    atk_err,
            "Atk":        atk,
            "Hit %":      hit_pct,
            "Assists":    assists,
            "Aces":       aces,
            "Serv Err":   serv_err,
            "Digs":       digs,
            "Total Blk":  total_blk,
            "Solo Blk":   solo_blk,
            "Blk Ast":    blk_ast,
            "Blk Err":    0,
            "BH Err":     0,
            "PTS":        pts,
        }

        row["Pos"] = infer_position(row)
        output_rows.append(row)

    print(f"[output] Skipped {skipped} players (< {MIN_SETS} sets)")
    print(f"[output] Final player count: {len(output_rows)}")

    if len(output_rows) < 100:
        print("ERROR: Too few players — ncaa-api may be down or returning unexpected data")
        print("Sample of raw data collected:")
        for k, v in list(all_players.items())[:3]:
            print(f"  {k}: {v}")
        sys.exit(1)

    # ── Position breakdown ────────────────────────────────────────────────────
    from collections import Counter
    pos_counts = Counter(r["Pos"] for r in output_rows)
    print(f"[output] Positions: { dict(pos_counts) }")

    # ── Write JSON ────────────────────────────────────────────────────────────
    os.makedirs("data", exist_ok=True)
    out = {
        "meta": {
            "updated":    datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "season":     SEASON_YEAR,
            "division":   1,
            "count":      len(output_rows),
            "source":     "ncaa-api.henrygd.me → ncaa.com",
            "posInferred": len(output_rows),   # all positions are inferred
        },
        "players": output_rows,
    }

    with open("data/players.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))

    kb = os.path.getsize("data/players.json") / 1024
    print(f"\n✓ Saved data/players.json  ({kb:.0f} KB, {len(output_rows)} players)")


if __name__ == "__main__":
    main()

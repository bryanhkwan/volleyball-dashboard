#!/usr/bin/env python3
"""
Process volleyball CSV files into structured JSON for dashboard.
Handles Team Stats, Setter Stats, and Exhibition data.
"""

import csv
import json
import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Base paths
BASE_DIR = Path(__file__).parent
SPRING_DIR = BASE_DIR / "Spring 2026"
OUTPUT_FILE = BASE_DIR / "processed_data.json"

def parse_date_from_filename(filename):
    """Extract date from filename like '03.10 Practice.csv' -> 2026-03-10"""
    match = re.match(r'(\d{2})\.(\d{2})', filename)
    if match:
        month, day = match.groups()
        return f"2026-{month}-{day}"
    return None

def normalize_player_name(raw_name):
    """Clean player name: '#4 Olivia H.' -> 'Olivia H.'"""
    if not raw_name:
        return None
    name = re.sub(r'^["\']*#?\d+\s+', '', raw_name)
    name = re.sub(r'["\']$', '', name)
    name = name.strip()

    # Skip aggregate/team-total rows that the Hudl export mixes in with players.
    lower = name.lower()
    AGGREGATE_NAMES = {
        'team a', 'team b', 'team', 'team total', 'totals', 'total',
        'opponent', 'opponents',
        "toledo women's volleyball",
        'toledo womens volleyball',
        'toledo',
        ''
    }
    if lower in AGGREGATE_NAMES:
        return None
    if 'toledo' in lower and 'volleyball' in lower:
        return None
    return name

def parse_stat_value(val):
    """Convert stat value to float or None"""
    if val is None or val == '' or (isinstance(val, str) and val.strip() == ''):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def parse_csv_file(filepath):
    """Parse a single CSV file and return list of player stat dicts"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = []
            for row in reader:
                player_name = normalize_player_name(row.get('Name', ''))
                if not player_name:
                    continue
                
                # Parse all stats
                stats = {
                    'name': player_name,
                    # Attack
                    'attack_k': parse_stat_value(row.get('Attack K')),
                    'attack_e': parse_stat_value(row.get('Attack E')),
                    'attack_ta': parse_stat_value(row.get('Attack TA')),
                    'attack_pct': parse_stat_value(row.get('Attack Atk%')),
                    'attack_k_per_set': parse_stat_value(row.get('Attack K/S')),
                    # Serve
                    'serve_sa': parse_stat_value(row.get('Serve SA')),
                    'serve_se': parse_stat_value(row.get('Serve SE')),
                    'serve_ta': parse_stat_value(row.get('Serve TA')),
                    'serve_pct': parse_stat_value(row.get('Serve Pct')),
                    'serve_eff': parse_stat_value(row.get('Serve Eff')),
                    'serve_rtg': parse_stat_value(row.get('Serve Rtg.')),
                    # Receive
                    'receive_3': parse_stat_value(row.get('Receive 3')),
                    'receive_2': parse_stat_value(row.get('Receive 2')),
                    'receive_1': parse_stat_value(row.get('Receive 1')),
                    'receive_0': parse_stat_value(row.get('Receive 0')),
                    'receive_ta': parse_stat_value(row.get('Receive TA')),
                    'receive_pass_pct': parse_stat_value(row.get('Receive Pass%')),
                    # Set
                    'set_ast': parse_stat_value(row.get('Set Ast')),
                    'set_ta': parse_stat_value(row.get('Set TA')),
                    'set_se': parse_stat_value(row.get('Set SE')),
                    'set_3': parse_stat_value(row.get('Set 3')),
                    'set_2': parse_stat_value(row.get('Set 2')),
                    'set_1': parse_stat_value(row.get('Set 1')),
                    'set_0': parse_stat_value(row.get('Set 0')),
                    'set_rtg': parse_stat_value(row.get('Set Rtg.')),
                    # Dig
                    'dig_ds': parse_stat_value(row.get('Dig DS')),
                    'dig_de': parse_stat_value(row.get('Dig DE')),
                    # Block
                    'block_bs': parse_stat_value(row.get('Block BS')),
                    'block_ba': parse_stat_value(row.get('Block BA')),
                    'block_be': parse_stat_value(row.get('Block BE')),
                    'block_per_set': parse_stat_value(row.get('Block B/S')),
                    # Overall
                    'points': parse_stat_value(row.get('Points Pts +/-')),
                    'sets_played': parse_stat_value(row.get('Sets Sets Played')),
                }
                
                # Only include if player has some stats
                if any(v is not None for k, v in stats.items() if k != 'name'):
                    rows.append(stats)
            
            return rows
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return []

def process_team_stats():
    """Process all Team Stats practice files"""
    team_stats_dir = SPRING_DIR / "Team Stats"
    practices = []
    
    for csv_file in sorted(team_stats_dir.glob("*.csv")):
        date = parse_date_from_filename(csv_file.name)
        if not date:
            continue
        
        player_stats = parse_csv_file(csv_file)
        if player_stats:
            practices.append({
                'date': date,
                'type': 'practice',
                'category': 'team',
                'players': player_stats
            })
    
    return practices

def process_setter_stats():
    """Process all Setter Stats practice files"""
    setter_stats_dir = SPRING_DIR / "Setter Stats"
    practices = defaultdict(list)  # {date: {setter: [players]}}
    
    for csv_file in sorted(setter_stats_dir.glob("*.csv")):
        # Parse filename: "03.10 Practice Gabbi.csv"
        match = re.match(r'(\d{2})\.(\d{2}) Practice (\w+)\.csv', csv_file.name)
        if not match:
            continue
        
        month, day, setter_name = match.groups()
        date = f"2026-{month}-{day}"
        
        player_stats = parse_csv_file(csv_file)
        if player_stats:
            practices[date].append({
                'setter': setter_name,
                'players': player_stats
            })
    
    # Convert to list format
    practice_list = []
    for date, setter_data in sorted(practices.items()):
        practice_list.append({
            'date': date,
            'type': 'practice',
            'category': 'setter',
            'setters': setter_data
        })
    
    return practice_list

def process_exhibitions():
    """Process all Exhibition game files"""
    exhibitions = []
    
    # Team exhibitions
    team_exh_dir = SPRING_DIR / "Exhibitions" / "Team Exhibition"
    for csv_file in sorted(team_exh_dir.glob("*.csv")):
        # Parse: "04.19 Exhibition Michigan.csv"
        match = re.match(r'(\d{2})\.(\d{2}) Exhibition (.+)\.csv', csv_file.name)
        if not match:
            continue
        
        month, day, opponent = match.groups()
        date = f"2026-{month}-{day}"
        
        player_stats = parse_csv_file(csv_file)
        if player_stats:
            exhibitions.append({
                'date': date,
                'type': 'exhibition',
                'category': 'team',
                'opponent': opponent.strip(),
                'players': player_stats
            })
    
    # Setter exhibitions
    setter_exh_dir = SPRING_DIR / "Exhibitions" / "Setter Exhibition"
    setter_games = defaultdict(lambda: defaultdict(list))  # {date: {opponent: [setter_data]}}
    
    for csv_file in sorted(setter_exh_dir.glob("*.csv")):
        # Parse: "04.19 Michigan Gabbi.csv"
        match = re.match(r'(\d{2})\.(\d{2}) (.+?) (\w+)\.csv', csv_file.name)
        if not match:
            continue
        
        month, day, opponent, setter_name = match.groups()
        date = f"2026-{month}-{day}"
        
        player_stats = parse_csv_file(csv_file)
        if player_stats:
            setter_games[date][opponent].append({
                'setter': setter_name,
                'players': player_stats
            })
    
    # Add setter data to exhibitions
    for exh in exhibitions:
        if exh['date'] in setter_games:
            opponent_key = list(setter_games[exh['date']].keys())[0]
            exh['setters'] = setter_games[exh['date']][opponent_key]
    
    return exhibitions

def build_player_index(all_sessions):
    """Build player-centric index from all sessions"""
    players = defaultdict(lambda: {
        'practices': [],
        'exhibitions': [],
        'name': None
    })
    
    for session in all_sessions:
        is_exhibition = session['type'] == 'exhibition'
        
        # Handle team stats
        if 'players' in session:
            for player_stats in session['players']:
                player_name = player_stats['name']
                players[player_name]['name'] = player_name
                
                entry = {
                    'date': session['date'],
                    'stats': player_stats
                }
                
                if is_exhibition:
                    entry['opponent'] = session.get('opponent')
                    players[player_name]['exhibitions'].append(entry)
                else:
                    players[player_name]['practices'].append(entry)
        
        # Handle setter-specific stats
        if 'setters' in session:
            for setter_data in session['setters']:
                setter_name = setter_data['setter']
                for player_stats in setter_data['players']:
                    player_name = player_stats['name']
                    players[player_name]['name'] = player_name
                    
                    entry = {
                        'date': session['date'],
                        'setter': setter_name,
                        'stats': player_stats
                    }
                    
                    if is_exhibition:
                        entry['opponent'] = session.get('opponent')
                        players[player_name]['exhibitions'].append(entry)
                    else:
                        players[player_name]['practices'].append(entry)
    
    # Convert to list and sort
    player_list = []
    for player_name, data in sorted(players.items()):
        data['practices'].sort(key=lambda x: x['date'])
        data['exhibitions'].sort(key=lambda x: x['date'])
        player_list.append(data)
    
    return player_list

def build_setter_index(all_sessions):
    """Build setter-centric index"""
    setters = {
        'Gabbi': {'practices': [], 'exhibitions': []},
        'Janelle': {'practices': [], 'exhibitions': []},
        'Maddy': {'practices': [], 'exhibitions': []}
    }
    
    for session in all_sessions:
        if 'setters' not in session:
            continue
        
        is_exhibition = session['type'] == 'exhibition'
        
        for setter_data in session['setters']:
            setter_name = setter_data['setter']
            if setter_name not in setters:
                continue
            
            entry = {
                'date': session['date'],
                'players': setter_data['players']
            }
            
            if is_exhibition:
                entry['opponent'] = session.get('opponent')
                setters[setter_name]['exhibitions'].append(entry)
            else:
                setters[setter_name]['practices'].append(entry)
    
    return setters

def main():
    print("🏐 Processing volleyball stats...")
    
    # Process all data sources
    print("  📊 Processing team practice stats...")
    team_practices = process_team_stats()
    print(f"     Found {len(team_practices)} team practice sessions")
    
    print("  🎯 Processing setter practice stats...")
    setter_practices = process_setter_stats()
    print(f"     Found {len(setter_practices)} setter practice sessions")
    
    print("  🏆 Processing exhibition games...")
    exhibitions = process_exhibitions()
    print(f"     Found {len(exhibitions)} exhibition games")
    
    # Combine all sessions
    all_sessions = team_practices + setter_practices + exhibitions
    all_sessions.sort(key=lambda x: x['date'])
    
    # Build indices
    print("  👥 Building player index...")
    players = build_player_index(all_sessions)
    print(f"     Indexed {len(players)} players")
    
    print("  🏐 Building setter index...")
    setters = build_setter_index(all_sessions)
    
    # Create output structure
    output = {
        'metadata': {
            'processed_at': datetime.now().isoformat(),
            'season': 'Spring 2026',
            'total_practices': len([s for s in all_sessions if s['type'] == 'practice']),
            'total_exhibitions': len([s for s in all_sessions if s['type'] == 'exhibition']),
            'total_players': len(players),
            'date_range': {
                'start': all_sessions[0]['date'] if all_sessions else None,
                'end': all_sessions[-1]['date'] if all_sessions else None
            }
        },
        'sessions': all_sessions,
        'players': players,
        'setters': setters
    }
    
    # Write to file
    print(f"  💾 Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    file_size = OUTPUT_FILE.stat().st_size / 1024
    print(f"  ✅ Done! Output: {file_size:.1f} KB")
    print(f"\n📈 Summary:")
    print(f"   • {output['metadata']['total_practices']} practice sessions")
    print(f"   • {output['metadata']['total_exhibitions']} exhibition games")
    print(f"   • {output['metadata']['total_players']} unique players")
    print(f"   • Date range: {output['metadata']['date_range']['start']} to {output['metadata']['date_range']['end']}")

if __name__ == '__main__':
    main()

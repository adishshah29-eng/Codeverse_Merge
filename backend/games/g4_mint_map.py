from typing import Dict, Any, List, Optional

ROOMS = [
    {"id": 0,  "name": "Vault Entrance",      "zone": "Restricted",   "risk": 5,  "time": 0, "window": [0, 999], "type": "start", "x": 60,  "y": 270},
    {"id": 1,  "name": "Ventilation Shaft",   "zone": "Blindspot",    "risk": 14, "time": 4, "window": [21, 83],  "type": "mid",   "x": 160, "y": 120},
    {"id": 2,  "name": "Sub-Vault Tunnel",    "zone": "Low-Traffic",  "risk": 18, "time": 3, "window": [8, 74],   "type": "mid",   "x": 160, "y": 270},
    {"id": 3,  "name": "Security Hall",       "zone": "Guard Post",   "risk": 45, "time": 2, "window": [36, 79],  "type": "mid",   "x": 160, "y": 420},
    {"id": 4,  "name": "Server Room",         "zone": "Surveillance", "risk": 35, "time": 3, "window": [31, 82],  "type": "mid",   "x": 260, "y": 90},
    {"id": 5,  "name": "Melt Chamber",        "zone": "Industrial",   "risk": 25, "time": 4, "window": [15, 75],  "type": "mid",   "x": 260, "y": 210},
    {"id": 6,  "name": "Old Boiler Room",     "zone": "Low-Traffic",  "risk": 20, "time": 5, "window": [40, 79],  "type": "mid",   "x": 260, "y": 330},
    {"id": 7,  "name": "Sorting Office",      "zone": "Industrial",   "risk": 40, "time": 3, "window": [29, 82],  "type": "mid",   "x": 260, "y": 450},
    {"id": 8,  "name": "Camera Blindspot",    "zone": "Blindspot",    "risk": 12, "time": 3, "window": [38, 94],  "type": "mid",   "x": 370, "y": 110},
    {"id": 9,  "name": "Printing Press",      "zone": "Industrial",   "risk": 50, "time": 4, "window": [51, 95],  "type": "mid",   "x": 370, "y": 230},
    {"id": 10, "name": "Storage Bay A",       "zone": "Low-Traffic",  "risk": 22, "time": 5, "window": [46, 82],  "type": "mid",   "x": 370, "y": 350},
    {"id": 11, "name": "Security Office",     "zone": "Guard Post",   "risk": 65, "time": 2, "window": [41, 83],  "type": "mid",   "x": 370, "y": 470},
    {"id": 12, "name": "Roof Access",         "zone": "Surveillance", "risk": 42, "time": 3, "window": [39, 100], "type": "mid",   "x": 480, "y": 90},
    {"id": 13, "name": "Archive Vault",       "zone": "Restricted",   "risk": 55, "time": 4, "window": [69, 93],  "type": "mid",   "x": 480, "y": 210},
    {"id": 14, "name": "Maintenance Tunnel",  "zone": "Blindspot",    "risk": 16, "time": 4, "window": [51, 95],  "type": "mid",   "x": 480, "y": 330},
    {"id": 15, "name": "Loading Bay",         "zone": "Industrial",   "risk": 36, "time": 3, "window": [45, 101], "type": "mid",   "x": 480, "y": 450},
    {"id": 16, "name": "Emergency Stairwell", "zone": "Low-Traffic",  "risk": 28, "time": 4, "window": [72, 112], "type": "mid",   "x": 580, "y": 120},
    {"id": 17, "name": "Drainage Canal",      "zone": "Low-Traffic",  "risk": 15, "time": 5, "window": [51, 109], "type": "mid",   "x": 580, "y": 230},
    {"id": 18, "name": "Armory Corridor",     "zone": "Guard Post",   "risk": 58, "time": 2, "window": [67, 109], "type": "mid",   "x": 580, "y": 340},
    {"id": 19, "name": "Control Checkpoint",  "zone": "Surveillance", "risk": 48, "time": 3, "window": [66, 100], "type": "mid",   "x": 580, "y": 450},
    {"id": 20, "name": "Exit Gate",           "zone": "Restricted",   "risk": 5,  "time": 0, "window": [0, 999], "type": "end",   "x": 680, "y": 270},
]

EDGES = [
    {"from": 0,  "to": 1,  "travel_time": 4},
    {"from": 0,  "to": 2,  "travel_time": 5},
    {"from": 0,  "to": 3,  "travel_time": 3},
    {"from": 1,  "to": 4,  "travel_time": 4},
    {"from": 1,  "to": 5,  "travel_time": 5},
    {"from": 2,  "to": 5,  "travel_time": 3},
    {"from": 2,  "to": 6,  "travel_time": 4},
    {"from": 3,  "to": 6,  "travel_time": 4},
    {"from": 3,  "to": 7,  "travel_time": 3},
    {"from": 4,  "to": 8,  "travel_time": 4},
    {"from": 4,  "to": 9,  "travel_time": 5},
    {"from": 5,  "to": 8,  "travel_time": 3},
    {"from": 5,  "to": 9,  "travel_time": 4},
    {"from": 6,  "to": 10, "travel_time": 3},
    {"from": 6,  "to": 11, "travel_time": 4},
    {"from": 7,  "to": 10, "travel_time": 4},
    {"from": 7,  "to": 11, "travel_time": 3},
    {"from": 8,  "to": 12, "travel_time": 4},
    {"from": 8,  "to": 13, "travel_time": 5},
    {"from": 9,  "to": 13, "travel_time": 4},
    {"from": 9,  "to": 14, "travel_time": 4},
    {"from": 10, "to": 14, "travel_time": 3},
    {"from": 10, "to": 15, "travel_time": 4},
    {"from": 11, "to": 14, "travel_time": 4},
    {"from": 11, "to": 15, "travel_time": 3},
    {"from": 12, "to": 16, "travel_time": 4},
    {"from": 12, "to": 17, "travel_time": 5},
    {"from": 13, "to": 16, "travel_time": 4},
    {"from": 13, "to": 17, "travel_time": 4},
    {"from": 14, "to": 17, "travel_time": 3},
    {"from": 14, "to": 18, "travel_time": 4},
    {"from": 15, "to": 18, "travel_time": 4},
    {"from": 15, "to": 19, "travel_time": 3},
    {"from": 16, "to": 20, "travel_time": 5},
    {"from": 17, "to": 20, "travel_time": 4},
    {"from": 18, "to": 20, "travel_time": 5},
    {"from": 19, "to": 20, "travel_time": 6},
]

START_ID = 0
EXIT_ID = 20
ROOM_BY_ID = {r["id"]: r for r in ROOMS}

ADJ: Dict[int, List[tuple]] = {r["id"]: [] for r in ROOMS}
for _e in EDGES:
    ADJ[_e["from"]].append((_e["to"], _e["travel_time"]))
    ADJ[_e["to"]].append((_e["from"], _e["travel_time"]))

def get_travel_time(a: int, b: int) -> Optional[int]:
    for nid, tt in ADJ.get(a, []):
        if nid == b:
            return tt
    return None

def get_map_dataset() -> Dict[str, Any]:
    return {
        "rooms": ROOMS,
        "edges": EDGES,
        "start_id": START_ID,
        "exit_id": EXIT_ID
    }

def evaluate_mint_route(route: List[int]) -> Dict[str, Any]:
    if not route or route[0] != START_ID:
        return {"valid": False, "passed": False, "message": "Infiltration route must begin at Room 0 (Vault Entrance)."}
    if route[-1] != EXIT_ID:
        return {"valid": False, "passed": False, "message": f"Infiltration route must terminate at Room {EXIT_ID} (Exit Gate)."}
    if any(rid not in ROOM_BY_ID for rid in route):
        return {"valid": False, "passed": False, "message": "Route contains an unmapped chamber."}
    if len(set(route)) != len(route):
        return {"valid": False, "passed": False, "message": "Chambers cannot be revisited (loop detected)."}

    for a, b in zip(route, route[1:]):
        tt = get_travel_time(a, b)
        if tt is None:
            return {"valid": False, "passed": False, "message": f"No traversable corridor connects Room {a} and Room {b}."}

    clock = 0
    risk = 0
    failures = []

    for i, rid in enumerate(route):
        room = ROOM_BY_ID[rid]
        if i > 0:
            tt = get_travel_time(route[i - 1], rid)
            clock += tt + room["time"]
            risk += room["risk"]
            
        lo, hi = room["window"]
        if not (lo <= clock <= hi):
            failures.append({
                "room": room["name"],
                "chamber_id": rid,
                "arrived": clock,
                "window": [lo, hi],
                "reason": "too early" if clock < lo else "too late (patrol intercepted)"
            })

    cost = risk + 2 * clock
    passed = (len(failures) == 0)

    if passed:
        msg = f"ESCAPE ROUTE VERIFIED: Infiltration succeeded! Total Cost: {cost} (Risk: {risk}, Time: {clock} min)."
    else:
        failed_names = ", ".join(f["room"] for f in failures)
        msg = f"SECURITY BREACH: Patrol window violation in chamber(s): {failed_names}."

    return {
        "valid": True,
        "passed": passed,
        "risk": risk,
        "time": clock,
        "cost": cost,
        "failures": failures,
        "message": msg
    }

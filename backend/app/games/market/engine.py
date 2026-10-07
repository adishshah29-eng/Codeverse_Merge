"""
Black Market Engine (Parallel Side Economy)
Enforces:
1. Team-specific price inflation (One team's purchases NEVER affect another team's prices)
2. Authoritative wallet balance and deductions
3. Advantage item catalog (intel hints, buffs, mystery assets)
4. Purchase ledger audit trail
"""
from typing import Any, Dict, List, Optional, Tuple

MARKET_CATALOG = {
    "hints": [
        {
            "id": "hint_stage1_anomaly",
            "name": "INTEL // Stage 1 Ledger Anomaly",
            "description": "Reveals the rogue employee ID and target transaction from the insider breach.",
            "price": 1000,
            "max_purchases": 1,
            "stage_id": 1,
            "intel": "Rogue Employee: EMP-4091 (Viktor Brandt). Target Transfer: TXN-884920 on TERM-SEC-09.",
        },
        {
            "id": "hint_stage2_injection",
            "name": "INTEL // Stage 2 SQLi Vector",
            "description": "Exposes the exact tautology syntax accepted by the Teller login portal.",
            "price": 1200,
            "max_purchases": 1,
            "stage_id": 2,
            "intel": "Use tautology: ' OR '1'='1 in both user and pass fields. Avoid -- or ; or 2=2 decoys.",
        },
        {
            "id": "hint_stage3_safe_nodes",
            "name": "INTEL // Stage 3 Safe Corridors",
            "description": "Identifies the lowest-risk intermediate checkpoints for the escape route.",
            "price": 1500,
            "max_purchases": 1,
            "stage_id": 3,
            "intel": "Corridors via N15 and N30 have risk < 2.0 and stay open through t=45.",
        },
    ],
    "buffs": [
        {
            "id": "buff_risk_reducer",
            "name": "POLICE SCANNER JAMMER",
            "description": "Reduces your accumulated escape risk by 3.0 units.",
            "price": 2000,
            "max_purchases": 2,
            "effect_type": "risk_reduction",
            "effect_value": 3.0,
        },
        {
            "id": "buff_time_shield",
            "name": "COUNTERMEASURE DECOY",
            "description": "Absorbs one incorrect attempt penalty during Final Extraction.",
            "price": 1800,
            "max_purchases": 3,
            "effect_type": "shield",
            "effect_value": 1,
        },
    ],
    "mystery": [
        {
            "id": "mystery_classified_drop",
            "name": "CONTRABAND CACHE #01",
            "description": "Encrypted contraband intercepted from the Royal Mint vaults.",
            "price": 2500,
            "max_purchases": 1,
            "effect_type": "mystery",
            "intel": "Contains emergency vault shutdown frequency: 'MINT-FREQUENCY-912' and +500 Bonus Heist Points.",
        }
    ],
}


# Placeholder in item intel replaced with the configured Stage 4 shutdown code.
SHUTDOWN_CODE_PLACEHOLDER = "MINT-FREQUENCY-912"


def get_item(category: str, item_id: str) -> Optional[Dict[str, Any]]:
    category_items = MARKET_CATALOG.get(category, [])
    for item in category_items:
        if item["id"] == item_id:
            return item
    return None


def calculate_team_item_price(item: Dict[str, Any], team_purchase_count: int, inflation_rate: float) -> int:
    """
    Computes team-specific inflated price.
    Inflation formula: base_price * (1 + inflation_rate * team_purchase_count)
    Strictly isolated per team: team_purchase_count is scoped to the requesting team.
    """
    base_price = item["price"]
    multiplier = 1.0 + (inflation_rate * max(0, team_purchase_count))
    return int(round(base_price * multiplier))


def get_catalog_for_team(team_purchase_count: int, purchased_item_ids: List[str], inflation_rate: float) -> Dict[str, List[Dict[str, Any]]]:
    """Generates the market catalog with personalized prices and purchase states for a specific team."""
    team_catalog = {}
    for category, items in MARKET_CATALOG.items():
        cat_list = []
        for item in items:
            times_bought = purchased_item_ids.count(item["id"])
            is_locked = times_bought >= item.get("max_purchases", 1)
            current_price = calculate_team_item_price(item, team_purchase_count, inflation_rate)

            item_data = dict(item)
            if times_bought == 0:
                item_data.pop("intel", None)
            item_data["current_price"] = current_price
            item_data["times_bought"] = times_bought
            item_data["is_maxed"] = is_locked
            cat_list.append(item_data)
        team_catalog[category] = cat_list
    return team_catalog

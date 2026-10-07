from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team
from ..db import get_db
from ..games.market.engine import (
    SHUTDOWN_CODE_PLACEHOLDER,
    calculate_team_item_price,
    get_catalog_for_team,
    get_item,
)
from ..models import AuditEvent, ConfigKV, MarketPurchase, StageProgress, Team

router = APIRouter(prefix="/api/market", tags=["market"])

def _cfg(db: Session, key: str) -> str:
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not row:
        raise HTTPException(status_code=503, detail=f"Game configuration is missing: {key}")
    return row.value


def _intel(text: str | None, db: Session) -> str | None:
    """Show the actually configured shutdown code in market intel."""
    if not text or SHUTDOWN_CODE_PLACEHOLDER not in text:
        return text
    row = db.query(ConfigKV).filter(ConfigKV.key == "stage4_shutdown_code").one_or_none()
    return text.replace(SHUTDOWN_CODE_PLACEHOLDER, row.value) if row and row.value else text


@router.get("/catalog")
def get_market_catalog(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    """
    Returns the Black Market catalog.
    Prices are scaled with team-specific inflation based strictly on THIS team's purchases.
    """
    purchases = db.query(MarketPurchase).filter(MarketPurchase.team_id == team.id).all()
    purchased_ids = [p.item_id for p in purchases]
    inflation_rate = float(_cfg(db, "market_inflation_rate"))

    catalog = get_catalog_for_team(
        team_purchase_count=team.black_market_purchases,
        purchased_item_ids=purchased_ids,
        inflation_rate=inflation_rate,
    )

    for items in catalog.values():
        for item in items:
            if item.get("intel"):
                item["intel"] = _intel(item["intel"], db)

    return {
        "success": True,
        "team_money": team.money,
        "team_purchases": team.black_market_purchases,
        "black_market_unlocked": team.black_market_unlocked,
        "catalog": catalog,
        "purchased_history": [
            {
                "id": p.id,
                "item_id": p.item_id,
                "category": p.category,
                "price": p.price,
                "created_at": p.created_at.isoformat(),
            }
            for p in purchases
        ],
    }


class PurchaseRequest(BaseModel):
    category: str
    item_id: str


@router.post("/purchase")
def purchase_market_item(
    req: PurchaseRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    # Market must be unlocked for this team
    if not team.black_market_unlocked:
        raise HTTPException(status_code=403, detail="Black Market not unlocked for this team")

    item = get_item(req.category, req.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in Black Market catalog")

    # Check already acquired count for this team
    prior_buys = db.query(MarketPurchase).filter(
        MarketPurchase.team_id == team.id,
        MarketPurchase.item_id == req.item_id,
    ).count()

    if prior_buys >= item.get("max_purchases", 1):
        raise HTTPException(status_code=400, detail="Maximum purchase limit reached for this asset")

    # Compute team-isolated price from server-side config
    inflation_rate = float(_cfg(db, "market_inflation_rate"))
    effective_price = calculate_team_item_price(item, team.black_market_purchases, inflation_rate)

    if team.money < effective_price:
        raise HTTPException(status_code=400, detail="Insufficient heist funds")

    # Deduct funds server-side
    team.money -= effective_price
    team.black_market_purchases += 1

    # Record purchase
    purchase = MarketPurchase(
        team_id=team.id,
        item_id=req.item_id,
        category=req.category,
        price=effective_price,
        created_at=datetime.utcnow(),
    )
    db.add(purchase)

    # Apply item buffs if applicable
    buff_applied = None
    if item.get("effect_type") == "risk_reduction":
        team.risk = max(0.0, team.risk - item["effect_value"])
        buff_applied = f"Accumulated risk decreased by {item.get('effect_value')} units"

    db.add(AuditEvent(
        team_id=team.id,
        event_type="market_purchase",
        payload=f'{{"item_id": "{req.item_id}", "price": {effective_price}, "remaining_money": {team.money}}}',
    ))

    db.commit()

    return {
        "success": True,
        "message": f"Asset {item['name']} acquired successfully!",
        "new_balance": team.money,
        "effective_price": effective_price,
        "intel": _intel(item.get("intel"), db),
        "buff_applied": buff_applied,
        "team_purchases": team.black_market_purchases,
    }


@router.post("/unlock")
def unlock_market(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    """
    Unlock the Black Market. Requires completing at least Stage 1.
    The minimum stage required is configurable via ConfigKV (market_min_completed_stage).
    """
    min_stage = int(_cfg(db, "market_min_completed_stage"))

    # Check that the team has completed the minimum required stage
    completed_stages = [
        p.stage for p in
        db.query(StageProgress).filter(
            StageProgress.team_id == team.id,
            StageProgress.status == "completed",
        ).all()
    ]

    if min_stage not in completed_stages:
        raise HTTPException(
            status_code=403,
            detail=f"Complete Stage {min_stage} before accessing the Black Market.",
        )

    team.black_market_unlocked = True
    db.add(AuditEvent(
        team_id=team.id,
        event_type="market_unlocked",
        payload=f'{{"stage": {team.current_stage}}}',
    ))
    db.commit()
    return {"success": True, "message": "Black Market hub unlocked."}

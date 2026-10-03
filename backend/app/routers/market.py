from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team
from ..db import get_db
from ..games.market.engine import (
    calculate_team_item_price,
    get_catalog_for_team,
    get_item,
)
from ..models import AuditEvent, MarketPurchase, Team

router = APIRouter(prefix="/api/market", tags=["market"])


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

    catalog = get_catalog_for_team(
        team_purchase_count=team.black_market_purchases,
        purchased_item_ids=purchased_ids,
    )

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

    # Compute team-isolated price
    effective_price = calculate_team_item_price(item, team.black_market_purchases)

    if team.money < effective_price:
        raise HTTPException(status_code=400, detail="Insufficient heist funds")

    # Deduct funds
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
        team.risk = max(0.0, team.risk - item.get("effect_value", 3.0))
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
        "intel": item.get("intel"),
        "buff_applied": buff_applied,
        "team_purchases": team.black_market_purchases,
    }


@router.post("/unlock")
def unlock_market(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    team.black_market_unlocked = True
    db.commit()
    return {"success": True, "message": "Black Market hub unlocked."}

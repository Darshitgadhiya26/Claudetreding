from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging

from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    symbol: str
    exchange: str = "NSE"
    condition_type: str
    condition_value: Optional[float] = None
    condition_params: Optional[dict] = None
    name: Optional[str] = None
    message: Optional[str] = None
    frequency: str = "ONCE"
    timeframe: str = "15m"
    notification_channels: Optional[dict] = None


class AlertUpdate(BaseModel):
    condition_value: Optional[float] = None
    name: Optional[str] = None
    message: Optional[str] = None
    is_active: Optional[bool] = None
    frequency: Optional[str] = None
    notification_channels: Optional[dict] = None


class AlertResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    exchange: str
    condition_type: str
    condition_value: Optional[float]
    condition_params: Optional[dict]
    name: Optional[str]
    message: Optional[str]
    frequency: str
    notification_channels: dict
    is_active: bool
    triggered_count: int
    triggered_at: Optional[datetime]
    timeframe: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

VALID_CONDITIONS = {
    "PRICE_ABOVE", "PRICE_BELOW", "PRICE_CROSSES",
    "PERCENT_CHANGE_UP", "PERCENT_CHANGE_DOWN",
    "RSI_ABOVE", "RSI_BELOW", "RSI_OVERBOUGHT", "RSI_OVERSOLD",
    "MACD_CROSSOVER_BULLISH", "MACD_CROSSOVER_BEARISH",
    "EMA_CROSSOVER", "VOLUME_SPIKE",
    "BOLLINGER_UPPER", "BOLLINGER_LOWER",
    "SUPERTREND_BUY", "SUPERTREND_SELL",
}


@router.post("/", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new price or indicator alert."""
    if payload.condition_type.upper() not in VALID_CONDITIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid condition_type. Valid options: {', '.join(sorted(VALID_CONDITIONS))}",
        )

    default_channels = {"telegram": False, "email": False, "browser": True}
    channels = {**default_channels, **(payload.notification_channels or {})}

    alert = Alert(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=payload.exchange.upper(),
        condition_type=payload.condition_type.upper(),
        condition_value=payload.condition_value,
        condition_params=payload.condition_params,
        name=payload.name or f"{payload.symbol} {payload.condition_type}",
        message=payload.message,
        frequency=payload.frequency.upper(),
        timeframe=payload.timeframe,
        notification_channels=channels,
        is_active=True,
    )

    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    is_active: Optional[bool] = None,
    symbol: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all alerts for the current user."""
    query = select(Alert).where(Alert.user_id == current_user.id)
    if is_active is not None:
        query = query.where(Alert.is_active == is_active)
    if symbol:
        query = query.where(Alert.symbol == symbol.upper())
    query = query.order_by(Alert.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific alert."""
    result = await db.execute(
        select(Alert).where(
            and_(Alert.id == alert_id, Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    payload: AlertUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an alert's configuration."""
    result = await db.execute(
        select(Alert).where(
            and_(Alert.id == alert_id, Alert.user_id == current_user.id)
        )
    )
    alert: Optional[Alert] = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(alert, field, value)

    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an alert."""
    result = await db.execute(
        select(Alert).where(
            and_(Alert.id == alert_id, Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
    await db.commit()


@router.post("/{alert_id}/toggle")
async def toggle_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle alert active/inactive status."""
    result = await db.execute(
        select(Alert).where(
            and_(Alert.id == alert_id, Alert.user_id == current_user.id)
        )
    )
    alert: Optional[Alert] = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = not alert.is_active
    await db.commit()
    return {"id": alert.id, "is_active": alert.is_active, "symbol": alert.symbol}


@router.post("/test-alert")
async def test_alert(
    channel: str = Query(default="browser", description="Notification channel: browser, telegram, email"),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification to verify alert configuration."""
    from app.services.alert_service import alert_service

    success = await alert_service.test_alert(current_user.id, channel)

    return {
        "success": success,
        "channel": channel,
        "message": f"Test alert sent via {channel}" if success else f"Test via {channel} failed — check configuration",
    }

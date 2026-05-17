from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from app.database import get_db, check_db_connection
from app.models.user import User
from app.models.trade import Trade
from app.models.alert import Alert
from app.models.strategy import Strategy
from app.models.backtest import BacktestResult
from app.utils.auth import get_current_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class UserAdminView(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class SystemStats(BaseModel):
    total_users: int
    active_users: int
    total_trades: int
    total_strategies: int
    total_backtests: int
    total_alerts: int
    active_websocket_connections: int
    database_healthy: bool
    uptime_seconds: Optional[float]
    server_time: str


class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_verified: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Get system-wide statistics (admin only)."""
    # User counts
    total_users_r = await db.execute(select(func.count(User.id)))
    active_users_r = await db.execute(select(func.count(User.id)).where(User.is_active == True))

    # Trade count
    total_trades_r = await db.execute(select(func.count(Trade.id)))

    # Strategy count
    total_strat_r = await db.execute(select(func.count(Strategy.id)))

    # Backtest count
    total_bt_r = await db.execute(select(func.count(BacktestResult.id)))

    # Alert count
    total_alerts_r = await db.execute(select(func.count(Alert.id)))

    # WebSocket stats
    from app.websocket.manager import manager
    ws_stats = manager.get_stats()

    # DB health
    db_healthy = await check_db_connection()

    return SystemStats(
        total_users=total_users_r.scalar_one(),
        active_users=active_users_r.scalar_one(),
        total_trades=total_trades_r.scalar_one(),
        total_strategies=total_strat_r.scalar_one(),
        total_backtests=total_bt_r.scalar_one(),
        total_alerts=total_alerts_r.scalar_one(),
        active_websocket_connections=ws_stats["total_connections"],
        database_healthy=db_healthy,
        uptime_seconds=None,
        server_time=datetime.utcnow().isoformat(),
    )


@router.get("/users", response_model=List[UserAdminView])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """List all users with pagination and optional filtering (admin only)."""
    query = select(User)

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/users/{user_id}", response_model=UserAdminView)
async def get_user_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Get detailed user info (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}")
async def update_user_admin(
    user_id: int,
    payload: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Update user account status (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user: Optional[User] = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.is_verified is not None:
        user.is_verified = payload.is_verified

    await db.commit()
    return {"message": "User updated", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Permanently delete a user account (admin only). Cannot delete self."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
    logger.warning(f"Admin {admin.email} deleted user {user.email}")
    return {"message": f"User {user.email} deleted"}


@router.get("/trades")
async def list_all_trades(
    user_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """List all trades across all users (admin only)."""
    query = select(Trade)
    if user_id:
        query = query.where(Trade.user_id == user_id)
    query = query.order_by(Trade.created_at.desc()).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "symbol": t.symbol,
            "trade_type": t.trade_type,
            "quantity": t.quantity,
            "entry_price": t.entry_price,
            "exit_price": t.exit_price,
            "pnl": t.pnl,
            "status": t.status,
            "is_paper_trade": t.is_paper_trade,
            "entry_time": t.entry_time.isoformat() if t.entry_time else None,
        }
        for t in trades
    ]


@router.get("/websocket-stats")
async def get_websocket_stats(
    _admin: User = Depends(get_current_admin_user),
):
    """Get real-time WebSocket connection statistics (admin only)."""
    from app.websocket.manager import manager
    return manager.get_stats()


@router.post("/broadcast")
async def broadcast_message(
    message: str,
    message_type: str = "announcement",
    _admin: User = Depends(get_current_admin_user),
):
    """Broadcast a message to all connected WebSocket clients (admin only)."""
    from app.websocket.manager import manager

    sent = await manager.broadcast({
        "type": message_type,
        "message": message,
        "from": "admin",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {"message": "Broadcast sent", "recipients": sent}


@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
):
    """
    System health check endpoint.
    Does NOT require admin auth — used by load balancers.
    """
    db_ok = await check_db_connection()

    from app.websocket.manager import manager
    ws_stats = manager.get_stats()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "websockets": ws_stats["total_connections"],
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }

"""Portfolio tracker for covered call positions."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class CoveredCallPosition:
    """A single covered call position (100 shares + 1 short call)."""

    id: str
    symbol: str
    shares: int
    avg_cost: float  # per share cost basis
    call_strike: float
    call_expiration: str
    call_premium_received: float  # total premium received
    open_date: str
    status: str = "open"  # open, closed, assigned
    close_date: str | None = None
    close_price: float | None = None
    realized_pnl: float | None = None
    notes: str = ""


@dataclass
class Portfolio:
    """Collection of covered call positions."""

    positions: list[CoveredCallPosition] = field(default_factory=list)
    cash: float = 0.0
    total_premiums_collected: float = 0.0
    total_realized_pnl: float = 0.0


class PortfolioTracker:
    """Manages covered call positions and tracks P&L."""

    def __init__(self, data_file: str | Path = "portfolio.json") -> None:
        self.data_file = Path(data_file)
        self.portfolio = self._load()

    def _load(self) -> Portfolio:
        if self.data_file.exists():
            data = json.loads(self.data_file.read_text())
            positions = [CoveredCallPosition(**p) for p in data.get("positions", [])]
            return Portfolio(
                positions=positions,
                cash=data.get("cash", 0.0),
                total_premiums_collected=data.get("total_premiums_collected", 0.0),
                total_realized_pnl=data.get("total_realized_pnl", 0.0),
            )
        return Portfolio()

    def save(self) -> None:
        """Persist portfolio state to disk."""
        data = {
            "positions": [asdict(p) for p in self.portfolio.positions],
            "cash": self.portfolio.cash,
            "total_premiums_collected": self.portfolio.total_premiums_collected,
            "total_realized_pnl": self.portfolio.total_realized_pnl,
        }
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        self.data_file.write_text(json.dumps(data, indent=2))

    def open_position(
        self,
        symbol: str,
        shares: int,
        avg_cost: float,
        call_strike: float,
        call_expiration: str,
        premium_per_contract: float,
    ) -> CoveredCallPosition:
        """Open a new covered call position."""
        num_contracts = shares // 100
        total_premium = premium_per_contract * num_contracts * 100

        position = CoveredCallPosition(
            id=f"{symbol}_{call_expiration}_{call_strike}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            symbol=symbol.upper(),
            shares=shares,
            avg_cost=avg_cost,
            call_strike=call_strike,
            call_expiration=call_expiration,
            call_premium_received=total_premium,
            open_date=datetime.now().strftime("%Y-%m-%d"),
        )

        self.portfolio.positions.append(position)
        self.portfolio.cash += total_premium
        self.portfolio.total_premiums_collected += total_premium
        self.save()
        return position

    def close_position(
        self, position_id: str, close_price: float, status: str = "closed"
    ) -> CoveredCallPosition | None:
        """Close a position (expired worthless, bought back, or assigned)."""
        for pos in self.portfolio.positions:
            if pos.id == position_id and pos.status == "open":
                pos.status = status
                pos.close_date = datetime.now().strftime("%Y-%m-%d")
                pos.close_price = close_price

                if status == "assigned":
                    # Shares called away at strike price
                    stock_pnl = (pos.call_strike - pos.avg_cost) * pos.shares
                    pos.realized_pnl = stock_pnl + pos.call_premium_received
                else:
                    # Call expired or bought back; still hold shares
                    pos.realized_pnl = pos.call_premium_received - (
                        close_price * (pos.shares // 100) * 100
                    )

                self.portfolio.total_realized_pnl += pos.realized_pnl
                self.save()
                return pos
        return None

    def roll_position(
        self,
        position_id: str,
        new_strike: float,
        new_expiration: str,
        new_premium: float,
        buyback_cost: float,
    ) -> CoveredCallPosition | None:
        """Roll a position to a new strike/expiration."""
        for pos in self.portfolio.positions:
            if pos.id == position_id and pos.status == "open":
                # Close old call
                net_debit_credit = new_premium - buyback_cost
                pos.status = "rolled"
                pos.close_date = datetime.now().strftime("%Y-%m-%d")
                pos.realized_pnl = pos.call_premium_received - buyback_cost * (
                    pos.shares // 100
                ) * 100

                # Open new position with same shares
                new_pos = self.open_position(
                    symbol=pos.symbol,
                    shares=pos.shares,
                    avg_cost=pos.avg_cost,
                    call_strike=new_strike,
                    call_expiration=new_expiration,
                    premium_per_contract=new_premium,
                )
                self.save()
                return new_pos
        return None

    def get_open_positions(self) -> list[CoveredCallPosition]:
        """Get all open positions."""
        return [p for p in self.portfolio.positions if p.status == "open"]

    def get_position_summary(self) -> dict:
        """Get a summary of the portfolio."""
        open_positions = self.get_open_positions()
        total_invested = sum(p.avg_cost * p.shares for p in open_positions)
        total_premium_open = sum(p.call_premium_received for p in open_positions)
        return {
            "open_positions": len(open_positions),
            "total_positions": len(self.portfolio.positions),
            "total_invested": total_invested,
            "pending_premiums": total_premium_open,
            "total_premiums_collected": self.portfolio.total_premiums_collected,
            "total_realized_pnl": self.portfolio.total_realized_pnl,
            "cash": self.portfolio.cash,
        }

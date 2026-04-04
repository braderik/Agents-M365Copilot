"""Tests for the portfolio tracker."""

import json
from pathlib import Path

from covered_call_bot.portfolio.tracker import PortfolioTracker


def test_open_and_close_position(tmp_path):
    pf = tmp_path / "test_portfolio.json"
    tracker = PortfolioTracker(pf)

    pos = tracker.open_position(
        symbol="AAPL",
        shares=100,
        avg_cost=150.0,
        call_strike=155.0,
        call_expiration="2026-05-16",
        premium_per_contract=3.50,
    )

    assert pos.status == "open"
    assert pos.call_premium_received == 350.0  # 3.50 * 1 * 100
    assert tracker.portfolio.cash == 350.0

    # Close as expired (worthless)
    closed = tracker.close_position(pos.id, close_price=0.0, status="closed")
    assert closed is not None
    assert closed.status == "closed"


def test_assigned_position(tmp_path):
    pf = tmp_path / "test_portfolio.json"
    tracker = PortfolioTracker(pf)

    pos = tracker.open_position(
        symbol="MSFT",
        shares=100,
        avg_cost=300.0,
        call_strike=310.0,
        call_expiration="2026-05-16",
        premium_per_contract=5.00,
    )

    closed = tracker.close_position(pos.id, close_price=315.0, status="assigned")
    assert closed is not None
    assert closed.status == "assigned"
    # P&L: (310 - 300) * 100 + 500 premium = 1500
    assert closed.realized_pnl == 1500.0


def test_persistence(tmp_path):
    pf = tmp_path / "test_portfolio.json"
    tracker = PortfolioTracker(pf)
    tracker.open_position(
        symbol="GOOGL",
        shares=100,
        avg_cost=140.0,
        call_strike=145.0,
        call_expiration="2026-06-20",
        premium_per_contract=4.00,
    )

    # Reload from disk
    tracker2 = PortfolioTracker(pf)
    assert len(tracker2.get_open_positions()) == 1
    assert tracker2.portfolio.cash == 400.0


def test_summary(tmp_path):
    pf = tmp_path / "test_portfolio.json"
    tracker = PortfolioTracker(pf)
    tracker.open_position("AAPL", 100, 150.0, 155.0, "2026-05-16", 3.0)
    tracker.open_position("MSFT", 200, 300.0, 310.0, "2026-06-20", 5.0)

    summary = tracker.get_position_summary()
    assert summary["open_positions"] == 2
    assert summary["total_invested"] == 150.0 * 100 + 300.0 * 200
    assert summary["total_premiums_collected"] == 300.0 + 1000.0  # 3*1*100 + 5*2*100

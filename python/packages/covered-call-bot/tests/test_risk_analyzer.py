"""Tests for the risk analyzer module."""

from covered_call_bot.risk.analyzer import RiskAnalyzer


def test_breakeven_calculation():
    analyzer = RiskAnalyzer(risk_free_rate=0.05)
    profile = analyzer.analyze_position(
        stock_price=100.0,
        cost_basis=100.0,
        strike=105.0,
        premium_received=2.50,
        days_to_expiry=30,
        implied_vol=0.25,
    )
    assert profile.breakeven == 97.50
    assert profile.max_profit == 7.50  # (105 - 100) + 2.50
    assert profile.max_loss == 97.50  # cost - premium (stock to 0)


def test_max_profit_itm_call():
    analyzer = RiskAnalyzer()
    profile = analyzer.analyze_position(
        stock_price=100.0,
        cost_basis=100.0,
        strike=95.0,
        premium_received=7.00,
        days_to_expiry=30,
        implied_vol=0.30,
    )
    # ITM call: max profit = (95 - 100) + 7 = 2.00
    assert profile.max_profit == 2.00


def test_greeks_otm_call():
    analyzer = RiskAnalyzer()
    greeks = analyzer.calculate_greeks(
        stock_price=100.0,
        strike=110.0,
        days_to_expiry=30,
        implied_vol=0.25,
    )
    # Net delta for covered call with OTM call should be positive (close to 1)
    assert 0.5 < greeks.delta < 1.0
    # Theta should be positive (time decay benefits short call holder)
    assert greeks.theta > 0


def test_greeks_expired():
    analyzer = RiskAnalyzer()
    greeks = analyzer.calculate_greeks(
        stock_price=100.0,
        strike=105.0,
        days_to_expiry=0,
        implied_vol=0.25,
    )
    assert greeks.delta == 1.0
    assert greeks.gamma == 0.0


def test_pnl_table():
    analyzer = RiskAnalyzer()
    rows = analyzer.generate_pnl_table(
        cost_basis=100.0,
        strike=105.0,
        premium_received=2.50,
        price_range_pct=0.10,
        steps=5,
    )
    assert len(rows) == 5
    # At max price (110), should be assigned, pnl capped at max profit
    assigned_rows = [r for r in rows if r["assigned"]]
    assert len(assigned_rows) > 0
    for r in assigned_rows:
        assert r["pnl_per_share"] == 7.50  # (105 - 100) + 2.50


def test_pnl_table_below_breakeven():
    analyzer = RiskAnalyzer()
    rows = analyzer.generate_pnl_table(
        cost_basis=100.0,
        strike=105.0,
        premium_received=2.50,
        price_range_pct=0.10,
        steps=5,
    )
    # Lowest price row should have negative P&L
    lowest = rows[0]
    assert lowest["pnl_per_share"] < 0

"""Tests for the covered call strategy engine."""

from unittest.mock import MagicMock

from covered_call_bot.market_data.provider import OptionContract, StockQuote
from covered_call_bot.strategy.covered_call import CoveredCallStrategy
from datetime import datetime, timedelta


def _make_quote(symbol="AAPL", price=150.0):
    return StockQuote(
        symbol=symbol,
        price=price,
        bid=149.90,
        ask=150.10,
        volume=1000000,
        market_cap=2e12,
        dividend_yield=0.005,
        fifty_two_week_high=180.0,
        fifty_two_week_low=120.0,
        timestamp=datetime.now(),
    )


def _make_contract(strike=155.0, bid=3.50, ask=3.80, oi=500, iv=0.25, expiration=None):
    if expiration is None:
        expiration = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    return OptionContract(
        contract_symbol=f"AAPL{expiration}C{strike}",
        strike=strike,
        expiration=expiration,
        bid=bid,
        ask=ask,
        last_price=(bid + ask) / 2,
        volume=200,
        open_interest=oi,
        implied_volatility=iv,
        in_the_money=False,
    )


def test_scan_symbol_returns_candidates():
    mock_md = MagicMock()
    mock_md.get_stock_quote.return_value = _make_quote()
    exp = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    mock_md.get_option_expirations.return_value = [exp]
    mock_md.get_call_chain.return_value = [
        _make_contract(strike=155.0, bid=3.50, expiration=exp),
        _make_contract(strike=160.0, bid=1.80, expiration=exp),
        _make_contract(strike=150.0, bid=5.20, expiration=exp),
    ]

    strategy = CoveredCallStrategy(market_data=mock_md)
    candidates = strategy.scan_symbol("AAPL", top_n=3)

    assert len(candidates) > 0
    assert all(c.symbol == "AAPL" for c in candidates)
    # Candidates should be sorted by score descending
    scores = [c.score for c in candidates]
    assert scores == sorted(scores, reverse=True)


def test_filters_low_open_interest():
    mock_md = MagicMock()
    mock_md.get_stock_quote.return_value = _make_quote()
    exp = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    mock_md.get_option_expirations.return_value = [exp]
    mock_md.get_call_chain.return_value = [
        _make_contract(strike=155.0, oi=2, expiration=exp),  # too low
    ]

    strategy = CoveredCallStrategy(market_data=mock_md, min_open_interest=10)
    candidates = strategy.scan_symbol("AAPL")
    assert len(candidates) == 0


def test_filters_wrong_dte():
    mock_md = MagicMock()
    mock_md.get_stock_quote.return_value = _make_quote()
    far_exp = (datetime.now() + timedelta(days=120)).strftime("%Y-%m-%d")
    mock_md.get_option_expirations.return_value = [far_exp]
    mock_md.get_call_chain.return_value = [
        _make_contract(strike=155.0, expiration=far_exp),
    ]

    strategy = CoveredCallStrategy(market_data=mock_md, max_days_to_expiry=60)
    candidates = strategy.scan_symbol("AAPL")
    assert len(candidates) == 0


def test_candidate_metrics():
    mock_md = MagicMock()
    mock_md.get_stock_quote.return_value = _make_quote(price=100.0)
    exp = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    mock_md.get_option_expirations.return_value = [exp]
    mock_md.get_call_chain.return_value = [
        _make_contract(strike=105.0, bid=2.00, ask=2.20, expiration=exp),
    ]

    strategy = CoveredCallStrategy(market_data=mock_md)
    candidates = strategy.scan_symbol("TEST")
    assert len(candidates) == 1

    c = candidates[0]
    assert abs(c.static_return - 0.02) < 1e-9
    assert abs(c.moneyness - 0.05) < 1e-9
    assert abs(c.if_called_return - 0.07) < 1e-9

"""Covered call strategy engine - analyzes and ranks covered call opportunities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from covered_call_bot.market_data.provider import MarketDataProvider, OptionContract


@dataclass
class CoveredCallCandidate:
    """A scored covered call opportunity."""

    symbol: str
    stock_price: float
    strike: float
    expiration: str
    premium_bid: float
    premium_mid: float
    days_to_expiry: int
    implied_volatility: float
    open_interest: int
    # Computed metrics
    static_return: float  # premium / stock_price (if not assigned)
    if_called_return: float  # (premium + strike - stock_price) / stock_price
    annualized_return: float  # if_called_return annualized
    downside_protection: float  # premium / stock_price as percentage
    moneyness: float  # strike / stock_price - 1 (positive = OTM)
    score: float  # composite ranking score


class CoveredCallStrategy:
    """Finds and ranks optimal covered call candidates."""

    def __init__(
        self,
        market_data: MarketDataProvider | None = None,
        min_open_interest: int = 10,
        min_days_to_expiry: int = 7,
        max_days_to_expiry: int = 60,
        min_premium_yield: float = 0.005,
        target_moneyness: float = 0.05,
    ) -> None:
        self.market_data = market_data or MarketDataProvider()
        self.min_open_interest = min_open_interest
        self.min_days_to_expiry = min_days_to_expiry
        self.max_days_to_expiry = max_days_to_expiry
        self.min_premium_yield = min_premium_yield
        self.target_moneyness = target_moneyness

    def _days_to_expiry(self, expiration: str) -> int:
        exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
        return (exp_date - datetime.now().date()).days

    def _score_candidate(self, candidate: CoveredCallCandidate) -> float:
        """Score a candidate based on multiple factors (higher = better)."""
        # Favor annualized return
        return_score = min(candidate.annualized_return / 0.30, 1.0) * 40

        # Favor OTM calls near target moneyness
        moneyness_diff = abs(candidate.moneyness - self.target_moneyness)
        moneyness_score = max(0, 1.0 - moneyness_diff / 0.10) * 25

        # Favor higher liquidity
        oi_score = min(candidate.open_interest / 500, 1.0) * 15

        # Favor moderate DTE (sweet spot around 30-45 days)
        dte_optimal = 37
        dte_diff = abs(candidate.days_to_expiry - dte_optimal)
        dte_score = max(0, 1.0 - dte_diff / 30) * 10

        # Favor reasonable downside protection
        protection_score = min(candidate.downside_protection / 0.05, 1.0) * 10

        return return_score + moneyness_score + oi_score + dte_score + protection_score

    def _build_candidate(
        self, symbol: str, stock_price: float, contract: OptionContract
    ) -> CoveredCallCandidate | None:
        """Build a scored candidate from an option contract."""
        dte = self._days_to_expiry(contract.expiration)
        if dte < self.min_days_to_expiry or dte > self.max_days_to_expiry:
            return None
        if contract.open_interest < self.min_open_interest:
            return None

        premium_mid = (contract.bid + contract.ask) / 2
        if stock_price <= 0:
            return None

        static_return = contract.bid / stock_price
        if static_return < self.min_premium_yield:
            return None

        if_called_return = (contract.bid + contract.strike - stock_price) / stock_price
        annualized = if_called_return * (365 / dte) if dte > 0 else 0.0
        moneyness = (contract.strike / stock_price) - 1.0
        downside_protection = contract.bid / stock_price

        candidate = CoveredCallCandidate(
            symbol=symbol.upper(),
            stock_price=stock_price,
            strike=contract.strike,
            expiration=contract.expiration,
            premium_bid=contract.bid,
            premium_mid=premium_mid,
            days_to_expiry=dte,
            implied_volatility=contract.implied_volatility,
            open_interest=contract.open_interest,
            static_return=static_return,
            if_called_return=if_called_return,
            annualized_return=annualized,
            downside_protection=downside_protection,
            moneyness=moneyness,
            score=0.0,
        )
        candidate.score = self._score_candidate(candidate)
        return candidate

    def scan_symbol(self, symbol: str, top_n: int = 5) -> list[CoveredCallCandidate]:
        """Scan a single symbol for the best covered call opportunities."""
        quote = self.market_data.get_stock_quote(symbol)
        expirations = self.market_data.get_option_expirations(symbol)
        candidates: list[CoveredCallCandidate] = []

        for exp in expirations:
            dte = self._days_to_expiry(exp)
            if dte < self.min_days_to_expiry or dte > self.max_days_to_expiry:
                continue
            calls = self.market_data.get_call_chain(symbol, exp)
            for contract in calls:
                candidate = self._build_candidate(symbol, quote.price, contract)
                if candidate:
                    candidates.append(candidate)

        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[:top_n]

    def scan_watchlist(
        self, symbols: list[str], top_n: int = 10
    ) -> list[CoveredCallCandidate]:
        """Scan multiple symbols and return the best overall candidates."""
        all_candidates: list[CoveredCallCandidate] = []
        for symbol in symbols:
            try:
                all_candidates.extend(self.scan_symbol(symbol, top_n=top_n))
            except Exception as e:
                print(f"Warning: Failed to scan {symbol}: {e}")
        all_candidates.sort(key=lambda c: c.score, reverse=True)
        return all_candidates[:top_n]

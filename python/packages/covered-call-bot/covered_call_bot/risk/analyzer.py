"""Risk analysis for covered call positions - Greeks, P&L scenarios, breakeven."""

from __future__ import annotations

from dataclasses import dataclass
from math import exp, log, sqrt

from scipy.stats import norm


@dataclass
class GreeksResult:
    """Option Greeks for a covered call position."""

    delta: float  # net delta (long stock + short call)
    gamma: float
    theta: float  # daily theta (positive = time decay in your favor)
    vega: float
    rho: float


@dataclass
class CoveredCallRiskProfile:
    """Full risk profile for a covered call."""

    max_profit: float
    max_profit_price: float  # stock price at max profit (strike)
    max_loss: float  # theoretical max loss (stock goes to 0)
    breakeven: float  # stock price where P&L = 0
    downside_protection_pct: float
    probability_of_profit: float  # estimated from IV
    probability_of_assignment: float
    greeks: GreeksResult


class RiskAnalyzer:
    """Analyzes risk for covered call strategies using Black-Scholes."""

    def __init__(self, risk_free_rate: float = 0.05) -> None:
        self.risk_free_rate = risk_free_rate

    def _d1(self, S: float, K: float, T: float, sigma: float) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        return (log(S / K) + (self.risk_free_rate + sigma**2 / 2) * T) / (
            sigma * sqrt(T)
        )

    def _d2(self, S: float, K: float, T: float, sigma: float) -> float:
        return self._d1(S, K, T, sigma) - sigma * sqrt(T) if T > 0 else 0.0

    def calculate_greeks(
        self,
        stock_price: float,
        strike: float,
        days_to_expiry: int,
        implied_vol: float,
    ) -> GreeksResult:
        """Calculate Greeks for a short call in a covered call position."""
        T = days_to_expiry / 365.0
        S = stock_price
        K = strike
        r = self.risk_free_rate
        sigma = implied_vol

        if T <= 0 or sigma <= 0:
            return GreeksResult(delta=1.0, gamma=0.0, theta=0.0, vega=0.0, rho=0.0)

        d1 = self._d1(S, K, T, sigma)
        d2 = self._d2(S, K, T, sigma)

        # Call delta; covered call net delta = 1 - call_delta
        call_delta = norm.cdf(d1)
        net_delta = 1.0 - call_delta

        # Gamma (short call gamma is negative for the position)
        gamma = -norm.pdf(d1) / (S * sigma * sqrt(T))

        # Theta (daily) for short call - positive theta means time decay benefits us
        theta_annual = -(S * norm.pdf(d1) * sigma / (2 * sqrt(T))) - (
            r * K * exp(-r * T) * norm.cdf(d2)
        )
        theta = -theta_annual / 365  # negate because we're short the call

        # Vega per 1% change in IV (short call vega is negative for position)
        vega = -(S * norm.pdf(d1) * sqrt(T)) / 100

        # Rho per 1% change in rates
        rho = -(K * T * exp(-r * T) * norm.cdf(d2)) / 100

        return GreeksResult(
            delta=round(net_delta, 4),
            gamma=round(gamma, 6),
            theta=round(theta, 4),
            vega=round(vega, 4),
            rho=round(rho, 4),
        )

    def analyze_position(
        self,
        stock_price: float,
        cost_basis: float,
        strike: float,
        premium_received: float,
        days_to_expiry: int,
        implied_vol: float,
    ) -> CoveredCallRiskProfile:
        """Full risk analysis for a covered call position (per share)."""
        # Max profit: stock called away at strike + premium
        max_profit = (strike - cost_basis) + premium_received
        max_profit_price = strike

        # Max loss: stock goes to zero, keep premium
        max_loss = cost_basis - premium_received

        # Breakeven: cost basis minus premium received
        breakeven = cost_basis - premium_received

        # Downside protection
        downside_protection_pct = premium_received / cost_basis if cost_basis > 0 else 0

        # Probability estimates from Black-Scholes
        T = days_to_expiry / 365.0
        if T > 0 and implied_vol > 0:
            d2 = self._d2(stock_price, breakeven, T, implied_vol)
            probability_of_profit = norm.cdf(d2)

            d2_strike = self._d2(stock_price, strike, T, implied_vol)
            probability_of_assignment = norm.cdf(d2_strike)
        else:
            probability_of_profit = 0.5
            probability_of_assignment = 0.5 if stock_price >= strike else 0.0

        greeks = self.calculate_greeks(stock_price, strike, days_to_expiry, implied_vol)

        return CoveredCallRiskProfile(
            max_profit=round(max_profit, 2),
            max_profit_price=max_profit_price,
            max_loss=round(max_loss, 2),
            breakeven=round(breakeven, 2),
            downside_protection_pct=round(downside_protection_pct, 4),
            probability_of_profit=round(probability_of_profit, 4),
            probability_of_assignment=round(probability_of_assignment, 4),
            greeks=greeks,
        )

    def generate_pnl_table(
        self,
        cost_basis: float,
        strike: float,
        premium_received: float,
        price_range_pct: float = 0.20,
        steps: int = 11,
    ) -> list[dict]:
        """Generate a P&L table at various stock prices at expiration."""
        low = cost_basis * (1 - price_range_pct)
        high = cost_basis * (1 + price_range_pct)
        step_size = (high - low) / (steps - 1)

        rows = []
        for i in range(steps):
            price_at_exp = low + i * step_size
            # At expiration: profit from stock + premium - cost
            if price_at_exp >= strike:
                # Assigned: sell at strike
                pnl = (strike - cost_basis + premium_received)
            else:
                # Not assigned: keep stock and premium
                pnl = (price_at_exp - cost_basis + premium_received)

            rows.append(
                {
                    "stock_price": round(price_at_exp, 2),
                    "pnl_per_share": round(pnl, 2),
                    "pnl_per_contract": round(pnl * 100, 2),
                    "return_pct": round(pnl / cost_basis * 100, 2) if cost_basis > 0 else 0,
                    "assigned": price_at_exp >= strike,
                }
            )
        return rows

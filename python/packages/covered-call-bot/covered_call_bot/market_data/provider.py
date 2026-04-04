"""Market data provider using yfinance for stock prices and options chains."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import pandas as pd
import yfinance as yf


@dataclass
class StockQuote:
    """Current stock quote data."""

    symbol: str
    price: float
    bid: float
    ask: float
    volume: int
    market_cap: float | None
    dividend_yield: float | None
    fifty_two_week_high: float
    fifty_two_week_low: float
    timestamp: datetime


@dataclass
class OptionContract:
    """Single option contract data."""

    contract_symbol: str
    strike: float
    expiration: str
    bid: float
    ask: float
    last_price: float
    volume: int
    open_interest: int
    implied_volatility: float
    in_the_money: bool


class MarketDataProvider:
    """Fetches stock and options data from Yahoo Finance."""

    def __init__(self) -> None:
        self._cache: dict[str, yf.Ticker] = {}

    def _get_ticker(self, symbol: str) -> yf.Ticker:
        symbol = symbol.upper()
        if symbol not in self._cache:
            self._cache[symbol] = yf.Ticker(symbol)
        return self._cache[symbol]

    def get_stock_quote(self, symbol: str) -> StockQuote:
        """Fetch current stock quote."""
        ticker = self._get_ticker(symbol)
        info = ticker.info
        return StockQuote(
            symbol=symbol.upper(),
            price=info.get("currentPrice") or info.get("regularMarketPrice", 0.0),
            bid=info.get("bid", 0.0),
            ask=info.get("ask", 0.0),
            volume=info.get("volume", 0),
            market_cap=info.get("marketCap"),
            dividend_yield=info.get("dividendYield"),
            fifty_two_week_high=info.get("fiftyTwoWeekHigh", 0.0),
            fifty_two_week_low=info.get("fiftyTwoWeekLow", 0.0),
            timestamp=datetime.now(),
        )

    def get_option_expirations(self, symbol: str) -> list[str]:
        """Get available option expiration dates for a symbol."""
        ticker = self._get_ticker(symbol)
        return list(ticker.options)

    def get_call_chain(self, symbol: str, expiration: str) -> list[OptionContract]:
        """Fetch call options chain for a given expiration date."""
        ticker = self._get_ticker(symbol)
        chain = ticker.option_chain(expiration)
        calls: pd.DataFrame = chain.calls
        contracts = []
        for _, row in calls.iterrows():
            contracts.append(
                OptionContract(
                    contract_symbol=row.get("contractSymbol", ""),
                    strike=float(row["strike"]),
                    expiration=expiration,
                    bid=float(row.get("bid", 0.0)),
                    ask=float(row.get("ask", 0.0)),
                    last_price=float(row.get("lastPrice", 0.0)),
                    volume=int(row.get("volume", 0) or 0),
                    open_interest=int(row.get("openInterest", 0) or 0),
                    implied_volatility=float(row.get("impliedVolatility", 0.0)),
                    in_the_money=bool(row.get("inTheMoney", False)),
                )
            )
        return contracts

    def get_historical_prices(
        self, symbol: str, period: str = "1y", interval: str = "1d"
    ) -> pd.DataFrame:
        """Fetch historical price data."""
        ticker = self._get_ticker(symbol)
        return ticker.history(period=period, interval=interval)

    def get_historical_volatility(self, symbol: str, window: int = 30) -> float:
        """Calculate annualized historical volatility."""
        hist = self.get_historical_prices(symbol, period="6mo")
        if hist.empty or len(hist) < window:
            return 0.0
        returns = hist["Close"].pct_change().dropna()
        return float(returns.tail(window).std() * (252**0.5))

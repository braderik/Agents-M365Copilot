"""Configuration for the covered call bot."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_CONFIG_PATH = Path("covered_call_config.json")

DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",
    "NVDA", "JPM", "V", "JNJ", "PG",
]


@dataclass
class BotConfig:
    """Configuration for the covered call strategy bot."""

    watchlist: list[str] = field(default_factory=lambda: list(DEFAULT_WATCHLIST))
    min_open_interest: int = 10
    min_days_to_expiry: int = 14
    max_days_to_expiry: int = 55
    min_premium_yield: float = 0.005
    target_moneyness: float = 0.03  # 3% OTM
    max_positions: int = 10
    shares_per_position: int = 100
    risk_free_rate: float = 0.05
    portfolio_file: str = "portfolio.json"
    top_results: int = 10

    @classmethod
    def load(cls, path: Path | str = DEFAULT_CONFIG_PATH) -> BotConfig:
        path = Path(path)
        if path.exists():
            data = json.loads(path.read_text())
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()

    def save(self, path: Path | str = DEFAULT_CONFIG_PATH) -> None:
        Path(path).write_text(json.dumps(asdict(self), indent=2))

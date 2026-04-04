# Covered Call Investment Bot

An automated covered call strategy analysis tool that scans for optimal covered call opportunities, analyzes risk profiles, and tracks portfolio positions.

## Features

- **Options Scanner** - Scans watchlist symbols for the best covered call candidates ranked by a composite score (annualized return, liquidity, moneyness, DTE)
- **Risk Analysis** - Full Black-Scholes Greeks calculation, P&L scenarios at expiration, probability of profit/assignment
- **Portfolio Tracker** - Track open positions, premiums collected, assignments, and rolling
- **Rich CLI** - Beautiful terminal output with tables and color formatting

## Installation

```bash
cd python/packages/covered-call-bot
pip install -e ".[dev]"
```

## Usage

### Initialize configuration

```bash
covered-call-bot init
```

Creates `covered_call_config.json` with default settings (watchlist, DTE range, moneyness targets).

### Scan for opportunities

```bash
# Scan default watchlist
covered-call-bot scan

# Scan specific symbols
covered-call-bot scan AAPL MSFT NVDA

# Show top 20 results
covered-call-bot scan --top 20
```

### Analyze a specific covered call

```bash
covered-call-bot analyze AAPL --strike 195 --expiration 2026-05-16 --cost-basis 185
```

Shows:
- Max profit/loss and breakeven
- Greeks (delta, gamma, theta, vega)
- Probability of profit and assignment
- P&L table at various stock prices at expiration

### Portfolio management

```bash
# View portfolio
covered-call-bot portfolio

# Add a position
covered-call-bot add-position AAPL --shares 100 --cost 185 --strike 195 --expiration 2026-05-16 --premium 3.50

# Close a position
covered-call-bot close-position <position-id> --price 0.10 --status expired
```

## Configuration

Edit `covered_call_config.json`:

```json
{
  "watchlist": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
  "min_open_interest": 10,
  "min_days_to_expiry": 14,
  "max_days_to_expiry": 55,
  "min_premium_yield": 0.005,
  "target_moneyness": 0.03,
  "max_positions": 10,
  "risk_free_rate": 0.05
}
```

## Strategy Overview

A **covered call** involves:
1. Owning 100 shares of a stock
2. Selling 1 call option contract against those shares

The bot optimizes for:
- **Annualized return** - Maximizes income from premiums on an annualized basis
- **Moneyness** - Targets slightly OTM calls (default 3%) to balance income vs. upside
- **Liquidity** - Filters for adequate open interest to ensure fill quality
- **DTE sweet spot** - Focuses on 14-55 day expirations where theta decay accelerates

## Running Tests

```bash
pytest tests/ -v
```

## Disclaimer

This tool is for educational and research purposes only. It does not constitute financial advice. Options trading involves significant risk of loss. Always do your own research and consult with a qualified financial advisor before making investment decisions.

"""CLI interface for the covered call investment bot."""

from __future__ import annotations

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from covered_call_bot.config import BotConfig
from covered_call_bot.market_data.provider import MarketDataProvider
from covered_call_bot.portfolio.tracker import PortfolioTracker
from covered_call_bot.risk.analyzer import RiskAnalyzer
from covered_call_bot.strategy.covered_call import CoveredCallStrategy

console = Console()


@click.group()
@click.option("--config", default="covered_call_config.json", help="Path to config file")
@click.pass_context
def main(ctx: click.Context, config: str) -> None:
    """Covered Call Investment Bot - Find and manage covered call opportunities."""
    ctx.ensure_object(dict)
    ctx.obj["config"] = BotConfig.load(config)


@main.command()
@click.argument("symbols", nargs=-1)
@click.option("--top", default=None, type=int, help="Number of top results")
@click.pass_context
def scan(ctx: click.Context, symbols: tuple[str, ...], top: int | None) -> None:
    """Scan symbols for covered call opportunities."""
    cfg = ctx.obj["config"]
    symbol_list = list(symbols) if symbols else cfg.watchlist
    top_n = top or cfg.top_results

    console.print(
        Panel(f"Scanning {len(symbol_list)} symbols for covered call opportunities..."),
    )

    market_data = MarketDataProvider()
    strategy = CoveredCallStrategy(
        market_data=market_data,
        min_open_interest=cfg.min_open_interest,
        min_days_to_expiry=cfg.min_days_to_expiry,
        max_days_to_expiry=cfg.max_days_to_expiry,
        min_premium_yield=cfg.min_premium_yield,
        target_moneyness=cfg.target_moneyness,
    )

    candidates = strategy.scan_watchlist(symbol_list, top_n=top_n)

    if not candidates:
        console.print("[yellow]No candidates found matching criteria.[/yellow]")
        return

    table = Table(title="Top Covered Call Candidates", show_lines=True)
    table.add_column("Symbol", style="bold cyan")
    table.add_column("Price", justify="right")
    table.add_column("Strike", justify="right")
    table.add_column("Expiry")
    table.add_column("DTE", justify="right")
    table.add_column("Bid", justify="right")
    table.add_column("Static %", justify="right")
    table.add_column("If Called %", justify="right")
    table.add_column("Annual %", justify="right", style="green")
    table.add_column("OI", justify="right")
    table.add_column("IV", justify="right")
    table.add_column("Score", justify="right", style="bold yellow")

    for c in candidates:
        table.add_row(
            c.symbol,
            f"${c.stock_price:.2f}",
            f"${c.strike:.2f}",
            c.expiration,
            str(c.days_to_expiry),
            f"${c.premium_bid:.2f}",
            f"{c.static_return:.2%}",
            f"{c.if_called_return:.2%}",
            f"{c.annualized_return:.1%}",
            str(c.open_interest),
            f"{c.implied_volatility:.1%}",
            f"{c.score:.1f}",
        )

    console.print(table)


@main.command()
@click.argument("symbol")
@click.option("--strike", required=True, type=float, help="Call strike price")
@click.option("--expiration", required=True, help="Expiration date (YYYY-MM-DD)")
@click.option("--cost-basis", required=True, type=float, help="Stock cost basis per share")
@click.pass_context
def analyze(
    ctx: click.Context,
    symbol: str,
    strike: float,
    expiration: str,
    cost_basis: float,
) -> None:
    """Analyze risk profile for a specific covered call."""
    cfg = ctx.obj["config"]
    market_data = MarketDataProvider()
    risk = RiskAnalyzer(risk_free_rate=cfg.risk_free_rate)

    quote = market_data.get_stock_quote(symbol)
    calls = market_data.get_call_chain(symbol, expiration)

    contract = next((c for c in calls if c.strike == strike), None)
    if not contract:
        console.print(f"[red]No call contract found for {symbol} ${strike} {expiration}[/red]")
        return

    from covered_call_bot.strategy.covered_call import CoveredCallStrategy

    strategy = CoveredCallStrategy(market_data=market_data)
    dte = strategy._days_to_expiry(expiration)

    premium = contract.bid
    profile = risk.analyze_position(
        stock_price=quote.price,
        cost_basis=cost_basis,
        strike=strike,
        premium_received=premium,
        days_to_expiry=dte,
        implied_vol=contract.implied_volatility,
    )

    # Risk profile panel
    console.print(Panel(
        f"[bold]{symbol}[/bold] ${quote.price:.2f} | "
        f"Strike ${strike:.2f} | Exp {expiration} | DTE {dte}\n"
        f"Premium: ${premium:.2f}/share (${premium * 100:.0f}/contract)",
        title="Covered Call Analysis",
    ))

    info_table = Table(show_header=False, box=None, padding=(0, 2))
    info_table.add_column("Metric", style="bold")
    info_table.add_column("Value", justify="right")
    info_table.add_row("Max Profit (per share)", f"${profile.max_profit:.2f}")
    info_table.add_row("Max Profit (per contract)", f"${profile.max_profit * 100:.2f}")
    info_table.add_row("Max Loss (per share)", f"${profile.max_loss:.2f}")
    info_table.add_row("Breakeven", f"${profile.breakeven:.2f}")
    info_table.add_row("Downside Protection", f"{profile.downside_protection_pct:.2%}")
    info_table.add_row("P(Profit)", f"{profile.probability_of_profit:.1%}")
    info_table.add_row("P(Assignment)", f"{profile.probability_of_assignment:.1%}")
    console.print(info_table)

    # Greeks
    console.print("\n[bold]Greeks:[/bold]")
    g = profile.greeks
    greeks_table = Table(show_header=False, box=None, padding=(0, 2))
    greeks_table.add_column("Greek", style="bold")
    greeks_table.add_column("Value", justify="right")
    greeks_table.add_row("Delta (net)", f"{g.delta:+.4f}")
    greeks_table.add_row("Gamma", f"{g.gamma:+.6f}")
    greeks_table.add_row("Theta (daily)", f"${g.theta:+.4f}")
    greeks_table.add_row("Vega", f"${g.vega:+.4f}")
    console.print(greeks_table)

    # P&L table
    console.print("\n[bold]P&L at Expiration:[/bold]")
    pnl_rows = risk.generate_pnl_table(cost_basis, strike, premium)
    pnl_table = Table(show_lines=True)
    pnl_table.add_column("Stock Price", justify="right")
    pnl_table.add_column("P&L/Share", justify="right")
    pnl_table.add_column("P&L/Contract", justify="right")
    pnl_table.add_column("Return %", justify="right")
    pnl_table.add_column("Assigned?")

    for row in pnl_rows:
        style = "green" if row["pnl_per_share"] >= 0 else "red"
        pnl_table.add_row(
            f"${row['stock_price']:.2f}",
            f"${row['pnl_per_share']:+.2f}",
            f"${row['pnl_per_contract']:+.2f}",
            f"{row['return_pct']:+.2f}%",
            "Yes" if row["assigned"] else "No",
            style=style,
        )
    console.print(pnl_table)


@main.command()
@click.pass_context
def portfolio(ctx: click.Context) -> None:
    """Show current portfolio and positions."""
    cfg = ctx.obj["config"]
    tracker = PortfolioTracker(cfg.portfolio_file)
    summary = tracker.get_position_summary()

    console.print(Panel("[bold]Portfolio Summary[/bold]"))
    info = Table(show_header=False, box=None, padding=(0, 2))
    info.add_column("Metric", style="bold")
    info.add_column("Value", justify="right")
    info.add_row("Open Positions", str(summary["open_positions"]))
    info.add_row("Total Positions", str(summary["total_positions"]))
    info.add_row("Total Invested", f"${summary['total_invested']:,.2f}")
    info.add_row("Premiums Collected", f"${summary['total_premiums_collected']:,.2f}")
    info.add_row("Realized P&L", f"${summary['total_realized_pnl']:,.2f}")
    info.add_row("Cash", f"${summary['cash']:,.2f}")
    console.print(info)

    open_positions = tracker.get_open_positions()
    if open_positions:
        console.print("\n[bold]Open Positions:[/bold]")
        pos_table = Table(show_lines=True)
        pos_table.add_column("ID", style="dim")
        pos_table.add_column("Symbol", style="bold cyan")
        pos_table.add_column("Shares", justify="right")
        pos_table.add_column("Cost Basis", justify="right")
        pos_table.add_column("Strike", justify="right")
        pos_table.add_column("Expiry")
        pos_table.add_column("Premium", justify="right", style="green")
        pos_table.add_column("Opened")

        for p in open_positions:
            pos_table.add_row(
                p.id[:20] + "...",
                p.symbol,
                str(p.shares),
                f"${p.avg_cost:.2f}",
                f"${p.call_strike:.2f}",
                p.call_expiration,
                f"${p.call_premium_received:.2f}",
                p.open_date,
            )
        console.print(pos_table)
    else:
        console.print("\n[dim]No open positions.[/dim]")


@main.command(name="add-position")
@click.argument("symbol")
@click.option("--shares", default=100, type=int, help="Number of shares (default: 100)")
@click.option("--cost", required=True, type=float, help="Cost basis per share")
@click.option("--strike", required=True, type=float, help="Call strike price")
@click.option("--expiration", required=True, help="Expiration date (YYYY-MM-DD)")
@click.option("--premium", required=True, type=float, help="Premium received per share")
@click.pass_context
def add_position(
    ctx: click.Context,
    symbol: str,
    shares: int,
    cost: float,
    strike: float,
    expiration: str,
    premium: float,
) -> None:
    """Add a covered call position to the portfolio."""
    cfg = ctx.obj["config"]
    tracker = PortfolioTracker(cfg.portfolio_file)
    position = tracker.open_position(
        symbol=symbol,
        shares=shares,
        avg_cost=cost,
        call_strike=strike,
        call_expiration=expiration,
        premium_per_contract=premium,
    )
    console.print(f"[green]Position opened: {position.id}[/green]")
    console.print(f"  Premium collected: ${position.call_premium_received:.2f}")


@main.command(name="close-position")
@click.argument("position_id")
@click.option("--price", required=True, type=float, help="Close/buyback price per share")
@click.option(
    "--status",
    type=click.Choice(["closed", "assigned", "expired"]),
    default="closed",
    help="How the position was closed",
)
@click.pass_context
def close_position(
    ctx: click.Context, position_id: str, price: float, status: str
) -> None:
    """Close or mark a position as assigned/expired."""
    cfg = ctx.obj["config"]
    tracker = PortfolioTracker(cfg.portfolio_file)
    pos = tracker.close_position(position_id, price, status)
    if pos:
        console.print(f"[green]Position {status}: {pos.id}[/green]")
        console.print(f"  Realized P&L: ${pos.realized_pnl:+.2f}")
    else:
        console.print(f"[red]Position not found or already closed: {position_id}[/red]")


@main.command()
@click.pass_context
def init(ctx: click.Context) -> None:
    """Initialize a new configuration file with defaults."""
    cfg = ctx.obj["config"]
    cfg.save()
    console.print("[green]Configuration saved to covered_call_config.json[/green]")
    console.print(f"  Watchlist: {', '.join(cfg.watchlist)}")
    console.print(f"  DTE range: {cfg.min_days_to_expiry}-{cfg.max_days_to_expiry} days")
    console.print(f"  Target moneyness: {cfg.target_moneyness:.0%} OTM")


if __name__ == "__main__":
    main()

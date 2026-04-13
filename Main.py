from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal
import numpy as np
import pandas as pd

app = FastAPI(title="InvestSafe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REQUEST MODELS ──────────────────────────────────────────────

class SimulationRequest(BaseModel):
    amount: float           # in INR
    horizon_years: int      # 1–20
    volatility: Literal[1, 2, 3]   # 1=Low, 2=Med, 3=High
    risk_level: Literal["low", "med", "high"] = "med"

class ExplainerRequest(BaseModel):
    amount: float
    horizon_years: int
    volatility: Literal[1, 2, 3]
    expected_return_pct: float   # from simulation result
    loss_probability: float      # from loss meter

class LossRequest(BaseModel):
    amount: float
    horizon_years: int
    volatility: Literal[1, 2, 3]
    num_simulations: int = 5000

# ── CONSTANTS ───────────────────────────────────────────────────

VOL_PARAMS = {
    1: {"mu": 0.07, "sigma": 0.05,  "label": "Low"},
    2: {"mu": 0.10, "sigma": 0.14,  "label": "Medium"},
    3: {"mu": 0.14, "sigma": 0.25,  "label": "High"},
}

ALLOCATION = {
    "equity":  0.40,
    "mf":      0.30,
    "gold":    0.20,
    "fd":      0.10,
}

# ── HELPERS ─────────────────────────────────────────────────────

def monte_carlo_paths(amount, horizon_years, volatility, n_paths=3, path_bias=None):
    """Generate n Monte-Carlo wealth paths using GBM."""
    mu    = VOL_PARAMS[volatility]["mu"]
    sigma = VOL_PARAMS[volatility]["sigma"]
    months = horizon_years * 12
    rng = np.random.default_rng()

    paths = []
    biases = path_bias or [0.7, 1.0, 1.6]   # best / expected / worst scaling

    for bias in biases:
        monthly_returns = (mu / 12) + (sigma / np.sqrt(12)) * rng.standard_normal(months) * bias
        wealth = np.concatenate([[amount], amount * np.cumprod(1 + monthly_returns)])
        wealth = np.maximum(wealth, 0)
        paths.append(wealth.tolist())

    return paths

def asset_allocation_values(amount, final_ret, horizon_years):
    """Per-asset final values and % change."""
    asset_returns = {
        "equity": final_ret * 1.3,
        "mf":     final_ret * 1.0,
        "gold":   final_ret * 0.5,
        "fd":     0.065 * horizon_years,
    }
    result = {}
    for asset, alloc in ALLOCATION.items():
        initial = round(amount * alloc, 2)
        ret = asset_returns[asset]
        final = round(initial * (1 + ret), 2)
        result[asset] = {
            "initial": initial,
            "final":   final,
            "change_pct": round(ret * 100, 2),
        }
    return result

# ── ENDPOINTS ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "api": "InvestSafe"}


@app.post("/api/simulate")
def simulate(req: SimulationRequest):
    """
    Run a 3-path Monte-Carlo simulation.
    Returns: paths, outcomes (best/expected/bad/worst), asset breakdown.
    """
    paths = monte_carlo_paths(req.amount, req.horizon_years, req.volatility)

    best_final  = paths[0][-1]
    exp_final   = paths[1][-1]
    bad_final   = paths[2][-1]
    worst_final = bad_final * 0.75

    final_ret = (exp_final / req.amount) - 1

    assets = asset_allocation_values(req.amount, final_ret, req.horizon_years)

    # Build time labels (months)
    months = req.horizon_years * 12
    labels = []
    for i in range(months + 1):
        if i == 0:
            labels.append("Now")
        elif i % 12 == 0:
            labels.append(f"Y{i // 12}")
        else:
            labels.append("")

    def pct(v):
        return round((v / req.amount - 1) * 100, 2)

    return {
        "paths": paths,
        "labels": labels,
        "outcomes": {
            "best":  {"value": round(best_final, 2),  "change_pct": pct(best_final)},
            "expected": {"value": round(exp_final, 2), "change_pct": pct(exp_final)},
            "bad":   {"value": round(bad_final, 2),   "change_pct": pct(bad_final)},
            "worst": {"value": round(worst_final, 2), "change_pct": pct(worst_final)},
        },
        "assets": assets,
        "volatility_label": VOL_PARAMS[req.volatility]["label"],
    }


@app.post("/api/loss-probability")
def loss_probability(req: LossRequest):
    """
    Run N Monte-Carlo simulations and compute:
    - probability of any loss
    - probability of >10%, >25%, >50% loss
    - VaR (5th percentile)
    - Expected Shortfall
    - distribution histogram data
    Uses pandas for aggregation.
    """
    mu    = VOL_PARAMS[req.volatility]["mu"]
    sigma = VOL_PARAMS[req.volatility]["sigma"]
    months = req.horizon_years * 12
    rng = np.random.default_rng(42)

    # Simulate final wealth for N paths
    monthly_ret = (mu / 12) + (sigma / np.sqrt(12)) * rng.standard_normal((req.num_simulations, months))
    final_wealth = req.amount * np.prod(1 + monthly_ret, axis=1)

    # Pandas series for clean aggregation
    s = pd.Series(final_wealth)
    returns_pct = (s / req.amount - 1) * 100

    loss_prob        = round(float((s < req.amount).mean() * 100), 2)
    loss_gt10_prob   = round(float((returns_pct < -10).mean() * 100), 2)
    loss_gt25_prob   = round(float((returns_pct < -25).mean() * 100), 2)
    loss_gt50_prob   = round(float((returns_pct < -50).mean() * 100), 2)

    var_5  = round(float(np.percentile(final_wealth, 5)), 2)
    var_1  = round(float(np.percentile(final_wealth, 1)), 2)
    es_5   = round(float(s[s <= var_5].mean()), 2)   # Expected Shortfall

    # Histogram (20 bins) for front-end bar chart
    counts, bin_edges = np.histogram(final_wealth, bins=20)
    histogram = [
        {"bin_start": round(float(bin_edges[i]), 0),
         "bin_end":   round(float(bin_edges[i+1]), 0),
         "count":     int(counts[i])}
        for i in range(len(counts))
    ]

    # Fear index: 0–100 composite score
    fear_index = round(min(loss_prob * 1.2, 100), 1)

    return {
        "loss_probability":     loss_prob,
        "loss_gt10_pct":        loss_gt10_prob,
        "loss_gt25_pct":        loss_gt25_prob,
        "loss_gt50_pct":        loss_gt50_prob,
        "var_5pct":             var_5,
        "var_1pct":             var_1,
        "expected_shortfall":   es_5,
        "fear_index":           fear_index,
        "median_final":         round(float(s.median()), 2),
        "mean_final":           round(float(s.mean()), 2),
        "histogram":            histogram,
        "num_simulations":      req.num_simulations,
    }


@app.post("/api/explain")
def explain(req: ExplainerRequest):
    """
    Rule-based AI explainer that generates contextual investment advice
    based on volatility, horizon, and simulation results.
    Returns structured paragraphs + key tips.
    """
    vol_label = VOL_PARAMS[req.volatility]["label"]
    amt_fmt = f"₹{req.amount:,.0f}"
    ret_fmt = f"{req.expected_return_pct:+.1f}%"
    loss_fmt = f"{req.loss_probability:.0f}%"

    # ── Core analysis ──
    if req.volatility == 1:
        risk_profile = "Conservative"
        summary = (
            f"Your {amt_fmt} portfolio is positioned for steady, low-risk growth. "
            f"With Fixed Deposits and Bonds dominating, capital preservation is your priority."
        )
        horizon_advice = (
            f"Over {req.horizon_years} year(s), stable instruments compound reliably. "
            f"Expected annualised return is ~7%. You won't beat inflation spectacularly, "
            f"but you also won't lose sleep."
        )
        loss_insight = (
            f"Historical data shows only a {loss_fmt} chance of ending in loss at this horizon. "
            f"Even in downturns, FD rates hold your floor."
        )
        tips = [
            "Consider a small equity SIP to beat inflation over time.",
            "Ladder your FDs across 1, 2 & 3-year terms for liquidity.",
            "Gold ETF provides a natural hedge against currency risk.",
            "Reinvest interest income to harness compounding."
        ]
        emoji = "🌿"

    elif req.volatility == 2:
        risk_profile = "Balanced"
        summary = (
            f"Your {amt_fmt} portfolio strikes a healthy balance between growth and stability. "
            f"Equity and Mutual Funds drive returns while Gold and FD cushion drawdowns."
        )
        horizon_advice = (
            f"Over {req.horizon_years} year(s), a balanced mix historically delivers 10–13% p.a. "
            f"Drawdowns of 20–30% are possible but temporary — markets have recovered "
            f"within 2–4 years every time in Indian history."
        )
        loss_insight = (
            f"With a {loss_fmt} loss probability, {req.horizon_years} years gives markets enough "
            f"time to recover. The longer you hold, the lower this risk becomes."
        )
        tips = [
            "Use SIP to average your cost during volatile phases.",
            "Rebalance annually — equity tends to drift higher over time.",
            "Don't exit during corrections; they are buying opportunities.",
            f"At your {req.horizon_years}-year horizon, equity allocation is appropriate."
        ]
        emoji = "⚖️"

    else:
        risk_profile = "Aggressive"
        summary = (
            f"Your {amt_fmt} portfolio is built for maximum growth. "
            f"High equity and volatile assets mean significant short-term swings — "
            f"but historically, this is the best wealth-building strategy over long horizons."
        )
        horizon_advice = (
            f"Over {req.horizon_years} year(s), Indian equity markets have delivered 14–16% CAGR "
            f"historically. Intra-year drops of 40%+ are possible and normal. "
            f"{'This horizon is ideal for riding out volatility.' if req.horizon_years >= 7 else 'Consider extending your horizon to 7+ years for aggressive allocations.'}"
        )
        loss_insight = (
            f"A {loss_fmt} short-term loss probability sounds scary — but zoom out. "
            f"Every market crash in history has been followed by a stronger recovery. "
            f"Volatility is the price of superior long-term returns."
        )
        tips = [
            "Never invest money you need within 3 years in high-vol assets.",
            "SIP eliminates timing risk — automate your investments.",
            "Diversify across sectors; avoid concentrating in a single stock.",
            "Keep 6 months of expenses in liquid funds as an emergency buffer."
        ]
        emoji = "🔥"

    # ── Portfolio allocation explanation ──
    allocation_notes = {
        "equity":  f"40% Equity: Highest return potential, highest short-term risk. Core growth engine.",
        "mf":      f"30% Mutual Funds: Professionally managed diversification. Reduces stock-picking risk.",
        "gold":    f"20% Gold ETF: Inverse correlation with equity. Your portfolio shock absorber.",
        "fd":      f"10% Fixed Deposit: Guaranteed returns, full capital safety. Liquidity anchor.",
    }

    return {
        "risk_profile":      risk_profile,
        "emoji":             emoji,
        "summary":           summary,
        "horizon_advice":    horizon_advice,
        "loss_insight":      loss_insight,
        "tips":              tips,
        "allocation_notes":  allocation_notes,
        "expected_return":   ret_fmt,
        "volatility_label":  vol_label,
        "confidence_score":  round(100 - req.loss_probability, 1),
    }
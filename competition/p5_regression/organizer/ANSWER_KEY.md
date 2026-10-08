# Problem 5 — Answer key (organizer only)

True process: `price = 60000 + 190*area_sqft + 11000*bedrooms - 4500*dist_km + 55*(age-30)^2 + noise`,
`noise ~ N(0, (14*area_sqft)^2)`.  Regenerate everything with `python gen_housing.py` (seeded; deterministic).

| # | Trap | Planted as | Caught by | Fix |
|---|---|---|---|---|
| 1 | Multicollinearity | `area_sqm = 0.092903*area_sqft + N(0,0.08)` | VIF ≈ 893,000 for both areas; naive coefficients absurd (area_sqft ≈ −3359, area_sqm ≈ +39059) | drop one column, or Ridge (the penalty spreads weight over correlated columns, so the fit is stable) |
| 2 | Leak | `price_per_sqft = price/area_sqft` in train; stale shuffled values in test/holdout | train R² ≈ 0.94 vs test R² ≈ 0.27; the column is a function of the target; wouldn't exist at inference | drop it — deleting the best-looking feature is the point |
| 3 | Non-linearity | `+55*(age-30)^2` (U-shape) | residuals-vs-fitted / residuals-vs-age show a curve | add `(age-30)^2` or `age^2` |
| 4 | Heteroscedasticity + 3 outliers | noise sd ∝ area; 3 luxury homes (5200–6200 sqft, price ×1.7 + 250k) | residuals fan out with fitted value; leverage/Cook's distance flags the 3 rows | Huber/RANSAC, or justified removal; WLS / log-price for the variance |

Reference numbers on the hidden holdout (R²): naive 0.35 · leak dropped only 0.92 · +quadratic 0.936 · +Huber/outliers removed ≈ 0.97.

## Platform grader (`backend/app/phase1/games/g5_regression.py`) — 10 points
leak not in features 2.0 · coefficients sane 1.5 · non-linearity (age-tail bias < 3% of mean price) 1.5 ·
outliers (large-home bias < 2%) 1.5 · stability (5 seeds, min R² ≥ 0.93, spread ≤ 0.03) 1.0 ·
report lines 0.5 each (2.0, keyword-checked) · numeric VIF evidence in the report 0.5.
Coefficient sanity (original units): `area_sqft` ∈ [0, 600], `area_sqm` ∈ [0, 6500], `dist_km` ≤ 0 and ≥ −12000,
`bedrooms` ∈ [−30000, 40000], plus the effective price per sqft (`area_sqft + area_sqm/0.092903`) must be ≥ 0.

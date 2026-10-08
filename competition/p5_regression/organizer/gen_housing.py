"""Generate the Problem 5 datasets with all four traps built in.

    python gen_housing.py            -> ../handout/housing.csv, ../handout/housing_test.csv,
                                        hidden_holdout.csv (+ hidden_holdout_features.csv)  [organizer only]

TRUE PROCESS (the answer key):
    price = 60_000 + 190*area_sqft + 11_000*bedrooms - 4_500*dist_km + 55*(age-30)^2 + noise
    noise ~ N(0, (14*area_sqft)^2)                         # trap 4a: heteroscedastic (sd grows with size)

TRAPS
  1. Multicollinearity : area_sqm = area_sqft*0.092903 + tiny noise  (near-duplicate of area_sqft)
  2. Leak              : price_per_sqft = price / area_sqft (computed from the target).
                         In housing.csv (train) the leak is exact. In housing_test.csv and the hidden holdout it
                         is a STALE market-feed value (a shuffled train value): not tied to this sale any more,
                         exactly as it would be at inference time. => naive fit: train R^2 ~0.99, test collapses.
  3. Non-linearity     : (age-30)^2 term (U-shaped: new builds and heritage homes are dear).
  4. Outliers          : 3 luxury homes in train (very large, priced ~1.7x the trend) drag an OLS line.
"""
import csv
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "handout")
SQM = 0.092903
COLS = ["area_sqft", "area_sqm", "bedrooms", "age", "dist_km", "price_per_sqft", "price"]


def make(n, rng, outliers=0):
    area = rng.uniform(700, 3400, n)
    bedrooms = np.clip(np.round(area / 800 + rng.normal(0, 0.6, n)), 1, 6)
    age = rng.uniform(0, 70, n)
    dist = rng.uniform(1, 25, n)
    noise = rng.normal(0, 1, n) * 14 * area
    if outliers:
        idx = rng.choice(n, outliers, replace=False)
        area[idx] = rng.uniform(5200, 6200, outliers)
        bedrooms[idx] = 6
        age[idx] = rng.uniform(3, 15, outliers)
        dist[idx] = rng.uniform(1, 4, outliers)
    trend = 60_000 + 190 * area + 11_000 * bedrooms - 4_500 * dist + 55 * (age - 30) ** 2
    price = trend + noise
    if outliers:
        price[idx] = trend[idx] * 1.7 + 250_000
    sqm = area * SQM + rng.normal(0, 0.08, n)
    return dict(area_sqft=area, area_sqm=sqm, bedrooms=bedrooms, age=age, dist_km=dist, price=price)


def write(path, d, cols):
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for i in range(len(d["price"])):
            w.writerow([f"{d[c][i]:.2f}" if c not in ("bedrooms",) else int(d[c][i]) for c in cols])


def main():
    rng = np.random.default_rng(20261008)
    train = make(500, rng, outliers=3)
    train["price_per_sqft"] = train["price"] / train["area_sqft"]
    pool = train["price_per_sqft"].copy()

    def stale(n):
        return rng.choice(pool, n, replace=True)

    test = make(150, rng)
    test["price_per_sqft"] = stale(150)
    hidden = make(300, rng)
    hidden["price_per_sqft"] = stale(300)

    os.makedirs(OUT, exist_ok=True)
    write(os.path.join(OUT, "housing.csv"), train, COLS)
    write(os.path.join(OUT, "housing_test.csv"), test, COLS)
    write(os.path.join(HERE, "hidden_holdout.csv"), hidden, COLS)
    write(os.path.join(HERE, "hidden_holdout_features.csv"), hidden, [c for c in COLS if c != "price"])
    print("wrote housing.csv (500), housing_test.csv (150), hidden_holdout.csv (300)")


if __name__ == "__main__":
    main()

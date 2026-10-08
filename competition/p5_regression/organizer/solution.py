"""Reference solution: drop leak + duplicate, quadratic age, Huber."""
import numpy as np
import pandas as pd
from sklearn.linear_model import HuberRegressor

train_df = pd.read_csv("housing.csv")
test_df = pd.read_csv("housing_test.csv")
FEATS = ["area_sqft", "bedrooms", "dist_km", "age", "age_sq"]


def _prep(d):
    d = d.copy()
    d["age_sq"] = (d["age"] - 30) ** 2
    return d[FEATS].to_numpy(float)


def fit_predict(train_df, test_df):
    X, y = _prep(train_df), train_df["price"].to_numpy(float)
    mu, sd = X.mean(0), X.std(0)
    m = HuberRegressor(max_iter=5000).fit((X - mu) / sd, y)
    coef = m.coef_ / sd
    return m.predict((_prep(test_df) - mu) / sd), dict(zip(FEATS, coef))


report = {
    "leak": "price_per_sqft = price/area_sqft is computed from the target; train R2 0.94 but test R2 0.27 once it is stale; dropped.",
    "collinearity": "VIF for area_sqft and area_sqm is ~893000 (>10): near duplicates, coefficients -3359/+39059; dropped area_sqm.",
    "nonlinearity": "Residuals-vs-age plot shows a U-shaped curve; added (age-30)^2.",
    "outliers": "Residuals-vs-fitted fans out (heteroscedastic) and Cook's distance flags 3 luxury homes; used HuberRegressor.",
}

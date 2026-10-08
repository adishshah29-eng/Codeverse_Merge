"""Starter: the naive model, plus the template the grader expects.

Run it:   python starter.py
Then diagnose (residuals-vs-fitted plot, VIF, ...) and rewrite `fit_predict` below.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

train_df = pd.read_csv("housing.csv")
test_df = pd.read_csv("housing_test.csv")      # has the true price so you can score yourself locally


def fit_predict(train_df, test_df):
    """Fit on `train_df` and return (predictions for test_df rows, coefficients).

    * `test_df` may or may not contain `price` -- never read it.
    * `coefficients` is a dict {feature name: value in ORIGINAL units of that column}
      for the final model (engineered features like "age_sq" are allowed). The keys are
      taken to be the features you actually use, so do not list features you dropped.
    """
    features = [c for c in train_df.columns if c != "price"]          # naive: everything
    model = LinearRegression().fit(train_df[features], train_df["price"])
    return model.predict(test_df[features]), dict(zip(features, model.coef_))


# One line per trap: name the trap and the diagnostic that caught it.
report = {
    "leak": "",
    "collinearity": "",
    "nonlinearity": "",
    "outliers": "",   # outliers and/or heteroscedasticity
}

if __name__ == "__main__":
    preds, coefs = fit_predict(train_df, test_df)
    feats = list(coefs)
    in_sample, _ = fit_predict(train_df, train_df)
    print("train R2:", round(r2_score(train_df["price"], in_sample), 4))
    print("test  R2:", round(r2_score(test_df["price"], preds), 4))
    print({k: round(float(v), 1) for k, v in coefs.items()})

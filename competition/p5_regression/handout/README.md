# Problem 5 — Linear regression: the model that lies to you

Files: `housing.csv` (500 rows, train), `housing_test.csv` (150 rows, for local scoring), `starter.py`.

Fit a plain `LinearRegression().fit()` on the data as given (run `python starter.py`) and you will see a
suspiciously high **training R²** and a much worse **test R²**. Something is wrong with the data, the model,
or both. **Diagnose it, fix it, and justify every change.** The exercise is the diagnosis, not the `.fit()`.
A model that merely scores high once is not enough: it must be stable and its coefficients must make sense.

Diagnose *before* you fix. The two tools that expose most of this: a **residuals-vs-fitted plot** and a **VIF check**
(`pip install pandas numpy scikit-learn matplotlib`; VIF = 1/(1-R²) of regressing a feature on the others).

## What the grader checks (on a hidden holdout, over 5 resampled seeds)
1. you no longer use a feature that wouldn't exist at prediction time;
2. no absurd coefficients (a one-sentence explanation must exist for each);
3. the model captures the shape of the relationships (look at the residuals);
4. the fit is not dragged around by a few extreme houses / non-constant error;
5. R² is stable across seeds, not just high on one split;
6. one line per trap in `report`, naming which diagnostic caught it (quote the numbers, e.g. the VIF values).

## Submit
Your finished code with `fit_predict(train_df, test_df) -> (predictions, coefficients)` and the `report` dict
(see `starter.py`). It runs with `housing.csv` / `housing_test.csv` in the working directory and a 45 s limit.

# XGBoost Model

## Model Description

The core model uses XGBoost (`xgboost` v3.3) to predict future cumulative demand per product and branch. It is trained on a multi-dimensional feature set derived from historical sales and inventory records.

## Feature Groups

| Feature Group | Examples |
|---|---|
| Temporal | Month, week of year, day of week, quarter |
| Lag features | Demand at t-1, t-7, t-14, t-28 |
| Rolling statistics | 7-day and 28-day rolling mean, std |
| Inventory signals | Stock level, stock-to-demand ratio |
| Calendar | Holidays, weekend flag |
| Categorical (encoded) | Product, branch, category |

## Evaluation Metrics

The model is evaluated on a held-out chronological test set using:

| Metric | Description |
|---|---|
| MAE | Mean Absolute Error |
| RMSE | Root Mean Squared Error |
| R² | Coefficient of determination |
| MAPE | Mean Absolute Percentage Error |

## Generated Artifacts

All artifacts are stored in `artefactos/` and are versioned in git for reproducibility:

| File | Description |
|---|---|
| `config_modelo.json` | Model hyperparameters, feature list, and metadata |
| `label_encoders.pkl` | Fitted scikit-learn encoders for categorical variables |
| `dataset_procesado.csv` | Processed dataset used for inference |

The trained model itself is registered in the local MLflow experiment store (`mlruns/`, gitignored).

## Reproducibility

To retrain the model from scratch:

```bash
# 1. Install dependencies
uv sync --extra dev

# 2. Execute the training notebook
uv run jupyter nbconvert --to notebook --execute notebooks/Modelo_Mariscos.ipynb
```

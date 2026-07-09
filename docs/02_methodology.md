# Methodology

## Workflow

The project follows a strict sequential pipeline to avoid data leakage and ensure reproducibility:

1. **Data loading and cleaning** — raw sales records from `files/` are ingested and standardized
2. **Exploratory data analysis** — distributions, time series patterns, and cross-variable correlations examined in `EDA-MARISCOS.ipynb`
3. **Feature engineering** — temporal lags, rolling averages, calendar signals (month, weekday, holidays), and inventory indicators
4. **Time-based model training** — XGBoost trained using a chronological train/validation split to prevent future data leakage
5. **Artifact export** — trained encoders, model configuration, and the processed dataset are saved to `artefactos/` for inference
6. **Prediction and inference** — `Funcion_Prediccion.ipynb` and the FastAPI endpoint demonstrate model consumption

## Best Practices

| Practice | Implementation |
|---|---|
| Clear separation of concerns | EDA, training, and inference in separate notebooks |
| No data leakage | Strictly chronological train/test splits |
| Dependency pinning | All dependencies locked in `pyproject.toml` via `uv` |
| Clean notebook commits | Cell outputs stripped before every commit via `nbstripout` |
| Reproducibility | Artifacts and config versioned in `artefactos/` |
| Code quality | `ruff` enforces formatting and linting; `pre-commit` runs on every commit |

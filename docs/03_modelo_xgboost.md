# Modelo XGBoost

El modelo principal usa XGBoost para predecir la demanda acumulada futura. El entrenamiento contempla variables temporales, lags, medias móviles, inventario y señales de calendario.

## Artefactos generados

- `artefactos/config_modelo.json`
- `artefactos/label_encoders.pkl`
- `artefactos/dataset_procesado.csv`
- Modelo registrado en MLflow

## Consideraciones

- El modelo se evalúa con métricas como MAE, RMSE, R² y MAPE.
- La validación respeta el orden cronológico.
- El registro del experimento permite recuperar el modelo para predicción posterior.

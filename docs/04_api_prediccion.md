# API de Predicción

La API FastAPI expone el modelo entrenado para realizar predicciones de demanda.

## Endpoints propuestos

- `GET /health`: verificación de estado.
- `GET /`: mensaje de bienvenida.
- `POST /predict`: predicción para productos, sucursales y fechas.

## Dependencias clave

- FastAPI
- Uvicorn
- MLflow
- Joblib
- Pandas
- Scikit-learn

## Ejecución local

```bash
uv run uvicorn mariscos_api.main:app --reload
```

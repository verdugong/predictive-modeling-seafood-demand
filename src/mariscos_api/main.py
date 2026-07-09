from fastapi import FastAPI

app = FastAPI(
    title="Predicción de Demanda de Mariscos",
    version="0.1.0",
    description="API FastAPI para consultar predicciones del modelo XGBoost",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "API de predicción de demanda de mariscos"}


def main() -> None:
    """Entry point opcional para ejecuciones directas."""
    import uvicorn

    uvicorn.run("mariscos_api.main:app", host="0.0.0.0", port=8000, reload=True)

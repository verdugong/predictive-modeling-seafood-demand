from fastapi import FastAPI

app = FastAPI(
    title="Seafood Demand Prediction API",
    version="0.1.0",
    description="FastAPI endpoint for querying XGBoost demand forecasting predictions",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    """Return a welcome message with basic service information."""
    return {"message": "Seafood demand prediction API — see /docs for the full API reference"}


def main() -> None:
    """Entry point for direct execution via `uv run api`."""
    import uvicorn

    uvicorn.run("mariscos_api.main:app", host="0.0.0.0", port=8000, reload=True)

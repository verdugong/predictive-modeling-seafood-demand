"""FastAPI entrypoint for the seafood inventory prediction service."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import OptionsResponse, PredictionRequest, PredictionResponse
from .services.model_service import AppState, load_state, predict_series


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model_state = load_state()
    yield


app = FastAPI(
    title="Mariscos Inventory API",
    version="1.0.0",
    description="Backend de inferencia para predicción de inventario de una tienda de mariscos.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_state() -> AppState:
    state = getattr(app.state, "model_state", None)
    if state is None:
        raise RuntimeError("El estado del modelo no está cargado.")
    return state


@app.get("/opciones", response_model=OptionsResponse)
def opciones() -> OptionsResponse:
    state = get_state()
    return OptionsResponse(productos=state.product_options, sucursales=state.branch_options)


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    state = get_state()

    try:
        resultados = predict_series(
            state=state,
            productos=payload.productos,
            sucursales=payload.sucursales,
            fechas=payload.fechas,
            festivo=payload.festivo,
            vispera_festivo=payload.vispera_festivo,
        )
        return PredictionResponse(resultados=resultados)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - safeguard for runtime faults
        raise HTTPException(status_code=500, detail=f"Error inesperado al predecir: {exc}") from exc


@app.get("/")
def root() -> dict:
    return {
        "message": "Seafood inventory API running",
        "endpoints": ["/opciones", "/predict"],
    }

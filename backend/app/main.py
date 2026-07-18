"""FastAPI entrypoint for the seafood inventory prediction service."""

from __future__ import annotations

import logging
import os
import time

from typing import List, Optional
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

from .logging_config import log_event, setup_logging
from .middleware import RequestLoggingMiddleware
from .schemas import LimeExplainRequest, LimeExplainResponse, OptionsResponse, PredictionRequest, PredictionResponse
from .services.model_service import AppState, explicar_prediccion_individual, load_state, predict_series

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatRequest(BaseModel):
    mensaje: str
    contexto_predicciones: Optional[List[dict]] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🟢 INICIANDO SISTEMA: API de Predicción de Mariscos")
    logger.info("Cargando modelo ONNX y artefactos desde /artefactos...")
    app.state.model_state = load_state()
    logger.info("Sistema listo y en ejecución. Escuchando peticiones.")
    yield
    logger.info("🛑 APAGANDO SISTEMA...")


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
app.add_middleware(RequestLoggingMiddleware)


def get_state() -> AppState:
    state = getattr(app.state, "model_state", None)
    if state is None:
        logger.error("El estado del modelo no está cargado.")
        raise RuntimeError("El estado del modelo no está cargado.")
    return state


@app.get("/opciones", response_model=OptionsResponse)
def opciones() -> OptionsResponse:
    logger.info("Solicitud GET recibida en /opciones (Poblando frontend)")
    state = get_state()
    return OptionsResponse(productos=state.product_options, sucursales=state.branch_options)


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    state = get_state()
    start = time.perf_counter()
    log_event(
        logger,
        logging.INFO,
        "prediction_started",
        productos_count=len(payload.productos),
        sucursales_count=len(payload.sucursales),
        fechas_count=len(payload.fechas),
        festivo=payload.festivo,
        vispera_festivo=payload.vispera_festivo,
        horizonte=payload.horizonte,
    )

    try:
        resultados = predict_series(
            state=state,
            productos=payload.productos,
            sucursales=payload.sucursales,
            fechas=payload.fechas,
            festivo=payload.festivo,
            vispera_festivo=payload.vispera_festivo,
            horizonte=payload.horizonte,
        )
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "prediction_completed",
            productos_count=len(payload.productos),
            sucursales_count=len(payload.sucursales),
            resultados_count=len(resultados),
            horizonte=payload.horizonte,
            duration_ms=duration_ms,
        )
        return PredictionResponse(resultados=resultados)
    except ValueError as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.WARNING,
            "prediction_failed",
            error_type="ValueError",
            error=str(exc),
            duration_ms=duration_ms,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - safeguard for runtime faults
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.ERROR,
            "prediction_failed",
            error_type=type(exc).__name__,
            error=str(exc),
            duration_ms=duration_ms,
        )
        raise HTTPException(status_code=500, detail=f"Error inesperado al predecir: {exc}") from exc


@app.post("/explicar", response_model=LimeExplainResponse)
def explicar(payload: LimeExplainRequest) -> LimeExplainResponse:
    """On-demand LIME explanation for a single prediction row (never run in bulk over /predict)."""
    state = get_state()
    start = time.perf_counter()
    log_event(
        logger,
        logging.INFO,
        "lime_explain_started",
        producto=payload.producto,
        sucursal=payload.sucursal,
        horizonte=payload.horizonte,
    )

    try:
        factores = explicar_prediccion_individual(
            state=state,
            producto=payload.producto,
            sucursal=payload.sucursal,
            fecha=payload.fecha,
            horizonte=payload.horizonte,
            festivo=payload.festivo,
            vispera_festivo=payload.vispera_festivo,
        )
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "lime_explain_completed",
            factores_count=len(factores),
            duration_ms=duration_ms,
        )
        return LimeExplainResponse(factores=factores)
    except ValueError as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.WARNING,
            "lime_explain_failed",
            error_type="ValueError",
            error=str(exc),
            duration_ms=duration_ms,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    start = time.perf_counter()
    datos_contexto = "Sin datos en la tabla aún."
    context_items = 0
    if req.contexto_predicciones:
        datos_contexto = str(req.contexto_predicciones)
        context_items = len(req.contexto_predicciones)

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres el analista financiero y operativo en jefe de una distribuidora de mariscos y congelados en Ecuador. "
                        "Tu tono debe ser completamente formal, serio y profesional, enfocado en apoyar la toma de decisiones gerenciales.\n\n"
                        "REGLAS DE PRECIOS Y CÁLCULOS:\n"
                        "1. Aplica un precio unitario realista en dólares (USD). ESTRICTAMENTE los precios deben estar en un rango normal del mercado ecuatoriano (ej. entre $1.50 y $25.00 máximo por unidad/kilo). Por ejemplo: Nuggets de pollo ~$3.50, Camarón ~$7.00, Atún ~$4.50. NUNCA generes precios desorbitados como 100 o 1500.\n"
                        "2. Presenta el precio siempre como el 'precio oficial del catálogo'. NUNCA uses términos como 'supongamos', 'inventado', 'ficticio', 'asumiendo' o 'escenario hipotético'. Habla con total certeza.\n"
                        "3. Realiza el cálculo de ingresos proyectados multiplicando las unidades del contexto por el precio de catálogo.\n\n"
                        "REGLAS DE FORMATO Y PRESENTACIÓN:\n"
                        "1. Presenta el desglose diario estrictamente en una tabla Markdown con las columnas: Fecha | Producto | Unidades | Precio Unitario | Ingreso Proyectado.\n"
                        "2. Para facilitar la lectura técnica, los números mayores a mil no deben usar separadores de miles con coma (ejemplo: usa 1500.00 en lugar de 1,500.00).\n"
                        "3. Debajo de la tabla, resalta el Ingreso Total Proyectado de manera directa y cierra con una breve conclusión operativa sin tecnicismos excesivos.\n\n"
                        f"CONTEXTO DE PREDICCIONES (7 Días): {datos_contexto}"
                    )
                },
                {"role": "user", "content": req.mensaje}
            ]
        )
        respuesta_ia = response.choices[0].message.content
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "chat_request",
            status="success",
            message_length=len(req.mensaje),
            context_items=context_items,
            response_length=len(respuesta_ia or ""),
            duration_ms=duration_ms,
        )
        return {"respuesta": respuesta_ia}
    except Exception as e:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            logger,
            logging.ERROR,
            "chat_request",
            status="error",
            message_length=len(req.mensaje),
            context_items=context_items,
            error_type=type(e).__name__,
            duration_ms=duration_ms,
        )
        return {"respuesta": "Hubo un error de conexión con el agente de IA."}

@app.get("/")
def root() -> dict:
    logger.info("Solicitud GET en la ruta raíz (/)")
    return {
        "message": "Seafood inventory API running",
        "endpoints": ["/opciones", "/predict", "/explicar", "/chat"],
    }

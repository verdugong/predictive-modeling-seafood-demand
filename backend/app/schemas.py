"""Pydantic models for the FastAPI service."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Horizonte = Literal["semanal", "mensual"]
UnidadMedida = Literal["lb", "unidades"]


class OptionItem(BaseModel):
    id: str
    label: str
    category: Optional[str] = None
    sucursales: Optional[List[str]] = None
    product_clean: Optional[str] = None
    presentation: Optional[str] = None
    unidad_medida: Optional[UnidadMedida] = None


class OptionsResponse(BaseModel):
    productos: List[OptionItem]
    sucursales: List[OptionItem]


class PredictionRequest(BaseModel):
    productos: List[str] = Field(..., min_length=1, description="Unique product keys")
    sucursales: List[str] = Field(..., min_length=1, description="Branch names")
    fechas: List[str] = Field(..., min_length=1, description="ISO date strings")
    festivo: int = Field(0, ge=0, le=1)
    vispera_festivo: int = Field(0, ge=0, le=1)
    horizonte: Horizonte = Field(
        "semanal",
        description=(
            "'semanal': salida directa del modelo (target_7d), 7 días desde 'fechas'. "
            "'mensual': suma de 4 estimaciones semanales independientes, ancladas cada "
            "7 días a partir de 'fechas', sin encadenar lags/medias móviles entre semanas."
        ),
    )


class PredictionItem(BaseModel):
    producto: str
    sucursal: str
    fecha: str
    horizonte: Horizonte
    unidades_estimadas_7d: float


class PredictionResponse(BaseModel):
    resultados: List[PredictionItem]


class LimeExplainRequest(BaseModel):
    """Explains a single already-shown prediction row, on demand — LIME is never
    run for a whole /predict batch, only for the one row the user asks about."""

    producto: str
    sucursal: str
    fecha: str
    horizonte: Horizonte = "semanal"
    festivo: int = Field(0, ge=0, le=1)
    vispera_festivo: int = Field(0, ge=0, le=1)


class LimeFactorItem(BaseModel):
    direccion: Literal["sube", "baja"]
    texto: str


class LimeExplainResponse(BaseModel):
    factores: List[LimeFactorItem]

"""Pydantic models for the FastAPI service."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class OptionItem(BaseModel):
    id: str
    label: str


class OptionsResponse(BaseModel):
    productos: List[OptionItem]
    sucursales: List[OptionItem]


class PredictionRequest(BaseModel):
    productos: List[str] = Field(..., min_length=1, description="Unique product keys")
    sucursales: List[str] = Field(..., min_length=1, description="Branch names")
    fechas: List[str] = Field(..., min_length=1, description="ISO date strings")
    festivo: int = Field(0, ge=0, le=1)
    vispera_festivo: int = Field(0, ge=0, le=1)


class PredictionItem(BaseModel):
    producto: str
    sucursal: str
    fecha: str
    unidades_estimadas_30d: float
    justificacion_inventario: str


class PredictionResponse(BaseModel):
    resultados: List[PredictionItem]

# Predicción de Demanda de Mariscos con XGBoost

Repositorio del proyecto de predicción de ventas futuras para productos del mar. Incluye tres notebooks principales, documentación en `docs/`, una API FastAPI para consumo del modelo, y configuración de entorno con `uv`.

## Estructura

- `notebooks/`: notebooks de trabajo y versiones sin outputs en Markdown.
- `docs/`: documentación del proyecto.
- `src/mariscos_api/`: API FastAPI.
- `artefactos/`: configuración, encoders y dataset procesado necesarios para la inferencia.
- `files/`: insumos y datos auxiliares del EDA.

## Componentes del proyecto

- `EDA-MARISCOS.ipynb`: análisis exploratorio.
- `Modelo_Mariscos.ipynb`: entrenamiento, validación y exportación del modelo.
- `Funcion_Prediccion.ipynb`: carga del modelo y función de predicción.

## Requisitos

- Python 3.13.x
- `uv`

## Instalación

```bash
uv sync
```

## Ejecución de la API

```bash
uv run uvicorn mariscos_api.main:app --reload
```

## Calidad y estilo

- `ruff` para lint y formato.
- `pre-commit` para validaciones automáticas.

## Notas

- Los notebooks deben mantenerse sin outputs antes de publicar.
- Los archivos generados por entrenamiento, como `mlruns/` y figuras intermedias, no deben versionarse salvo que sean necesarios para reproducibilidad.

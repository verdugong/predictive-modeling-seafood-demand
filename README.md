# Predicción de Demanda de Mariscos con XGBoost

Proyecto de predicción de demanda para productos del mar, preparado para publicarse en GitHub con notebooks ordenados, documentación técnica, artefactos de inferencia y una API FastAPI para servir predicciones.

## Qué incluye

- Tres notebooks en `notebooks/` para EDA, entrenamiento y predicción.
- Cuatro documentos en `docs/` para resumir el proyecto, la metodología, el modelo y la API.
- Una API FastAPI en `src/mariscos_api/`.
- Artefactos listos para inferencia en `artefactos/`.
- Automatización con `uv`, `Makefile` y `pre-commit`.

## Estructura del repositorio

- `notebooks/`: notebooks principales y sus versiones en Markdown.
- `docs/`: documentación del proyecto.
- `src/mariscos_api/`: aplicación FastAPI.
- `artefactos/`: configuración, codificadores y dataset procesado para inferencia.
- `files/`: insumos y recursos auxiliares del análisis.
- `tools/`: utilidades para limpiar y exportar notebooks.

## Notebooks principales

- `notebooks/EDA-MARISCOS.ipynb`: análisis exploratorio del dataset.
- `notebooks/Modelo_Mariscos.ipynb`: entrenamiento, validación y exportación del modelo.
- `notebooks/Funcion_Prediccion.ipynb`: carga del modelo y función de predicción.

## Requisitos

- Python 3.13.x
- `uv`

## Instalación

```bash
uv sync
```

## Comandos útiles

```bash
make format
make lint
make export-notebooks
make clear-notebooks
```

## Ejecutar la API

```bash
uv run uvicorn mariscos_api.main:app --reload
```

## Publicación en GitHub

Antes de subir el proyecto, asegúrate de mantener los notebooks sin outputs y de no versionar archivos temporales como `mlruns/`.

## Notas

- Los notebooks están pensados para ejecutarse desde la carpeta `notebooks/`.
- Los artefactos de inferencia en `artefactos/` se conservan porque son necesarios para reproducir predicciones.

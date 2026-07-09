UV ?= uv
PYTHON ?= $(UV) run python

.PHONY: help sync format lint clean export-notebooks clear-notebooks run-api test

help:
	@echo "Targets disponibles:"
	@echo "  sync              Instala dependencias con uv"
	@echo "  format            Formatea el código con ruff"
	@echo "  lint              Revisa calidad con ruff"
	@echo "  clear-notebooks    Elimina outputs de notebooks"
	@echo "  export-notebooks   Exporta notebooks a Markdown"
	@echo "  run-api           Levanta la API FastAPI"
	@echo "  clean             Limpia caches y artefactos temporales"

sync:
	$(UV) sync --extra dev

format:
	$(UV) run ruff format src tests

lint:
	$(UV) run ruff check src tests

clear-notebooks:
	$(UV) run python tools/notebooks.py clear

export-notebooks:
	$(UV) run python tools/notebooks.py export

run-api:
	$(UV) run uvicorn mariscos_api.main:app --reload

test:
	$(UV) run pytest

clean:
	$(UV) run python tools/notebooks.py clean

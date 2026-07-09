UV ?= uv
PYTHON ?= $(UV) run python

.PHONY: help sync format lint check clear-notebooks export-notebooks run-api test pre-commit clean

help:
	@echo ""
	@echo "  Available targets:"
	@echo ""
	@echo "  sync               Install project dependencies with uv"
	@echo "  format             Format source code with ruff"
	@echo "  lint               Lint source code with ruff"
	@echo "  check              Run format + lint + tests in one shot"
	@echo "  test               Run the test suite with pytest"
	@echo "  clear-notebooks    Strip all cell outputs from notebooks"
	@echo "  export-notebooks   Export notebooks to Markdown"
	@echo "  pre-commit         Run all pre-commit hooks on staged files"
	@echo "  run-api            Start the FastAPI development server"
	@echo "  clean              Remove build caches and temporary files"
	@echo ""

sync:
	$(UV) sync --extra dev

format:
	$(UV) run ruff format src tests tools

lint:
	$(UV) run ruff check src tests tools

check: format lint test

test:
	$(UV) run pytest

clear-notebooks:
	$(UV) run python tools/notebooks.py clear

export-notebooks:
	$(UV) run python tools/notebooks.py export

pre-commit:
	$(UV) run pre-commit run --all-files

run-api:
	$(UV) run uvicorn mariscos_api.main:app --reload

clean:
	$(UV) run python tools/notebooks.py clean

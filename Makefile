# =============================================================================
# Makefile - predictive-modeling-seafood-demand
#
# Backend : FastAPI + Uvicorn (backend/app), entorno virtual en backend/venv
# Frontend: Next.js (frontend), gestionado con npm
#
# Requisitos:
#   - Python 3.12+ disponible como "python" en el PATH (para crear el venv).
#   - Node.js + npm instalados para el frontend.
#   - Este Makefile usa comandos POSIX (rm, find, test). En Windows debe
#     ejecutarse con Git Bash, WSL o MSYS2/Cygwin (make.exe de Git for
#     Windows funciona out-of-the-box). No es compatible con cmd.exe puro.
# =============================================================================

PYTHON_BIN  ?= python
BACKEND_DIR := backend
FRONTEND_DIR := frontend
VENV        := $(BACKEND_DIR)/venv

# El venv de backend/ ya se crea con estructura Windows (Scripts/), pero
# detectamos el SO para que el Makefile también funcione en Linux/macOS.
ifeq ($(OS),Windows_NT)
	VENV_PY := $(VENV)/Scripts/python.exe
else
	VENV_PY := $(VENV)/bin/python
endif

.PHONY: help install install-backend install-frontend \
        backend frontend dev \
        lint lint-backend lint-frontend \
        format \
        clean clean-all

## help: Muestra esta lista de comandos disponibles
help:
	@echo ""
	@echo "Comandos disponibles:"
	@echo "  make install          Instala dependencias de backend y frontend"
	@echo "  make backend          Levanta el backend FastAPI (uvicorn --reload) en :8000"
	@echo "  make frontend         Levanta el frontend Next.js en modo desarrollo en :3000"
	@echo "  make dev              Levanta backend y frontend juntos (requiere shell POSIX)"
	@echo "  make lint             Ejecuta ruff (backend) y next lint (frontend)"
	@echo "  make format           Formatea el backend con ruff format"
	@echo "  make clean            Borra __pycache__, .pytest_cache, *.pyc y cache/build del frontend"
	@echo "  make clean-all        clean + elimina venv y node_modules (reinstalables con make install)"
	@echo ""

# -----------------------------------------------------------------------------
# Instalacion
# -----------------------------------------------------------------------------

## install: Instala dependencias de backend (venv + requirements.txt) y frontend (npm install)
install: install-backend install-frontend

## install-backend: Crea el venv si no existe e instala backend/requirements.txt
install-backend:
	@test -d $(VENV) || $(PYTHON_BIN) -m venv $(VENV)
	$(VENV_PY) -m pip install --upgrade pip
	$(VENV_PY) -m pip install -r $(BACKEND_DIR)/requirements.txt
	@# ruff esta configurado en pyproject.toml ([tool.ruff]) pero no en requirements.txt;
	@# se instala aqui para que "make lint" y "make format" funcionen.
	$(VENV_PY) -m pip install ruff==0.6.9

## install-frontend: Instala dependencias de frontend/package.json
install-frontend:
	cd $(FRONTEND_DIR) && npm install

# -----------------------------------------------------------------------------
# Ejecucion
# -----------------------------------------------------------------------------

## backend: Levanta la API FastAPI con uvicorn --reload (http://localhost:8000)
backend:
	$(VENV_PY) -m uvicorn app.main:app --reload --app-dir $(BACKEND_DIR) --host 127.0.0.1 --port 8000

## frontend: Levanta el frontend Next.js en modo desarrollo (http://localhost:3000)
frontend:
	cd $(FRONTEND_DIR) && npm run dev

## dev: Levanta backend y frontend en paralelo en la misma terminal
#  Nota: usa "&"/"wait" de shell POSIX (Git Bash/WSL/macOS/Linux). Si tu
#  make no soporta esto, abre dos terminales y corre "make backend" y
#  "make frontend" por separado.
dev:
	@echo "Iniciando backend (:8000) y frontend (:3000)..."
	$(MAKE) backend & $(MAKE) frontend & wait

# -----------------------------------------------------------------------------
# Calidad de codigo
# -----------------------------------------------------------------------------

## lint: Ejecuta el linter de backend (ruff) y de frontend (next lint)
lint: lint-backend lint-frontend

## lint-backend: Ejecuta ruff check sobre backend/ (reglas definidas en pyproject.toml)
lint-backend:
	$(VENV_PY) -m ruff check $(BACKEND_DIR)

## lint-frontend: Ejecuta "npm run lint" (next lint), script real de frontend/package.json
lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint

## format: Formatea el backend con ruff format (frontend no tiene formateador configurado)
format:
	$(VENV_PY) -m ruff format $(BACKEND_DIR)

# -----------------------------------------------------------------------------
# Limpieza
# -----------------------------------------------------------------------------

## clean: Borra cache/temporales reales del proyecto (no toca modelos, datasets ni .env)
clean:
	find $(BACKEND_DIR) -type d -name "__pycache__" -not -path "*/venv/*" -exec rm -rf {} +
	find $(BACKEND_DIR) -type d -name ".pytest_cache" -not -path "*/venv/*" -exec rm -rf {} +
	find $(BACKEND_DIR) -type d -name ".ruff_cache" -not -path "*/venv/*" -exec rm -rf {} +
	find $(BACKEND_DIR) -name "*.pyc" -not -path "*/venv/*" -delete
	rm -rf $(FRONTEND_DIR)/.next
	rm -f $(FRONTEND_DIR)/tsconfig.tsbuildinfo
	@echo "clean: listo. No se tocaron artefactos/, .env ni node_modules."

## clean-all: clean + elimina backend/venv y frontend/node_modules (reinstalables con "make install")
clean-all: clean
	rm -rf $(VENV)
	rm -rf $(FRONTEND_DIR)/node_modules
	@echo "clean-all: listo. Se eliminaron venv/ y node_modules/. Ejecuta 'make install' para reinstalar."

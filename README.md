# XGBoost Predictive Modeling for Seafood Demand

[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/badge/dependency%20manager-uv-purple)](https://github.com/astral-sh/uv)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit)](https://pre-commit.com/)

A reproducible machine learning project for forecasting seafood product demand across branches and time horizons. Built with XGBoost, served via a FastAPI REST endpoint, and managed end-to-end with [uv](https://github.com/astral-sh/uv).

---

## Table of Contents

- [Project Overview](#project-overview)
- [Repository Structure](#repository-structure)
- [Notebooks](#notebooks)
- [Requirements](#requirements)
- [Installation](#installation)
- [Makefile Targets](#makefile-targets)
- [Running the API](#running-the-api)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Project Overview

This project addresses the challenge of demand forecasting for a seafood distribution business. Using historical sales and inventory data, we build a gradient-boosted tree model (XGBoost) capable of predicting future demand per product, branch, and date. The workflow covers:

- Exploratory data analysis (EDA)
- Feature engineering (temporal lags, rolling averages, calendar signals)
- Model training with time-based validation splits
- Artifact export for reproducible inference
- A lightweight REST API for serving predictions in production

---

## Repository Structure

```
.
├── notebooks/                   # Jupyter notebooks (EDA, training, inference)
│   ├── EDA-MARISCOS.ipynb
│   ├── EDA-MARISCOS.md          # Auto-generated Markdown export
│   ├── Modelo_Mariscos.ipynb
│   ├── Modelo_Mariscos.md
│   ├── Funcion_Prediccion.ipynb
│   └── Funcion_Prediccion.md
├── docs/                        # Technical documentation
│   ├── 01_project_summary.md
│   ├── 02_methodology.md
│   ├── 03_xgboost_model.md
│   └── 04_prediction_api.md
├── src/
│   └── mariscos_api/            # FastAPI application package
│       ├── __init__.py
│       └── main.py
├── tests/                       # Unit and integration tests
│   └── test_health.py
├── tools/                       # CLI utilities for notebook management
│   └── notebooks.py
├── artefactos/                  # Inference-ready model artifacts
│   ├── config_modelo.json
│   ├── label_encoders.pkl
│   └── dataset_procesado.csv
├── files/                       # Raw inputs and auxiliary analysis files
├── .pre-commit-config.yaml
├── Makefile
├── pyproject.toml               # Project config & dependencies (uv/hatch)
└── README.md
```

---

## Notebooks

The analysis is divided into three sequential notebooks:

| Notebook | Purpose |
|---|---|
| `EDA-MARISCOS.ipynb` | Exploratory data analysis — distributions, time series, correlations |
| `Modelo_Mariscos.ipynb` | Feature engineering, XGBoost training, validation, artifact export |
| `Funcion_Prediccion.ipynb` | Model loading, prediction function, and inference examples |

Each notebook has a corresponding `.md` export (generated via `make export-notebooks`) for easy review without running Jupyter.

> **Note:** Notebooks are designed to be run from the `notebooks/` directory. Outputs are stripped before committing — see [Makefile Targets](#makefile-targets).

---

## Requirements

- Python 3.13.x
- [`uv`](https://github.com/astral-sh/uv) — fast Python package and project manager

---

## Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/predictive-modeling-seafood-demand.git
cd predictive-modeling-seafood-demand

# Install all dependencies (including dev extras)
uv sync --extra dev

# Install pre-commit hooks
uv run pre-commit install
```

---

## Makefile Targets

```bash
make help              # List all available targets
make sync              # Install dependencies with uv
make format            # Format source code with ruff
make lint              # Lint source code with ruff
make test              # Run test suite with pytest
make check             # Run format + lint + tests in one shot
make export-notebooks  # Convert notebooks to Markdown
make clear-notebooks   # Strip all cell outputs from notebooks
make pre-commit        # Run all pre-commit hooks on staged files
make clean             # Remove build caches and temporary files
make run-api           # Start the FastAPI development server
```

---

## Running the API

```bash
# Start the development server (auto-reload enabled)
uv run uvicorn mariscos_api.main:app --reload

# Or via the project entry point
uv run api
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Root — service info |
| `GET` | `/health` | Health check |
| `POST` | `/predict` | Demand prediction for a given product, branch, and date |

---

## Documentation

Detailed technical documentation lives in [`docs/`](./docs/):

- [`01_project_summary.md`](./docs/01_project_summary.md) — Project scope and deliverables
- [`02_methodology.md`](./docs/02_methodology.md) — Workflow and best practices
- [`03_xgboost_model.md`](./docs/03_xgboost_model.md) — Model details and artifacts
- [`04_prediction_api.md`](./docs/04_prediction_api.md) — API reference and local setup

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run `make sync` to install dependencies.
3. Make your changes, ensuring `make check` passes.
4. Commit — pre-commit hooks will enforce formatting and strip notebook outputs automatically.
5. Open a pull request with a clear description of the changes.

---

> **Large files:** `artefactos/dataset_procesado.csv` (~42 MB) is tracked in git for reproducibility. Consider migrating to [Git LFS](https://git-lfs.github.com/) if the repository grows significantly.

# Project Summary

## Overview

This project develops a demand forecasting system for seafood products using XGBoost. The goal is to support purchasing, inventory, and supply planning decisions by combining exploratory data analysis, supervised learning, and a production-ready inference API.

The end-to-end workflow — from raw sales data to a deployable REST endpoint — is fully reproducible via the tooling described in this repository.

## Scope

- Exploratory analysis of historical sales and inventory data
- Dataset preparation and business-relevant feature engineering
- XGBoost model training, hyperparameter validation, and evaluation
- Export of inference artifacts for reproducible prediction
- FastAPI REST endpoint for serving model predictions

## Deliverables

| Artifact | Location |
|---|---|
| 3 Jupyter notebooks (EDA, training, inference) | `notebooks/` |
| 3 Markdown exports of the notebooks | `notebooks/*.md` |
| 4 technical documentation files | `docs/` |
| Inference artifacts (config, encoders, processed dataset) | `artefactos/` |
| FastAPI application | `src/mariscos_api/` |
| Reproducible environment config | `pyproject.toml` + `uv.lock` |
| Automation scripts | `Makefile` |
| Code quality hooks | `.pre-commit-config.yaml` |

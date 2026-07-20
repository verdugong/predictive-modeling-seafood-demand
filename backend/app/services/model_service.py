"""Model loading, catalog preparation, and inference helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import joblib
import lime.lime_tabular
import numpy as np
import onnxruntime as ort
import pandas as pd

from ..schemas import Horizonte, UnidadMedida

DAYS_PER_WEEK = 7
WEEKS_PER_MONTH = 4
LIME_BACKGROUND_SIZE = 2000
LIME_NUM_SAMPLES = 1000


FEATURES: List[str] = [
    "product_key_enc",
    "sucursal_enc",
    "mes_sin",
    "mes_cos",
    "dow_sin",
    "dow_cos",
    "fin_de_semana",
    "festivo",
    "vispera_festivo",
    "demanda",
    "n_tx",
    "lag_1",
    "lag_2",
    "lag_7",
    "lag_14",
    "ma_7",
    "ma_14",
    "stock_inicial_dia",
    "cobertura_dias",
    "rotacion",
    "media_dia_semana_hist",
    "share_producto_suc",
]


FEATURE_LABELS = {
    "product_key_enc": "codificación del producto",
    "sucursal_enc": "codificación de la sucursal",
    "share_producto_suc": "peso histórico del producto en la sucursal",
    "ma_7": "media móvil de 7 días",
    "ma_14": "media móvil de 14 días",
    "stock_inicial_dia": "stock inicial del día",
    "cobertura_dias": "cobertura de inventario",
    "rotacion": "rotación de inventario",
    "media_dia_semana_hist": "promedio histórico por día de semana",
    "demanda": "demanda base del corte",
    "n_tx": "número de transacciones",
}


@dataclass(slots=True)
class AppState:
    session: ort.InferenceSession
    input_name: str
    catalog: pd.DataFrame
    product_encoder: Any
    branch_encoder: Any
    importance: Dict[str, float]
    top_features: List[Tuple[str, float]]
    product_options: List[Dict[str, str]]
    branch_options: List[Dict[str, str]]
    lime_explainer: lime.lime_tabular.LimeTabularExplainer


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read_catalog() -> pd.DataFrame:
    data_path = _project_root() / "artefactos" / "dataset_forecasting_final.csv.gz"
    if not data_path.exists():
        raise FileNotFoundError(f"No se encontró el dataset en: {data_path}")

    df = pd.read_csv(data_path, compression="gzip", low_memory=False)
    if "fecha" not in df.columns:
        raise ValueError("El dataset no contiene la columna 'fecha'.")

    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.dropna(subset=["fecha"]).sort_values(["product_key", "sucursal", "fecha"])

    numeric_candidates = [
        "demanda",
        "n_tx",
        "lag_1",
        "lag_2",
        "lag_7",
        "lag_14",
        "ma_7",
        "ma_14",
        "stock_inicial_dia",
        "cobertura_dias",
        "rotacion",
        "media_dia_semana_hist",
        "share_producto_suc",
        "mes_sin",
        "mes_cos",
        "dow_sin",
        "dow_cos",
        "fin_de_semana",
        "festivo",
        "vispera_festivo",
    ]
    for column in numeric_candidates:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    return df


def _latest_catalog(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby(["product_key", "sucursal"], as_index=False).last()
    grouped["product_key"] = grouped["product_key"].astype(str)
    grouped["sucursal"] = grouped["sucursal"].astype(str)
    return grouped


def _load_importance() -> Dict[str, float]:
    importance_path = _project_root() / "artefactos" / "importancia_variables.json"
    if not importance_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de importancia en: {importance_path}")

    import json

    with importance_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _build_lime_explainer(
    full_df: pd.DataFrame, product_encoder: Any, branch_encoder: Any
) -> lime.lime_tabular.LimeTabularExplainer:
    """Same setup as the project's reference notebook (Funcion - Prediccion.ipynb):
    a LIME regression explainer fit on a background sample of real historical rows,
    encoded the same way a live prediction row is encoded."""
    df_bg = full_df.copy()
    df_bg["product_key_enc"] = product_encoder.transform(df_bg["product_key"].astype(str))
    df_bg["sucursal_enc"] = branch_encoder.transform(df_bg["sucursal"].astype(str))
    df_bg = df_bg.dropna(subset=FEATURES)[FEATURES]
    sample_size = min(LIME_BACKGROUND_SIZE, len(df_bg))
    df_bg = df_bg.sample(sample_size, random_state=42)
    return lime.lime_tabular.LimeTabularExplainer(
        training_data=df_bg.values, feature_names=FEATURES, mode="regression", random_state=42
    )


def load_state() -> AppState:
    root = _project_root()
    model_path = root / "artefactos" / "modelo_mariscos.onnx"
    if not model_path.exists():
        raise FileNotFoundError(f"No se encontró el modelo ONNX en: {model_path}")

    encoders_path = root / "artefactos" / "label_encoders.pkl"
    if not encoders_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de encoders en: {encoders_path}")

    full_df = _read_catalog()
    catalog = _latest_catalog(full_df)
    encoders = joblib.load(encoders_path)
    product_encoder = encoders["product_encoder"]
    branch_encoder = encoders["branch_encoder"]

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    lime_explainer = _build_lime_explainer(full_df, product_encoder, branch_encoder)

    importance = _load_importance()
    top_features = sorted(importance.items(), key=lambda item: item[1], reverse=True)[:3]

    product_options = []
    product_labels = (
        catalog[["product_key", "product_clean"]]
        .drop_duplicates()
        .sort_values(["product_clean", "product_key"], na_position="last")
    )
    # catalog has exactly one row per (product_key, sucursal) pair that actually
    # exists in the data, so grouping it also tells us which branches sell a product.
    sucursales_by_product = catalog.groupby("product_key")["sucursal"].apply(
        lambda values: sorted(values.astype(str).unique().tolist())
    )
    category_by_product = catalog.groupby("product_key")["category"].first()
    presentation_by_product = catalog.groupby("product_key")["presentation"].first()
    is_libra_by_product = catalog.groupby("product_key")["is_libra"].first()
    for _, row in product_labels.iterrows():
        product_key = str(row["product_key"])
        product_clean = str(row.get("product_clean") or product_key)
        category = category_by_product.get(product_key)
        presentation = presentation_by_product.get(product_key)
        product_options.append(
            {
                "id": product_key,
                "label": f"{product_clean} ({product_key})",
                "category": None if pd.isna(category) else str(category),
                "sucursales": sucursales_by_product.get(product_key, []),
                "product_clean": product_clean,
                "presentation": None if pd.isna(presentation) else str(presentation),
                "unidad_medida": _unidad_medida(is_libra_by_product.get(product_key)),
            }
        )

    branch_options = [
        {"id": branch, "label": branch}
        for branch in sorted(catalog["sucursal"].astype(str).unique().tolist())
    ]

    return AppState(
        session=session,
        input_name=input_name,
        catalog=catalog,
        product_encoder=product_encoder,
        branch_encoder=branch_encoder,
        importance=importance,
        top_features=top_features,
        product_options=product_options,
        branch_options=branch_options,
        lime_explainer=lime_explainer,
    )


def _unidad_medida(is_libra_value: Any) -> Optional[UnidadMedida]:
    """Maps the dataset's is_libra flag to a display unit: 1 -> 'lb', 0 -> 'unidades'."""
    if is_libra_value is None or pd.isna(is_libra_value):
        return None
    return "lb" if int(is_libra_value) == 1 else "unidades"


def build_date_list(raw_dates: Sequence[str]) -> List[date]:
    dates = []
    for raw in raw_dates:
        parsed = pd.to_datetime(raw, errors="coerce")
        if pd.isna(parsed):
            raise ValueError(f"Fecha inválida: {raw}")
        dates.append(parsed.date())
    return dates


def _row_value(row: pd.Series, key: str, default: float = 0.0) -> float:
    value = row.get(key, default)
    if pd.isna(value):
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _feature_row(base_row: pd.Series, product_key: str, branch: str, current_date: date, festivo: int, vispera: int) -> Dict[str, float]:
    current_ts = pd.Timestamp(current_date)
    base_demand = _row_value(base_row, "demanda")

    return {
        "product_key_enc": float(base_row["product_key_enc"]),
        "sucursal_enc": float(base_row["sucursal_enc"]),
        "mes_sin": float(np.sin(2 * np.pi * current_ts.month / 12)),
        "mes_cos": float(np.cos(2 * np.pi * current_ts.month / 12)),
        "dow_sin": float(np.sin(2 * np.pi * current_ts.dayofweek / 7)),
        "dow_cos": float(np.cos(2 * np.pi * current_ts.dayofweek / 7)),
        "fin_de_semana": float(int(current_ts.dayofweek >= 5)),
        "festivo": float(festivo),
        "vispera_festivo": float(vispera),
        "demanda": base_demand,
        "n_tx": _row_value(base_row, "n_tx"),
        "lag_1": _row_value(base_row, "lag_1", base_demand),
        "lag_2": _row_value(base_row, "lag_2", _row_value(base_row, "lag_1", base_demand)),
        "lag_7": _row_value(base_row, "lag_7", base_demand),
        "lag_14": _row_value(base_row, "lag_14", base_demand),
        "ma_7": _row_value(base_row, "ma_7", base_demand),
        "ma_14": _row_value(base_row, "ma_14", base_demand),
        "stock_inicial_dia": _row_value(base_row, "stock_inicial_dia"),
        "cobertura_dias": _row_value(base_row, "cobertura_dias"),
        "rotacion": _row_value(base_row, "rotacion"),
        "media_dia_semana_hist": _row_value(base_row, "media_dia_semana_hist"),
        "share_producto_suc": _row_value(base_row, "share_producto_suc"),
    }


def _predict_from_row(state: AppState, feature_row: Dict[str, float]) -> float:
    ordered = [feature_row.get(feature, 0.0) for feature in FEATURES]
    input_array = np.asarray([ordered], dtype=np.float32)
    output = state.session.run(None, {state.input_name: input_array})[0]
    predicted = float(np.asarray(output).reshape(-1)[0])
    return max(0.0, round(predicted, 2))


## LIME-based "why" explanations (replaces the old inventory-recommendation text).
## Mirrors Funcion - Prediccion.ipynb: LimeTabularExplainer.explain_instance() on the
## real feature row, then the same rule-parsing + human-language translation approach
## used there — only the vocabulary/sentence templates are the ones requested for this
## UI (shorter, grouped by direction, no restated units, no OpenAI).

# feature -> (frase sin artículo, género 'm'/'f', es_plural). Solo estas variables se
# muestran al usuario; cualquier otro factor de LIME (calendario, codificaciones) se
# descarta porque no tiene una traducción de negocio aprobada.
_LIME_FACTOR_INFO: Dict[str, Tuple[str, str, bool]] = {
    "lag_1": ("ventas recientes", "f", True),
    "lag_7": ("ventas de hace una semana", "f", True),
    "lag_14": ("ventas de hace dos semanas", "f", True),
    "ma_7": ("promedio de ventas de la última semana", "m", False),
    "ma_14": ("promedio de ventas de las últimas dos semanas", "m", False),
    "demanda": ("nivel de venta reciente", "m", False),
    "rotacion": ("rotación del producto", "f", False),
    "stock_inicial_dia": ("stock disponible", "m", False),
    "cobertura_dias": ("cobertura de inventario", "f", False),
    "media_dia_semana_hist": ("comportamiento habitual para ese día", "m", False),
    "share_producto_suc": ("participación del producto en esta sucursal", "f", False),
    "n_tx": ("cantidad de transacciones recientes", "f", False),
}


def _lime_feature_de(regla: str) -> Optional[str]:
    """Extracts which known feature a LIME rule string (e.g. '1.05 < ma_14 <= 2.57') refers to."""
    for feat in _LIME_FACTOR_INFO:
        if re.search(rf"\b{re.escape(feat)}\b", regla):
            return feat
    return None


def _lime_factores_traducibles(
    exp_list: List[Tuple[str, float]], top: int = 3
) -> List[Tuple[str, bool, float]]:
    """Keeps only LIME factors with an approved business translation, ranked by |contribution|."""
    vistos: set[str] = set()
    candidatos: List[Tuple[str, bool, float]] = []
    for regla, contribucion in exp_list:
        feat = _lime_feature_de(regla)
        if feat is None or feat in vistos:
            continue
        vistos.add(feat)
        candidatos.append((feat, contribucion >= 0, abs(contribucion)))
    candidatos.sort(key=lambda item: item[2], reverse=True)
    return candidatos[:top]


def _articulo(genero: str, plural: bool) -> str:
    if plural:
        return "las" if genero == "f" else "los"
    return "la" if genero == "f" else "el"


def _calificador_bajo(genero: str, plural: bool) -> str:
    if plural:
        return "bajas" if genero == "f" else "bajos"
    return "baja" if genero == "f" else "bajo"


def _frase_factor(feat: str, sube: bool) -> str:
    nombre, genero, plural = _LIME_FACTOR_INFO[feat]
    articulo = _articulo(genero, plural)
    if sube:
        return f"{articulo} {nombre}"
    return f"{articulo} {_calificador_bajo(genero, plural)} {nombre}"


def _capitalizar(texto: str) -> str:
    return texto[0].upper() + texto[1:] if texto else texto


def _variante_estable(feats: Sequence[str], n: int) -> int:
    # Deterministic (not Python's salted hash()) so the same factor always picks
    # the same phrasing on repeat views, while different factors vary naturally —
    # this is what keeps wording from feeling like one canned template.
    return sum(ord(c) for c in "".join(sorted(feats))) % n


def _frase_individual(feat: str, sube: bool, participacion: float) -> str:
    """One short, standalone sentence for a single LIME factor — never merged with others."""
    sujeto = _capitalizar(_frase_factor(feat, sube))
    plural = _LIME_FACTOR_INFO[feat][2]
    leve = "ligeramente " if participacion < 0.25 else ""  # share of the top factors' total contribution

    if sube:
        opciones = (
            [
                f"{sujeto} aumentaron la estimación.",
                f"{sujeto} tuvieron un efecto positivo en la predicción.",
                f"{sujeto} impulsaron {leve}la demanda estimada.",
            ]
            if plural
            else [
                f"{sujeto} aumentó la estimación.",
                f"{sujeto} tuvo un efecto positivo en la predicción.",
                f"{sujeto} impulsó {leve}la demanda estimada.",
            ]
        )
    else:
        opciones = (
            [
                f"{sujeto} redujeron {leve}la estimación.",
                f"{sujeto} tuvieron un efecto negativo en la predicción.",
                f"{sujeto} limitaron {leve}la demanda estimada.",
            ]
            if plural
            else [
                f"{sujeto} redujo {leve}la estimación.",
                f"{sujeto} tuvo un efecto negativo en la predicción.",
                f"{sujeto} limitó {leve}la demanda estimada.",
            ]
        )
    return opciones[_variante_estable([feat, str(sube)], len(opciones))]


def _lime_predict_fn(state: AppState):
    def predict_fn(data: np.ndarray) -> np.ndarray:
        input_array = data.astype(np.float32)
        output = state.session.run(None, {state.input_name: input_array})[0]
        return np.asarray(output).reshape(-1)

    return predict_fn


def _factores_lime_para_fila(state: AppState, feature_row: Dict[str, float]) -> List[Dict[str, str]]:
    """Runs LIME on exactly this feature row and returns 2-3 short, independent
    factor statements — each grounded in that row's own real LIME contribution,
    never a reused/generic template. Called on demand (one row at a time), not
    for every row of a /predict response."""
    ordered = np.array([feature_row.get(feature, 0.0) for feature in FEATURES], dtype=float)
    exp = state.lime_explainer.explain_instance(
        data_row=ordered,
        predict_fn=_lime_predict_fn(state),
        num_features=len(FEATURES),
        num_samples=LIME_NUM_SAMPLES,
    )
    factores = _lime_factores_traducibles(exp.as_list(), top=3)
    if not factores:
        return []

    total_magnitud = sum(mag for _, _, mag in factores) or 1.0
    return [
        {
            "direccion": "sube" if sube else "baja",
            "texto": _frase_individual(feat, sube, mag / total_magnitud),
        }
        for feat, sube, mag in factores
    ]


def _feature_row_semanal(
    base_row: pd.Series,
    current_date: date,
    festivo: int,
    vispera_festivo: int,
    lag1: float,
    lag2: float,
    buf_ma7: List[float],
    buf_ma14: List[float],
) -> Dict[str, float]:
    """Exact feature-row construction used by the day-by-day 'semanal' path for one
    step, factored out so the on-demand explain endpoint can reproduce precisely
    the same inputs the shown prediction was computed from (no drift, no rebuilt logic)."""
    return {
        "product_key_enc": float(base_row["product_key_enc"]),
        "sucursal_enc": float(base_row["sucursal_enc"]),
        "mes_sin": float(np.sin(2 * np.pi * pd.Timestamp(current_date).month / 12)),
        "mes_cos": float(np.cos(2 * np.pi * pd.Timestamp(current_date).month / 12)),
        "dow_sin": float(np.sin(2 * np.pi * pd.Timestamp(current_date).dayofweek / 7)),
        "dow_cos": float(np.cos(2 * np.pi * pd.Timestamp(current_date).dayofweek / 7)),
        "fin_de_semana": float(int(pd.Timestamp(current_date).dayofweek >= 5)),
        "festivo": float(festivo),
        "vispera_festivo": float(vispera_festivo),
        "demanda": _row_value(base_row, "demanda"),
        "n_tx": _row_value(base_row, "n_tx"),
        "lag_1": lag1,
        "lag_2": lag2,
        "lag_7": buf_ma7[-1],
        "lag_14": buf_ma14[-1],
        "ma_7": float(np.mean(buf_ma7)),
        "ma_14": float(np.mean(buf_ma14)),
        "stock_inicial_dia": _row_value(base_row, "stock_inicial_dia"),
        "cobertura_dias": _row_value(base_row, "cobertura_dias"),
        "rotacion": _row_value(base_row, "rotacion"),
        "media_dia_semana_hist": _row_value(base_row, "media_dia_semana_hist"),
        "share_producto_suc": _row_value(base_row, "share_producto_suc"),
    }


def _predict_weekly_series(
    state: AppState,
    base_row: pd.Series,
    unique_dates: Sequence[date],
    festivo: int,
    vispera_festivo: int,
) -> List[Tuple[date, float]]:
    """Day-by-day chained forecast: each step feeds its own prediction back into
    lag_1/lag_2 and shifts the ma_7/ma_14 buffers by one slot. This is only valid
    when the requested dates are consecutive days, since the buffers advance by
    exactly one slot per call regardless of the actual gap between dates."""
    base_row = base_row.copy()
    lag1 = _row_value(base_row, "lag_1")
    lag2 = _row_value(base_row, "lag_2")
    buf_ma7 = [float(base_row.get(f"lag_{i}", 0)) for i in range(7, 1, -1)]
    buf_ma14 = [float(base_row.get(f"lag_{i}", 0)) for i in range(14, 1, -1)]

    output: List[Tuple[date, float]] = []
    for current_date in unique_dates:
        feature_row = _feature_row_semanal(
            base_row, current_date, festivo, vispera_festivo, lag1, lag2, buf_ma7, buf_ma14
        )
        prediction = _predict_from_row(state, feature_row)
        output.append((current_date, prediction))

        lag2 = lag1
        lag1 = prediction
        buf_ma7.append(prediction)
        buf_ma7.pop(0)
        buf_ma14.append(prediction)
        buf_ma14.pop(0)

        base_row["demanda"] = prediction
        base_row["lag_1"] = lag1
        base_row["lag_2"] = lag2

    return output


def _predict_monthly_series(
    state: AppState,
    product_key: str,
    branch: str,
    base_row: pd.Series,
    unique_dates: Sequence[date],
    festivo: int,
    vispera_festivo: int,
) -> List[Tuple[date, float]]:
    """One row per requested anchor date, each the sum of 4 independent weekly
    (target_7d) forecasts spaced 7 days apart. target_7d is itself a forward sum
    of daily demand, not a single day's value, so it can never be fed back into
    lag_1/lag_7/ma_7/ma_14 (daily-resolution features) without corrupting them —
    and there is no real daily data yet for a month that hasn't happened. Instead,
    every weekly anchor reuses the product's real, unmutated historical features
    (via _feature_row) and only varies the calendar-dependent ones, so each of the
    4 weeks is an independently valid forecast; the monthly figure is their sum."""
    output: List[Tuple[date, float]] = []
    for anchor_date in unique_dates:
        weekly_values: List[float] = []
        for week_index in range(WEEKS_PER_MONTH):
            week_date = anchor_date + timedelta(days=DAYS_PER_WEEK * week_index)
            feature_row = _feature_row(base_row, product_key, branch, week_date, festivo, vispera_festivo)
            weekly_values.append(_predict_from_row(state, feature_row))

        total = round(sum(weekly_values), 2)
        output.append((anchor_date, total))

    return output


def predict_series(
    state: AppState,
    productos: Sequence[str],
    sucursales: Sequence[str],
    fechas: Sequence[str],
    festivo: int,
    vispera_festivo: int,
    horizonte: Horizonte = "semanal",
) -> List[Dict[str, object]]:
    normalized_dates = build_date_list(fechas)
    unique_dates = list(dict.fromkeys(normalized_dates))

    results: List[Dict[str, object]] = []
    missing_combos: List[str] = []
    valid_products = set(state.catalog["product_key"].astype(str).unique())
    valid_branches = set(state.catalog["sucursal"].astype(str).unique())

    for product_key in productos:
        product_key = str(product_key)
        if product_key not in valid_products:
            missing_combos.append(f"producto inexistente: {product_key}")
            continue

        for branch in sucursales:
            branch = str(branch)
            if branch not in valid_branches:
                missing_combos.append(f"sucursal inexistente: {branch}")
                continue

            mask = (state.catalog["product_key"].astype(str) == product_key) & (state.catalog["sucursal"].astype(str) == branch)
            if not mask.any():
                missing_combos.append(f"combinación no disponible: {product_key} × {branch}")
                continue

            base_row = state.catalog.loc[mask].iloc[-1].copy()
            base_row["product_key_enc"] = state.product_encoder.transform([product_key])[0]
            base_row["sucursal_enc"] = state.branch_encoder.transform([branch])[0]

            if horizonte == "mensual":
                predicted = _predict_monthly_series(
                    state, product_key, branch, base_row, unique_dates, festivo, vispera_festivo
                )
            else:
                predicted = _predict_weekly_series(state, base_row, unique_dates, festivo, vispera_festivo)

            for current_date, prediction in predicted:
                results.append(
                    {
                        "producto": product_key,
                        "sucursal": branch,
                        "fecha": current_date.isoformat(),
                        "horizonte": horizonte,
                        "unidades_estimadas_7d": prediction,
                    }
                )

    if missing_combos:
        raise ValueError("; ".join(dict.fromkeys(missing_combos)))

    return results


def explicar_prediccion_individual(
    state: AppState,
    producto: str,
    sucursal: str,
    fecha: str,
    horizonte: Horizonte,
    festivo: int,
    vispera_festivo: int,
) -> List[Dict[str, str]]:
    """On-demand LIME explanation for exactly one (producto, sucursal, fecha) —
    reconstructs the same feature row predict_series would have used for that
    row (no chaining/mutation involved either way), so the factors returned are
    the real LIME contributions for that specific prediction, not a stand-in."""
    producto = str(producto)
    sucursal = str(sucursal)
    mask = (state.catalog["product_key"].astype(str) == producto) & (
        state.catalog["sucursal"].astype(str) == sucursal
    )
    if not mask.any():
        raise ValueError(f"combinación no disponible: {producto} × {sucursal}")

    base_row = state.catalog.loc[mask].iloc[-1].copy()
    base_row["product_key_enc"] = state.product_encoder.transform([producto])[0]
    base_row["sucursal_enc"] = state.branch_encoder.transform([sucursal])[0]

    target_date = build_date_list([fecha])[0]

    if horizonte == "mensual":
        feature_row = _feature_row(base_row, producto, sucursal, target_date, festivo, vispera_festivo)
    else:
        lag1 = _row_value(base_row, "lag_1")
        lag2 = _row_value(base_row, "lag_2")
        buf_ma7 = [float(base_row.get(f"lag_{i}", 0)) for i in range(7, 1, -1)]
        buf_ma14 = [float(base_row.get(f"lag_{i}", 0)) for i in range(14, 1, -1)]
        feature_row = _feature_row_semanal(
            base_row, target_date, festivo, vispera_festivo, lag1, lag2, buf_ma7, buf_ma14
        )

    return _factores_lime_para_fila(state, feature_row)

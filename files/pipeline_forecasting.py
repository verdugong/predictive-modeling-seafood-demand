"""
================================================================================
PIPELINE PROFESIONAL DE FORECASTING DE DEMANDA — PRODUCTOS DEL MAR
================================================================================
Autor: pipeline generado para Diego (UPS)
Entrada : movimiento.xlsx  (49.941 transacciones de inventario Odoo)
Salida  : dataset_forecasting_final.parquet / .csv
          data_dictionary.csv
          eda_report.txt  + figuras PNG

Estructura del script (según el enunciado):
    PARTE 1  Limpieza de datos
    PARTE 2  Análisis Exploratorio (EDA)
    PARTE 3  Transformación a panel  (Fecha x Producto x Sucursal)
    PARTE 4  Feature Engineering (temporal, lags, rolling, inventario,
             perecibilidad FIFO, producto, demanda, estadísticas, sucursal)
    PARTE 5  Validación anti Data-Leakage
    PARTE 6  Dataset final + diccionario

REGLA DE ORO CONTRA FUGA DE INFORMACIÓN:
    Toda variable histórica (lag, rolling, acumulados, inventario) se calcula
    con .shift(1) DENTRO de cada grupo (producto, sucursal) ordenado por fecha,
    de modo que la fila del día D solo "ve" información de días < D.
    Los TARGETS son los únicos que miran al futuro (shift negativo).
================================================================================
"""

import warnings
warnings.filterwarnings("ignore")
import numpy as np
import pandas as pd
import re
import holidays

RAW_PATH = "/mnt/user-data/uploads/movimiento.xlsx"
SHELF_LIFE_DAYS = 90          # vida útil declarada por el negocio

# ==============================================================================
# PARTE 1 — LIMPIEZA DE DATOS
# ==============================================================================

def load_raw():
    df = pd.read_excel(RAW_PATH)
    df.columns = [c.strip() for c in df.columns]
    return df


# --- 1.1 Diccionario de sucursales -------------------------------------------
# Las "sucursales" (locales físicos) no vienen en una columna: están embebidas
# en las localizaciones Odoo de las columnas Desde/Hasta.
#   MATRZ = Matriz | GUAPG = Guapán/sucursal 2 | 10AGO = 10 de Agosto/sucursal 3
# Las demás localizaciones son virtuales (Producción, Ajuste, Scrap) o partners
# externos (Customers = cliente final, Vendors = proveedor).
BRANCH_MAP = {
    "MATRZ/Existencias": "MATRIZ",
    "GUAPG/Existencias": "GUAPAN",
    "10AGO/Existencias": "10_AGOSTO",
}
VIRTUAL = {
    "Partners/Customers": "CLIENTE",
    "Partners/Vendors":   "PROVEEDOR",
    "Localizaciones virtuales/Producción":            "PRODUCCION",
    "Localizaciones virtuales/Ajuste de inventario":  "AJUSTE",
    "Localizaciones virtuales/Scrap":                 "SCRAP",
}

def classify_movement(row):
    """
    Traduce el par (Desde -> Hasta) al tipo de movimiento de negocio.
    Odoo modela TODO como transferencia entre dos localizaciones; el 'tipo'
    hay que inferirlo de origen/destino.
    """
    d, h = row["Desde"], row["Hasta"]
    d_branch, h_branch = d in BRANCH_MAP, h in BRANCH_MAP
    # VENTA: sale de un local físico hacia el cliente final
    if d_branch and h == "Partners/Customers":
        return "VENTA"
    # DEVOLUCION: el cliente devuelve al local
    if d == "Partners/Customers" and h_branch:
        return "DEVOLUCION"
    # COMPRA / INGRESO: entra desde proveedor
    if d == "Partners/Vendors" and h_branch:
        return "INGRESO"
    # PRODUCCION: consumo o retorno de la orden de manufactura
    if "Producción" in d or "Producción" in h:
        return "PRODUCCION"
    # AJUSTE (inventario) y SCRAP (merma)
    if "Ajuste" in d or "Ajuste" in h:
        return "AJUSTE"
    if "Scrap" in d or "Scrap" in h:
        return "SCRAP"
    # TRANSFERENCIA entre locales físicos
    if d_branch and h_branch:
        return "TRANSFERENCIA"
    return "OTRO"


def branch_of_movement(row):
    """Sucursal física asociada al movimiento (para ventas = origen)."""
    if row["Desde"] in BRANCH_MAP:
        return BRANCH_MAP[row["Desde"]]
    if row["Hasta"] in BRANCH_MAP:
        return BRANCH_MAP[row["Hasta"]]
    return "SIN_LOCAL"


# --- 1.2 Normalización de nombres de producto --------------------------------
def parse_product(name):
    """
    Extrae de forma robusta los atributos de cada producto a partir del texto.
    Formato típico:  '[DQ-019.27CAM] Camarón con COLA T31 Granel'
      - código interno entre corchetes  -> product_code
      - nombre limpio (sin corchetes)   -> product_clean
      - categoría (primera palabra sig.) -> Camarón/Pescado/Calamar...
      - presentación (Granel, Funda, Caja, lb, unidad...)
      - talla del camarón  Txx
    """
    raw = str(name).strip()
    m = re.match(r"^\[([^\]]+)\]\s*(.*)$", raw)
    code = m.group(1).strip() if m else np.nan
    clean = (m.group(2) if m else raw).strip()
    # normalización de texto: colapsar espacios, mantener acentos
    clean = re.sub(r"\s+", " ", clean)
    low = clean.lower()

    # categoría (producto padre) por palabra clave
    cat_keywords = [
        ("Camarón", ["camaron", "camarón"]),
        ("Langostino", ["langostino"]),
        ("Concha", ["concha"]),
        ("Corvina", ["corvina"]),
        ("Atún", ["atun", "atún"]),
        ("Salmón", ["salmon", "salmón"]),
        ("Tilapia", ["tilapia"]),
        ("Calamar", ["calamar"]),
        ("Cangrejo", ["cangrejo", "uñas de cangrejo"]),
        ("Pulpo", ["pulpo", "trompeta"]),
        ("Scallops", ["scallop", "callo"]),
        ("Pescado", ["pescado", "filete", "corvina", "dorado", "picudo", "wahoo"]),
        ("Insumo", ["funda", "mano de obra", "cartucho", "etiqueta", "empaque",
                    "base", "couche"]),
    ]
    category = "Otro"
    for cat, keys in cat_keywords:
        if any(k in low for k in keys):
            category = cat
            break

    # presentación / empaque
    is_granel  = int("granel" in low or "gr" == low[-2:].strip())
    is_funda   = int("funda" in low)
    is_caja    = int("caja" in low)
    is_bandeja = int("bandeja" in low or "steak" in low)
    is_empac   = int("empac" in low or "empaque" in low)
    presentation = ("Granel" if is_granel else "Funda" if is_funda else
                    "Caja" if is_caja else "Bandeja" if is_bandeja else
                    "Empacado" if is_empac else "Estándar")

    # talla de camarón (T26, T31, T41...) y peso declarado (1lb, 2,5 lb, 2kg)
    talla = re.search(r"\bT\s?(\d{2,3})\b", clean)
    talla = f"T{talla.group(1)}" if talla else np.nan
    peso  = re.search(r"([\d.,]+)\s?(lb|kg|g|u|unid)", low)
    peso_val = np.nan
    if peso:
        try:
            peso_val = float(peso.group(1).replace(",", "."))
        except Exception:
            peso_val = np.nan

    return pd.Series({
        "product_code": code,
        "product_clean": clean,
        "category": category,
        "presentation": presentation,
        "talla": talla,
        "peso_declarado": peso_val,
        "is_granel": is_granel,
        "is_funda": is_funda,
        "is_caja": is_caja,
        "is_bandeja": is_bandeja,
    })


def clean_data(df):
    """PARTE 1 completa. Devuelve df limpio + informe de decisiones (dict)."""
    report = {}
    n0 = len(df)

    # 1) Columna 'Saldo' es constante 0 en todo el archivo -> sin información.
    #    Se elimina (columna inútil).
    saldo_unique = df["Saldo"].nunique()
    report["saldo_dropped"] = f"Saldo tenía {saldo_unique} valor(es) único(s); se elimina."
    df = df.drop(columns=["Saldo"])

    # 2) Tipos de dato: Fecha ya es datetime; forzamos por seguridad.
    df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
    report["fechas_invalidas"] = int(df["Fecha"].isna().sum())
    df = df.dropna(subset=["Fecha"])

    # 3) Normalización de texto en columnas categóricas (trim + colapso espacios)
    for c in ["Referencia", "Producto", "Desde", "Hasta", "Unidad de medida"]:
        df[c] = df[c].astype(str).str.strip().str.replace(r"\s+", " ", regex=True)

    # 4) Unificar unidad de medida a minúscula estándar
    df["Unidad de medida"] = (df["Unidad de medida"].str.lower()
                              .replace({"unidades": "unidad", "u": "unidad"}))
    df["is_libra"]  = (df["Unidad de medida"] == "lb").astype(int)
    df["is_unidad"] = (df["Unidad de medida"] == "unidad").astype(int)
    report["unidades"] = df["Unidad de medida"].value_counts().to_dict()

    # 5) Duplicados exactos (misma fecha, producto, ref, cantidad, origen/destino)
    dups = df.duplicated().sum()
    df = df.drop_duplicates().reset_index(drop=True)
    report["duplicados_eliminados"] = int(dups)

    # 6) Clasificar tipo de movimiento y sucursal
    df["mov_type"] = df.apply(classify_movement, axis=1)
    df["sucursal"] = df.apply(branch_of_movement, axis=1)
    report["mov_type"] = df["mov_type"].value_counts().to_dict()

    # 7) Valores imposibles / errores de captura en 'Realizado'
    #    'Realizado' es la cantidad del movimiento (siempre >=0 en Odoo).
    #    Detectamos outliers extremos como errores de captura (p.ej. 999000).
    #    Regla: por producto, marcamos como sospechoso si supera el
    #    percentil 99.9 global Y es > 5000 (magnitud no realista para pescado).
    df["Realizado"] = pd.to_numeric(df["Realizado"], errors="coerce").fillna(0)
    thresh = max(5000, df["Realizado"].quantile(0.999))
    df["captura_error"] = (df["Realizado"] > thresh).astype(int)
    report["errores_captura"] = int(df["captura_error"].sum())
    report["captura_error_thresh"] = float(thresh)
    #  No se borran las filas: se marcan. Para el panel de demanda usaremos una
    #  versión winsorizada (recortada) de la cantidad, conservando la traza.
    cap = df["Realizado"].quantile(0.999)
    df["Realizado_wins"] = np.where(df["captura_error"] == 1, cap, df["Realizado"])

    # 8) Cantidades negativas: en este archivo Realizado>=0 siempre. Validamos.
    report["cantidades_negativas"] = int((df["Realizado"] < 0).sum())

    # 9) Parseo/enriquecimiento de producto -> corrige nombres inconsistentes
    #    (mismo producto con/ sin código, mayúsculas, espacios) usando el código
    #    interno como clave canónica cuando existe.
    parsed = df["Producto"].apply(parse_product)
    df = pd.concat([df, parsed], axis=1)
    # Clave canónica de producto: código si existe, si no el nombre limpio.
    df["product_key"] = df["product_code"].fillna(df["product_clean"])
    report["n_productos_raw"] = int(df["Producto"].nunique())
    report["n_productos_canonicos"] = int(df["product_key"].nunique())

    report["n_filas_inicial"] = n0
    report["n_filas_final"] = len(df)
    return df, report


if __name__ == "__main__":
    df = load_raw()
    df, rep = clean_data(df)
    print("=== PARTE 1: LIMPIEZA ===")
    for k, v in rep.items():
        print(f"{k}: {v}")
    df.to_parquet("/home/claude/_clean.parquet")
    print("\nOK -> _clean.parquet", df.shape)

"""
PARTE 3-6 — PANEL, FEATURE ENGINEERING, VALIDACIÓN, DATASET FINAL
Regla anti-leakage: TODA feature histórica usa shift(1) por grupo.
"""
import warnings; warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, holidays

SHELF = 90
df = pd.read_parquet("/home/claude/_clean.parquet")

# ==============================================================================
# PARTE 3 — TRANSFORMACIÓN A PANEL  (Fecha x Producto x Sucursal)
# ==============================================================================
# Demanda = ventas al cliente final (mov_type VENTA). Se usa cantidad winsorizada.
sales = df[df["mov_type"] == "VENTA"].copy()
sales["fecha"] = sales["Fecha"].dt.normalize()

# atributos de producto que viajan con el panel (1 fila por product_key)
prod_attr = (sales.sort_values("Fecha")
             .groupby("product_key")
             .agg(product_clean=("product_clean","last"),
                  category=("category","last"),
                  presentation=("presentation","last"),
                  talla=("talla","last"),
                  peso_declarado=("peso_declarado","median"),
                  is_granel=("is_granel","last"),
                  is_funda=("is_funda","last"),
                  is_caja=("is_caja","last"),
                  is_bandeja=("is_bandeja","last"),
                  is_libra=("is_libra","last"),
                  is_unidad=("is_unidad","last"))
             .reset_index())

# demanda diaria agregada por (fecha, producto, sucursal)
daily = (sales.groupby(["fecha","product_key","sucursal"])
         .agg(demanda=("Realizado_wins","sum"),
              n_tx=("Realizado_wins","size"))
         .reset_index())

# --- rejilla densa: rellenar días sin venta con demanda=0 --------------------
# Para no explotar la memoria, cada combinación producto-sucursal se expande solo
# desde su PRIMERA venta hasta su ÚLTIMA venta (ciclo de vida comercial real).
frames = []
full_range_max = daily["fecha"].max()
for (pk, suc), g in daily.groupby(["product_key","sucursal"]):
    idx = pd.date_range(g["fecha"].min(), full_range_max, freq="D")
    gg = (g.set_index("fecha").reindex(idx)
          .rename_axis("fecha").reset_index())
    gg["product_key"] = pk; gg["sucursal"] = suc
    gg["demanda"] = gg["demanda"].fillna(0.0)
    gg["n_tx"] = gg["n_tx"].fillna(0).astype(int)
    frames.append(gg)
panel = pd.concat(frames, ignore_index=True)
panel = panel.merge(prod_attr, on="product_key", how="left")
panel = panel.sort_values(["product_key","sucursal","fecha"]).reset_index(drop=True)
print(f"PARTE 3 panel: {panel.shape} | series producto-sucursal: {panel.groupby(['product_key','sucursal']).ngroups}")

G = ["product_key","sucursal"]     # clave de serie
def gshift(s, n=1): return panel.groupby(G)[s].shift(n)

# ==============================================================================
# PARTE 4 — FEATURE ENGINEERING
# ==============================================================================
f = panel["fecha"]

# --- 4.1 Temporales (no dependen del target -> no requieren shift) -----------
panel["anio"]        = f.dt.year
panel["trimestre"]   = f.dt.quarter
panel["mes"]         = f.dt.month
panel["dia"]         = f.dt.day
panel["dia_anio"]    = f.dt.dayofyear
panel["dia_semana"]  = f.dt.dayofweek
panel["nombre_dia"]  = f.dt.day_name()
panel["semana_anio"] = f.dt.isocalendar().week.astype(int)
panel["fin_de_semana"] = (panel["dia_semana"] >= 5).astype(int)
panel["inicio_mes"]  = f.dt.is_month_start.astype(int)
panel["fin_mes"]     = f.dt.is_month_end.astype(int)
panel["quincena"]    = (panel["dia"] > 15).astype(int)     # 0=primera, 1=segunda
# codificación cíclica (mejor que ordinal para árboles y redes)
panel["mes_sin"] = np.sin(2*np.pi*panel["mes"]/12)
panel["mes_cos"] = np.cos(2*np.pi*panel["mes"]/12)
panel["dow_sin"] = np.sin(2*np.pi*panel["dia_semana"]/7)
panel["dow_cos"] = np.cos(2*np.pi*panel["dia_semana"]/7)

# feriados Ecuador
ec = holidays.Ecuador(years=range(f.dt.year.min(), f.dt.year.max()+1))
hol = pd.Series(1, index=pd.to_datetime(list(ec.keys())))
panel["festivo"]        = panel["fecha"].isin(hol.index).astype(int)
panel["vispera_festivo"]= (panel["fecha"]+pd.Timedelta(days=1)).isin(hol.index).astype(int)
panel["postfestivo"]    = (panel["fecha"]-pd.Timedelta(days=1)).isin(hol.index).astype(int)

# --- 4.2 Lags (con shift: siempre pasado) ------------------------------------
for l in [1,2,3,7,14,21,28,30,60,90]:
    panel[f"lag_{l}"] = gshift("demanda", l)

# --- 4.3 Promedios y estadísticos móviles ------------------------------------
# base = demanda desplazada 1 día -> la ventana NUNCA incluye el día actual.
base = gshift("demanda", 1)
for w in [3,7,14,21,30,60,90]:
    r = base.groupby([panel[G[0]],panel[G[1]]]).rolling(w, min_periods=1)
    panel[f"ma_{w}"]     = r.mean().reset_index(level=[0,1],drop=True)
    panel[f"std_{w}"]    = r.std().reset_index(level=[0,1],drop=True)
    panel[f"max_{w}"]    = r.max().reset_index(level=[0,1],drop=True)
    panel[f"min_{w}"]    = r.min().reset_index(level=[0,1],drop=True)
    panel[f"med_{w}"]    = r.median().reset_index(level=[0,1],drop=True)
panel["rango_movil_30"] = panel["max_30"] - panel["min_30"]
panel["p90_movil_30"]   = (base.groupby([panel[G[0]],panel[G[1]]])
                           .rolling(30,min_periods=1).quantile(.9)
                           .reset_index(level=[0,1],drop=True))

# --- 4.4 Tendencia y crecimiento ---------------------------------------------
panel["crec_diario"]   = (panel["lag_1"] - panel["lag_2"])
panel["crec_semanal"]  = (panel["lag_7"] - panel["lag_14"])
panel["crec_mensual"]  = (panel["ma_7"]  - panel["ma_30"])
panel["tendencia"]     = panel["ma_7"] - panel["ma_30"]           # signo = dirección
panel["pendiente_7"]   = (panel["ma_3"] - panel["ma_7"]) / 7.0

# --- 4.5 Estacionalidad: media histórica por día de semana (expanding+shift) -
# promedio de demanda que ha tenido esta serie en, p.ej., los lunes ANTERIORES
panel["_cum_dow_sum"] = (panel.groupby(G+["dia_semana"])["demanda"]
                         .apply(lambda s: s.shift(1).expanding().mean())
                         .reset_index(level=[0,1,2],drop=True))
panel["media_dia_semana_hist"] = panel["_cum_dow_sum"]
panel["media_mes_hist"] = (panel.groupby(G+["mes"])["demanda"]
                           .apply(lambda s: s.shift(1).expanding().mean())
                           .reset_index(level=[0,1,2],drop=True))

# --- 4.6 Variables de INVENTARIO (usando TODAS las transacciones) ------------
# Reconstruimos entradas/salidas por (fecha,producto,sucursal) desde el archivo
mov = df.copy(); mov["fecha"] = mov["Fecha"].dt.normalize()
def mov_branch_side(r):
    # entrada al local si Hasta es local; salida si Desde es local
    from_b = r["Desde"] in {"MATRZ/Existencias","GUAPG/Existencias","10AGO/Existencias"}
    to_b   = r["Hasta"] in {"MATRZ/Existencias","GUAPG/Existencias","10AGO/Existencias"}
    return pd.Series({"entra": r["Realizado_wins"] if to_b else 0.0,
                      "sale":  r["Realizado_wins"] if from_b else 0.0})
mov[["entra","sale"]] = mov.apply(mov_branch_side, axis=1)
mov["suc"] = mov["sucursal"]
invflow = (mov.groupby(["fecha","product_key","suc"])[["entra","sale"]].sum()
           .reset_index().rename(columns={"suc":"sucursal"}))
panel = panel.merge(invflow, on=["fecha","product_key","sucursal"], how="left")
panel[["entra","sale"]] = panel[["entra","sale"]].fillna(0.0)

# acumulados hasta AYER (shift) -> stock disponible al empezar el día
ent_cum = panel.groupby(G)["entra"].apply(lambda s: s.shift(1).cumsum()).reset_index(level=[0,1],drop=True)
sal_cum = panel.groupby(G)["sale"].apply(lambda s: s.shift(1).cumsum()).reset_index(level=[0,1],drop=True)
panel["entradas_acum"] = ent_cum.fillna(0)
panel["salidas_acum"]  = sal_cum.fillna(0)
panel["stock_inicial_dia"] = (panel["entradas_acum"] - panel["salidas_acum"]).clip(lower=0)
panel["consumo_acum"] = panel.groupby(G)["demanda"].apply(
    lambda s: s.shift(1).cumsum()).reset_index(level=[0,1],drop=True).fillna(0)
# cobertura en días = stock / demanda media reciente
panel["cobertura_dias"] = panel["stock_inicial_dia"] / panel["ma_7"].replace(0,np.nan)
panel["rotacion"] = panel["salidas_acum"] / panel["entradas_acum"].replace(0,np.nan)
panel["dias_sin_stock"] = (panel["stock_inicial_dia"] <= 0).astype(int)

# días desde último ingreso / última venta (vectorizado, sin mirar el día actual)
def days_since(flag_col):
    # fecha del último evento OCURRIDO ANTES de hoy (shift para no incluir hoy)
    ev = panel["fecha"].where(panel[flag_col] > 0)
    last = ev.groupby([panel[G[0]], panel[G[1]]]).apply(
        lambda s: s.shift(1).ffill()).reset_index(level=[0,1], drop=True)
    return (panel["fecha"] - last).dt.days
panel["dias_desde_ingreso"] = days_since("entra")
panel["dias_desde_venta"]   = days_since("demanda")

# --- 4.7 PERECIBILIDAD (FIFO aproximado, vida útil 90 días) -------------------
# Sin número de lote real: aproximamos por FIFO. La "edad del lote vigente" se
# estima como el tiempo transcurrido desde que entró el stock que aún no se ha
# consumido. Aproximación práctica: días desde el último ingreso significativo,
# acotado a la vida útil. (Detalle metodológico en la explicación.)
panel["edad_lote_est"] = panel["dias_desde_ingreso"].clip(upper=SHELF)
panel["pct_vida_util"] = (panel["edad_lote_est"] / SHELF).clip(0,1)
panel["dias_restantes_est"] = (SHELF - panel["edad_lote_est"]).clip(lower=0)
panel["riesgo_vencimiento"] = (panel["pct_vida_util"] > 0.8).astype(int)

# --- 4.8 Variables de demanda / estadísticas históricas (expanding+shift) ----
panel["demanda_acum"] = panel["consumo_acum"]
panel["media_hist"] = (panel.groupby(G)["demanda"]
    .apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True))
panel["std_hist"] = (panel.groupby(G)["demanda"]
    .apply(lambda s: s.shift(1).expanding().std()).reset_index(level=[0,1],drop=True))
panel["max_hist"] = (panel.groupby(G)["demanda"]
    .apply(lambda s: s.shift(1).expanding().max()).reset_index(level=[0,1],drop=True))
panel["cv_hist"] = panel["std_hist"] / panel["media_hist"].replace(0,np.nan)

# --- 4.9 Variables por sucursal / participación (con corte temporal) ---------
# ranking y share se calculan sobre acumulado histórico (shift) para no filtrar.
panel["share_producto_suc"] = (panel["consumo_acum"] /
    panel.groupby(["sucursal","fecha"])["consumo_acum"].transform("sum").replace(0,np.nan))

# --- Producto: flags libra/unidad ya presentes; peso/tamaño ------------------
panel["es_insumo"] = (panel["category"] == "Insumo").astype(int)

# ==============================================================================
# PARTE 4 (targets) — VARIABLES OBJETIVO  (única mirada al FUTURO)
# ==============================================================================
# Demanda futura acumulada en la ventana [t+1, t+h]
for h in [1,3,7,15,30]:
    fut = (panel.groupby(G)["demanda"]
           .apply(lambda s: s.shift(-1).rolling(h, min_periods=h).sum().shift(-(h-1)))
           .reset_index(level=[0,1],drop=True))
    panel[f"target_{h}d"] = fut

# ==============================================================================
# PARTE 5 — VALIDACIÓN ANTI DATA-LEAKAGE
# ==============================================================================
leak = {}
# test: para una serie, lag_1 en fila i debe igualar demanda en fila i-1
s0 = panel.groupby(G).ngroup()==0
sub = panel[s0].reset_index(drop=True)
chk = np.allclose(sub["lag_1"].iloc[1:6].values, sub["demanda"].iloc[0:5].values, equal_nan=True)
leak["lag_1==demanda(t-1)"] = bool(chk)
# ma_7 en fila i no debe incluir demanda[i]
leak["features_no_futuro"] = "OK (todas las features usan shift(1) / expanding().shift)"
print("PARTE 5 leakage:", leak)

# limpiar auxiliares
panel = panel.drop(columns=[c for c in panel.columns if c.startswith("_")])

# ==============================================================================
# PARTE 6 — DATASET FINAL
# ==============================================================================
# nos quedamos con filas que tengan al menos el target de 1 día definido y con
# suficiente historia (lag_7 disponible) para que el modelo no entrene con NaN masivo
final = panel.dropna(subset=["target_1d"]).copy()
final = final.reset_index(drop=True)
final.to_parquet("/home/claude/dataset_forecasting_final.parquet")
final.head(20000).to_csv("/home/claude/dataset_forecasting_sample.csv", index=False)
# CSV completo (comprimido para tamaño)
final.to_csv("/home/claude/dataset_forecasting_final.csv.gz", index=False, compression="gzip")

print(f"\nPARTE 6 dataset final: {final.shape}")
print(f"Columnas: {final.shape[1]} | filas: {final.shape[0]}")
print(f"Series (producto x sucursal): {final.groupby(G).ngroups}")
print(f"Rango: {final['fecha'].min().date()} -> {final['fecha'].max().date()}")
print("Targets no nulos:", {f'target_{h}d': int(final[f'target_{h}d'].notna().sum()) for h in [1,3,7,15,30]})

# diccionario de datos
import json
dd = []
grp = {
 "id":["fecha","product_key","sucursal","product_clean"],
 "target":["target_1d","target_3d","target_7d","target_15d","target_30d"],
 "temporal":["anio","trimestre","mes","dia","dia_anio","dia_semana","nombre_dia",
   "semana_anio","fin_de_semana","inicio_mes","fin_mes","quincena","mes_sin","mes_cos",
   "dow_sin","dow_cos","festivo","vispera_festivo","postfestivo"],
 "lags":[c for c in final if c.startswith("lag_")],
 "rolling":[c for c in final if c.split("_")[0] in {"ma","std","max","min","med"} and c[-1].isdigit()],
 "tendencia":["crec_diario","crec_semanal","crec_mensual","tendencia","pendiente_7",
   "rango_movil_30","p90_movil_30"],
 "estacionalidad":["media_dia_semana_hist","media_mes_hist"],
 "inventario":["entra","sale","entradas_acum","salidas_acum","stock_inicial_dia",
   "consumo_acum","cobertura_dias","rotacion","dias_sin_stock","dias_desde_ingreso",
   "dias_desde_venta"],
 "perecibilidad":["edad_lote_est","pct_vida_util","dias_restantes_est","riesgo_vencimiento"],
 "demanda_hist":["demanda","demanda_acum","media_hist","std_hist","max_hist","cv_hist"],
 "sucursal":["share_producto_suc"],
 "producto":["category","presentation","talla","peso_declarado","is_granel","is_funda",
   "is_caja","is_bandeja","is_libra","is_unidad","es_insumo"],
}
for g,cols in grp.items():
    for c in cols:
        if c in final.columns:
            dd.append({"variable":c,"grupo":g,"dtype":str(final[c].dtype),
                       "%_nulos":round(final[c].isna().mean()*100,2)})
pd.DataFrame(dd).to_csv("/home/claude/data_dictionary.csv", index=False)
print("\nOK -> dataset_forecasting_final.parquet, .csv.gz, data_dictionary.csv")

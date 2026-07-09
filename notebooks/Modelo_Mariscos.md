<div style="color:#3c4d5a; border-top: 7px solid #42A5F5; border-bottom: 7px solid #42A5F5; padding: 5px; text-align: center; text-transform: uppercase"><h1>Modelo XGBoost — Predicción de Ventas Futuras (Mariscos)</h1> </div>

<div>    
</div>
1. Carga y exploración del dataset
2. Feature engineering y selección de variables
3. División temporal (train/test)
4. XGBoost base
5. Optimización con RandomizedSearchCV + TimeSeriesSplit
6. Evaluación y análisis de residuos
7. Importancia de variables
8. Conclusión



<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>Instalación de dependencias e importaciones</h2> </div>


```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
import os
import json
import mlflow
import joblib

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")
sns.set_theme(style="whitegrid", palette="muted")
SEED = 42
os.makedirs("../artefactos", exist_ok=True)
print("Librerías importadas correctamente.")
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>1. Carga del dataset</h2> </div>

El dataset contiene registros históricos de ventas de productos del mar (camarón, corvina, pescado, tilapia, calamar, salmón, atún, pulpo, langostino, cangrejo, concha, scallops) con 116 columnas que incluyen variables temporales, lags, medias móviles, inventario y targets de demanda futura.


```python
df = pd.read_csv("../dataset_forecasting_final.csv.gz", compression="gzip", low_memory=False)
print(f"Dimensiones: {df.shape[0]:,} filas x {df.shape[1]} columnas")
print(f"Rango de fechas: {df["fecha"].min()} → {df["fecha"].max()}")
```


```python
print("Categorías de productos:")
print(df["category"].value_counts().to_string())
print(f"\nSucursales: {df["sucursal"].nunique()}")
print(f"Productos únicos: {df["product_key"].nunique()}")
```


```python
df["fecha"] = pd.to_datetime(df["fecha"])
df = df.sort_values(["product_key", "fecha"]).reset_index(drop=True)
print("Vista inicial:")
display(df.head(3))
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>2. Feature Engineering y selección de variables</h2> </div>

El dataset ya incluye ingeniería de atributos completa: variables temporales (año, mes, día, día_semana, fin_de_semana), lags (lag_1 hasta lag_90), medias móviles (ma_3 hasta ma_90), estadísticos móviles (std, max, min, med), variables de inventario y rotación.

Se codifican las variables categóricas (product_key, sucursal, category) y se seleccionan las features más relevantes para el modelo. El target será **target_30d** (demanda acumulada a 30 días), que es menos disperso que target_7d.


```python
# ── Codificación de categóricas ──
cats = {"product_key": LabelEncoder(), "sucursal": LabelEncoder(),
        "category": LabelEncoder(), "presentation": LabelEncoder()}
for col, le in cats.items():
    df[col + "_enc"] = le.fit_transform(df[col].astype(str))
print("Categóricas codificadas.")
```


```python
# ── Features seleccionadas (con codificación cíclica) ──
FEATURES = [
    "product_key_enc", "sucursal_enc",
    "mes_sin", "mes_cos", "dow_sin", "dow_cos",
    "fin_de_semana",
    "festivo", "vispera_festivo",
    "demanda", "n_tx",
    "lag_1", "lag_2", "lag_7", "lag_14",
    "ma_7", "ma_14",
    "stock_inicial_dia",
    "cobertura_dias",
    "rotacion",
    "media_dia_semana_hist",
    "share_producto_suc",
]
TARGET = "target_30d"
print(f"Features seleccionadas: {len(FEATURES)}")
print(FEATURES)
```


```python
# ── Filtrar filas con datos válidos ──
df_model = df.dropna(subset=FEATURES + [TARGET]).copy()
print(f"Filas para modelado: {len(df_model):,} (descartadas {len(df)-len(df_model):,})")
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>3. División temporal (train/test)</h2> </div>

Se respeta el orden cronológico: se entrena con el 80% más antiguo y se evalúa con el 20% más reciente. Así se simula un escenario real de **forecasting**, donde el modelo predice ventas futuras usando solo datos del pasado.


```python
# ── Split temporal 80/20 ──
df_model = df_model.sort_values("fecha").reset_index(drop=True)
corte = int(len(df_model) * 0.80)
df_train = df_model.iloc[:corte].copy()
df_test  = df_model.iloc[corte:].copy()

X_train = df_train[FEATURES]
y_train = df_train[TARGET]
X_test  = df_test[FEATURES]
y_test  = df_test[TARGET]

print(f"Entrenamiento: {len(df_train):,} muestras ({df_train['fecha'].min().date()} → {df_train['fecha'].max().date()})")
print(f"Prueba:       {len(df_test):,} muestras ({df_test['fecha'].min().date()} → {df_test['fecha'].max().date()})")
```


```python
def calcular_metricas(nombre, modelo, X_tr, y_tr, X_te, y_te):
    pred_tr = modelo.predict(X_tr)
    pred_te = modelo.predict(X_te)
    def mape(y_true, y_pred):
        mask = y_true != 0
        return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)
    return {
        "Modelo": nombre,
        "train_MAE": round(mean_absolute_error(y_tr, pred_tr), 3),
        "test_MAE": round(mean_absolute_error(y_te, pred_te), 3),
        "train_RMSE": round(np.sqrt(mean_squared_error(y_tr, pred_tr)), 3),
        "test_RMSE": round(np.sqrt(mean_squared_error(y_te, pred_te)), 3),
        "train_R2": round(r2_score(y_tr, pred_tr), 4),
        "test_R2": round(r2_score(y_te, pred_te), 4),
        "test_MAPE": round(mape(y_te.values, pred_te), 2),
    }

resultados = []
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>4. XGBoost Base</h2> </div>

Se entrena un XGBoost base con **objetivo Tweedie** (`reg:tweedie`), diseñado para datos zero-inflated con cola positiva como la demanda. Además se usa **early stopping** sobre un 10% de validación interno para detener el entrenamiento cuando el RMSE deja de mejorar.


```python
# ── Split interno train/val para early stopping ──
val_size = int(len(X_train) * 0.1)
X_tr, X_val = X_train.iloc[:-val_size], X_train.iloc[-val_size:]
y_tr, y_val = y_train.iloc[:-val_size], y_train.iloc[-val_size:]

xgb_base = XGBRegressor(
    objective="reg:tweedie", tweedie_variance_power=1.5,
    n_estimators=1000, max_depth=3, learning_rate=0.05,
    subsample=0.7, colsample_bytree=0.6,
    reg_alpha=1.0, reg_lambda=2.0, min_child_weight=5,
    early_stopping_rounds=10,
    random_state=SEED, verbosity=0
)
xgb_base.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
res_base = calcular_metricas("XGBoost_base", xgb_base, X_train, y_train, X_test, y_test)
resultados.append(res_base)
print("XGBoost base:", {k:v for k,v in res_base.items() if k != "Modelo"})
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>5. Optimización de hiperparámetros</h2> </div>

Se utiliza **RandomizedSearchCV** con **TimeSeriesSplit** (3 folds) para buscar la mejor combinación de hiperparámetros que minimice el RMSE, respetando el orden cronológico de los datos.


```python
tscv = TimeSeriesSplit(n_splits=3)

param_dist = {
    "n_estimators": [100, 200, 300, 500],
    "max_depth": [3, 4, 5, 6],
    "learning_rate": [0.01, 0.03, 0.05, 0.1],
    "subsample": [0.7, 0.8, 0.9, 1.0],
    "colsample_bytree": [0.6, 0.8, 1.0],
    "reg_alpha": [0, 0.1, 0.5, 1],
    "reg_lambda": [0.5, 1, 2, 3],
    "min_child_weight": [1, 3, 5, 7],
    "gamma": [0, 0.1, 0.2]
}

random_search = RandomizedSearchCV(
    estimator=XGBRegressor(
        objective="reg:tweedie", tweedie_variance_power=1.5,
        random_state=SEED, verbosity=0
    ),
    param_distributions=param_dist,
    n_iter=50,
    scoring="neg_root_mean_squared_error",
    cv=tscv,
    random_state=SEED,
    n_jobs=-1,
    refit=True
)

print("Ejecutando RandomizedSearchCV (50 iteraciones x 3 folds)...")
random_search.fit(X_train, y_train)

```


```python
best_params = random_search.best_params_
print("Mejores hiperparámetros:")
for k, v in best_params.items():
    print(f"   {k:20s}: {v}")
```


```python
xgb_opt = random_search.best_estimator_
res_opt = calcular_metricas("XGBoost_opt", xgb_opt, X_train, y_train, X_test, y_test)
resultados.append(res_opt)
print("XGBoost optimizado:")
for k, v in res_opt.items():
    if k != "Modelo":
        print(f"   {k}: {v}")
```


```python
df_comp = pd.DataFrame(resultados).set_index("Modelo")
print("Comparación de modelos:")
display(df_comp)
```


```python
df_over = df_comp[["train_R2","test_R2","train_RMSE","test_RMSE"]].copy()
df_over["gap_R2"] = (df_over["train_R2"] - df_over["test_R2"]).round(4)
df_over["gap_RMSE"] = (df_over["test_RMSE"] - df_over["train_RMSE"]).round(3)
print("Análisis de sobreajuste:")
display(df_over)
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>6. Evaluación gráfica</h2> </div>


```python
y_pred_opt = xgb_opt.predict(X_test)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Reales vs predichos
axes[0].scatter(y_test, y_pred_opt, alpha=0.3, s=10, color='steelblue')
lims = [min(y_test.min(), y_pred_opt.min()) - 1,
        max(y_test.max(), y_pred_opt.max()) + 1]
axes[0].plot(lims, lims, "r--", lw=1.5, label="Predicción perfecta")
axes[0].set_xlabel("Real"); axes[0].set_ylabel("Predicho")
axes[0].set_title("Reales vs Predichos — XGBoost Opt.")
axes[0].legend(fontsize=8)

# Serie temporal
n_show = min(200, len(y_test))
axes[1].plot(y_test.values[:n_show], label="Real", lw=1)
axes[1].plot(y_pred_opt[:n_show], label="Predicho", lw=1, ls="--")
axes[1].set_xlabel("Muestra"); axes[1].set_ylabel("Demanda acumulada 7d")
axes[1].set_title("Serie temporal (primeras 200 muestras)")
axes[1].legend(fontsize=8)

plt.tight_layout()
plt.savefig("../artefactos/reales_vs_predichos.png", dpi=120, bbox_inches="tight")
plt.show()
```


```python
residuos = y_test.values - y_pred_opt

fig, axes = plt.subplots(1, 2, figsize=(14, 4))
axes[0].scatter(y_pred_opt, residuos, alpha=0.3, s=10, color="coral")
axes[0].axhline(0, color="black", lw=1)
axes[0].set_xlabel("Predicción"); axes[0].set_ylabel("Residuo")
axes[0].set_title("Residuos vs Predicción")

axes[1].hist(residuos, bins=50, color="slateblue", edgecolor="white")
axes[1].axvline(0, color="black", lw=1)
axes[1].set_xlabel("Residuo"); axes[1].set_ylabel("Frecuencia")
axes[1].set_title("Distribución de Residuos")

plt.tight_layout()
plt.savefig("../artefactos/residuos.png", dpi=120, bbox_inches="tight")
plt.show()
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>7. Importancia de variables</h2> </div>


```python
importancias = pd.Series(
    xgb_opt.feature_importances_, index=FEATURES
).sort_values(ascending=True)

fig, ax = plt.subplots(figsize=(10, 8))
importancias.plot(kind="barh", color="teal", ax=ax)
ax.set_title("Importancia de Variables — XGBoost Optimizado")
ax.set_xlabel("Importancia (gain)")
plt.tight_layout()
plt.savefig("../artefactos/importancia_variables.png", dpi=120, bbox_inches="tight")
plt.show()
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>7. Exportación del modelo a MLflow</h2> </div>

Se exporta el modelo optimizado, los codificadores y la configuración necesaria para usar el modelo desde el cuaderno de predicción.


```python
# ── 7.1 Guardar dataset procesado y configurar MLflow ──
df_model.to_csv('../artefactos/dataset_procesado.csv', index=False)
print(f"Dataset procesado guardado: {len(df_model):,} filas")

EXPERIMENT_NAME = 'Prediccion_Ventas_Mariscos_XGBoost'
os.environ['MLFLOW_ALLOW_FILE_STORE'] = 'true'
mlflow.set_tracking_uri('../mlruns')
mlflow.set_experiment(EXPERIMENT_NAME)
print(f'Experimento MLflow: "{EXPERIMENT_NAME}"')
```


```python
# ── 7.2 Guardar encoders y registrar modelo en MLflow ──
joblib.dump(cats, '../artefactos/label_encoders.pkl')
print("Label encoders guardados en ../artefactos/label_encoders.pkl")

import mlflow.xgboost
with mlflow.start_run(run_name='XGBoost_Mariscos_optimizado') as run:
    mlflow.log_params(best_params)
    mlflow.log_metrics({
        'train_MAE': res_opt['train_MAE'],
        'test_MAE': res_opt['test_MAE'],
        'train_RMSE': res_opt['train_RMSE'],
        'test_RMSE': res_opt['test_RMSE'],
        'train_R2': res_opt['train_R2'],
        'test_R2': res_opt['test_R2'],
        'test_MAPE': res_opt['test_MAPE'],
    })
    mlflow.xgboost.log_model(
        xgb_model=xgb_opt,
        artifact_path='xgboost_model',
        registered_model_name='XGBoost_Mariscos'
    )
    run_id = run.info.run_id

print(f"Modelo registrado en MLflow. Run ID: {run_id}")
```


```python
# ── 7.3 Exportar configuración para Funcion_Prediccion ──
config_export = {
    'experiment_name': EXPERIMENT_NAME,
    'run_id_optimo': run_id,
    'model_uri': f'runs:/{run_id}/xgboost_model',
    'features': FEATURES,
    'target': TARGET
}
with open('../artefactos/config_modelo.json', 'w') as f:
    json.dump(config_export, f, indent=2)

print('Configuración exportada en ../artefactos/config_modelo.json')
print(f'   model_uri: {config_export["model_uri"]}')
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>8. Conclusiones</h2> </div>

Se construyó un modelo XGBoost para predecir la demanda acumulada a 7 días (target_7d) de productos del mar, utilizando datos históricos con ingeniería de atributos avanzada (lags, medias móviles, variables de inventario y calendario).

El proceso incluyó:
- Codificación de variables categóricas (producto, sucursal, categoría)
- División temporal 80/20 respetando el orden cronológico
- Entrenamiento de XGBoost base como referencia
- Optimización de hiperparámetros con RandomizedSearchCV + TimeSeriesSplit (validación temporal)
- Evaluación mediante MAE, RMSE, R², MAPE, análisis de residuos y gráficos de reales vs predichos
- Análisis de importancia de variables para interpretar el modelo

El XGBoost optimizado logra capturar la tendencia general de la demanda. Las variables más influyentes incluyen la demanda histórica reciente, los patrones semanales y las variables de inventario. El análisis de residuos muestra errores centrados alrededor de cero, lo que indica que el modelo no presenta sesgos significativos.

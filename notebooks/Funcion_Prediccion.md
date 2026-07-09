<div style="color:#3c4d5a; border-top: 7px solid #42A5F5; border-bottom: 7px solid #42A5F5; padding: 5px; text-align: center; text-transform: uppercase"><h1>Predicción de Ventas — Mariscos</h1> </div>

1. Librerías y Carga del Modelo
2. Función de Predicción
3. Ejemplos de Predicción
4. Visualización
5. Conclusión

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>1. Librerías y Carga del Modelo</h2> </div>

Se carga el modelo XGBoost optimizado desde MLflow, junto con las features, codificadores y el dataset procesado. El catálogo contiene el último registro conocido de cada combinación producto-sucursal, que sirve como base para predecir la demanda acumulada a 30 días (target_30d).


```python
import pandas as pd, numpy as np, json, joblib, warnings
import matplotlib.pyplot as plt
import os
import mlflow.xgboost
warnings.filterwarnings('ignore')

# Configuración exportada por Modelo_Mariscos
with open('../artefactos/config_modelo.json') as f:
    cfg = json.load(f)

FEATURES = cfg['features']
os.environ['MLFLOW_ALLOW_FILE_STORE'] = 'true'
mlflow.set_tracking_uri('../mlruns')
mlflow.set_experiment(cfg['experiment_name'])

modelo = mlflow.xgboost.load_model(cfg['model_uri'])
encoders = joblib.load('../artefactos/label_encoders.pkl')
le_product_key = encoders['product_key']
le_sucursal = encoders['sucursal']

# Catálogo: último registro conocido por (product_key, sucursal)
df_proc = pd.read_csv('../artefactos/dataset_procesado.csv')
catologo = (df_proc.sort_values('fecha')
            .groupby(['product_key', 'sucursal'])
            .last().reset_index())

print('Modelo cargado correctamente.')
print(f'Catálogo disponible para {len(catologo)} combinaciones producto × sucursal')
```

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>2. Función de Predicción</h2> </div>


```python
def predecir(
    productos,        # str 'ALM-CAS-GEN-UNID' | list | 'todos'
    sucursales,       # str 'MATRIZ' | list | 'todas'
    fechas,           # str 'YYYY-MM-DD' | tuple ('inicio','fin') | list
    festivo=0,        # 0/1 global
    vispera_festivo=0 # 0/1 global
) -> pd.DataFrame:

    # Normalizar productos
    if isinstance(productos, str) and productos == 'todos':
        pids = catologo['product_key'].unique().tolist()
    elif isinstance(productos, str):
        pids = [productos]
    else:
        pids = list(productos)

    # Normalizar sucursales
    if isinstance(sucursales, str) and sucursales == 'todas':
        sucs = catologo['sucursal'].unique().tolist()
    elif isinstance(sucursales, str):
        sucs = [sucursales]
    else:
        sucs = list(sucursales)

    # Normalizar fechas
    if isinstance(fechas, tuple):
        lista_fechas = [d.strftime('%Y-%m-%d') for d in pd.date_range(fechas[0], fechas[1])]
    elif isinstance(fechas, str):
        lista_fechas = [fechas]
    else:
        lista_fechas = [str(f) for f in fechas]

    # Filtrar solo combinaciones existentes en el catálogo
    catalogo_idx = set(zip(catologo['product_key'], catologo['sucursal']))
    combos = [(pid, suc) for pid in pids for suc in sucs if (pid, suc) in catalogo_idx]
    if not combos:
        print('No hay combinaciones válidas producto × sucursal en el catálogo.')
        return pd.DataFrame()

    filas = []
    for pid, suc in combos:
        s = catologo[(catologo['product_key'] == pid) & (catologo['sucursal'] == suc)].iloc[0]

        # Estado iterativo: se actualiza tras cada predicción
        lag1 = s['lag_1']
        lag2 = s['lag_2']
        demanda_iter = s['demanda']
        buf_ma7 = [float(s.get(f'lag_{i}', 0)) for i in range(7, 1, -1)]
        buf_ma14 = [float(s.get(f'lag_{i}', 0)) for i in range(14, 1, -1)]

        for fecha in lista_fechas:
            f = pd.to_datetime(fecha)
            mes = f.month
            dow = f.dayofweek

            row = {
                'product_key_enc': le_product_key.transform([str(pid)])[0],
                'sucursal_enc': le_sucursal.transform([str(suc)])[0],
                'mes_sin': np.sin(2 * np.pi * mes / 12),
                'mes_cos': np.cos(2 * np.pi * mes / 12),
                'dow_sin': np.sin(2 * np.pi * dow / 7),
                'dow_cos': np.cos(2 * np.pi * dow / 7),
                'fin_de_semana': int(dow >= 5),
                'festivo': festivo,
                'vispera_festivo': vispera_festivo,
                'demanda': demanda_iter,
                'n_tx': s['n_tx'],
                'lag_1': lag1,
                'lag_2': lag2,
                'lag_7': buf_ma7[-1],
                'lag_14': buf_ma14[-1],
                'ma_7': float(np.mean(buf_ma7)),
                'ma_14': float(np.mean(buf_ma14)),
                'stock_inicial_dia': s['stock_inicial_dia'],
                'cobertura_dias': s['cobertura_dias'],
                'rotacion': s['rotacion'],
                'media_dia_semana_hist': s['media_dia_semana_hist'],
                'share_producto_suc': s['share_producto_suc'],
            }

            pred = max(0.0, round(
                float(modelo.predict(pd.DataFrame([row])[FEATURES])[0]), 2
            ))

            filas.append({
                'product_key': pid,
                'sucursal': suc,
                'product_clean': s['product_clean'],
                'category': s['category'],
                'fecha': fecha,
                'dia': f.strftime('%A'),
                'es_fin_de_semana': int(dow >= 5),
                'prediccion_30d': pred,
            })

            # Actualizar estado iterativo
            lag2 = lag1
            lag1 = pred
            demanda_iter = pred
            buf_ma7.append(pred)
            buf_ma14.append(pred)
            if len(buf_ma7) > 7:
                buf_ma7.pop(0)
            if len(buf_ma14) > 14:
                buf_ma14.pop(0)

    return pd.DataFrame(filas)


print('Función predecir() lista.')
```

La función `predecir()` permite generar predicciones de demanda acumulada a 30 días (target_30d) para uno o varios productos, en una o varias sucursales, en una fecha o rango de fechas específico.

Para cada combinación (producto, sucursal), se toma como base su último registro conocido del dataset histórico y se construyen las variables que el modelo XGBoost necesita: codificación del producto y sucursal, variables temporales cíclicas (mes, día de semana), indicadores de fin de semana/festivo, demanda histórica reciente (lags y medias móviles), y variables de inventario y rotación. El modelo predice la demanda total esperada para los próximos 30 días, actualizando los lags de forma iterativa para que las predicciones varíen día a día.

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>3. Ejemplos de Predicción</h2> </div>


```python
# Un producto — fecha única
display(predecir('ALM-CAS-GEN-UNID', 'MATRIZ', '2026-06-01'))
```


```python
# Un producto — rango de fechas 
df_rango = predecir('ALM-CAS-GEN-UNID', 'MATRIZ', ('2026-06-01', '2026-06-05'))
display(df_rango[['product_key', 'product_clean', 'fecha', 'dia', 'prediccion_30d']].head(5))
```


```python
# Varios productos — rango de fechas
productos = catologo['product_key'].unique()[:5]
df_pred = predecir(productos, 'MATRIZ', ('2026-06-01', '2026-06-07'))
display(df_pred[['product_key', 'sucursal', 'product_clean', 'fecha', 'prediccion_30d']].head(10))
```


```python
# Todos los productos — múltiples sucursales — fecha única
# (solo se procesan combinaciones existentes en el catálogo)
df_todos = predecir('todos', 'todas', '2026-06-01')
display(df_todos.groupby('category')['prediccion_30d'].mean().round(1).to_frame('promedio_30d'))
```

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>4. Visualización</h2> </div>


```python
# Proyección de demanda a 30 días para varios productos
ejemplos = catologo['product_key'].unique()[:6]
df_graf = predecir(ejemplos, 'MATRIZ', ('2026-06-01', '2026-06-14'))

fig, ax = plt.subplots(figsize=(12, 4))
for pid, grp in df_graf.groupby('product_key'):
    nom = grp['product_clean'].iloc[0][:20]
    ax.plot(grp['fecha'], grp['prediccion_30d'], marker='o', markersize=3,
            lw=1.5, label=f"{pid} | {nom}")
ax.set_title('Demanda acumulada esperada (30d) — Productos seleccionados')
ax.set_ylabel('Unidades estimadas (30d)')
ax.tick_params(axis='x', rotation=25)
ax.legend(fontsize=7, ncol=2)
plt.tight_layout()
plt.show()
```

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2>5. Conclusión</h2> </div>

Se implementó la función de predicción que carga el modelo XGBoost optimizado desde MLflow y permite estimar la demanda acumulada a 30 días para cualquier combinación de producto y sucursal en fechas futuras.

La función toma como base el último registro conocido de cada producto-sucursal y construye automáticamente todas las variables necesarias para el modelo, incluyendo codificación de categóricas, variables temporales, lags históricos y métricas de inventario.

Esto permite simular escenarios de demanda futura y apoyar decisiones de inventario, planificación de compras y abastecimiento para los productos del mar.

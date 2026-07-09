# Pipeline de Forecasting de Demanda — Productos del Mar
## Documentación técnica y recomendaciones

Dataset final: **135.024 filas × 116 columnas**, 332 series (producto × sucursal), rango **2025-01-02 → 2026-06-23**. Grano: **una fila = una Fecha + un Producto + una Sucursal**.

---

## 1. Descubrimientos sobre los datos reales (que condicionaron el diseño)

El archivo de Odoo no trae columnas explícitas de "tipo de movimiento" ni "sucursal". Hubo que **inferirlas**:

- **Tipo de movimiento** se deduce del par `Desde → Hasta`. Regla aplicada: `Local → Partners/Customers` = **VENTA** (la demanda real); `Partners/Vendors → Local` = INGRESO; `Customers → Local` = DEVOLUCIÓN; cualquier cosa con *Producción/Ajuste/Scrap* = movimiento interno; `Local → Local` = TRANSFERENCIA. Resultado: 29.489 ventas, 13.550 producción, 3.261 transferencias, 1.652 ajustes, 1.649 ingresos, 180 devoluciones, 102 scrap.
- **Sucursal**: embebida en la localización — `MATRZ`=MATRIZ, `GUAPG`=GUAPÁN, `10AGO`=10 DE AGOSTO. La matriz concentra ~88 % de las ventas.
- **`Saldo`** era **constante = 0** en las 49.941 filas → columna sin información, eliminada.
- **Errores de captura**: 39 movimientos con cantidades imposibles (hasta 999.000 lb). Se **marcan** (`captura_error`) y se **winsoriza** al percentil 99,9 en la versión usada para demanda, sin borrar la traza.
- Duplicados exactos: 47 filas eliminadas. Unidades unificadas a `lb` / `unidad`.
- Productos: 258 textos crudos → **256 claves canónicas** usando el código interno entre corchetes (`[DQ-019.27CAM]`) como identificador, lo que corrige el mismo producto escrito de formas distintas.

---

## 2. Explicación de cada grupo de variables y por qué mejora la predicción

**Temporales** (año, trimestre, mes, día, día de semana, semana ISO, quincena, fin de semana, inicio/fin de mes, y codificación cíclica `mes_sin/cos`, `dow_sin/cos`). Capturan estacionalidad de calendario. El EDA muestra un patrón claro: jueves y viernes son los días fuertes, domingo el más flojo, y la venta se concentra entre las 9 y 12 h. La codificación cíclica evita que el modelo interprete "diciembre (12) y enero (1)" como lejanos.

**Feriados de Ecuador** (`festivo`, `vispera_festivo`, `postfestivo`, vía librería `holidays`). El consumo de productos del mar se dispara en vísperas de feriados y Semana Santa.

**Lags** (1, 2, 3, 7, 14, 21, 28, 30, 60, 90). La demanda de ayer, de hace una semana y de hace un mes son los predictores más directos. El lag_7 captura el "mismo día de la semana pasada".

**Promedios y estadísticos móviles** (media/desviación/máx/mín/mediana en ventanas 3–90, más rango y percentil 90). Suavizan el ruido y dan el nivel reciente. En el modelo de prueba, **`ma_60` y `ma_30` fueron las variables #1 y #2** en importancia — el nivel base reciente es lo que más informa.

**Tendencia y crecimiento** (`crec_diario/semanal/mensual`, `tendencia`, `pendiente_7`). Indican si la serie sube o baja; distinguen un producto en auge de uno en declive.

**Estacionalidad histórica** (`media_dia_semana_hist`, `media_mes_hist`): promedio que ESE producto en ESA sucursal tuvo en lunes/febrero anteriores. Personaliza la estacionalidad por serie.

**Inventario** (stock_inicial_dia, entradas/salidas acumuladas, consumo, cobertura en días, rotación, días sin stock, días desde último ingreso/venta). Reconstruidos desde TODAS las transacciones, no solo ventas. Clave: **no se puede vender lo que no hay en stock**. `stock_inicial_dia` fue la 3ª variable más importante — la demanda observada está limitada por la disponibilidad.

**Perecibilidad / FIFO** (`edad_lote_est`, `pct_vida_util`, `dias_restantes_est`, `riesgo_vencimiento`). Como **no hay número de lote**, se aproxima por FIFO: se asume que el stock disponible corresponde a los ingresos más recientes no consumidos, y la "edad del lote vigente" se estima como los días transcurridos desde el último ingreso, acotada a los 90 días de vida útil. `pct_vida_util = edad/90`; si supera 0,8 se marca `riesgo_vencimiento`. `pct_vida_util` entró en el top 5. *Mejora posible cuando exista número de lote real: reemplazar la aproximación por edad exacta por lote.*

**Demanda / estadísticas históricas** (media, desviación, máximo, coeficiente de variación históricos, expanding). Perfilan el comportamiento acumulado del producto sin mirar el futuro.

**Producto** (categoría, presentación, talla, peso, flags libra/unidad/funda/caja/bandeja/insumo). Extraídos por parsing del nombre. Permiten al modelo compartir señal entre productos similares (todos los "Camarón Granel" se comportan parecido).

**Sucursal** (`share_producto_suc`): peso del producto dentro de su sucursal, con corte temporal.

---

## 3. Las 30 variables más importantes (XGBoost, target a 7 días)

`ma_60, ma_30, stock_inicial_dia, std_7, pct_vida_util, max_30, max_60, ma_7, rotacion, rango_movil_30, mes_cos, ma_90, ma_21, dia_anio, edad_lote_est, is_libra, p90_movil_30, crec_mensual, mes_sin, sale, max_14, tendencia, salidas_acum, trimestre, entradas_acum, std_14, max_7, cv_hist, max_hist, demanda_acum.`

Interpretación: dominan (1) el **nivel reciente** (medias móviles), (2) el **estado de inventario** y (3) la **perecibilidad** — coherente con un negocio de producto fresco. Ver `top30_features.csv`.

---

## 4. Validación anti Data-Leakage

Toda variable histórica se construye con `shift(1)` dentro de cada serie ordenada por fecha, o con `expanding().shift()`. Se verificó de forma independiente que:
- `lag_1[t] == demanda[t-1]` ✔
- `ma_7[t]` promedia los días `t-7 … t-1`, **sin incluir el día t** ✔
- `target_1d[t] == demanda[t+1]` (los targets son los únicos que miran al futuro) ✔

Los targets (`target_1d/3d/7d/15d/30d`) suman la demanda futura en la ventana `[t+1, t+h]`.

---

## 5. Variables adicionales recomendadas (a incorporar a futuro)

- **Precio de venta** y cambios de precio (elasticidad).
- **Promociones / descuentos** por producto-fecha.
- **Clima** (temperatura, lluvia) — afecta consumo y pesca.
- **Precio internacional del camarón** y tipo de cambio.
- **Número de lote real** → reemplaza la aproximación FIFO de perecibilidad.
- **Eventos locales** (fiestas de Cuenca/Azogues, quincena de pagos públicos).
- **Competencia** y quiebres de stock del competidor.

---

## 6. Recomendaciones de entrenamiento

- **Partición temporal estricta**: entrenar con fechas antiguas, validar/probar con las recientes. Nunca `shuffle` aleatorio en series de tiempo.
- **`TimeSeriesSplit`** (o walk-forward / expanding window) para la validación cruzada. Considerar un `gap` igual al horizonte para no filtrar la ventana del target.
- **Un modelo por horizonte** (o modelos multi-output) para 1/3/7/15/30 días; los horizontes largos son más difíciles.
- **Métricas**: MAE (robusta), RMSE (penaliza errores grandes), MAPE **solo sobre series con demanda > 0** (con muchos ceros usar WAPE o MASE), y R². En la prueba base sin tuning: **MAE ≈ 5,8 / R² ≈ 0,49** en holdout temporal para 7 días.
- **Manejo de ceros**: hay muchos días con demanda 0 (producto sin venta). Evaluar modelos *tweedie* o *zero-inflated*, o `objective='count:poisson'`/`'reg:tweedie'` en XGBoost.
- **Anti-sobreajuste**: `early_stopping` sobre el fold de validación, regularización (`max_depth` moderado, `subsample`, `colsample_bytree`, `min_child_weight`), y monitorear la brecha train/val.
- **Modelos sugeridos**: empezar con **XGBoost/LightGBM** (rápidos, manejan NaN nativamente, fuertes con esta tabla). Para capturar dependencias temporales largas, probar **LSTM** o **Temporal Fusion Transformer** una vez validado el baseline de árboles.
- **Escalado**: los árboles no lo necesitan; SVR/LSTM sí (StandardScaler ajustado **solo** con el train).
- **NaN**: LightGBM/XGBoost los toleran; para SVR/redes, imputar con 0 los lags iniciales o descartar el arranque de cada serie.

---

## Archivos entregados
- `dataset_forecasting_final.parquet` — dataset ML completo (recomendado).
- `dataset_forecasting_final.csv.gz` — mismo dataset en CSV comprimido.
- `dataset_forecasting_sample.csv` — muestra 20k filas (vista rápida).
- `data_dictionary.csv` — diccionario de las 116 columnas por grupo.
- `top30_features.csv` — ranking de importancia.
- `eda_report.txt` + 4 figuras PNG — análisis exploratorio.
- `pipeline_forecasting.py`, `part2_eda.py`, `part3_6_features.py` — código reproducible y documentado.

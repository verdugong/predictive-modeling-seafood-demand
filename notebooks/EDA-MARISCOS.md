<div style="color:#3c4d5a; border-top: 7px solid #42A5F5; border-bottom: 7px solid #42A5F5; padding: 5px; text-align: center; text-transform: uppercase"><h1>EDA - PREDICCION DE DEMANDA - DISPEQ   </h1> </div>
<br>

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>1. Introducción</strong></h2> </div>

### Objetivo del análisis
Este notebook realiza un **Análisis Exploratorio de Datos (EDA)** sobre un dataset ya preparado para
el pronóstico de demanda de una comercializadora de productos del mar. El propósito es entender los
datos: sus patrones temporales, el comportamiento por sucursal y producto, el estado del inventario,
la perecibilidad y las relaciones entre variables, como paso previo (y separado) a cualquier etapa de modelado.


### Descripción del dataset
- **Grano:** una fila por Fecha + Producto + Sucursal.
- **Tamaño aproximado:** ~135.024 filas × 116 columnas.
- **Series producto-sucursal:** ~332.
- **Rango de fechas:** 2025-01-02 a 2026-06-23.
- **Sucursales:** MATRIZ, GUAPÁN y 10 DE AGOSTO.
- **Unidades:** productos vendidos por **libras** (`lb`) y por **unidades**.
- **Vida útil estimada:** 90 días (usada para las variables de perecibilidad).
- **Contenido:** variables temporales, *lags*, promedios y estadísticos móviles, stock, rotación,
  perecibilidad (aproximada, sin número de lote real), demanda histórica y *targets* futuros.

La columna de demanda diaria se llama `demanda`. Los *targets* (`target_1d`, `target_3d`, `target_7d`,
`target_15d`, `target_30d`) representan demanda futura y no se analizan como objetivo predictivo aquí,
solo se mencionan.



<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>2. Carga de librerías</strong></h2> </div>


```python
import os

DATA_PATH     = "../dataset_forecasting_final.parquet"
DATA_PATH_CSV = "../dataset_forecasting_final.csv.gz"

if os.path.exists(DATA_PATH):
    df = pd.read_parquet(DATA_PATH)
    print(f"Cargado desde parquet: {DATA_PATH}")
elif os.path.exists(DATA_PATH_CSV):
    df = pd.read_csv(DATA_PATH_CSV, compression="gzip", parse_dates=["fecha"])
    print(f"Cargado desde csv.gz: {DATA_PATH_CSV}")
else:
    raise FileNotFoundError("No se encontró el dataset (.parquet ni .csv.gz). Ajusta la ruta.")

# aseguremos que 'fecha' sea datetime
df["fecha"] = pd.to_datetime(df["fecha"])
print("Dimensiones:", df.shape)
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>3. Carga del dataset</strong></h2> </div>

Se intenta leer primero el archivo `.parquet` (más eficiente). Si no existe, se recurre al
`.csv.gz`. Ajusta la ruta `DATA_PATH`/`DATA_PATH_CSV` si tus archivos están en otra carpeta.


```python
import os

DATA_PATH     = "../dataset_forecasting_final.parquet"
DATA_PATH_CSV = "../dataset_forecasting_final.csv.gz"

if os.path.exists(DATA_PATH):
    df = pd.read_parquet(DATA_PATH)
    print(f"Cargado desde parquet: {DATA_PATH}")
elif os.path.exists(DATA_PATH_CSV):
    df = pd.read_csv(DATA_PATH_CSV, compression="gzip", parse_dates=["fecha"])
    print(f"Cargado desde csv.gz: {DATA_PATH_CSV}")
else:
    raise FileNotFoundError("No se encontró el dataset (.parquet ni .csv.gz). Ajusta la ruta.")

# aseguremos que 'fecha' sea datetime
df["fecha"] = pd.to_datetime(df["fecha"])
print("Dimensiones:", df.shape)
```


```python
# Primeras filas
df.head()
```


```python
# Tipos de datos (resumen compacto)
tipos = df.dtypes.value_counts()
print("Conteo de columnas por tipo de dato:")
print(tipos)
print()
print("Uso de memoria: {:.2f} MB".format(df.memory_usage(deep=True).sum() / 1e6))
```


```python
# Helper: verificar existencia de columnas para hacer el notebook robusto
def cols_ok(*cols):
    faltan = [c for c in cols if c not in df.columns]
    if faltan:
        print("Columnas ausentes, se omite el bloque:", faltan)
        return False
    return True

print("Total de columnas:", len(df.columns))
print(list(df.columns))
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>4. Calidad de datos</strong></h2> </div>
Revisamos nulos, duplicados, rango temporal y los conteos de productos, sucursales y series.


```python
# Nulos por columna (solo las que tienen nulos)
nulos = df.isna().sum()
nulos = nulos[nulos > 0].sort_values(ascending=False)
pct = (nulos / len(df) * 100).round(2)
tabla_nulos = pd.DataFrame({"n_nulos": nulos, "%_nulos": pct})
print("Columnas con valores nulos:", len(tabla_nulos))
tabla_nulos.head(25)
```

Los nulos son **esperables y no son un error**:
- `peso_declarado` y `talla` solo aplican a productos que declaran ese atributo (p. ej. tallas de camarón).
- Los *lags* largos (`lag_60`, `lag_90`) y algunas medias móviles no existen al **inicio de cada serie**,
  cuando aún no hay suficiente historia. Esto es correcto en series de tiempo.


```python
# Duplicados a nivel de grano (fecha + producto + sucursal)
dup_grano = df.duplicated(subset=["fecha", "product_key", "sucursal"]).sum()
dup_total = df.duplicated().sum()
print("Duplicados por (fecha, producto, sucursal):", dup_grano)
print("Duplicados de fila completa:", dup_total)
```


```python
# Rango de fechas y conteos clave
print("Rango de fechas: {}  ->  {}".format(df['fecha'].min().date(), df['fecha'].max().date()))
print("Días distintos:", df['fecha'].dt.normalize().nunique())
print("Productos (product_key):", df['product_key'].nunique())
print("Sucursales:", df['sucursal'].nunique(), "->", sorted(df['sucursal'].unique()))
print("Series producto-sucursal:", df.groupby(['product_key','sucursal']).ngroups)
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>5. Análisis temporal de la demanda</strong></h2> </div>
Analizamos cómo evoluciona la demanda total (`demanda`) en el tiempo: diaria, mensual, semanal,
por día de la semana y por mes.


```python
# Demanda total por fecha (serie diaria agregada)
serie_dia = df.groupby("fecha")["demanda"].sum()

fig, ax = plt.subplots(figsize=(12, 3.6))
ax.plot(serie_dia.index, serie_dia.values, color=PALETTE[0], lw=0.8, label="Demanda diaria")
ax.plot(serie_dia.index, serie_dia.rolling(14).mean(), color=PALETTE[1], lw=2,
        label="Media móvil 14 días")
ax.set_title("Demanda total diaria (todas las sucursales)")
ax.set_xlabel("Fecha"); ax.set_ylabel("Demanda (lb + unidades)")
ax.legend(); plt.tight_layout(); plt.show()
```


```python
# Demanda mensual
serie_mes = df.set_index("fecha")["demanda"].resample("MS").sum()

fig, ax = plt.subplots(figsize=(11, 3.6))
ax.bar(serie_mes.index, serie_mes.values, width=20, color=PALETTE[0])
ax.set_title("Demanda mensual total")
ax.set_xlabel("Mes"); ax.set_ylabel("Demanda")
plt.tight_layout(); plt.show()
```


```python
# Demanda semanal
serie_sem = df.set_index("fecha")["demanda"].resample("W").sum()

fig, ax = plt.subplots(figsize=(12, 3.4))
ax.plot(serie_sem.index, serie_sem.values, color=PALETTE[4], lw=1.4)
ax.set_title("Demanda semanal total")
ax.set_xlabel("Semana"); ax.set_ylabel("Demanda")
plt.tight_layout(); plt.show()
```


```python
# Demanda por día de la semana y por mes (usando columnas ya creadas)
dias_orden = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
dias_es    = {"Monday":"Lun","Tuesday":"Mar","Wednesday":"Mié","Thursday":"Jue",
              "Friday":"Vie","Saturday":"Sáb","Sunday":"Dom"}

fig, axes = plt.subplots(1, 2, figsize=(12, 3.6))

dow = df.groupby("nombre_dia")["demanda"].sum().reindex(dias_orden)
axes[0].bar([dias_es[d] for d in dow.index], dow.values, color=PALETTE[0])
axes[0].set_title("Demanda por día de la semana"); axes[0].set_ylabel("Demanda")

mes = df.groupby("mes")["demanda"].sum()
axes[1].bar(mes.index, mes.values, color=PALETTE[1])
axes[1].set_title("Demanda por mes (agregado 2025-2026)")
axes[1].set_xlabel("Mes"); axes[1].set_xticks(range(1,13))
plt.tight_layout(); plt.show()
```

**Patrones observados (temporal).**
- La serie diaria muestra fuerte **estacionalidad semanal** (picos en ciertos días) y variación a lo largo del año.
- A nivel de **día de la semana**, la demanda se concentra de martes a sábado, con **jueves y viernes** como
  días más fuertes y **domingo** como el más bajo — coherente con el consumo de pescado fresco antes del fin de semana.
- El perfil **mensual** deja ver meses más intensos en el primer semestre (relacionado con Semana Santa/Cuaresma,
  temporada alta del consumo de mariscos en Ecuador).


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>6. Análisis por sucursal</strong></h2> </div>

Comparamos el volumen, la participación, la evolución temporal y los productos líderes por sucursal.


```python
# Ventas totales y participación por sucursal
suc = df.groupby("sucursal")["demanda"].sum().sort_values(ascending=False)
part = (suc / suc.sum() * 100).round(2)
tabla_suc = pd.DataFrame({"demanda_total": suc.round(1), "participacion_%": part})
tabla_suc
```


```python
fig, ax = plt.subplots(figsize=(7, 3.6))
ax.bar(tabla_suc.index, tabla_suc["demanda_total"], color=PALETTE[:len(tabla_suc)])
for i, (v, p) in enumerate(zip(tabla_suc["demanda_total"], tabla_suc["participacion_%"])):
    ax.text(i, v, f"{p:.1f}%", ha="center", va="bottom", fontweight="bold")
ax.set_title("Demanda total por sucursal")
ax.set_ylabel("Demanda"); plt.tight_layout(); plt.show()
```


```python
# Evolución temporal (mensual) por sucursal
evol = (df.set_index("fecha").groupby("sucursal")["demanda"]
          .resample("MS").sum().reset_index())

fig, ax = plt.subplots(figsize=(12, 3.8))
for i, s in enumerate(tabla_suc.index):
    sub = evol[evol.sucursal == s]
    ax.plot(sub["fecha"], sub["demanda"], marker="o", ms=3, label=s, color=PALETTE[i])
ax.set_title("Evolución mensual de la demanda por sucursal")
ax.set_xlabel("Mes"); ax.set_ylabel("Demanda"); ax.legend()
plt.tight_layout(); plt.show()
```


```python
# Top 5 productos por sucursal
top_suc = (df.groupby(["sucursal","product_clean"])["demanda"].sum()
             .reset_index())
for s in tabla_suc.index:
    print(f"\n=== TOP 5 productos — {s} ===")
    t = (top_suc[top_suc.sucursal == s]
         .sort_values("demanda", ascending=False).head(5))
    print(t[["product_clean","demanda"]].to_string(index=False))
```

**Patrones observados (sucursal).**
- **MATRIZ** es la sucursal dominante (concentra la gran mayoría de la demanda); GUAPÁN es secundaria y
  **10 DE AGOSTO** tiene una participación marginal.
- La evolución mensual confirma que la tendencia global está guiada por MATRIZ.
- Cada sucursal tiene su propio mix de productos líderes, lo que sugiere modelar la demanda **por serie
  producto-sucursal** en lugar de un único modelo global.

<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>7. Análisis por producto</strong></h2> </div>
Top y bottom por volumen, productos más variables, productos con más días sin venta y la
distribución de la demanda diaria.


```python
# Top 20 y Bottom 20 por demanda total
por_prod = df.groupby("product_clean")["demanda"].sum().sort_values(ascending=False)
top20 = por_prod.head(20)
bottom20 = por_prod[por_prod > 0].tail(20)  # con al menos algo de venta

fig, ax = plt.subplots(figsize=(9, 6))
top20[::-1].plot(kind="barh", ax=ax, color=PALETTE[0])
ax.set_title("Top 20 productos más vendidos (demanda total)")
ax.set_xlabel("Demanda total"); plt.tight_layout(); plt.show()

print("BOTTOM 20 (productos con menor demanda, >0):")
bottom20.round(2)
```


```python
# Productos con mayor variabilidad (coeficiente de variación de la demanda diaria)
stats = df.groupby("product_clean")["demanda"].agg(["mean","std","sum"])
stats = stats[stats["mean"] > 0]
stats["cv"] = stats["std"] / stats["mean"]
mas_variables = stats.sort_values("cv", ascending=False).head(15)
print("Top 15 productos más variables (mayor coeficiente de variación):")
mas_variables[["mean","std","cv"]].round(2)
```


```python
# Productos con más días sin venta (demanda == 0)
sin_venta = (df.assign(cero=(df["demanda"] == 0).astype(int))
               .groupby("product_clean")["cero"].agg(["sum","count"]))
sin_venta["pct_dias_sin_venta"] = (sin_venta["sum"] / sin_venta["count"] * 100).round(1)
mas_ceros = sin_venta.sort_values("pct_dias_sin_venta", ascending=False).head(15)
print("Top 15 productos con mayor % de días sin venta:")
mas_ceros
```


```python
# Distribución de la demanda diaria (recortada al percentil 99 para visualizar)
d_pos = df["demanda"]
lim = d_pos.quantile(0.99)

fig, axes = plt.subplots(1, 2, figsize=(12, 3.6))
axes[0].hist(d_pos[d_pos <= lim], bins=60, color=PALETTE[0])
axes[0].set_title("Distribución de la demanda diaria (≤ p99)")
axes[0].set_xlabel("Demanda"); axes[0].set_ylabel("Frecuencia")

# proporción de ceros vs positivos
prop = pd.Series({"Días con demanda = 0": (df["demanda"] == 0).mean()*100,
                  "Días con demanda > 0": (df["demanda"] > 0).mean()*100})
axes[1].bar(prop.index, prop.values, color=[PALETTE[2], PALETTE[1]])
axes[1].set_title("Proporción de días con y sin demanda")
axes[1].set_ylabel("% de filas")
for i, v in enumerate(prop.values):
    axes[1].text(i, v, f"{v:.1f}%", ha="center", va="bottom", fontweight="bold")
plt.tight_layout(); plt.show()
```

**Patrones observados (producto).**
- Pocos productos concentran gran parte de la demanda (efecto **Pareto**): el Top 20 explica la mayor parte del volumen.
- Muchos productos tienen un **alto porcentaje de días sin venta**, lo que produce series **intermitentes**
  (muchos ceros). Esto es central: al modelar conviene considerarlo (p. ej. métricas robustas a ceros).
- La distribución de la demanda es fuertemente **asimétrica a la derecha** (colas largas).


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>8. Análisis de unidades y presentaciones</strong></h2> </div>

Comparación entre productos vendidos en **libras** (`is_libra`) y **unidades** (`is_unidad`), y por
`category` / `presentation`.


```python
# Ventas por tipo de unidad (usando banderas is_libra / is_unidad)
if cols_ok("is_libra", "is_unidad"):
    df["_unidad"] = np.where(df["is_libra"] == 1, "Libra (lb)",
                     np.where(df["is_unidad"] == 1, "Unidad", "Otro"))
    por_unidad = df.groupby("_unidad")["demanda"].agg(["sum","mean","count"]).round(2)
    print(por_unidad)

    fig, ax = plt.subplots(figsize=(7, 3.4))
    por_unidad["sum"].plot(kind="bar", ax=ax, color=PALETTE[:len(por_unidad)])
    ax.set_title("Demanda total por tipo de unidad")
    ax.set_ylabel("Demanda"); ax.set_xlabel("")
    plt.xticks(rotation=0); plt.tight_layout(); plt.show()
```


```python
# Ventas por categoría (si existe)
if cols_ok("category"):
    cat = df.groupby("category")["demanda"].sum().sort_values(ascending=False)
    fig, ax = plt.subplots(figsize=(10, 4))
    cat.plot(kind="barh", ax=ax, color=PALETTE[0])
    ax.set_title("Demanda total por categoría de producto")
    ax.set_xlabel("Demanda"); plt.tight_layout(); plt.show()
    display(cat.round(1).to_frame("demanda_total"))
```


```python
# Ventas por presentación (si existe)
if cols_ok("presentation"):
    pres = df.groupby("presentation")["demanda"].sum().sort_values(ascending=False)
    fig, ax = plt.subplots(figsize=(8, 3.4))
    pres.plot(kind="bar", ax=ax, color=PALETTE[3])
    ax.set_title("Demanda total por presentación")
    ax.set_ylabel("Demanda"); plt.xticks(rotation=30, ha="right")
    plt.tight_layout(); plt.show()
```

**Patrones observados (unidades/presentaciones).**
- La demanda medida en **libras** y en **unidades** no es directamente comparable en magnitud (son escalas
  distintas); conviene analizarlas por separado o normalizarlas al modelar.
- Las categorías dominantes reflejan el negocio (camarón y afines), y la presentación **Granel** suele
  concentrar el mayor volumen frente a empaques individuales.


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>9. Análisis de inventario</strong></h2> </div>


Distribución de `stock_inicial_dia`, relación stock–demanda, `dias_sin_stock`, `cobertura_dias`,
`rotacion` y productos con riesgo de quiebre.


```python
inv_cols = ["stock_inicial_dia","cobertura_dias","rotacion","dias_sin_stock"]
if cols_ok(*inv_cols):
    fig, axes = plt.subplots(1, 2, figsize=(12, 3.6))
    s = df["stock_inicial_dia"]
    axes[0].hist(s[s <= s.quantile(0.99)], bins=60, color=PALETTE[0])
    axes[0].set_title("Distribución de stock inicial diario (≤ p99)")
    axes[0].set_xlabel("Stock inicial")

    # relación stock vs demanda (muestra para no saturar)
    muestra = df.sample(min(8000, len(df)), random_state=0)
    axes[1].scatter(muestra["stock_inicial_dia"], muestra["demanda"],
                    s=6, alpha=0.25, color=PALETTE[4])
    axes[1].set_xlim(0, df["stock_inicial_dia"].quantile(0.99))
    axes[1].set_ylim(0, df["demanda"].quantile(0.99))
    axes[1].set_title("Relación stock inicial vs demanda")
    axes[1].set_xlabel("Stock inicial"); axes[1].set_ylabel("Demanda")
    plt.tight_layout(); plt.show()
```


```python
# Días sin stock y cobertura
if cols_ok("dias_sin_stock","cobertura_dias"):
    print("Filas con stock <= 0 (día sin stock):",
          int(df['dias_sin_stock'].sum()),
          f"({df['dias_sin_stock'].mean()*100:.1f}% de las filas)")
    cob = df["cobertura_dias"].replace([np.inf,-np.inf], np.nan).dropna()
    fig, ax = plt.subplots(figsize=(9, 3.4))
    ax.hist(cob[cob <= cob.quantile(0.95)], bins=60, color=PALETTE[2])
    ax.set_title("Distribución de cobertura en días (≤ p95)")
    ax.set_xlabel("Cobertura estimada (días)"); ax.set_ylabel("Frecuencia")
    plt.tight_layout(); plt.show()
```


```python
# Rotación promedio por producto y riesgo de quiebre
if cols_ok("rotacion","dias_sin_stock"):
    rot = (df.groupby("product_clean")
             .agg(rotacion_media=("rotacion","mean"),
                  pct_dias_sin_stock=("dias_sin_stock","mean"))
             .dropna())
    rot["pct_dias_sin_stock"] = (rot["pct_dias_sin_stock"]*100).round(1)
    riesgo = rot.sort_values("pct_dias_sin_stock", ascending=False).head(15)
    print("Top 15 productos con mayor % de días sin stock (riesgo de quiebre):")
    display(riesgo.round(2))
```

**Patrones observados (inventario).**
- El `stock_inicial_dia` es muy asimétrico: pocos productos mantienen inventarios altos.
- La demanda observada está **acotada por el stock disponible** (no se puede vender lo que no hay): esto
  refuerza incluir variables de inventario en el modelado.
- Hay productos con un porcentaje elevado de **días sin stock**, candidatos a **quiebres** que provocan
  ceros de demanda "artificiales" (falta de oferta, no de demanda).

## 10. Análisis de perecibilidad

Variables aproximadas con vida útil de 90 días: `edad_lote_est`, `pct_vida_util`, `dias_restantes_est`,
`riesgo_vencimiento`.



```python
per_cols = ["edad_lote_est","pct_vida_util","dias_restantes_est","riesgo_vencimiento"]
if cols_ok(*per_cols):
    fig, axes = plt.subplots(1, 3, figsize=(13, 3.4))
    axes[0].hist(df["edad_lote_est"].dropna(), bins=40, color=PALETTE[0])
    axes[0].set_title("Edad estimada del lote (días)")
    axes[1].hist(df["pct_vida_util"].dropna(), bins=40, color=PALETTE[1])
    axes[1].set_title("% de vida útil consumida")
    axes[2].hist(df["dias_restantes_est"].dropna(), bins=40, color=PALETTE[2])
    axes[2].set_title("Días restantes estimados")
    for a in axes: a.set_ylabel("Frecuencia")
    plt.tight_layout(); plt.show()

    print("Filas marcadas con riesgo de vencimiento (pct_vida_util > 0.8):",
          int(df['riesgo_vencimiento'].sum()),
          f"({df['riesgo_vencimiento'].mean()*100:.1f}% de las filas)")
```


```python
# Productos con mayor proporción de días en riesgo de vencimiento
if cols_ok("riesgo_vencimiento"):
    riesgo_prod = (df.groupby("product_clean")["riesgo_vencimiento"].mean()*100).round(1)
    riesgo_prod = riesgo_prod.sort_values(ascending=False).head(15)
    print("Top 15 productos con mayor % de días en riesgo de vencimiento:")
    display(riesgo_prod.to_frame("%_dias_en_riesgo"))
```

**Patrones observados (perecibilidad).**
- La mayoría de las observaciones tienen una **edad de lote estimada baja** (rotación relativamente rápida),
  consistente con producto fresco.
- Existe un subconjunto de filas con `pct_vida_util` alto y por tanto marcadas con **riesgo de vencimiento**;
  son las que más atención operativa requieren.
- Al ser aproximadas, estas variables sirven como **indicador temprano**; con número de lote real se
  podrían calcular con exactitud.


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>11. Análisis de estacionalidad</strong></h2> </div>

Día de la semana, mes, comparación fin de semana vs laborable y efecto de `festivo`.


```python
# Fin de semana vs día laborable
if cols_ok("fin_de_semana"):
    fds = df.groupby("fin_de_semana")["demanda"].agg(["mean","sum"])
    fds.index = ["Laborable","Fin de semana"]
    fig, ax = plt.subplots(figsize=(6, 3.4))
    ax.bar(fds.index, fds["mean"], color=[PALETTE[0], PALETTE[1]])
    ax.set_title("Demanda media: laborable vs fin de semana")
    ax.set_ylabel("Demanda media por fila")
    plt.tight_layout(); plt.show()
    display(fds.round(2))
```


```python
# Efecto de festivos (si existe la columna)
if cols_ok("festivo"):
    fest = df.groupby("festivo")["demanda"].agg(["mean","count"])
    fest.index = ["No festivo","Festivo"]
    print("Demanda media en días festivos vs no festivos:")
    display(fest.round(2))

    fig, ax = plt.subplots(figsize=(6, 3.4))
    ax.bar(fest.index, fest["mean"], color=[PALETTE[2], PALETTE[3]])
    ax.set_title("Demanda media: festivo vs no festivo")
    ax.set_ylabel("Demanda media"); plt.tight_layout(); plt.show()
```


```python
# Mapa de calor mes x día de la semana (intensidad de demanda media)
piv = (df.pivot_table(index="mes", columns="nombre_dia", values="demanda", aggfunc="mean")
         .reindex(columns=dias_orden))
piv.columns = [dias_es[c] for c in piv.columns]
fig, ax = plt.subplots(figsize=(9, 5))
sns.heatmap(piv, cmap="YlGnBu", annot=False, ax=ax, cbar_kws={"label":"Demanda media"})
ax.set_title("Estacionalidad: demanda media por mes y día de la semana")
ax.set_xlabel("Día de la semana"); ax.set_ylabel("Mes")
plt.tight_layout(); plt.show()
```

**Patrones observados (estacionalidad).**
- Se confirma la **estacionalidad semanal**: los días laborables centrales (jue-vie) concentran más demanda
  que el fin de semana.
- El mapa de calor mes × día evidencia combinaciones de mayor intensidad (ciertos meses del primer semestre).
- Los **festivos** muestran un comportamiento distinto al de días normales, por lo que la variable `festivo`
  aporta información útil para el modelado.


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>12. Análisis de variables creadas</strong></h2> </div>

Revisamos *lags*, promedios móviles, variables de tendencia y su correlación con la demanda.


```python
# Relación entre lags principales y la demanda actual (correlaciones)
lag_cols = [c for c in ["lag_1","lag_2","lag_3","lag_7","lag_14","lag_30"] if c in df.columns]
ma_cols  = [c for c in ["ma_3","ma_7","ma_14","ma_30","ma_60","ma_90"] if c in df.columns]
tend_cols= [c for c in ["crec_diario","crec_semanal","crec_mensual","tendencia","pendiente_7"] if c in df.columns]

print("Correlación de lags y medias móviles con 'demanda':")
base = df[["demanda"] + lag_cols + ma_cols].corr()["demanda"].drop("demanda")
display(base.sort_values(ascending=False).round(3).to_frame("corr_con_demanda"))
```


```python
# Visualizar demanda vs sus medias móviles para una serie ejemplo (la de mayor volumen)
serie_top = (df.groupby(["product_key","sucursal"])["demanda"].sum()
               .sort_values(ascending=False).index[0])
ej = df[(df.product_key == serie_top[0]) & (df.sucursal == serie_top[1])].sort_values("fecha")

fig, ax = plt.subplots(figsize=(12, 3.8))
ax.plot(ej["fecha"], ej["demanda"], color="lightgray", lw=0.9, label="Demanda")
for c, col in zip(["ma_7","ma_30"], [PALETTE[1], PALETTE[0]]):
    if c in ej.columns:
        ax.plot(ej["fecha"], ej[c], lw=1.8, label=c, color=col)
ax.set_title(f"Serie ejemplo (mayor volumen): {serie_top[0]} — {serie_top[1]}")
ax.set_xlabel("Fecha"); ax.set_ylabel("Demanda"); ax.legend()
plt.tight_layout(); plt.show()
```


```python
# Mapa de calor de correlación entre variables numéricas importantes
sel = ["demanda"] + lag_cols + ma_cols + tend_cols + \
      [c for c in ["std_7","std_30","stock_inicial_dia","rotacion",
                   "pct_vida_util","media_hist","cv_hist"] if c in df.columns]
sel = [c for c in dict.fromkeys(sel) if c in df.columns]  # únicos y existentes
corr = df[sel].corr()

fig, ax = plt.subplots(figsize=(11, 9))
sns.heatmap(corr, cmap="RdBu_r", center=0, vmin=-1, vmax=1,
            square=False, linewidths=.3, ax=ax, cbar_kws={"shrink":.7})
ax.set_title("Matriz de correlación — variables numéricas importantes")
plt.tight_layout(); plt.show()
```

**Patrones observados (variables creadas).**
- Los **lags cortos** (`lag_1`, `lag_7`) y las **medias móviles** (`ma_7`, `ma_30`) son las variables más
  correlacionadas con la demanda actual: el nivel reciente es el mejor descriptor.
- Las variables de **tendencia** aportan información complementaria (dirección de la serie), con correlaciones
  más moderadas.
- En el mapa de calor se aprecia **multicolinealidad** esperable entre medias móviles de ventanas cercanas
  (p. ej. `ma_30` y `ma_60`); es normal y los modelos de árboles la toleran bien.



<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>13. Outliers</strong></h2> </div>

Detección con el criterio **IQR**, *boxplots* de demanda y productos con ventas atípicas.


```python
# Detección de outliers de demanda con IQR (sobre demanda > 0)
d = df.loc[df["demanda"] > 0, "demanda"]
q1, q3 = d.quantile([0.25, 0.75]); iqr = q3 - q1
lim_sup = q3 + 1.5 * iqr
n_out = (d > lim_sup).sum()
print(f"Q1={q1:.2f}  Q3={q3:.2f}  IQR={iqr:.2f}  límite superior={lim_sup:.2f}")
print(f"Outliers por IQR (demanda>0): {n_out}  ({n_out/len(d)*100:.1f}%)")
```


```python
# Boxplots de demanda (global y por sucursal, en escala log para legibilidad)
fig, axes = plt.subplots(1, 2, figsize=(12, 3.8))
axes[0].boxplot(np.log1p(d), vert=True)
axes[0].set_title("Boxplot de log(1+demanda) — global")
axes[0].set_ylabel("log(1+demanda)")

datos = [np.log1p(df.loc[(df.sucursal==s) & (df.demanda>0), "demanda"])
         for s in sorted(df["sucursal"].unique())]
axes[1].boxplot(datos, label=sorted(df["sucursal"].unique()))
axes[1].set_title("log(1+demanda) por sucursal")
plt.tight_layout(); plt.show()
```


```python
# Productos con ventas atípicas: mayor demanda máxima diaria
atip = (df.groupby("product_clean")["demanda"]
          .agg(demanda_max="max", demanda_media="mean")
          .sort_values("demanda_max", ascending=False).head(15))
print("Top 15 productos con mayor demanda máxima en un día:")
atip.round(2)
```

**Interpretación de outliers.**
- Bajo el criterio IQR aparece un porcentaje no menor de valores altos. **No conviene eliminarlos de forma
  automática**: en un mayorista de mariscos, las **compras grandes puntuales** (restaurantes, eventos) son
  **demanda real**, no errores.
- La recomendación es **conservarlos** y, a lo sumo, tratar por separado el **0,1% extremo** ya identificado
  como posible error de captura en la etapa de limpieza. Para el modelado, técnicas robustas o
  transformaciones (log) reducen su impacto sin descartar información.


```python
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec

_FONDO = "#F8FAFC"; _GRIS = "#BDC3C7"; _AZUL = "#1A3A5C"
_AZUL2 = "#2980B9"; _ROJO = "#E74C3C"; _NARNJ = "#F39C12"; _VERDE = "#27AE60"

# Diccionario de colores base (se adapta dinámicamente si hay categorías nuevas)
_CAT_CLR_BASE = {
    'Bebidas':'#E74C3C','Lácteos':'#2980B9','Verduras':'#27AE60',
    'Panadería':'#8E44AD','Granos':'#F39C12','Snacks':'#E67E22',
    'Frutas':'#1ABC9C','Limpieza':'#2C3E50','Cuidado Personal':'#16A085',
    'Carnes':'#C0392B','Congelados':'#7F8C8D', 'Insumo': '#8E44AD'
}

# Asegurar mapeo de colores para todas las categorías del nuevo df
categorias_unicas = df['category'].dropna().unique()
colores_extra = plt.cm.tab20.colors
_CAT_CLR = {c: _CAT_CLR_BASE.get(c, '#%02x%02x%02x' % tuple(int(x*255) for x in colores_extra[i%20])) 
            for i, c in enumerate(categorias_unicas)}

# ── Datos Top 12 (Adaptado a 'demanda' y 'product_clean') ─────────
_top12 = (df.groupby(['product_clean', 'category'])['demanda']
          .sum().reset_index()
          .sort_values('demanda', ascending=False).head(12))

# ── Datos Matriz de Riesgo (Agrupado en un solo dataset 'df') ─────
# Promedio diario de demanda
_avg_s = df.groupby(['product_key', 'product_clean', 'category'])['demanda'].mean().reset_index()
_avg_s.rename(columns={'demanda': 'avg_daily_sales'}, inplace=True)

# Stock actual (último registro por producto)
_stock = df.sort_values('fecha').groupby('product_key').tail(1)[['product_key', 'stock_inicial_dia']]

_scat = _avg_s.merge(_stock, on='product_key', how='inner')
_scat['days_coverage'] = (_scat['stock_inicial_dia'] / _scat['avg_daily_sales'].clip(lower=0.1)).round(1)
_scat['color'] = _scat['category'].map(_CAT_CLR).fillna('#999')

_cov_mid  = _scat['days_coverage'].median()
_sell_mid = _scat['avg_daily_sales'].median()

# Manejo de casos donde la mediana es 0
_cov_mid = _cov_mid if _cov_mid > 0 else 5
_sell_mid = _sell_mid if _sell_mid > 0 else 5

# ── Canvas ────────────────────────────────────────────────────────
fig = plt.figure(figsize=(18, 7), facecolor=_FONDO)
fig.patch.set_facecolor(_FONDO)
gs = gridspec.GridSpec(1, 2, figure=fig, width_ratios=[1, 1.35], wspace=0.08)

# ── Panel izquierdo: Top 12 barras (ORDENADO MAYOR A MENOR) ───────────────
ax1 = fig.add_subplot(gs[0])
ax1.set_facecolor(_FONDO)

# Ordenamos de menor a mayor para que al graficar, el mayor quede en la parte superior
_top12_plot = _top12.sort_values('demanda', ascending=True) 

_bcolors = [_CAT_CLR.get(c, '#999') for c in _top12_plot['category']]
_bars = ax1.barh(range(len(_top12_plot)), _top12_plot['demanda'],
                 color=_bcolors, height=0.65, zorder=2, alpha=0.92)

# Etiquetas de texto
for bar in _bars:
    w = bar.get_width()
    # Usamos f-string para mostrar el número completo sin 'k' y con comas
    texto_etiqueta = f'{int(w):,}' 
    ax1.text(w + (w*0.02), bar.get_y() + bar.get_height()/2,
             texto_etiqueta, va='center', ha='left', fontsize=9.5,
             fontweight='bold', color='#333')

ax1.set_yticks(range(len(_top12_plot)))
ax1.set_yticklabels([str(n)[:25] for n in _top12_plot['product_clean']], fontsize=10)
ax1.set_xlabel('Unidades/Libras Demandadas', fontsize=10.5, color='#444')
ax1.set_title('🏆 Top 12 Productos por Volumen de Demanda',
              fontsize=13, fontweight='bold', color=_AZUL, pad=12)

ax1.set_xlim(0, _top12_plot['demanda'].max() * 1.25) # Un poco más de espacio para el texto
ax1.spines['top'].set_visible(False); ax1.spines['right'].set_visible(False)
ax1.spines['left'].set_color(_GRIS); ax1.spines['bottom'].set_color(_GRIS)
ax1.tick_params(colors='#555')
ax1.grid(axis='x', linestyle='--', alpha=0.4, color=_GRIS, zorder=0)

_lgnd = [mpatches.Patch(color=_CAT_CLR.get(c, '#999'), label=c)
         for c in _top12_plot['category'].unique() if c in _CAT_CLR]
ax1.legend(handles=_lgnd, title='Categoría', title_fontsize=8,
           loc='lower right', fontsize=8, ncol=2,
           frameon=True, framealpha=0.9, edgecolor=_GRIS)

# ── Panel derecho: Matriz de Riesgo (CORREGIDO Y INTEGRADO) ───────────────
ax2 = fig.add_subplot(gs[1])
ax2.set_facecolor('white')

# 1. Definir límites y zonas (Usamos _scat, que es el df que ya tiene 'color')
xlim_max, ylim_max = 25, 30
ax2.set_xlim(0, xlim_max); ax2.set_ylim(0, ylim_max)

_cov_mid, _sell_mid = 8.5, 10.5 

# 2. Dibujar las 4 zonas de color
ax2.axvspan(0, _cov_mid, ymin=_sell_mid/ylim_max, ymax=1, color=_ROJO, alpha=0.05)   # Quiebre
ax2.axvspan(_cov_mid, xlim_max, ymin=_sell_mid/ylim_max, ymax=1, color=_VERDE, alpha=0.05) # Óptima
ax2.axvspan(0, _cov_mid, ymin=0, ymax=_sell_mid/ylim_max, color=_NARNJ, alpha=0.05)  # Rotación Baja
ax2.axvspan(_cov_mid, xlim_max, ymin=0, ymax=_sell_mid/ylim_max, color=_AZUL2, alpha=0.04) # Excesivo

ax2.axhline(_sell_mid, color=_GRIS, lw=1.2, alpha=0.4)
ax2.axvline(_cov_mid, color=_GRIS, lw=1.2, alpha=0.4)

# 3. Scatter plot (Usamos _scat directamente, que YA TIENE la columna 'color')
max_stock = _scat['stock_inicial_dia'].max() if _scat['stock_inicial_dia'].max() > 0 else 1
_sizes = (_scat['stock_inicial_dia'] / max_stock * 200 + 40)

ax2.scatter(_scat['days_coverage'], _scat['avg_daily_sales'],
            c=_scat['color'], s=_sizes, alpha=0.7, edgecolors='white', lw=0.5, zorder=3)

# 4. Textos de cuadrantes
ax2.text(_cov_mid*0.5, 23, 'RIESGO\nDE QUIEBRE', ha='center', fontsize=8, color=_ROJO, fontweight='bold', alpha=0.8)
ax2.text(20, 23, 'ZONA\nÓPTIMA', ha='center', fontsize=8, color=_VERDE, fontweight='bold', alpha=0.8)
ax2.text(_cov_mid*0.5, 4, 'ROTACIÓN\nBAJA', ha='center', fontsize=8, color=_NARNJ, fontweight='bold', alpha=0.8)
ax2.text(20, 4, 'STOCK\nEXCESIVO', ha='center', fontsize=8, color=_AZUL2, fontweight='bold', alpha=0.8)

# 5. Formato y leyenda
ax2.set_title('Matriz de Riesgo del Inventario\nCobertura vs. Velocidad de Venta', fontsize=12, fontweight='bold', color=_AZUL, pad=10)
ax2.set_xlabel('Cobertura de stock (Días)', fontsize=10); ax2.set_ylabel('Velocidad de venta diaria', fontsize=10)
ax2.grid(linestyle='--', alpha=0.2, color=_GRIS)

_lgnd4 = [mpatches.Patch(color=_CAT_CLR[c], label=c) for c in _scat['category'].unique() if c in _CAT_CLR]
ax2.legend(handles=_lgnd4, title='Categoría', loc='upper right', fontsize=7, ncol=2)

plt.tight_layout()
plt.show()
```


<div id="RNN" style="color:#37475a; border-bottom: 4px solid #4E853C; width: 100%; margin-bottom: 15px; padding-bottom: 2px"><h2> <strong>14. Conclusiones </strong></h2> </div>

**Principales hallazgos**
- **Sucursal dominante:** MATRIZ concentra la mayor parte de la demanda; GUAPÁN es secundaria y
  10 DE AGOSTO es marginal. La dinámica global sigue a MATRIZ.
- **Productos más relevantes:** la demanda sigue un patrón **Pareto** — un grupo reducido de productos
  (principalmente camarón y afines) explica la mayor parte del volumen.
- **Patrones temporales:** fuerte **estacionalidad semanal** (picos jue-vie, mínimo domingo) y variación
  mensual con mayor intensidad en el primer semestre; los **festivos** se comportan distinto.
- **Inventario y ceros:** muchas series son **intermitentes** (gran proporción de días con demanda 0), en
  parte por **quiebres de stock**. La demanda observada está limitada por la disponibilidad.
- **Perecibilidad:** rotación mayormente rápida, con un subconjunto de filas en **riesgo de vencimiento**
  (indicador aproximado, sin lote real).
- **Variables creadas:** *lags* cortos y medias móviles son las más informativas; existe multicolinealidad
  natural entre ventanas cercanas.

**Problemas detectados**
- Series con **muchos ceros** (intermitencia) y **colas largas** (outliers legítimos + posibles errores de captura).
- **Multicolinealidad** entre medias móviles.
- Escalas distintas entre productos en **libras** y en **unidades**.
- Perecibilidad **aproximada** por ausencia de número de lote.

**Recomendaciones para una futura etapa de modelado (sin entrenar aquí)**
- Modelar **por serie producto-sucursal** o con modelos que aprovechen todas las series a la vez, incluyendo
  identificadores de producto/sucursal como variables.
- Usar **partición temporal** (validación tipo *walk-forward* / `TimeSeriesSplit`), nunca aleatoria.
- Elegir **métricas robustas a ceros** (WAPE/MASE además de MAE y RMSE); MAPE solo sobre series con demanda > 0.
- Considerar el tratamiento de la **intermitencia** (enfoques específicos para demanda con muchos ceros).
- Mantener las variables de **inventario y perecibilidad**, que aportan contexto operativo clave.
- Conservar los outliers legítimos; tratar solo el extremo marcado como error de captura.


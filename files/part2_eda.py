"""
PARTE 2 — ANÁLISIS EXPLORATORIO (EDA)
Genera un informe de texto + figuras profesionales.
"""
import warnings; warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams.update({"figure.dpi": 110, "font.size": 9, "axes.grid": True,
                     "grid.alpha": .3, "axes.spines.top": False,
                     "axes.spines.right": False})
C = "#0F6E8C"; C2 = "#E07A3F"

df = pd.read_parquet("/home/claude/_clean.parquet")
sales = df[df["mov_type"] == "VENTA"].copy()
lines = []
def p(s=""): lines.append(str(s)); print(s)

p("="*70); p("PARTE 2 — EDA"); p("="*70)

# --- Información general -------------------------------------------------------
p("\n## INFORMACIÓN GENERAL")
p(f"Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas")
p(f"Memoria: {df.memory_usage(deep=True).sum()/1e6:.2f} MB")
p(f"Rango temporal: {df['Fecha'].min()} -> {df['Fecha'].max()}")
p("\nValores nulos por columna:")
p(df.isna().sum()[df.isna().sum() > 0].to_string() or "  (sin nulos)")
p("\nValores únicos (columnas clave):")
for c in ["product_key", "sucursal", "mov_type", "category", "presentation", "Unidad de medida"]:
    p(f"  {c}: {df[c].nunique()}")

# --- Calidad de datos ---------------------------------------------------------
p("\n## CALIDAD DE DATOS")
p(f"% nulos global: {df.isna().mean().mean()*100:.2f}%")
p(f"Nota: 'Factura / Nota de Crédito' nulo = movimientos internos (no venta al cliente).")

# --- Productos ----------------------------------------------------------------
p("\n## PRODUCTOS")
p(f"Productos (canónicos): {df['product_key'].nunique()}")
p(f"Categorías: {sorted(df['category'].unique())}")
top = sales.groupby("product_clean")["Realizado_wins"].sum().sort_values(ascending=False)
p("\nTop 10 más vendidos (cantidad total):")
p(top.head(10).round(1).to_string())
p("\nBottom 10 menos vendidos:")
p(top.tail(10).round(2).to_string())
p("\nVentas por categoría:")
p(sales.groupby("category")["Realizado_wins"].sum().sort_values(ascending=False).round(1).to_string())
p("\nVentas por presentación:")
p(sales.groupby("presentation")["Realizado_wins"].sum().sort_values(ascending=False).round(1).to_string())

# --- Sucursales ---------------------------------------------------------------
p("\n## SUCURSALES")
suc = sales.groupby("sucursal")["Realizado_wins"].sum().sort_values(ascending=False)
p("Ventas por sucursal:"); p(suc.round(1).to_string())
p("\nParticipación (%):"); p((suc/suc.sum()*100).round(1).to_string())
p("\nTop producto por sucursal:")
for s in suc.index:
    t = sales[sales.sucursal == s].groupby("product_clean")["Realizado_wins"].sum().idxmax()
    p(f"  {s}: {t}")

# --- Temporal -----------------------------------------------------------------
p("\n## TEMPORAL")
sales["anio"]  = sales["Fecha"].dt.year
sales["mes"]   = sales["Fecha"].dt.month
sales["dia_sem"] = sales["Fecha"].dt.dayofweek
sales["hora"]  = sales["Fecha"].dt.hour
p("Ventas por año:");  p(sales.groupby("anio")["Realizado_wins"].sum().round(1).to_string())
p("\nVentas por mes (agregado):"); p(sales.groupby("mes")["Realizado_wins"].sum().round(1).to_string())
dias = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
dm = sales.groupby("dia_sem")["Realizado_wins"].sum()
p("\nVentas por día de la semana:")
for i,v in dm.items(): p(f"  {dias[i]}: {v:.1f}")
p("\nVentas por hora (top 5):")
p(sales.groupby("hora")["Realizado_wins"].sum().sort_values(ascending=False).head(5).round(1).to_string())

# --- Outliers -----------------------------------------------------------------
p("\n## OUTLIERS (sobre cantidad de venta)")
q1,q3 = sales["Realizado"].quantile([.25,.75]); iqr=q3-q1
iqr_out = ((sales["Realizado"]<q1-1.5*iqr)|(sales["Realizado"]>q3+1.5*iqr)).sum()
z = (sales["Realizado"]-sales["Realizado"].mean())/sales["Realizado"].std()
p(f"IQR: outliers = {iqr_out} ({iqr_out/len(sales)*100:.1f}%)")
p(f"Z-score |z|>3: outliers = {(z.abs()>3).sum()}")
p("Decisión: NO se eliminan las ventas outlier legítimas (compras grandes de")
p("mayoristas son demanda real). Solo se winsoriza el 0.1% extremo (errores de")
p("captura ya marcados) para que no distorsionen medias móviles.")

# ---------- FIGURAS ----------
daily = sales.groupby(sales["Fecha"].dt.date)["Realizado_wins"].sum()
daily.index = pd.to_datetime(daily.index)

fig,ax = plt.subplots(figsize=(11,3.2))
ax.plot(daily.index, daily.values, color=C, lw=.8)
ax.plot(daily.index, daily.rolling(14).mean(), color=C2, lw=2, label="Media móvil 14d")
ax.set_title("Demanda diaria total (todas las sucursales)"); ax.legend()
fig.tight_layout(); fig.savefig("/home/claude/fig_serie_temporal.png"); plt.close()

fig,axes = plt.subplots(1,3,figsize=(12,3.4))
suc.plot(kind="bar",ax=axes[0],color=C); axes[0].set_title("Ventas por sucursal")
sales.groupby("category")["Realizado_wins"].sum().sort_values().plot(
    kind="barh",ax=axes[1],color=C); axes[1].set_title("Ventas por categoría")
axes[2].bar(range(7),[dm.get(i,0) for i in range(7)],color=C2)
axes[2].set_xticks(range(7)); axes[2].set_xticklabels(dias); axes[2].set_title("Ventas por día de semana")
fig.tight_layout(); fig.savefig("/home/claude/fig_barras.png"); plt.close()

fig,axes = plt.subplots(1,2,figsize=(11,3.4))
d = sales[sales.Realizado<sales.Realizado.quantile(.99)]["Realizado"]
axes[0].hist(d,bins=60,color=C); axes[0].set_title("Distribución cantidad venta (<p99)")
axes[0].set_xlabel("cantidad"); 
axes[1].boxplot([np.log1p(sales[sales.sucursal==s]["Realizado"]) for s in suc.index],
                labels=suc.index); axes[1].set_title("log(cantidad) por sucursal (boxplot)")
fig.tight_layout(); fig.savefig("/home/claude/fig_distribuciones.png"); plt.close()

# correlación (sobre agregados diarios de features simples)
mth = sales.groupby([sales.Fecha.dt.to_period("M")])["Realizado_wins"].agg(["sum","mean","count","std"])
corr = mth.corr()
fig,ax = plt.subplots(figsize=(4.5,4))
im=ax.imshow(corr,cmap="RdBu_r",vmin=-1,vmax=1)
ax.set_xticks(range(len(corr))); ax.set_xticklabels(corr.columns,rotation=45,ha="right")
ax.set_yticks(range(len(corr))); ax.set_yticklabels(corr.columns)
for i in range(len(corr)):
    for j in range(len(corr)): ax.text(j,i,f"{corr.iloc[i,j]:.2f}",ha="center",va="center",fontsize=8)
ax.set_title("Matriz de correlación (métricas mensuales)")
fig.colorbar(im,fraction=.046); fig.tight_layout(); fig.savefig("/home/claude/fig_correlacion.png"); plt.close()

open("/home/claude/eda_report.txt","w").write("\n".join(lines))
print("\nOK EDA -> eda_report.txt + 4 figuras")

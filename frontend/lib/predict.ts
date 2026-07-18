import {
  predictInventory,
  type Horizonte,
  type OptionItem,
  type PredictionRow,
  type PredictionSummary,
  type UnidadMedida,
} from "@/lib/api";

export type { Horizonte, UnidadMedida };

export type FilterSelection = {
  category: string;
  product: string;
  sucursal: string;
  horizonte: Horizonte;
};

export const EMPTY_FILTERS: FilterSelection = {
  category: "",
  product: "",
  sucursal: "",
  horizonte: "semanal",
};

/** Options for the horizon selector in the filter drawer. */
export const HORIZON_OPTIONS: { value: Horizonte; label: string }[] = [
  { value: "semanal", label: "Semanal: próximos 7 días" },
  { value: "mensual", label: "4 semanas: próximos 28 días" },
];

/** Standalone horizon phrase: "Próximos 7 días" / "Próximas 4 semanas (28 días)". */
export function horizonteBadge(horizonte: Horizonte): string {
  return horizonte === "mensual" ? "Próximas 4 semanas (28 días)" : "Próximos 7 días";
}

/** Short form for column headers / parentheses: "7 días" / "4 semanas". */
export function horizonteCorto(horizonte: Horizonte): string {
  return horizonte === "mensual" ? "4 semanas" : "7 días";
}

/** "Demanda estimada - próximos 7 días" / "Demanda estimada - próximas 4 semanas". */
export function demandaTituloConHorizonte(horizonte: Horizonte): string {
  return horizonte === "mensual"
    ? "Demanda estimada - próximas 4 semanas"
    : "Demanda estimada - próximos 7 días";
}

/** Today's date as YYYY-MM-DD in the browser's local timezone. */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves which catalog products a filter selection points to.
 * A specific product wins; otherwise a category narrows the catalog;
 * with neither, every product is in scope.
 */
export function resolveProducts(
  products: OptionItem[],
  category: string,
  product: string,
): OptionItem[] {
  if (product) {
    const match = products.find((item) => item.id === product);
    return match ? [match] : [];
  }
  if (category) {
    return products.filter((item) => item.category === category);
  }
  return products;
}

/**
 * Runs a prediction for a resolved set of products against a single date.
 * The catalog is sparse (not every product sells at every branch), so a naive
 * "all products x all branches" call would include combinations the backend
 * rejects and fail the whole request. Instead we group products by the
 * branches they actually belong to and issue one request per branch.
 */
export async function runPrediction(params: {
  products: OptionItem[];
  sucursal: string;
  fecha: string;
  horizonte: Horizonte;
}): Promise<PredictionRow[]> {
  const { products, sucursal, fecha, horizonte } = params;

  const branchToProducts = new Map<string, string[]>();
  for (const product of products) {
    const validBranches = (product.sucursales ?? []).filter(
      (branch) => !sucursal || branch === sucursal,
    );
    for (const branch of validBranches) {
      const bucket = branchToProducts.get(branch) ?? [];
      bucket.push(product.id);
      branchToProducts.set(branch, bucket);
    }
  }

  if (branchToProducts.size === 0) {
    return [];
  }

  const responses = await Promise.all(
    Array.from(branchToProducts.entries()).map(([branch, productKeys]) =>
      predictInventory({
        productos: productKeys,
        sucursales: [branch],
        fechas: [fecha],
        festivo: 0,
        vispera_festivo: 0,
        horizonte,
      }),
    ),
  );

  return responses.flatMap((response) => response.resultados);
}

export function uniqueCategories(products: OptionItem[]): string[] {
  const values = new Set<string>();
  for (const product of products) {
    if (product.category) {
      values.add(product.category);
    }
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
}

function productLabel(products: OptionItem[], productKey: string): string {
  const match = products.find((item) => item.id === productKey);
  if (!match) {
    return productKey;
  }
  if (match.product_clean) {
    return match.product_clean;
  }
  // Fallback for older catalogs: labels are formatted as "Nombre limpio (CODIGO)".
  return match.label.replace(/\s*\([^)]*\)\s*$/, "") || productKey;
}

function branchLabel(branches: OptionItem[], branchId: string): string {
  return branches.find((item) => item.id === branchId)?.label ?? branchId;
}

/** Unit a product is sold in. Falls back to "unidades" if the catalog doesn't know (shouldn't happen). */
export function unidadDeProducto(products: OptionItem[], productKey: string): UnidadMedida {
  return products.find((item) => item.id === productKey)?.unidad_medida ?? "unidades";
}

/** "2.30 lb" / "12 unidades" — lb keeps decimals (fractional), unit counts are always whole. */
export function formatDemanda(value: number, unidad: UnidadMedida): string {
  return unidad === "lb" ? `${value.toFixed(2)} lb` : `${Math.round(value)} unidades`;
}

/** Splits rows so a product sold by lb is never mixed into a product-count total, or vice versa. */
export function filterRowsByUnit(
  rows: PredictionRow[],
  products: OptionItem[],
  unidad: UnidadMedida,
): PredictionRow[] {
  return rows.filter((row) => unidadDeProducto(products, row.producto) === unidad);
}

export type RankedItem = { key: string; label: string; total: number };

/**
 * Total estimated demand, kept as two separate totals (lb and unidades) instead of
 * one combined figure — a pound of shrimp and a bag of nuggets aren't the same
 * quantity, so summing them would produce a meaningless number.
 */
export function totalDemandByUnit(
  rows: PredictionRow[],
  products: OptionItem[],
): { lb: number; unidades: number } {
  let lb = 0;
  let unidades = 0;
  for (const row of rows) {
    if (unidadDeProducto(products, row.producto) === "lb") {
      lb += row.unidades_estimadas_7d;
    } else {
      unidades += row.unidades_estimadas_7d;
    }
  }
  return { lb: Math.round(lb * 100) / 100, unidades: Math.round(unidades * 100) / 100 };
}

/** Aggregates units across branches/dates per product and ranks the top N. */
export function computeTopProducts(rows: PredictionRow[], products: OptionItem[], limit = 5): RankedItem[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.producto, (totals.get(row.producto) ?? 0) + row.unidades_estimadas_7d);
  }
  return Array.from(totals.entries())
    .map(([producto, total]) => ({ key: producto, total, label: productLabel(products, producto) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Aggregates estimated units per branch. */
export function computeDemandBySucursal(rows: PredictionRow[], branches: OptionItem[]): RankedItem[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.sucursal, (totals.get(row.sucursal) ?? 0) + row.unidades_estimadas_7d);
  }
  return Array.from(totals.entries())
    .map(([sucursal, total]) => ({ key: sucursal, total, label: branchLabel(branches, sucursal) }))
    .sort((a, b) => b.total - a.total);
}

/** Aggregates estimated units per product category. Products without a category are excluded. */
export function computeDemandByCategory(rows: PredictionRow[], products: OptionItem[]): RankedItem[] {
  const categoryByProduct = new Map<string, string>();
  for (const product of products) {
    if (product.category) {
      categoryByProduct.set(product.id, product.category);
    }
  }

  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = categoryByProduct.get(row.producto);
    if (!category) continue;
    totals.set(category, (totals.get(category) ?? 0) + row.unidades_estimadas_7d);
  }
  return Array.from(totals.entries())
    .map(([category, total]) => ({ key: category, total, label: category }))
    .sort((a, b) => b.total - a.total);
}

/** Human-readable description of an applied filter selection. */
export function describeFilters(
  filters: FilterSelection,
  products: OptionItem[],
  branches: OptionItem[],
): string {
  const parts: string[] = [];
  if (filters.product) {
    parts.push(products.find((p) => p.id === filters.product)?.label ?? filters.product);
  } else if (filters.category) {
    parts.push(`Categoría: ${filters.category}`);
  }
  if (filters.sucursal) {
    parts.push(branches.find((b) => b.id === filters.sucursal)?.label ?? filters.sucursal);
  }
  return parts.length > 0 ? parts.join(" · ") : "Todos los productos";
}

/** Compact summary of a prediction run — horizon, totals, count, filters, top 5 — for the chat context. */
export function buildPredictionSummary(
  rows: PredictionRow[],
  products: OptionItem[],
  filtrosDescripcion: string,
  horizonte: Horizonte,
): PredictionSummary {
  const top5 = computeTopProducts(rows, products, 5);
  const totales = totalDemandByUnit(rows, products);
  return {
    horizonte: horizonteBadge(horizonte),
    total_estimado_lb: totales.lb,
    total_estimado_unidades: totales.unidades,
    cantidad_registros: rows.length,
    filtros: filtrosDescripcion,
    top5: top5.map((item) => ({
      producto: item.label,
      cantidad: Math.round(item.total * 100) / 100,
      unidad: unidadDeProducto(products, item.key),
    })),
  };
}

/** Renders a PredictionSummary as the chat message text sent to the assistant. */
export function formatSummaryMessage(summary: PredictionSummary): string {
  const topLines = summary.top5
    .map((item, index) => `${index + 1}. ${item.producto} — ${formatDemanda(item.cantidad, item.unidad)}`)
    .join("\n");
  return [
    "Resumen de la última predicción:",
    `- Horizonte: ${summary.horizonte}`,
    `- Total estimado en lb: ${summary.total_estimado_lb.toFixed(2)}`,
    `- Total estimado en unidades: ${Math.round(summary.total_estimado_unidades)}`,
    `- Registros: ${summary.cantidad_registros}`,
    `- Filtros: ${summary.filtros}`,
    "- Top 5 productos:",
    topLines,
  ].join("\n");
}

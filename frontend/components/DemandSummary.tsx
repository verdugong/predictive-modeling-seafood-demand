"use client";

import { useMemo, useState } from "react";

import type { Horizonte, OptionItem, PredictionRow, UnidadMedida } from "@/lib/api";
import {
  computeDemandByCategory,
  computeDemandBySucursal,
  computeTopProducts,
  filterRowsByUnit,
  horizonteBadge,
} from "@/lib/predict";
import { BarRankingChart } from "@/components/BarRankingChart";

const UNIT_TABS: { value: UnidadMedida; label: string }[] = [
  { value: "lb", label: "Libras" },
  { value: "unidades", label: "Unidades" },
];

function UnitCharts({
  rows,
  products,
  branches,
  unidad,
  horizonteMinuscula,
}: {
  rows: PredictionRow[];
  products: OptionItem[];
  branches: OptionItem[];
  unidad: UnidadMedida;
  horizonteMinuscula: string;
}) {
  const scoped = useMemo(() => filterRowsByUnit(rows, products, unidad), [rows, products, unidad]);
  const topProducts = useMemo(() => computeTopProducts(scoped, products, 10), [scoped, products]);
  const byBranch = useMemo(() => computeDemandBySucursal(scoped, branches), [scoped, branches]);
  const byCategory = useMemo(() => computeDemandByCategory(scoped, products), [scoped, products]);
  const unidadTexto = unidad === "lb" ? "libras" : "unidades";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BarRankingChart
        title={`Top 10 productos por ${unidadTexto}`}
        subtitle={`Suma de ${unidadTexto} estimadas en la predicción actual (${horizonteMinuscula}).`}
        items={topProducts}
        emptyMessage={`No hay productos vendidos por ${unidadTexto} en esta predicción.`}
        color="coral"
      />
      <BarRankingChart
        title="Demanda estimada por sucursal"
        subtitle={`Total de ${unidadTexto} por sucursal (${horizonteMinuscula}).`}
        items={byBranch}
        emptyMessage={`No hay datos por ${unidadTexto} para las sucursales.`}
        color="teal"
      />
      {byCategory.length > 0 ? (
        <BarRankingChart
          title="Demanda estimada por categoría"
          subtitle={`Total de ${unidadTexto} por categoría de producto (${horizonteMinuscula}).`}
          items={byCategory}
          emptyMessage={`No hay datos por ${unidadTexto} para las categorías.`}
          color="teal"
          className="lg:col-span-2"
        />
      ) : null}
    </div>
  );
}

export function DemandSummary({
  rows,
  products,
  branches,
  horizonte,
}: {
  rows: PredictionRow[];
  products: OptionItem[];
  branches: OptionItem[];
  horizonte: Horizonte;
}) {
  const [activeUnit, setActiveUnit] = useState<UnidadMedida>("lb");
  const horizonteTexto = horizonteBadge(horizonte);
  const horizonteMinuscula = horizonteTexto.charAt(0).toLowerCase() + horizonteTexto.slice(1);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-brand-ink print:text-slate-900">Resumen de demanda</h2>
          <p className="mt-1 text-sm text-brand-muted print:text-brand-muted">
            Qué productos, sucursales y categorías van a mover más — {horizonteMinuscula}. Libras y
            unidades se muestran por separado porque no son la misma cantidad.
          </p>
        </div>

        <div className="flex gap-1 rounded-full border border-brand-lineStrong bg-white p-1 print:hidden" role="tablist" aria-label="Unidad de medida">
          {UNIT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeUnit === tab.value}
              onClick={() => setActiveUnit(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeUnit === tab.value
                  ? "bg-brand-teal text-white"
                  : "text-brand-muted hover:text-brand-tealDeep"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Both units always render for the printable report; on screen only the active tab shows. */}
      <div className={activeUnit === "lb" ? "block" : "hidden print:block"}>
        <h3 className="mb-3 hidden text-sm font-semibold uppercase tracking-wide text-brand-muted print:block">
          Por libras
        </h3>
        <UnitCharts
          rows={rows}
          products={products}
          branches={branches}
          unidad="lb"
          horizonteMinuscula={horizonteMinuscula}
        />
      </div>
      <div className={activeUnit === "unidades" ? "mt-6 block" : "hidden print:mt-6 print:block"}>
        <h3 className="mb-3 hidden text-sm font-semibold uppercase tracking-wide text-brand-muted print:block">
          Por unidades
        </h3>
        <UnitCharts
          rows={rows}
          products={products}
          branches={branches}
          unidad="unidades"
          horizonteMinuscula={horizonteMinuscula}
        />
      </div>
    </section>
  );
}

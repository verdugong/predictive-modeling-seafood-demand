"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatWidget } from "@/components/ChatWidget";
import { DemandSummary } from "@/components/DemandSummary";
import { FilterDrawer } from "@/components/FilterDrawer";
import { PredictionTable } from "@/components/PredictionTable";
import { ReportModal } from "@/components/ReportModal";
import { getOptions, type OptionItem, type PredictionRow } from "@/lib/api";
import {
  EMPTY_FILTERS,
  demandaTituloConHorizonte,
  describeFilters,
  horizonteBadge,
  resolveProducts,
  runPrediction,
  todayISO,
  totalDemandByUnit,
  uniqueCategories,
} from "@/lib/predict";
import type { FilterSelection } from "@/lib/predict";

type LoadState = "idle" | "loading" | "ready" | "error";

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-brand-line bg-brand-card p-4 shadow-card transition hover:shadow-pop">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-tealDeep">{title}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-brand-ink">{value}</p>
      <p className="mt-1 text-sm text-brand-muted">{helper}</p>
    </div>
  );
}

export default function Page() {
  const [optionsState, setOptionsState] = useState<LoadState>("idle");
  const [products, setProducts] = useState<OptionItem[]>([]);
  const [branches, setBranches] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState<FilterSelection>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterSelection>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<PredictionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const categories = useMemo(() => uniqueCategories(products), [products]);
  const appliedFiltersDescription = useMemo(
    () => describeFilters(appliedFilters, products, branches),
    [appliedFilters, products, branches],
  );
  const demandaTotal = useMemo(() => totalDemandByUnit(rows, products), [rows, products]);

  useEffect(() => {
    let active = true;

    async function load() {
      setOptionsState("loading");
      try {
        const payload = await getOptions();
        if (!active) {
          return;
        }

        setProducts(payload.productos);
        setBranches(payload.sucursales);
        setOptionsState("ready");
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : "No se pudieron cargar los productos.";
        setError(message);
        setOptionsState("error");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function executePrediction(selection: FilterSelection) {
    setError(null);
    setSubmitting(true);
    try {
      const resolved = resolveProducts(products, selection.category, selection.product);
      if (resolved.length === 0) {
        setRows([]);
        setError("No hay productos que coincidan con el filtro seleccionado.");
        return;
      }

      const resultados = await runPrediction({
        products: resolved,
        sucursal: selection.sucursal,
        fecha: todayISO(),
        horizonte: selection.horizonte,
      });

      setRows(resultados);
      setAppliedFilters(selection);
      setHasRun(true);
      if (resultados.length === 0) {
        setError("No se encontraron combinaciones válidas de producto y sucursal para este filtro.");
      }
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "La predicción falló.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerate() {
    setFilters(EMPTY_FILTERS);
    await executePrediction(EMPTY_FILTERS);
  }

  async function handleApplyFilters() {
    await executePrediction(filters);
    setFilterOpen(false);
  }

  function handleResetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-brand-text sm:px-6 lg:px-10 print:overflow-visible print:bg-white print:px-0 print:py-0">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 print:hidden">
        <header className="glass-panel relative overflow-hidden rounded-[2rem] p-6 shadow-card sm:p-8">
          <div className="relative flex items-start justify-between">
            <div className="relative max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-brand-teal">
                Distribuidora de mariscos
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-ink sm:text-5xl">
                Planificación de demanda de mariscos
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
                Anticipa las ventas de los próximos días y organiza el inventario de cada sucursal.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting || optionsState !== "ready"}
                  className="inline-flex items-center justify-center rounded-full bg-brand-coral px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,107,75,0.32)] transition hover:-translate-y-0.5 hover:bg-brand-coralDeep disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                >
                  {submitting ? "Calculando..." : "Generar predicción"}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  disabled={optionsState !== "ready"}
                  className="inline-flex items-center justify-center rounded-full border border-brand-lineStrong bg-white px-6 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-teal hover:bg-brand-tealSoft hover:text-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  disabled={rows.length === 0}
                  title={rows.length === 0 ? "Genera una predicción primero" : undefined}
                  className="inline-flex items-center justify-center rounded-full border border-brand-lineStrong bg-white px-6 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-teal hover:bg-brand-tealSoft hover:text-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generar reporte
                </button>
              </div>
            </div>
            <img
              src="/logo.jpeg"
              alt="Logo"
              className="h-24 w-24 shrink-0 object-contain sm:h-32 sm:w-32"
            />
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            title={demandaTituloConHorizonte(appliedFilters.horizonte)}
            value={
              <span className="flex items-baseline gap-4">
                <span>
                  {demandaTotal.lb.toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-brand-muted">lb</span>
                </span>
                <span>
                  {Math.round(demandaTotal.unidades)}
                  <span className="ml-1 text-sm font-normal text-brand-muted">unid.</span>
                </span>
              </span>
            }
            helper={`Totales por separado, ${horizonteBadge(appliedFilters.horizonte).toLowerCase()} (no se suman entre sí)`}
          />
          <StatCard title="Filtro activo" value={hasRun ? "Aplicado" : "Ninguno"} helper={appliedFiltersDescription} />
          <StatCard
            title="Registros generados"
            value={String(rows.length)}
            helper={`Horizonte: ${horizonteBadge(appliedFilters.horizonte)}`}
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-brand-coral/40 bg-brand-coralSoft px-4 py-3 text-sm text-brand-coralDeep" role="alert">
            {error}
          </div>
        ) : null}

        <section className="glass-panel rounded-[2rem] p-6 shadow-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-brand-ink">Predicción de ventas</h2>
              <p className="text-sm text-brand-muted">
                Cuánto conviene tener de cada producto. Haz clic en la columna de demanda para ordenar de
                mayor a menor.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-brand-muted">
              <span className="rounded-full border border-[#C6E5EC] bg-brand-tealSoft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-tealDeep">
                Horizonte: {horizonteBadge(appliedFilters.horizonte)}
              </span>
              <span>{rows.length > 0 ? `${rows.length} registros generados` : "Sin resultados aún"}</span>
            </div>
          </div>

          <div className="mt-5">
            <PredictionTable rows={rows} products={products} horizonte={appliedFilters.horizonte} />
          </div>
        </section>

        <DemandSummary rows={rows} products={products} branches={branches} horizonte={appliedFilters.horizonte} />
      </div>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        categories={categories}
        products={products}
        branches={branches}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        submitting={submitting}
      />

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        rows={rows}
        products={products}
        branches={branches}
        filtersDescription={appliedFiltersDescription}
        horizonte={appliedFilters.horizonte}
      />

      <ChatWidget
        rows={rows}
        products={products}
        filtersDescription={appliedFiltersDescription}
        horizonte={appliedFilters.horizonte}
      />
    </main>
  );
}

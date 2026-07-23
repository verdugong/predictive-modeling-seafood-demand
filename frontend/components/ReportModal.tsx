"use client";

import type { Horizonte, OptionItem, PredictionRow } from "@/lib/api";
import { horizonteBadge, totalDemandByUnit } from "@/lib/predict";
import { totalSubtotales } from "@/lib/prices";
import { PredictionTable } from "@/components/PredictionTable";

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-brand-muted print:text-brand-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-brand-ink print:text-slate-900">{value}</dd>
    </div>
  );
}

export function ReportModal({
  open,
  onClose,
  rows,
  products,
  branches,
  filtersDescription,
  horizonte,
}: {
  open: boolean;
  onClose: () => void;
  rows: PredictionRow[];
  products: OptionItem[];
  branches: OptionItem[];
  filtersDescription: string;
  horizonte: Horizonte;
}) {
  const generatedAt = new Date().toLocaleString("es-EC", { dateStyle: "long", timeStyle: "short" });
  const total = totalDemandByUnit(rows, products);
  const totalUSD = totalSubtotales(rows);
  const fechaInicio = rows.length > 0 ? rows[0].fecha : null;
  const diasHorizonte = horizonte === "mensual" ? 28 : 7;
  const fechaFin = fechaInicio ? (() => {
    const d = new Date(fechaInicio);
    d.setDate(d.getDate() + diasHorizonte - 1);
    return d.toISOString().split("T")[0];
  })() : null;

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-scrim/60 backdrop-blur-sm print:static print:overflow-visible print:bg-transparent print:backdrop-blur-none">
      <div className="mx-auto my-8 w-full max-w-5xl px-4 print:my-0 print:max-w-none print:px-0">
        <div className="glass-panel flex items-center justify-between gap-3 rounded-t-[2rem] border-b border-brand-line p-5 shadow-pop print:hidden">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Reporte de predicción</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-brand-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-coralDeep"
            >
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar reporte"
              className="rounded-full border border-brand-line p-2 text-brand-muted transition hover:border-brand-teal hover:text-brand-tealDeep"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          id="report-print-area"
          className="glass-panel space-y-8 rounded-b-[2rem] p-6 text-brand-text shadow-pop sm:p-8 print:rounded-none print:border-none print:bg-white print:p-0 print:text-slate-900 print:shadow-none"
        >
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Reporte de predicción de inventario</h1>
            <p className="text-sm text-brand-muted print:text-slate-600">Generado el {generatedAt}</p>
            {fechaInicio && fechaFin && (
              <p className="text-sm font-semibold text-brand-ink print:text-slate-900 mt-1">
                Predicción: {fechaInicio} hasta {fechaFin}
              </p>
            )}
            <p className="text-lg font-bold text-brand-tealDeep print:text-slate-900 mt-2">
              Total estimado: ${totalUSD.toFixed(2)} USD
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportStat label="Horizonte" value={horizonteBadge(horizonte)} />
            <ReportStat label="Filtros aplicados" value={filtersDescription} />
            <ReportStat label="Total de registros" value={String(rows.length)} />
            <ReportStat label="Demanda total estimada en lb" value={`${total.lb.toFixed(1)} lb`} />
            <ReportStat
              label="Demanda total estimada en unidades"
              value={`${Math.round(total.unidades)} unidades`}
            />
          </dl>

          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">Tabla de resultados</h2>
            <div className="mt-3">
              <PredictionTable rows={rows} products={products} horizonte={horizonte} paginate={false} reportMode />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

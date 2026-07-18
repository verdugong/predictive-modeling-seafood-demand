"use client";

import { useEffect, useMemo, useState } from "react";

import type { Horizonte, OptionItem, PredictionRow } from "@/lib/api";
import { formatDemanda, horizonteCorto, unidadDeProducto } from "@/lib/predict";
import { LimeExplainModal, type LimeExplainTarget } from "@/components/LimeExplainModal";

const PAGE_SIZE = 15;

export function PredictionTable({
  rows,
  products,
  horizonte,
  paginate = true,
}: {
  rows: PredictionRow[];
  products: OptionItem[];
  horizonte: Horizonte;
  /** Set to false to render every row at once (used by the printable report). */
  paginate?: boolean;
}) {
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [explainTarget, setExplainTarget] = useState<LimeExplainTarget | null>(null);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) =>
      sortDir === "asc"
        ? a.unidades_estimadas_7d - b.unidades_estimadas_7d
        : b.unidades_estimadas_7d - a.unidades_estimadas_7d,
    );
    return copy;
  }, [rows, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = paginate ? sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : sorted;

  function toggleSort() {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-brand-line print:overflow-visible print:rounded-none print:border-slate-300">
        <table className="min-w-full divide-y divide-brand-line text-left text-sm print:divide-slate-300">
          <thead className="bg-brand-tableHead text-[#EAF4F9] print:bg-slate-100 print:text-slate-700">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Producto</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Sucursal</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="inline-flex items-center gap-1 whitespace-nowrap transition hover:text-white print:pointer-events-none"
                >
                  Demanda estimada ({horizonteCorto(horizonte)})
                  <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">¿Por qué esta predicción?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line bg-brand-card print:bg-white">
            {pageRows.length > 0 ? (
              pageRows.map((row) => {
                const catalogEntry = products.find((item) => item.id === row.producto);
                const unidad = unidadDeProducto(products, row.producto);
                const productoLabel = catalogEntry?.product_clean ?? row.producto;
                return (
                  <tr
                    key={`${row.producto}-${row.sucursal}-${row.fecha}`}
                    className="align-top transition hover:bg-brand-tint"
                  >
                    <td className="px-4 py-4 print:text-slate-900">
                      <p className="font-semibold text-brand-ink print:text-slate-900">{productoLabel}</p>
                      <p className="mt-0.5 text-xs text-brand-faint print:text-brand-muted">
                        {row.producto}
                        {catalogEntry?.presentation ? ` · ${catalogEntry.presentation}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-brand-muted print:text-slate-700">{row.sucursal}</td>
                    <td className="px-4 py-4 text-brand-muted print:text-slate-700">{row.fecha}</td>
                    <td className="px-4 py-4 font-bold tabular-nums text-brand-teal print:text-slate-900">
                      {formatDemanda(row.unidades_estimadas_7d, unidad)}
                    </td>
                    <td className="px-4 py-4 print:text-slate-700">
                      <button
                        type="button"
                        onClick={() =>
                          setExplainTarget({
                            producto: row.producto,
                            productoLabel,
                            sucursal: row.sucursal,
                            fecha: row.fecha,
                            horizonte: row.horizonte,
                          })
                        }
                        className="rounded-full border border-brand-lineStrong bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-tealDeep transition hover:border-brand-teal hover:bg-brand-tealSoft print:hidden"
                      >
                        Ver explicación
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-brand-muted">
                  Genera una predicción para ver los resultados aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginate && sorted.length > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-brand-muted print:hidden">
          <span>
            Página {safePage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-xl border border-brand-line px-3 py-1.5 transition hover:border-brand-teal hover:text-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-xl border border-brand-line px-3 py-1.5 transition hover:border-brand-teal hover:text-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      <LimeExplainModal target={explainTarget} onClose={() => setExplainTarget(null)} />
    </div>
  );
}

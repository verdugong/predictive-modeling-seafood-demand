"use client";

import { useEffect, useState } from "react";

import { explicarPrediccion, type Horizonte, type LimeFactor } from "@/lib/api";

export type LimeExplainTarget = {
  producto: string;
  productoLabel: string;
  sucursal: string;
  fecha: string;
  horizonte: Horizonte;
};

export function LimeExplainModal({
  target,
  onClose,
}: {
  target: LimeExplainTarget | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factores, setFactores] = useState<LimeFactor[]>([]);

  useEffect(() => {
    if (!target) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setFactores([]);

    explicarPrediccion({
      producto: target.producto,
      sucursal: target.sucursal,
      fecha: target.fecha,
      horizonte: target.horizonte,
      festivo: 0,
      vispera_festivo: 0,
    })
      .then((data) => {
        if (active) {
          setFactores(data.factores);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "No fue posible calcular la explicación.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [target]);

  if (!target) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-scrim/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel w-full max-w-sm rounded-[1.5rem] p-6 shadow-pop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">¿Por qué el modelo predijo esto?</h3>
            <p className="mt-1 text-xs text-brand-muted">
              {target.productoLabel} · {target.sucursal}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full border border-brand-line p-1.5 text-brand-muted transition hover:border-brand-teal hover:text-brand-tealDeep"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-brand-muted">Calculando explicación…</p>
          ) : error ? (
            <p className="text-sm text-brand-coralDeep">{error}</p>
          ) : factores.length === 0 ? (
            <p className="text-sm text-brand-muted">
              No se identificaron factores destacados para esta predicción.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {factores.map((factor, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm text-brand-text">
                  <span
                    className={`mt-0.5 shrink-0 font-semibold ${factor.direccion === "sube" ? "text-brand-coralDeep" : "text-brand-tealDeep"}`}
                    aria-hidden="true"
                  >
                    {factor.direccion === "sube" ? "↑" : "↓"}
                  </span>
                  <span>{factor.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getOptions,
  predictInventory,
  type OptionItem,
  type PredictionRow,
} from "@/lib/api";

type LoadState = "idle" | "loading" | "ready" | "error";

function toDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  if (!start || !end) {
    return dates;
  }

  const cursor = new Date(`${start}T00:00:00`);
  const final = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(final.getTime()) || cursor > final) {
    return dates;
  }

  while (cursor <= final) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="block font-medium tracking-wide text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Selecciona una opción</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="block font-medium tracking-wide text-slate-200">{label}</span>
      <select
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
      >
        <option value="0">No</option>
        <option value="1">Sí</option>
      </select>
    </label>
  );
}

function StatCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

export default function Page() {
  const [optionsState, setOptionsState] = useState<LoadState>("idle");
  const [products, setProducts] = useState<OptionItem[]>([]);
  const [branches, setBranches] = useState<OptionItem[]>([]);
  const [product, setProduct] = useState("");
  const [branch, setBranch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [festivo, setFestivo] = useState(0);
  const [visperaFestivo, setVisperaFestivo] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<PredictionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedProductLabel = useMemo(
    () => products.find((item) => item.id === product)?.label ?? "Sin selección",
    [product, products],
  );
  const selectedBranchLabel = useMemo(
    () => branches.find((item) => item.id === branch)?.label ?? "Sin selección",
    [branch, branches],
  );

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

        const message = err instanceof Error ? err.message : "No se pudieron cargar las opciones.";
        setError(message);
        setOptionsState("error");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!product || !branch) {
      setError("Selecciona un producto y una sucursal antes de predecir.");
      return;
    }

    const dates = toDateRange(startDate, endDate);
    if (dates.length === 0) {
      setError("Selecciona un rango de fechas válido.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await predictInventory({
        productos: [product],
        sucursales: [branch],
        fechas: dates,
        festivo,
        vispera_festivo: visperaFestivo,
      });

      setRows(response.resultados);
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

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="absolute inset-0 -z-10 bg-grid-fine bg-[size:42px_42px] opacity-[0.05]" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="glass-panel rounded-[2rem] p-6 shadow-glow sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-cyan-300/80">
                Bienvenido
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Panel operativo de predicción de inventario para mariscos.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Selecciona producto, sucursal y rango de fechas para consultar una predicción
                explicable con foco en rotación, demanda reciente e inventario.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px] lg:grid-cols-3">
              <StatCard title="Estado" value={optionsState === "ready" ? "Listo" : "Cargando"} helper="Catálogo y motor ONNX" />
              <StatCard title="Producto" value={product ? "1" : "0"} helper={selectedProductLabel} />
              <StatCard title="Sucursal" value={branch ? "1" : "0"} helper={selectedBranchLabel} />
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="glass-panel rounded-[2rem] p-6 shadow-glow">
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Configuración de consulta</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Selecciona.
                </p>
              </div>

              <SelectField
                label="Producto"
                value={product}
                onChange={setProduct}
                options={products}
                disabled={optionsState !== "ready"}
              />

              <SelectField
                label="Sucursal"
                value={branch}
                onChange={setBranch}
                options={branches}
                disabled={optionsState !== "ready"}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="block font-medium tracking-wide text-slate-200">Fecha de inicio</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="block font-medium tracking-wide text-slate-200">Fecha de fin</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ToggleField label="Feriado" value={festivo} onChange={setFestivo} />
                <ToggleField label="Víspera de feriado" value={visperaFestivo} onChange={setVisperaFestivo} />
              </div>

              <button
                type="submit"
                disabled={submitting || optionsState !== "ready"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Calculando..." : "Generar predicción"}
              </button>
            </div>
          </form>

          <section className="glass-panel rounded-[2rem] p-6 shadow-glow">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Resultados</h2>
                <p className="text-sm text-slate-400">
                  Predicciones por día con explicación resumida para apoyo operativo.
                </p>
              </div>
              <p className="text-sm text-slate-400">
                {rows.length > 0 ? `${rows.length} registros generados` : "Sin resultados aún"}
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900/90 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Unidades Estimadas (30d)</th>
                    <th className="px-4 py-3 font-medium">Justificación de Inventario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <tr key={`${row.producto}-${row.sucursal}-${row.fecha}`} className="align-top transition hover:bg-slate-900/60">
                        <td className="px-4 py-4 text-slate-100">{row.producto}</td>
                        <td className="px-4 py-4 text-slate-300">{row.sucursal}</td>
                        <td className="px-4 py-4 text-slate-300">{row.fecha}</td>
                        <td className="px-4 py-4 text-cyan-300">{row.unidades_estimadas_30d.toFixed(2)}</td>
                        <td className="px-4 py-4 text-slate-300">{row.justificacion_inventario}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        Ejecuta una consulta para visualizar la tabla de predicciones.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

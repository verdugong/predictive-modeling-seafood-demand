"use client";

import { useMemo } from "react";

import type { OptionItem } from "@/lib/api";
import { HORIZON_OPTIONS, type FilterSelection } from "@/lib/predict";

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  disabled?: boolean;
  /** Omit to render the field as a required choice with no empty option. */
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm text-brand-muted">
      <span className="block font-medium tracking-wide text-brand-text">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-text outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  categories,
  products,
  branches,
  onApply,
  onReset,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterSelection;
  onChange: (next: FilterSelection) => void;
  categories: string[];
  products: OptionItem[];
  branches: OptionItem[];
  onApply: () => void;
  onReset: () => void;
  submitting: boolean;
}) {
  const productsInCategory = useMemo(() => {
    if (!filters.category) {
      return products;
    }
    return products.filter((product) => product.category === filters.category);
  }, [products, filters.category]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onClose}
        className="absolute inset-0 bg-brand-scrim/50 backdrop-blur-sm"
      />

      <aside className="glass-panel relative flex h-full w-full max-w-sm flex-col gap-6 overflow-y-auto rounded-l-[2rem] border-l border-brand-line p-6 shadow-pop sm:max-w-md">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-ink">Filtrar predicción</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Acota por categoría, producto y sucursal antes de predecir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full border border-brand-line p-2 text-brand-muted transition hover:border-brand-teal hover:text-brand-tealDeep"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          <SelectField
            label="Categoría"
            value={filters.category}
            placeholder="Todas las categorías"
            options={categories.map((category) => ({ id: category, label: category }))}
            onChange={(category) =>
              onChange({
                ...filters,
                category,
                // A product from the previous category no longer applies.
                product:
                  filters.product && products.find((p) => p.id === filters.product)?.category === category
                    ? filters.product
                    : "",
              })
            }
          />

          <SelectField
            label="Producto"
            value={filters.product}
            placeholder={filters.category ? "Todos los productos de la categoría" : "Todos los productos"}
            options={productsInCategory}
            onChange={(product) => onChange({ ...filters, product })}
          />

          <SelectField
            label="Sucursal"
            value={filters.sucursal}
            placeholder="Todas las sucursales"
            options={branches}
            onChange={(sucursal) => onChange({ ...filters, sucursal })}
          />

          <SelectField
            label="Horizonte"
            value={filters.horizonte}
            options={HORIZON_OPTIONS.map((option) => ({ id: option.value, label: option.label }))}
            onChange={(horizonte) => onChange({ ...filters, horizonte: horizonte as FilterSelection["horizonte"] })}
          />
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-brand-line pt-5">
          <button
            type="button"
            onClick={onApply}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-coral px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-coralDeep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Calculando..." : "Aplicar y predecir"}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full border border-brand-line px-4 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-teal hover:text-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpiar filtros
          </button>
        </div>
      </aside>
    </div>
  );
}

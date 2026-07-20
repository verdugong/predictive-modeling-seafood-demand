/** "lb" = se vende por libras (fraccionable). "unidades" = se vende por pieza/funda (entero). */
export type UnidadMedida = "lb" | "unidades";

export type OptionItem = {
  id: string;
  label: string;
  category?: string | null;
  sucursales?: string[] | null;
  product_clean?: string | null;
  presentation?: string | null;
  unidad_medida?: UnidadMedida | null;
};

export type OptionsResponse = {
  productos: OptionItem[];
  sucursales: OptionItem[];
};

/** "semanal" = 7 días (target_7d del modelo). "mensual" = suma de 4 semanas (28 días). */
export type Horizonte = "semanal" | "mensual";

export type PredictionRequest = {
  productos: string[];
  sucursales: string[];
  fechas: string[];
  festivo: number;
  vispera_festivo: number;
  horizonte: Horizonte;
};

export type PredictionRow = {
  producto: string;
  sucursal: string;
  fecha: string;
  horizonte: Horizonte;
  unidades_estimadas_7d: number;
};

export type PredictionResponse = {
  resultados: PredictionRow[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getOptions(): Promise<OptionsResponse> {
  const response = await fetch(`${API_URL}/opciones`, { cache: "no-store" });
  if (!response.ok) {
    const body = await safeJson<{ detail?: string }>(response);
    throw new Error(body?.detail ?? "No fue posible cargar las opciones.");
  }

  return (await response.json()) as OptionsResponse;
}

export async function predictInventory(payload: PredictionRequest): Promise<PredictionResponse> {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await safeJson<{ detail?: string }>(response);
    throw new Error(body?.detail ?? "La predicción no pudo completarse.");
  }

  return (await response.json()) as PredictionResponse;
}

export type LimeExplainRequest = {
  producto: string;
  sucursal: string;
  fecha: string;
  horizonte: Horizonte;
  festivo: number;
  vispera_festivo: number;
};

/** One real LIME factor for a single prediction: its direction and a short, specific sentence. */
export type LimeFactor = {
  direccion: "sube" | "baja";
  texto: string;
};

export type LimeExplainResponse = {
  factores: LimeFactor[];
};

/** Computes LIME on demand for exactly one prediction row — never run in bulk. */
export async function explicarPrediccion(payload: LimeExplainRequest): Promise<LimeExplainResponse> {
  const response = await fetch(`${API_URL}/explicar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await safeJson<{ detail?: string }>(response);
    throw new Error(body?.detail ?? "No fue posible calcular la explicación.");
  }

  return (await response.json()) as LimeExplainResponse;
}

export type ChatResponse = {
  respuesta: string;
};

/** Compact summary of a prediction run, sent to /chat instead of the full table. */
export type PredictionSummary = {
  horizonte: string;
  // Never a single combined total: lb and unidades are different quantities.
  total_estimado_lb: number;
  total_estimado_unidades: number;
  cantidad_registros: number;
  filtros: string;
  top5: { producto: string; cantidad: number; unidad: UnidadMedida }[];
};

export async function sendChatMessage(
  mensaje: string,
  contextoPredicciones?: PredictionSummary[],
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mensaje, contexto_predicciones: contextoPredicciones ?? null }),
  });

  if (!response.ok) {
    const body = await safeJson<{ detail?: string }>(response);
    throw new Error(body?.detail ?? "No fue posible enviar el mensaje.");
  }

  return (await response.json()) as ChatResponse;
}

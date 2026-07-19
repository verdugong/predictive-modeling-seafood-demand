# Frontend - Seafood Demand Dashboard

Interfaz web en Next.js para consultar predicciones, explorar resultados y apoyar decisiones de inventario en una distribuidora de mariscos.

## Proposito

- Permitir filtrado por producto, sucursal, categoria y horizonte.
- Consumir la API del backend para cargar opciones, predecir y explicar resultados.
- Presentar la informacion en tablas, resumen ejecutivo, reporte y chat.

## Como funciona

1. Al iniciar, la pagina principal solicita `GET /opciones` para poblar los filtros.
2. El usuario ajusta el alcance de la consulta desde `FilterDrawer`.
3. `POST /predict` devuelve la demanda estimada y se renderiza en `PredictionTable`.
4. `DemandSummary` consolida la lectura operativa por horizonte y sucursal.
5. `ReportModal` y `ChatWidget` reutilizan el mismo contexto para analisis adicional.

## Estructura funcional

- `app/page.tsx` coordina el estado global, la carga de opciones y la ejecucion de predicciones.
- `components/` agrupa filtros, tablas, resumen, reporte y chat.
- `lib/api.ts` encapsula las llamadas HTTP al backend.
- `lib/predict.ts` contiene reglas de transformacion y utilidades de negocio.

## Tecnologias

- Next.js 15 y React 19 para la aplicacion principal.
- TypeScript para tipado y mantenimiento.
- Tailwind CSS para estilos y layout responsivo.
- react-markdown y remark-gfm para respuestas enriquecidas del asistente.

## Ejecucion local

1. Instalar dependencias con `npm install` dentro de `frontend/`.
2. Iniciar el servidor con `npm run dev`.
3. Si el backend usa otro host o puerto, definir `NEXT_PUBLIC_API_URL` en `frontend/.env.local`.
4. Abrir `http://localhost:3000` para usar la interfaz.

## Notas

- El frontend esta diseñado para lectura rapida por usuarios operativos y gerenciales.
- Si la API no responde, revisar que el backend este corriendo y que la URL configurada sea correcta.
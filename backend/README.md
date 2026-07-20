# Backend - Seafood Demand API

API en FastAPI que sirve la prediccion de demanda para la distribuidora de mariscos y concentra la logica de inferencia, validacion y analisis.

## Proposito

- Cargar en memoria el modelo ONNX y sus artefactos desde `artefactos/`.
- Exponer la capa de servicio para opciones, prediccion, explicacion local y chat.
- Estandarizar validacion, logging y manejo de errores HTTP.

## Que hace internamente

1. `main.py` carga `backend/.env` y crea el cliente de OpenAI con `OPENAI_API_KEY`.
2. En el arranque se ejecuta `load_state()` para preparar el modelo y los codificadores.
3. `GET /opciones` devuelve productos y sucursales para poblar el frontend.
4. `POST /predict` valida la solicitud y ejecuta inferencia con `ONNX Runtime`.
5. `POST /explicar` calcula factores locales de una fila con LIME.
6. `POST /chat` usa contexto de predicciones para generar analisis gerencial.

## Tecnologias

- FastAPI y Uvicorn para servir la API.
- Pydantic para definir contratos de entrada y salida.
- ONNX Runtime para inferencia eficiente.
- LIME para interpretabilidad puntual.
- OpenAI para respuestas conversacionales con contexto.
- python-dotenv para cargar variables de entorno.

## Ejecucion local

1. Crear y activar el entorno virtual dentro de `backend/`.
2. Instalar dependencias con `pip install -r requirements.txt`.
3. Configurar `backend/.env` con `OPENAI_API_KEY`.
4. Verificar que existan los artefactos requeridos en `artefactos/`.
5. Ejecutar desde la raiz del proyecto:
   `uvicorn backend.app.main:app --reload --port 8000`

## Endpoints clave

- `GET /` estado general del servicio.
- `GET /opciones` catalogo para filtros del frontend.
- `POST /predict` prediccion de demanda por producto y sucursal.
- `POST /explicar` explicacion de una prediccion individual.
- `POST /chat` analisis operativo con IA generativa.

## Notas

- El backend no arranca correctamente si faltan los artefactos o la variable `OPENAI_API_KEY`.
- El frontend debe apuntar a `http://localhost:8000` o a la URL definida en `NEXT_PUBLIC_API_URL`.
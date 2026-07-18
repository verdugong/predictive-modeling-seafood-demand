"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sendChatMessage, type Horizonte, type OptionItem, type PredictionRow } from "@/lib/api";
import { buildPredictionSummary, formatSummaryMessage } from "@/lib/predict";

type ChatMessage = { role: "user" | "assistant"; content: string };

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 15.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatWidget({
  rows,
  products,
  filtersDescription,
  horizonte,
}: {
  rows: PredictionRow[];
  products: OptionItem[];
  filtersDescription: string;
  horizonte: Horizonte;
}) {
  const [open, setOpen] = useState(false);
  const [chatMensajes, setChatMensajes] = useState<ChatMessage[]>([]);
  const [inputChat, setInputChat] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  const summary = useMemo(
    () => (rows.length > 0 ? buildPredictionSummary(rows, products, filtersDescription, horizonte) : null),
    [rows, products, filtersDescription, horizonte],
  );

  const enviarMensajeChat = async (textoOverride?: string) => {
    const texto = (textoOverride ?? inputChat).trim();
    if (!texto) return;

    const nuevoMensaje: ChatMessage = { role: "user", content: texto };
    setChatMensajes((prev) => [...prev, nuevoMensaje]);
    setInputChat("");
    setLoadingChat(true);

    try {
      const data = await sendChatMessage(texto, summary ? [summary] : undefined);
      setChatMensajes((prev) => [...prev, { role: "assistant", content: data.respuesta }]);
    } catch (error) {
      console.error("Error en chat", error);
      setChatMensajes((prev) => [
        ...prev,
        { role: "assistant", content: "Error al conectar con el servidor." },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const enviarResumen = () => {
    if (!summary || loadingChat) return;
    void enviarMensajeChat(formatSummaryMessage(summary));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-coral text-white shadow-[0_8px_20px_rgba(255,107,75,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-coralDeep"
        aria-label={open ? "Cerrar asistente de inventario" : "Abrir asistente de inventario"}
      >
        <MessageIcon />
      </button>

      {open ? (
        <section className="glass-panel fixed bottom-24 right-6 z-40 flex h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-[2rem] shadow-pop">
          <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-tableHead p-5 font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="text-[#8FD6E4]">
                <MessageIcon />
              </span>
              Asistente de inventario
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="rounded-full border border-white/25 p-1.5 text-white/80 transition hover:border-white hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-brand-tint p-5">
            {chatMensajes.length === 0 && (
              <div className="mt-10 text-center text-sm text-brand-muted">
                Hola, soy tu asistente virtual. ¿En qué te puedo ayudar con el inventario hoy?
              </div>
            )}

            {chatMensajes.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] overflow-x-auto whitespace-pre-wrap rounded-2xl p-3.5 text-sm leading-relaxed shadow-card ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-brand-teal font-medium text-white"
                      : "rounded-bl-sm border border-brand-line bg-white text-brand-text"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ node, ...props }) => (
                          <table
                            className="my-3 min-w-full divide-y divide-brand-line text-xs sm:text-sm"
                            {...props}
                          />
                        ),
                        th: ({ node, ...props }) => (
                          <th
                            className="rounded-t-sm bg-brand-tint px-3 py-2 text-left font-semibold text-brand-tealDeep"
                            {...props}
                          />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="border-t border-brand-line px-3 py-2" {...props} />
                        ),
                        p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                        strong: ({ node, ...props }) => (
                          <strong className="font-semibold text-brand-tealDeep" {...props} />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {loadingChat && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-brand-line bg-white p-4 shadow-card">
                  <div className="flex h-2 items-center gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-brand-muted" />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-brand-muted"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-brand-muted"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {summary ? (
            <div className="border-t border-brand-line bg-white px-4 pt-3">
              <button
                type="button"
                onClick={enviarResumen}
                disabled={loadingChat}
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#C6E5EC] bg-brand-tealSoft px-3 py-2 text-xs font-semibold text-brand-tealDeep transition hover:bg-[#D3EEF2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar resumen de la predicción actual
              </button>
            </div>
          ) : null}

          <div className="flex gap-3 border-t border-brand-line bg-white p-4">
            <input
              type="text"
              className="flex-1 rounded-xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-text placeholder-brand-faint outline-none transition-all focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              placeholder="Ej: ¿Qué predice para esta semana?"
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarMensajeChat()}
            />
            <button
              onClick={() => enviarMensajeChat()}
              disabled={loadingChat || !inputChat.trim()}
              className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Frescura marina": distribuidora de mariscos — fondo hielo, tarjetas blancas,
        // tinta azul marino, coral para la acción principal, turquesa para datos/acentos.
        // Sin azul saturado como color dominante: el turquesa se usa con moderación.
        brand: {
          bg: "#EEF5F8", // fondo de página (hielo)
          bgDeep: "#E1EEF4", // degradado inferior del fondo
          card: "#FFFFFF", // tarjetas principales
          tint: "#F6FAFC", // relleno sutil (hover de filas, franjas secundarias)
          track: "#E1EEF4", // pista de barras de gráficas
          tableHead: "#0F3450", // encabezado de tabla (marino)
          ink: "#0C2B40", // titulares, texto de alto contraste
          text: "#24455C", // texto principal
          muted: "#56748A", // texto secundario
          faint: "#7E97A8", // metadatos, pies
          line: "#DCE7EE", // bordes
          lineStrong: "#C7D9E3", // bordes en hover / división marcada
          coral: "#FF6B4B", // acción principal (CTA)
          coralDeep: "#E85436", // hover / texto sobre fondo claro
          coralSoft: "#FFF0EB", // relleno tenue de alertas
          teal: "#0E8FA8", // datos, enlaces, acentos puntuales
          tealDeep: "#0A6E82", // hover / texto de acento
          tealSoft: "#E4F4F7", // relleno tenue de chips/acentos
          scrim: "#0A2438", // superposición de modales
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Sombra suave de tarjeta clara, sin resplandor de color.
        card: "0 1px 2px rgba(12,43,64,.05), 0 6px 18px rgba(12,43,64,.06)",
        pop: "0 2px 6px rgba(12,43,64,.08), 0 14px 34px rgba(12,43,64,.10)",
      },
    },
  },
  plugins: [],
};

export default config;

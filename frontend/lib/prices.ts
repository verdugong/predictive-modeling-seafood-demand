/**
 * Precios unitarios estimados basados en el mercado ecuatoriano de mariscos.
 * Fuente: precios promedio de distribuidoras en Guayaquil (2024-2025).
 * Los precios son por libra (lb) o por unidad según unidad_medida del producto.
 */

const PRICES: Record<string, number> = {
  // ── Camarón ──────────────────────────────────────────────
  "CAM16PYDG2": 14.50,        // Camarón PYD T16 / Jumbo Granel
  "CAM17PYD5LBMC": 13.50,     // Camarón PYD T17 / Jumbo (5LB MC)
  "CAM17-PYD-G2": 13.50,      // Camarón PYD T17 / Jumbo Granel
  "CAM-PYD-T18-2,5LB": 12.50, // Camarón PYD T18 (Funda 2,5LB)
  "CAM-PYD-T18-2KG-UNID": 12.50,
  "CAM21PYD5LB": 11.50,       // Camarón PYD T21 (5 LB) MC
  "CAM21PYD22": 11.50,
  "CAM21PYD25": 11.50,
  "CAM21PYD44": 11.50,
  "DQ-019.15CAM": 11.50,      // T21 / Jumbo 1lb
  "DQ-019.16CAM": 11.00,      // T21 / Jumbo Granel
  "DQ-019.16CAM2": 11.00,
  "CAM26PYD5LB": 10.50,
  "CAM31PYD5LB": 9.00,
  "CAM41PYD5LB": 7.50,
  "CAM61PYD1LB": 6.50,
  "Camaron 61 PYD (2,5)": 6.00,
  "CAM61PYD5LB": 5.50,
  "CAMPYD61PROM": 6.00,
  "CAMPYD61GRAN2": 5.50,
  "CAM51WM": 6.50,
  "CAMCAS31": 8.50,
  "CAM-CAB-GEN-GR": 3.50,     // Cabeza granel
  "CAM-PYD-T51-41MIX-1LB": 6.50,
  "CAMCASC26": 10.00,
  "CAM31420": 9.00,
  "CAM36420": 8.00,
  "CAM36PROMO": 8.00,
  "CAM-17-PYD-2.5": 13.50,
  "Camarón T17 Extra Jumbo (1 LB)": 14.00,
  "CAM-PYD-T26-5LB": 10.50,
  "CAM-PYD-T31-5LB": 9.50,
  "DQ-019.38CAM": 9.50,
  "CAM-PYD-T36-5LB": 8.00,
  "CAM-PYD-T41-5LB": 7.50,
  "DQ-019.27CAM": 8.50,       // con cola T31 Granel
  "CAMCABZLIB": 5.50,         // con cabeza 1 LB
  "CAM-CABEZA-3LB": 5.00,
  "DQ-019.28CAM": 4.50,       // con cabeza Granel
  "CAMCOL1KG": 8.50,          // con cola T31 (1 KG)
  "CAMCOLA31": 8.50,
  "CAMCOLA312.5": 8.50,
  "DQ-019.24CAM": 10.00,      // con cáscara T16-17 Granel
  "Camarón con cáscara T18 Granel": 9.50,
  "DQ-019.23CAM": 10.50,      // con cáscara T21
  "DQ-019.22CAM": 9.50,       // con cáscara T26
  "DQ-019.21CAM": 7.50,       // con cáscara T36
  "DQ-019.25CAM": 6.50,       // con cáscara T41
  "CAM41CAS420": 7.00,
  "CAS-CAM-UNI": 3.00,        // Cáscaras de Camarón (Funda)
  "HAMBURGUESAS DE CAMARON": 5.50,

  // ── Atún ─────────────────────────────────────────────────
  "DQ-0001.8AT": 5.50,        // Atún Blanco (Steak)
  "ATU-ROJ-LOM-GEN-GR": 7.50, // Atún Rojo (Lomo-Granel)
  "ATU-ROJ-STK-GEN-EMP": 8.00,
  "ATU-ALB-LOM-GEN-GR": 5.50, // Atún de Albacora (Lomo-Granel)
  "ATU-ALB-STK-GEN-EMP": 6.00,
  "ATU-BON-LOM-GEN-GR": 4.00, // Bonito (Lomo - Granel)
  "PORCION DE HUESO DE ALBACORA FUNDA": 2.50,

  // ── Corvina ──────────────────────────────────────────────
  "DQ-0002.9CV": 4.50,        // Corvina Cachema Platera
  "DQ-0002.11CV": 4.00,       // Corvina Picada (Ceviche)
  "Corvina Picada (Ceviche) - Económica": 3.50,
  "DQ-0002.8CV": 5.00,        // Corvina blanca Bassa (Funda 4U)
  "DQ-0002.10CV": 4.50,
  "CORVBASSASTE": 5.00,
  "Corvina de Roca (Lomo Med) Paquete": 5.50,
  "Corvina de Roca (Lomo Peq.) Paquete": 5.00,
  "Corvina de roca (Steak)": 5.50,
  "CORVROCSTK": 5.50,
  "DQ-0002.5CV": 5.00,        // filete granel
  "Corvina de roca (filete) granel PQ.": 5.00,
  "DQ-0002.6CV": 5.50,        // lomo grande
  "DQ-0002.4CV": 5.00,        // lomo mediano
  "Corvina de roca (lomo pequeño)": 4.50,
  "DQ-0002.2CV": 4.50,        // Corvina plateada (filete completo)
  "DQ-0002.0CV": 4.50,        // Corvina plateada (steak)
  "CORVPLATPROM": 4.00,
  "PROMCORVREGALO": 3.50,

  // ── Bagre ────────────────────────────────────────────────
  "BRG-COL-ENT-GEN-GR": 3.00, // Bagre Colorado (Granel)
  "BRG-COL-POR-GEN-EMP": 3.50,

  // ── Tilapia ──────────────────────────────────────────────
  "Funda Tilapia Blanca / Gourmet 2kg": 3.00,
  "DQ-010.3TI": 3.50,         // Tilapia Blanca / Gourmet (Steak)
  "Tilapia Blanca Granel": 3.00,
  "DQ-010.0TI": 3.50,         // Tilapia Roja (Paquete)
  "DQ-010.2TI": 3.00,         // Tilapia Roja Granel GR
  "TILPROJMEDGR": 3.00,
  "TILROJPROM": 2.80,
  "Tilapia Roja PQ (Steack) Promoción 2 Unid.": 3.50,
  "TROCITOS ESPECIALDE TILAPIA GRANEL (2)": 3.00,

  // ── Calamar ──────────────────────────────────────────────
  "DQ-0006.0CL": 6.50,        // Calamar Condon (1 LB)
  "CAL-CUE-PIC-GEN-UNID": 6.00,
  "CAL-ARO-GEN-1LB": 6.50,
  "CAL-ARO-GEN-GR": 6.00,
  "DQ-0006.1CL": 5.50,        // en cabeza (Picado)
  "Mixtura de Calamar (Cuerpo y Cabeza)": 5.00,

  // ── Langostino ───────────────────────────────────────────
  "LANGOSTINO Sta Pris Muestra": 9.00,
  "Langostino Pequeño (Promo)": 7.00,
  "Langostino en IQF U 4 PROMO": 10.00,
  "DQ-018.0LG": 10.50,        // IQF U 5-6
  "DQ-018.1LG": 9.00,         // IQF U 7-8

  // ── Pota ─────────────────────────────────────────────────
  "DQ-023.3PA": 2.50,         // Pota de Cabeza (Entera) GRANEL
  "POTCABTEN": 2.80,
  "POTCUERGRAN": 2.50,
  "POTCUE": 2.80,

  // ── Pescado salado ───────────────────────────────────────
  "PES-SAL-CABCOL-GEN-GR": 2.50,
  "Pescado Salado Sierra Bonito (Empacado)": 3.00,
  "DQ-024.1PS": 3.50,         // BACALAO MP
  "Pescado salado (SIERRA - BONITO) granel": 2.80,
  "PESECO": 3.00,
  "DQ-024.2PS": 2.50,         // Lisa (FANESCA)

  // ── Otros pescados ───────────────────────────────────────
  "DQ-0004.3DO": 6.50,        // Dorado Premium (Lomo Picado)
  "DQ-0004.2DO": 7.00,        // Dorado Premium (Lomo)
  "Dorado Premium (Porción)": 6.50,
  "DQ-016CH": 3.50,           // Pescado Chinito (Entero)
  "DQ-0005.0WH": 5.50,        // Pez Sierra Wahoo (Flecha)
  "PEZ SIERRA WAHOO (STEAK)": 6.00,
  "DQ-009.0TP": 3.50,         // Pez Trompeta 1 cuarta
  "DQ-009.1TP": 3.00,
  "DQ-0007.0PE": 5.50,        // Pez espada (Lomo)
  "DQ-0007.1PE": 5.50,        // Pez espada (Steak)
  "PESPPROMSTK": 5.00,
  "PESPADPROMFUND": 5.50,
  "DQ-0003.0PI": 4.50,        // Picudo Blanco (lomo)
  "DQ-0003.2PI": 4.00,        // Picudo Blanco (picado)
  "DQ-0003.1PI": 4.50,        // Picudo Blanco (steak)
  "DQ-021.0RO": 6.50,         // Robalo (Filete)
  "DQ-021.1RO": 5.50,         // Robalo (Pescado Entero)
  "DQ-020.0TY": 5.50,         // Toyo Tinto (Lomo)
  "DQ-020.1TY": 5.00,         // Toyo Tinto (Picado Granel)
  "DQ-020.2TY": 5.50,         // Toyo Tinto (Steak)
  "Toyo Tinto Picado (Steak)": 5.00,
  "Trompeta 2/4 filete (steack)": 3.50,
  "DQ-TP01": 3.00,            // Trompeta picada Paquete
  "Trucha Salmonada": 4.50,

  // ── Salmón ───────────────────────────────────────────────
  "DQ-012.0SL": 8.00,         // Salmón Penca (Promo)
  "SALMPROM": 8.50,           // Salmón Porción (Promo)
  "DQ-012.3SL": 9.00,         // Salmón del Atlántico (PROMO)
  "DQ-012.2SL": 8.50,         // Salmón del Atlántico (Penca)
  "DQ-012.1SL": 9.00,         // Salmón del Atlántico (Porción)

  // ── Mariscos / otros ─────────────────────────────────────
  "ALM-CAS-GEN-UNID": 4.50,   // Almeja en cáscara (Funda)
  "ALM-PUL-GEN-UNID": 5.00,   // Almeja en pulpa (Funda)
  "CAN-ROJ-PUL-UNI-0,50LB": 8.00,
  "CAN-ROJ-PUL-UNID": 7.50,
  "CAN-ROJ-UÑA-PRO-UNID": 5.00,
  "CONCHCASGR": 4.00,
  "DQ-013.4CN": 4.50,         // Pulpa de concha / 25 unidades
  "DQ-013.5CN": 4.50,         // Pulpa de concha / 50 unidades
  "DQ-011.0PO": 7.00,         // Pulpo de Roca (Entero) Paquete
  "DQ-014.1MJ": 5.00,         // Mejillón en Pulpa
  "DQ-014.0MJj": 4.50,        // Mejillón entero en cáscara (Funda)
  "DQ-015.2MJs": 4.50,        // Uñas de cangrejo
  "DQ-022.1RO": 5.50,         // Scallops Pulpa (Funda)
  "MAR-MIX-GEN-0.50LB-UNID": 5.50,
  "MAR-MIX-GEN-1LB-UNID": 5.50,
  "DQ-002ALFS": 5.00,         // Mix de frutos secos

  // ── Pescado apanado / procesado ──────────────────────────
  "Pescado Apanado en Dedos (0.50 lb - Paquete)": 4.50,
  "DEDPESCCON": 4.50,
  "Pescado Apanado en Dedos (Granel)": 4.00,
  "NUGGETS APANADOS GRANEL": 3.50,
  "TARMANI": 3.00,
  "TARRMANI": 3.00,
};

/** Precio por defecto para productos sin mapeo explícito. */
const DEFAULT_PRICE = 5.00;

/** Obtiene el precio unitario de un producto (USD). */
export function precioUnitario(productKey: string): number {
  return PRICES[productKey] ?? DEFAULT_PRICE;
}

/** Calcula el subtotal de una fila: precio × unidades estimadas. */
export function subtotalFila(
  productKey: string,
  unidadesEstimadas: number,
): number {
  return Math.round(precioUnitario(productKey) * unidadesEstimadas * 100) / 100;
}

/** Suma de todos los subtotales del reporte. */
export function totalSubtotales(
  rows: { producto: string; unidades_estimadas_7d: number }[],
): number {
  let total = 0;
  for (const row of rows) {
    total += subtotalFila(row.producto, row.unidades_estimadas_7d);
  }
  return Math.round(total * 100) / 100;
}

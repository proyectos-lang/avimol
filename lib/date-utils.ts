const ZONA = "America/Bogota"

export function fechaColombiaHoy(): string {
  // YYYY-MM-DD en hora de Colombia, usando el calendario sv-SE (ISO) para
  // evitar el desfase de un día que producen los parseos con Date().
  return new Date().toLocaleDateString("sv-SE", { timeZone: ZONA })
}

export function horaColombiaAhora(): string {
  return new Date().toLocaleTimeString("es-CO", { timeZone: ZONA, hour12: false })
}

export function fechaHoraColombiaISO(): string {
  return new Date().toISOString()
}

export function formatearFechaColombia(fecha: string | Date): string {
  // Fecha pura tipo "YYYY-MM-DD" (columna DATE, sin hora): reformatear
  // directo sin pasar por Date()/timezone. new Date("2026-07-06") se
  // interpreta como medianoche UTC, y reconvertir a America/Bogota
  // (UTC-5) la retrocede al día anterior — el mismo desfase que Lipgo
  // ya documentaba evitar en sus date-utils.
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [anio, mes, dia] = fecha.split("-")
    return `${dia}/${mes}/${anio}`
  }
  const d = typeof fecha === "string" ? new Date(fecha) : fecha
  return d.toLocaleDateString("es-CO", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" })
}

export function formatearFechaHoraColombia(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha
  return d.toLocaleString("es-CO", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

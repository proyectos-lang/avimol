import * as XLSX from "xlsx"

export interface HojaExcel {
  nombre: string
  filas: Record<string, string | number>[]
}

// Arma un solo libro con una hoja por sección y dispara la descarga en
// el navegador. Se ejecuta enteramente en el cliente porque los datos
// ya están cargados en el dashboard — no hay necesidad de ir al server.
export function exportarIndicadoresExcel(hojas: HojaExcel[], nombreArchivo: string) {
  const libro = XLSX.utils.book_new()

  for (const hoja of hojas) {
    if (hoja.filas.length === 0) continue
    const worksheet = XLSX.utils.json_to_sheet(hoja.filas)
    XLSX.utils.book_append_sheet(libro, worksheet, hoja.nombre.slice(0, 31))
  }

  XLSX.writeFile(libro, nombreArchivo)
}

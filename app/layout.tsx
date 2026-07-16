import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

// Misma fuente que usa Lipgo: basta con invocar Geist()/Geist_Mono() —
// next/font registra el @font-face globalmente con los nombres exactos
// 'Geist'/'Geist Fallback' que --font-sans ya espera en globals.css.
// Sin esta invocación esos nombres no resuelven a nada real y el
// navegador cae a su tipografía por defecto — por eso los títulos se
// veían distintos a los de Lipgo.
const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Avimol",
  description: "Inventario, logística y comercialización de huevos — Avimol",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}

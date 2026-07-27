"use client"

import { useState } from "react"
import { Egg } from "lucide-react"

// Marca de la app: usa el ícono de LiPGO desde public/ (prueba .svg y luego
// .png). Mientras el archivo no exista, cae con gracia al huevo en cuadro
// cian que había antes — así nada se ve roto hasta que se suba el logo.
const FUENTES = ["/logo-lipgo-mark.png", "/logo-lipgo-mark.svg"]

export function LogoMarca({ size = 32 }: { size?: number }) {
  const [idx, setIdx] = useState(0)
  const [fallback, setFallback] = useState(false)

  if (fallback) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          background: "linear-gradient(135deg,#0a3f6e,#00c2dc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          boxShadow: "0 0 14px rgba(0,194,220,.5)",
          flexShrink: 0,
        }}
      >
        <Egg size={Math.round(size * 0.5)} />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={FUENTES[idx]}
      alt="LiPGO"
      width={size}
      height={size}
      onError={() => {
        if (idx < FUENTES.length - 1) setIdx(idx + 1)
        else setFallback(true)
      }}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  )
}

"use client"

import { useState } from "react"

// Marca de la app: el wordmark de LiPGO desde public/ (prueba .png y luego
// .svg). Es una imagen ANCHA (~2.55:1), así que se dimensiona por ALTO y el
// ancho es automático, para que se lea "LiPGO" completo y con protagonismo.
// Si el archivo faltara, cae con gracia a un wordmark de texto "LiPGO".
const FUENTES = ["/logo-lipgo-mark.png", "/logo-lipgo-mark.svg"]

export function LogoMarca({ height = 32 }: { height?: number }) {
  const [idx, setIdx] = useState(0)
  const [fallback, setFallback] = useState(false)

  if (fallback) {
    return (
      <span
        style={{
          height,
          display: "inline-flex",
          alignItems: "center",
          fontSize: Math.round(height * 0.62),
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#0a3f6e" }}>LiP</span>
        <span style={{ color: "#00c2dc" }}>GO</span>
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={FUENTES[idx]}
      alt="LiPGO"
      onError={() => {
        if (idx < FUENTES.length - 1) setIdx(idx + 1)
        else setFallback(true)
      }}
      style={{ height, width: "auto", objectFit: "contain", flexShrink: 0 }}
    />
  )
}

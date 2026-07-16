"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { ArrowRight } from "lucide-react"
import { groups } from "@/lib/dashboard-data"

export function ModuleCards() {
  return (
    <div>
      <style>{`
        .mod-tile{ position:relative; display:flex; flex-direction:column; gap:12px; border-radius:18px;
          background:var(--card); border:1px solid var(--border); padding:16px; text-align:left; overflow:hidden;
          transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .mod-tile::after{ content:""; position:absolute; top:-40%; right:-30%; width:140px; height:140px; border-radius:50%;
          background:radial-gradient(closest-side, color-mix(in srgb, var(--tint) 28%, transparent), transparent);
          opacity:.35; transition:opacity .25s, transform .25s; pointer-events:none; }
        .mod-tile::before{ content:""; position:absolute; inset:0; border-radius:18px; padding:1.3px; pointer-events:none;
          background:linear-gradient(135deg, color-mix(in srgb, var(--tint) 70%, transparent), transparent 62%);
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude;
          opacity:0; transition:opacity .2s; }
        .mod-tile:hover{ transform:translateY(-3px); border-color:transparent;
          box-shadow:0 18px 38px color-mix(in srgb, var(--tint) 26%, transparent), 0 6px 14px rgba(20,42,68,.06); }
        .mod-tile:hover::before{ opacity:1; }
        .mod-tile:hover::after{ opacity:.6; transform:scale(1.15); }
        .mod-ico{ position:relative; z-index:1; width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center;
          background:color-mix(in srgb, var(--tint) 14%, var(--card)); color:var(--tint);
          box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--tint) 22%, transparent);
          transition:transform .2s, background .2s, color .2s, box-shadow .2s; }
        .mod-tile:hover .mod-ico{ transform:scale(1.06) rotate(-3deg); color:#fff;
          background:linear-gradient(135deg, var(--tint), color-mix(in srgb, var(--tint) 62%, #000));
          box-shadow:0 10px 22px color-mix(in srgb, var(--tint) 42%, transparent); }
        .mod-name{ position:relative; z-index:1; font-size:15px; font-weight:800; line-height:1.15; color:var(--foreground); letter-spacing:-.01em; }
        .mod-foot{ position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
        .mod-count{ font-size:11.5px; color:var(--muted-foreground); font-weight:500; }
        .mod-enter{ display:inline-flex; align-items:center; gap:3px; font-size:11.5px; font-weight:800; color:var(--tint);
          opacity:0; transform:translateX(-6px); transition:opacity .2s, transform .2s; }
        .mod-tile:hover .mod-enter{ opacity:1; transform:none; }
        @media (prefers-reduced-motion:reduce){ .mod-tile, .mod-tile *{ transition:none !important; } .mod-tile:hover{ transform:none } }
      `}</style>

      <div className="apps-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {groups.map((grupo) => {
          const Icono = grupo.icon
          const primerModulo = grupo.modules[0]?.href ?? "/"
          return (
            <Link key={grupo.key} href={primerModulo} className="mod-tile" style={{ "--tint": grupo.tint } as CSSProperties}>
              <span className="mod-ico">
                <Icono className="h-[22px] w-[22px]" />
              </span>
              <span className="mod-name">{grupo.title}</span>
              <span className="mod-foot">
                <span className="mod-count">{grupo.modules.length} módulos</span>
                <span className="mod-enter">
                  Entrar <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

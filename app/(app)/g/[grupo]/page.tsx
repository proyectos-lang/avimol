import { notFound } from "next/navigation"
import { groups } from "@/lib/dashboard-data"
import { GrupoLanding } from "@/components/grupo-landing"

export default async function GrupoPage({ params }: { params: Promise<{ grupo: string }> }) {
  const { grupo } = await params
  if (!groups.some((g) => g.key === grupo)) notFound()
  return <GrupoLanding grupoKey={grupo} />
}

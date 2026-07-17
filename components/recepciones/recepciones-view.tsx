"use client"

import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClasificarTab } from "@/components/recepciones/clasificar-tab"
import { ResumenTab } from "@/components/recepciones/resumen-tab"

export function RecepcionesView() {
  return (
    <div>
      <PageHeader
        titulo="Recepciones"
        subtitulo="Clasifica lo recibido en cada viaje (bueno/roto/picado/partido) y consulta el resumen de rotura"
      />

      <Tabs defaultValue="clasificar">
        <TabsList>
          <TabsTrigger value="clasificar">Clasificar</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>
        <TabsContent value="clasificar">
          <ClasificarTab />
        </TabsContent>
        <TabsContent value="resumen">
          <ResumenTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

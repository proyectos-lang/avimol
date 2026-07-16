import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente único, solo para uso en servidor (server actions / route handlers).
// Usa la service_role key porque en Avimol NO hay RLS: el control de acceso
// se hace en la capa de aplicación (sesión propia + rol de avimol.usuarios),
// nunca a nivel de fila en Postgres.
//
// IMPORTANTE: para que Supabase acepte consultas contra el esquema `avimol`
// (en vez de `public`) hay que agregar "avimol" a Settings → API →
// "Exposed schemas" en el panel de Supabase. Sin ese paso, cualquier query
// aquí falla con: "The schema must be one of the following: public".
type DBClient = SupabaseClient<any, any, any>

let client: DBClient | null = null

export function getAvimolDb(): DBClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: { schema: "avimol" },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    )
  }
  return client
}

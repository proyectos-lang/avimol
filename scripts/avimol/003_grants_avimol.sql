-- Otorga a la service_role (la única que usa la app Avimol; nunca se usa
-- la anon key contra este esquema) los privilegios necesarios sobre el
-- esquema avimol. "Exposed schemas" en Settings→API resuelve QUÉ esquemas
-- puede enrutar PostgREST; esto resuelve QUÉ puede hacer cada rol ahí
-- dentro. Sin este GRANT, incluso con el esquema expuesto, las consultas
-- fallan con "permission denied for schema avimol".
GRANT USAGE ON SCHEMA avimol TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA avimol TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA avimol TO service_role;

-- Para que las tablas/vistas que se creen en el futuro dentro de avimol
-- queden accesibles automáticamente sin repetir este GRANT cada vez.
ALTER DEFAULT PRIVILEGES IN SCHEMA avimol GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA avimol GRANT ALL ON SEQUENCES TO service_role;

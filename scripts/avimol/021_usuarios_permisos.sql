-- Permisos por módulo: lista de "permitidos" (allow-list) de rutas de
-- módulo por usuario. El admin no necesita filas — ve todo por su rol.
-- El nav filtra por estos href y el layout bloquea el acceso por URL.

CREATE TABLE avimol.usuario_modulos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint NOT NULL REFERENCES avimol.usuarios(id),
  modulo_href text NOT NULL,
  UNIQUE (usuario_id, modulo_href)
);

CREATE INDEX idx_usuario_modulos_usuario ON avimol.usuario_modulos(usuario_id);

-- Usuario administrador inicial para poder entrar por primera vez.
-- Usuario: admin
-- Contraseña temporal: avimol2026  (CÁMBIALA después del primer ingreso)
INSERT INTO avimol.usuarios (usuario, nombre, password_hash, rol, activo)
VALUES (
  'admin',
  'Administrador',
  '$2b$10$0eOE2zCwKFxjEhZ36HLClOEoNfasLt2uDDFGHwIoMfo2IwU6Qv8dK',
  'admin',
  true
);

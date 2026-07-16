INSERT INTO avimol.clientes (nombre, activo)
SELECT 'Consumidor final', true
WHERE NOT EXISTS (SELECT 1 FROM avimol.clientes WHERE nombre = 'Consumidor final');

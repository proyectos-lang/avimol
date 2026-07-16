-- Amplía el pedido con la información comercial que hoy no se captura:
-- vendedor, condición de pago, número de orden de compra del cliente, y
-- el desglose de IVA/descuento aplicado. Los valores monetarios quedan
-- como snapshot en el pedido (igual patrón que valor_tarifa_aplicado en
-- ordenes_cargue) para que un cambio futuro del % de IVA no altere lo
-- que ya se facturó.
ALTER TABLE avimol.pedidos
  ADD COLUMN vendedor_id          bigint REFERENCES avimol.usuarios(id),
  ADD COLUMN condicion_pago       text CHECK (condicion_pago IN ('contado','credito_15','credito_30','credito_60')),
  ADD COLUMN numero_orden_compra  text,
  ADD COLUMN aplica_iva           boolean NOT NULL DEFAULT true,
  ADD COLUMN iva_porcentaje       numeric(5,2) NOT NULL DEFAULT 19,
  ADD COLUMN descuento_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN subtotal             numeric(12,2),
  ADD COLUMN valor_descuento      numeric(12,2),
  ADD COLUMN valor_iva            numeric(12,2),
  ADD COLUMN total                numeric(12,2);

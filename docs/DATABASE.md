# Esquema de base de datos (Google Sheets)

Cada tabla es una pestaña en el mismo Google Spreadsheet. La primera fila son los encabezados.

## Convenciones

- `id` = entero autoincremental.
- `created_at`, `updated_at` = ISO 8601 (`2026-05-18T12:34:56Z`).
- `created_by` = id de usuario.
- `activo` = booleano (TRUE/FALSE), para soft-delete.
- Estados: `pendiente`, `pagada`, `anulada`.

---

## Tablas

### usuarios
| id | username | password_hash | salt | nombre | email | rol_id | telegram_id | activo | created_at |
|----|----------|---------------|------|--------|-------|--------|-------------|--------|------------|

### roles
| id | nombre | descripcion | activo |
|----|--------|-------------|--------|

### permisos
| id | modulo | accion |
|----|--------|--------|
(módulo: ventas, compras, caja, inventario, ...; acción: ver, crear, editar, anular)

### roles_permisos
| rol_id | permiso_id |
|--------|------------|

### sesiones
| token | usuario_id | created_at | expires_at | ip |
|-------|------------|------------|------------|----|

---

### clientes
| id | tipo_doc | num_doc | nombre | telefono | email | direccion | activo | created_at | created_by |

### proveedores
| id | tipo_doc | num_doc | nombre | telefono | email | direccion | activo | created_at | created_by |

### categorias
| id | nombre | descripcion | activo |

### productos
| id | sku | nombre | categoria_id | unidad | precio_venta | costo_promedio | stock_minimo | activo | created_at | created_by |

### metodos_pago
| id | nombre | tipo | activo |
(tipo: efectivo, transferencia, tarjeta, otro)

### cajas
| id | nombre | activo |

---

### compras
| id | numero | proveedor_id | fecha | metodo_pago_id | subtotal | iva | total | estado | observaciones | created_at | created_by | anulada_motivo | anulada_by | anulada_at |

### compras_detalle
| id | compra_id | producto_id | cantidad | costo_unitario | subtotal |

### historial_costos
| id | producto_id | fecha | costo_unitario | proveedor_id | compra_id |

---

### ventas
| id | numero | cliente_id | vendedor_id | fecha | metodo_pago_id | subtotal | descuento | total | costo_total | utilidad | estado | observaciones | created_at | created_by | anulada_motivo | anulada_by | anulada_at |

### ventas_detalle
| id | venta_id | producto_id | cantidad | precio_unitario | descuento | subtotal | costo_unitario | utilidad |

---

### caja_movimientos
| id | caja_id | fecha | tipo | concepto | referencia_tipo | referencia_id | metodo_pago_id | monto | usuario_id |
(tipo: apertura, ingreso, egreso, cierre, ajuste)

### caja_sesiones
| id | caja_id | usuario_id | fecha_apertura | saldo_inicial | fecha_cierre | saldo_esperado | saldo_real | diferencia | estado | observaciones |
(estado: abierta, cerrada)

---

### comprobantes_egreso
| id | numero | fecha | beneficiario | concepto | metodo_pago_id | caja_id | valor | soporte_url | estado | created_at | created_by | anulada_motivo | anulada_by | anulada_at |

---

### inventario_movimientos
| id | fecha | producto_id | tipo | cantidad | costo_unitario | valor | saldo_cantidad | saldo_valor | costo_promedio | referencia_tipo | referencia_id | motivo | usuario_id |
(tipo: entrada, salida, ajuste)

### ajustes_inventario
| id | fecha | producto_id | cantidad_anterior | cantidad_nueva | motivo | usuario_id |

---

### facturas_telegram
| id | telegram_user_id | telegram_username | fecha | imagen_drive_id | imagen_url | ocr_texto | datos_extraidos_json | estado | compra_id | confirmada_at | confirmada_by |
(estado: pendiente, confirmada, descartada, error)

### telegram_logs
| id | fecha | telegram_user_id | tipo | comando | payload | respuesta |
(tipo: mensaje, foto, callback, comando)

### telegram_usuarios_autorizados
| telegram_id | usuario_id | autorizado_at | autorizado_by | activo |

---

### config
| clave | valor | descripcion |
(claves típicas: empresa_nombre, empresa_nit, empresa_direccion, iva_default, moneda, telegram_token, ocr_provider, ...)

### auditoria
| id | fecha | usuario_id | modulo | accion | entidad | entidad_id | detalle_json |

---

## Relaciones (resumen)

- `compras_detalle.compra_id → compras.id`
- `compras_detalle.producto_id → productos.id`
- `ventas_detalle.venta_id → ventas.id`
- `ventas_detalle.producto_id → productos.id`
- `caja_movimientos.referencia_id → ventas.id | comprobantes_egreso.id | compras.id`
- `inventario_movimientos.referencia_id → compras.id | ventas.id | ajustes_inventario.id`
- `facturas_telegram.compra_id → compras.id`
- `usuarios.rol_id → roles.id`
- `roles_permisos: muchos a muchos roles ↔ permisos`

## Reglas obligatorias

1. **Stock**: el stock vigente = `saldo_cantidad` del último `inventario_movimientos` para ese `producto_id`.
2. **Costo promedio**: se recalcula sólo en entradas (compras/ajustes positivos).
3. **Anulación**: las anulaciones generan movimientos inversos en inventario y caja, nunca se borra la fila original.
4. **Auditoría**: todo crear/editar/anular se registra en `auditoria`.

-- =====================================================================
-- 002_seed.sql — Datos de prueba
-- UUIDs fijos para poder usarlos en Postman / cURL. Idempotente.
-- =====================================================================

INSERT INTO users (id, full_name, email) VALUES
  ('8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e01', 'Ana López',     'ana.lopez@example.com'),
  ('8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e02', 'Carlos Méndez', 'carlos.mendez@example.com'),
  ('8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e03', 'María Pérez',   'maria.perez@example.com')
ON CONFLICT (id) DO NOTHING;

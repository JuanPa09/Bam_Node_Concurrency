-- =====================================================================
-- 001_schema.sql — Modelo relacional de la API de tarjetas de crédito
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- =====================================================================

-- Catálogos como tipos enumerados ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_network') THEN
    CREATE TYPE card_network AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_status') THEN
    CREATE TYPE card_status AS ENUM ('ACTIVE', 'BLOCKED', 'CANCELLED');
  END IF;
END$$;

-- Titulares de las tarjetas -------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT        NOT NULL CHECK (length(trim(full_name)) > 0),
  email       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tarjetas de crédito -------------------------------------------------
-- Nunca se guarda el número completo (PAN) ni el CVV: solo los últimos 4
-- dígitos y una huella HMAC-SHA256 para detectar duplicados.
CREATE TABLE IF NOT EXISTS credit_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  network       card_network  NOT NULL,
  last4         CHAR(4)       NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  fingerprint   CHAR(64)      NOT NULL,
  expiry_month  SMALLINT      NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year   SMALLINT      NOT NULL CHECK (expiry_year BETWEEN 2000 AND 2099),
  credit_limit  NUMERIC(12,2) NOT NULL CHECK (credit_limit >= 0),
  status        card_status   NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ   NULL      -- soft delete: NULL = vigente
);

-- Listar tarjetas vigentes de un usuario sin recorrer las eliminadas.
CREATE INDEX IF NOT EXISTS credit_cards_user_alive_idx
  ON credit_cards (user_id)
  WHERE deleted_at IS NULL;

-- Un usuario no puede tener dos veces la misma tarjeta vigente.
CREATE UNIQUE INDEX IF NOT EXISTS credit_cards_user_fingerprint_alive_uq
  ON credit_cards (user_id, fingerprint)
  WHERE deleted_at IS NULL;

-- updated_at se mantiene solo --------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS credit_cards_touch_updated_at ON credit_cards;
CREATE TRIGGER credit_cards_touch_updated_at
  BEFORE UPDATE ON credit_cards
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Seguridad en Supabase ------------------------------------------------
-- Supabase expone el esquema public por su API REST automática. Con RLS
-- activado y sin políticas, las llaves anon/publishable no pueden leer ni
-- escribir estas tablas. El backend se conecta como el rol dueño (postgres),
-- que no queda restringido por RLS.
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

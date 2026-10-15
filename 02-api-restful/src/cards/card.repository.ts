import type { Pool } from 'pg';
import type { CardNetwork } from './card-rules.ts';
import type { CardChanges, CardRecord, CardStatus, NewCard } from './card.types.ts';

/** El usuario ya tiene esta misma tarjeta vigente. */
export class DuplicateCardError extends Error {}

/** El userId no existe en la tabla users. */
export class UnknownUserError extends Error {}

/**
 * Contrato de persistencia. El servicio solo conoce esta interfaz, así que
 * en pruebas se sustituye por una implementación en memoria.
 * Todas las lecturas ignoran las tarjetas eliminadas (soft delete).
 */
export interface CardRepository {
  listAlive(): Promise<CardRecord[]>;
  findAlive(id: string): Promise<CardRecord | null>;
  userExists(userId: string): Promise<boolean>;
  /** @throws DuplicateCardError | UnknownUserError */
  create(card: NewCard): Promise<CardRecord>;
  update(id: string, changes: CardChanges): Promise<CardRecord | null>;
  softDelete(id: string): Promise<boolean>;
}

interface CardRow {
  id: string;
  user_id: string;
  network: CardNetwork;
  last4: string;
  fingerprint: string;
  expiry_month: number;
  expiry_year: number;
  credit_limit: string; // NUMERIC llega como string desde pg
  status: CardStatus;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, user_id, network, last4, fingerprint, expiry_month, expiry_year,
                 credit_limit, status, created_at, updated_at`;

function toRecord(row: CardRow): CardRecord {
  return {
    id: row.id,
    userId: row.user_id,
    network: row.network,
    last4: row.last4,
    fingerprint: row.fingerprint,
    expiryMonth: row.expiry_month,
    expiryYear: row.expiry_year,
    creditLimit: Number(row.credit_limit),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Implementación sobre PostgreSQL (Supabase). Solo SQL parametrizado. */
export class PgCardRepository implements CardRepository {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async listAlive(): Promise<CardRecord[]> {
    const { rows } = await this.#pool.query<CardRow>(
      `SELECT ${COLUMNS} FROM credit_cards
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`,
    );
    return rows.map(toRecord);
  }

  async findAlive(id: string): Promise<CardRecord | null> {
    const { rows } = await this.#pool.query<CardRow>(
      `SELECT ${COLUMNS} FROM credit_cards
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async userExists(userId: string): Promise<boolean> {
    const { rowCount } = await this.#pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
    return (rowCount ?? 0) > 0;
  }

  async create(card: NewCard): Promise<CardRecord> {
    try {
      const { rows } = await this.#pool.query<CardRow>(
        `INSERT INTO credit_cards
           (user_id, network, last4, fingerprint, expiry_month, expiry_year, credit_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [
          card.userId,
          card.network,
          card.last4,
          card.fingerprint,
          card.expiryMonth,
          card.expiryYear,
          card.creditLimit,
        ],
      );
      return toRecord(rows[0]!);
    } catch (error) {
      // 23505 = unique_violation, 23503 = foreign_key_violation
      if (pgErrorCode(error) === '23505') throw new DuplicateCardError();
      if (pgErrorCode(error) === '23503') throw new UnknownUserError();
      throw error;
    }
  }

  async update(id: string, changes: CardChanges): Promise<CardRecord | null> {
    // COALESCE conserva el valor actual cuando el campo no viene en el PATCH.
    // updated_at lo actualiza el trigger de la base de datos.
    const { rows } = await this.#pool.query<CardRow>(
      `UPDATE credit_cards
          SET credit_limit = COALESCE($2::numeric, credit_limit),
              status       = COALESCE($3::card_status, status)
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${COLUMNS}`,
      [id, changes.creditLimit ?? null, changes.status ?? null],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const { rowCount } = await this.#pool.query(
      `UPDATE credit_cards SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }
}

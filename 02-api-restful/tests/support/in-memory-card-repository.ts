import { randomUUID } from 'node:crypto';
import {
  DuplicateCardError,
  UnknownUserError,
  type CardRepository,
} from '../../src/cards/card.repository.ts';
import type { CardChanges, CardRecord, NewCard } from '../../src/cards/card.types.ts';

/** Repositorio en memoria con las mismas reglas que imponen las restricciones SQL. */
export class InMemoryCardRepository implements CardRepository {
  readonly #users: Set<string>;
  readonly #cards = new Map<string, CardRecord & { deletedAt: Date | null }>();

  constructor(userIds: string[]) {
    this.#users = new Set(userIds);
  }

  #alive(): CardRecord[] {
    return [...this.#cards.values()].filter((c) => c.deletedAt === null);
  }

  async listAlive(): Promise<CardRecord[]> {
    return this.#alive().reverse();
  }

  async findAlive(id: string): Promise<CardRecord | null> {
    return this.#alive().find((c) => c.id === id) ?? null;
  }

  async userExists(userId: string): Promise<boolean> {
    return this.#users.has(userId);
  }

  async create(card: NewCard): Promise<CardRecord> {
    if (!this.#users.has(card.userId)) throw new UnknownUserError();
    if (this.#alive().some((c) => c.userId === card.userId && c.fingerprint === card.fingerprint)) {
      throw new DuplicateCardError();
    }
    const now = new Date();
    const record = { ...card, id: randomUUID(), status: 'ACTIVE' as const, createdAt: now, updatedAt: now, deletedAt: null };
    this.#cards.set(record.id, record);
    return record;
  }

  async update(id: string, changes: CardChanges): Promise<CardRecord | null> {
    const card = this.#cards.get(id);
    if (!card || card.deletedAt) return null;
    if (changes.creditLimit !== undefined) card.creditLimit = changes.creditLimit;
    if (changes.status !== undefined) card.status = changes.status;
    card.updatedAt = new Date();
    return card;
  }

  async softDelete(id: string): Promise<boolean> {
    const card = this.#cards.get(id);
    if (!card || card.deletedAt) return false;
    card.deletedAt = new Date();
    return true;
  }
}

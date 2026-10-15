import { createHmac } from 'node:crypto';
import { ApiError } from '../http/api-error.ts';
import { inspectCard, type CardCandidate, type CardNetwork, type RuleViolation } from './card-rules.ts';
import { DuplicateCardError, UnknownUserError, type CardRepository } from './card.repository.ts';
import type { CardChanges, CardRecord, CardView } from './card.types.ts';
import type { CreateCardBody } from './card.schemas.ts';

export interface ValidationReport {
  valid: boolean;
  network: CardNetwork | null;
  violations: RuleViolation[];
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Representación pública: número enmascarado y sin huella. */
export function toView(card: CardRecord): CardView {
  return {
    id: card.id,
    userId: card.userId,
    network: card.network,
    maskedNumber: `**** **** **** ${card.last4}`,
    expiry: `${pad2(card.expiryMonth)}/${pad2(card.expiryYear % 100)}`,
    creditLimit: card.creditLimit,
    status: card.status,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

/**
 * Lógica de negocio de tarjetas. No conoce HTTP (más allá de ApiError) ni SQL.
 * `today` se inyecta para que las pruebas de vencimiento sean deterministas.
 */
export class CardService {
  readonly #repo: CardRepository;
  readonly #fingerprintSecret: string;
  readonly #today: () => Date;

  constructor(repo: CardRepository, fingerprintSecret: string, today: () => Date = () => new Date()) {
    this.#repo = repo;
    this.#fingerprintSecret = fingerprintSecret;
    this.#today = today;
  }

  async list(): Promise<CardView[]> {
    const cards = await this.#repo.listAlive();
    return cards.map(toView);
  }

  async get(id: string): Promise<CardView> {
    const card = await this.#repo.findAlive(id);
    if (!card) throw ApiError.notFound(`No existe una tarjeta activa con id ${id}`);
    return toView(card);
  }

  /** Revisa una tarjeta contra todas las reglas sin guardarla. */
  validate(candidate: CardCandidate): ValidationReport {
    const { valid, network, violations } = inspectCard(candidate, this.#today());
    return { valid, network, violations };
  }

  async create(input: CreateCardBody): Promise<CardView> {
    const inspection = inspectCard(input, this.#today());

    if (!inspection.valid || !inspection.network || !inspection.expiry) {
      throw ApiError.badRequest(
        'CARD_RULES_FAILED',
        'La tarjeta no cumple las reglas de validación',
        inspection.violations,
      );
    }

    if (!(await this.#repo.userExists(input.userId))) {
      throw this.#unknownUser(input.userId);
    }

    try {
      const card = await this.#repo.create({
        userId: input.userId,
        network: inspection.network,
        last4: inspection.digits.slice(-4),
        fingerprint: this.#fingerprint(inspection.digits),
        expiryMonth: inspection.expiry.month,
        expiryYear: inspection.expiry.year,
        creditLimit: input.creditLimit,
      });
      return toView(card);
    } catch (error) {
      if (error instanceof DuplicateCardError) {
        throw ApiError.conflict('DUPLICATE_CARD', 'El usuario ya tiene registrada esta tarjeta');
      }
      if (error instanceof UnknownUserError) throw this.#unknownUser(input.userId);
      throw error;
    }
  }

  async update(id: string, changes: CardChanges): Promise<CardView> {
    const card = await this.#repo.update(id, changes);
    if (!card) throw ApiError.notFound(`No existe una tarjeta activa con id ${id}`);
    return toView(card);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.#repo.softDelete(id);
    if (!deleted) throw ApiError.notFound(`No existe una tarjeta activa con id ${id}`);
  }

  /**
   * Huella HMAC-SHA256 del número completo. Permite detectar duplicados sin
   * guardar el PAN. No sustituye la tokenización de un proveedor PCI.
   */
  #fingerprint(digits: string): string {
    return createHmac('sha256', this.#fingerprintSecret).update(digits).digest('hex');
  }

  #unknownUser(userId: string): ApiError {
    return ApiError.badRequest('UNKNOWN_USER', `No existe un usuario con id ${userId}`, [
      { field: 'userId', message: 'El usuario no existe' },
    ]);
  }
}

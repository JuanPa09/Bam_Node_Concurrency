import type { CardNetwork } from './card-rules.ts';

export const CARD_STATUSES = ['ACTIVE', 'BLOCKED', 'CANCELLED'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

/** Tarjeta tal como la entrega el repositorio (ya en camelCase). */
export interface CardRecord {
  id: string;
  userId: string;
  network: CardNetwork;
  last4: string;
  fingerprint: string;
  expiryMonth: number;
  expiryYear: number;
  creditLimit: number;
  status: CardStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos para insertar una tarjeta. Sin PAN ni CVV. */
export type NewCard = Pick<
  CardRecord,
  'userId' | 'network' | 'last4' | 'fingerprint' | 'expiryMonth' | 'expiryYear' | 'creditLimit'
>;

/** Campos que se pueden modificar con PATCH. */
export interface CardChanges {
  creditLimit?: number | undefined;
  status?: CardStatus | undefined;
}

/** Lo que devuelve la API: nunca incluye la huella ni datos sensibles. */
export interface CardView {
  id: string;
  userId: string;
  network: CardNetwork;
  maskedNumber: string;
  expiry: string;
  creditLimit: number;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
}

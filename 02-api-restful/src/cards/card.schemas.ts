/**
 * Esquemas de entrada (forma de la solicitud). Las reglas de negocio de la
 * tarjeta (red, Luhn, vencimiento, CVV) viven en card-rules.ts.
 */
import { z } from 'zod';
import { CARD_STATUSES } from './card.types.ts';

// Mensajes por defecto de zod en español.
z.config(z.locales.es());

const required = (field: string, type: string) => ({
  error: (issue: { input: unknown }) =>
    issue.input === undefined ? `${field} es obligatorio` : `${field} debe ser ${type}`,
});

const creditLimit = z
  .number(required('creditLimit', 'un número'))
  .nonnegative('creditLimit no puede ser negativo')
  .max(9_999_999_999.99, 'creditLimit excede el máximo permitido')
  .multipleOf(0.01, 'creditLimit admite como máximo 2 decimales');

const cardFields = {
  cardNumber: z.string(required('cardNumber', 'texto')).min(1, 'cardNumber es obligatorio').max(30),
  expiry: z.string(required('expiry', 'texto con formato MM/AA')).max(10),
  cvv: z.string(required('cvv', 'texto')).min(1, 'cvv es obligatorio').max(10),
};

export const cardIdParams = z.object({
  id: z.uuid('El id debe ser un UUID válido'),
});

/** POST /credit-cards/validate: revisa la tarjeta sin guardarla. */
export const validateCardBody = z.strictObject(cardFields);

/** POST /credit-cards */
export const createCardBody = z.strictObject({
  userId: z.uuid(required('userId', 'un UUID válido')),
  ...cardFields,
  creditLimit,
});
export type CreateCardBody = z.infer<typeof createCardBody>;

/** PATCH /credit-cards/:id — solo creditLimit y/o status. */
export const updateCardBody = z
  .strictObject({
    creditLimit: creditLimit.optional(),
    status: z.enum(CARD_STATUSES, `status debe ser uno de: ${CARD_STATUSES.join(', ')}`).optional(),
  })
  .refine((body) => body.creditLimit !== undefined || body.status !== undefined, {
    message: 'Envíe al menos uno de estos campos: creditLimit, status',
  });
export type UpdateCardBody = z.infer<typeof updateCardBody>;

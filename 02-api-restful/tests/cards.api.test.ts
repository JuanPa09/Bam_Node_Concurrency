import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { CardService } from '../src/cards/card.service.ts';
import { InMemoryCardRepository } from './support/in-memory-card-repository.ts';

const USER_ID = '8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e01';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const BASE = '/api/v1/credit-cards';

const visa = {
  userId: USER_ID,
  cardNumber: '4111 1111 1111 1111',
  expiry: '12/29',
  cvv: '123',
  creditLimit: 5000,
};

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  const service = new CardService(
    new InMemoryCardRepository([USER_ID]),
    'secreto-de-prueba-con-al-menos-32-caracteres',
    () => new Date(2026, 9, 15),
  );
  app = buildApp({ cardService: service });
});

async function createCard(body: object = visa): Promise<string> {
  const res = await request(app).post(BASE).send(body).expect(201);
  return res.body.id as string;
}

describe('GET /credit-cards', () => {
  it('200 con un arreglo JSON de tarjetas activas', async () => {
    await createCard();
    const res = await request(app).get(BASE).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('no incluye tarjetas eliminadas', async () => {
    const id = await createCard();
    await request(app).delete(`${BASE}/${id}`).expect(204);
    const res = await request(app).get(BASE).expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /credit-cards', () => {
  it('201 Created, con Location y sin datos sensibles', async () => {
    const res = await request(app).post(BASE).send(visa).expect(201);
    expect(res.headers.location).toBe(`${BASE}/${res.body.id}`);
    expect(res.body).toMatchObject({
      userId: USER_ID,
      network: 'VISA',
      maskedNumber: '**** **** **** 1111',
      expiry: '12/29',
      creditLimit: 5000,
      status: 'ACTIVE',
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('4111111111111111');
    expect(raw).not.toContain('fingerprint');
    expect(raw).not.toContain('cvv');
  });

  it.each(['creditLimit', 'userId'])('400 si falta %s', async (field) => {
    const body: Record<string, unknown> = { ...visa };
    delete body[field];
    const res = await request(app).post(BASE).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.issues).toContainEqual({ field, message: `${field} es obligatorio` });
  });

  it('400 con el detalle de cada regla incumplida', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...visa, cardNumber: '378282246310005', expiry: '01/24', cvv: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('CARD_RULES_FAILED');
    expect(res.body.error.issues.map((i: { rule: string }) => i.rule)).toEqual(['expiry.expired', 'cvv.length']);
  });

  it('400 si el usuario no existe', async () => {
    const res = await request(app).post(BASE).send({ ...visa, userId: MISSING_ID }).expect(400);
    expect(res.body.error.code).toBe('UNKNOWN_USER');
  });

  it('400 si se envían campos no permitidos', async () => {
    await request(app).post(BASE).send({ ...visa, brand: 'VISA' }).expect(400);
  });

  it('409 si el usuario ya tiene esa tarjeta vigente', async () => {
    await createCard();
    const res = await request(app).post(BASE).send({ ...visa, cardNumber: '4111-1111-1111-1111' }).expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_CARD');
  });

  it('permite volver a registrar una tarjeta después de eliminarla', async () => {
    const id = await createCard();
    await request(app).delete(`${BASE}/${id}`).expect(204);
    await createCard();
  });

  it('400 con JSON malformado', async () => {
    const res = await request(app).post(BASE).set('content-type', 'application/json').send('{"userId":').expect(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});

describe('GET /credit-cards/:id', () => {
  it('200 si existe', async () => {
    const id = await createCard();
    const res = await request(app).get(`${BASE}/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('404 Not Found si no existe en BD', async () => {
    const res = await request(app).get(`${BASE}/${MISSING_ID}`).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400 si el id no es un UUID', async () => {
    await request(app).get(`${BASE}/123`).expect(400);
  });
});

describe('PATCH /credit-cards/:id', () => {
  it('200 al actualizar creditLimit y status', async () => {
    const id = await createCard();
    const res = await request(app).patch(`${BASE}/${id}`).send({ creditLimit: 8000.5, status: 'BLOCKED' }).expect(200);
    expect(res.body).toMatchObject({ creditLimit: 8000.5, status: 'BLOCKED' });
  });

  it('400 si el cuerpo está vacío', async () => {
    const id = await createCard();
    await request(app).patch(`${BASE}/${id}`).send({}).expect(400);
  });

  it('400 si intenta cambiar otros campos', async () => {
    const id = await createCard();
    await request(app).patch(`${BASE}/${id}`).send({ userId: MISSING_ID }).expect(400);
  });

  it('400 con status desconocido o límite negativo', async () => {
    const id = await createCard();
    await request(app).patch(`${BASE}/${id}`).send({ status: 'FROZEN' }).expect(400);
    await request(app).patch(`${BASE}/${id}`).send({ creditLimit: -1 }).expect(400);
  });

  it('404 si no existe', async () => {
    await request(app).patch(`${BASE}/${MISSING_ID}`).send({ status: 'BLOCKED' }).expect(404);
  });
});

describe('DELETE /credit-cards/:id', () => {
  it('204 No Content y luego 404 al consultarla (soft delete)', async () => {
    const id = await createCard();
    const res = await request(app).delete(`${BASE}/${id}`).expect(204);
    expect(res.text).toBe('');
    await request(app).get(`${BASE}/${id}`).expect(404);
  });

  it('404 si ya estaba eliminada', async () => {
    const id = await createCard();
    await request(app).delete(`${BASE}/${id}`).expect(204);
    await request(app).delete(`${BASE}/${id}`).expect(404);
  });
});

describe('POST /credit-cards/validate', () => {
  it('reporta las reglas incumplidas sin guardar nada', async () => {
    const res = await request(app)
      .post(`${BASE}/validate`)
      .send({ cardNumber: '6011111111111117', expiry: '13/30', cvv: '1234' })
      .expect(200);
    expect(res.body).toMatchObject({ valid: false, network: 'DISCOVER' });
    expect(res.body.violations.map((v: { rule: string }) => v.rule)).toEqual(['expiry.month', 'cvv.length']);
    const list = await request(app).get(BASE).expect(200);
    expect(list.body).toEqual([]);
  });

  it('valid: true para una tarjeta correcta', async () => {
    const res = await request(app)
      .post(`${BASE}/validate`)
      .send({ cardNumber: '5555555555554444', expiry: '10/26', cvv: '321' })
      .expect(200);
    expect(res.body).toEqual({ valid: true, network: 'MASTERCARD', violations: [] });
  });
});

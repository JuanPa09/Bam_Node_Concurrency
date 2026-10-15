# 2. API RESTful — Tarjetas de crédito

API financiera para administrar tarjetas de crédito y sus límites.
**Stack:** Node.js 24 · TypeScript estricto · Express 5 · PostgreSQL en Supabase (`pg`, SQL parametrizado) · zod · Vitest + supertest.

> Administra tarjetas y límites; **no** procesa pagos.

## Endpoints — `/api/v1/credit-cards`

| Método | Ruta | Éxito | Errores |
|--------|------|-------|---------|
| `GET` | `/credit-cards` | **200** arreglo JSON de tarjetas activas | — |
| `GET` | `/credit-cards/:id` | **200** | **404** si no existe en BD · 400 si el id no es UUID |
| `POST` | `/credit-cards` | **201** + header `Location` | **400** si falta `creditLimit` o `userId`, si la tarjeta incumple una regla o si el usuario no existe · 409 si el usuario ya tiene esa tarjeta |
| `PATCH` | `/credit-cards/:id` | **200** (actualiza `creditLimit` y/o `status`) | 400 · 404 |
| `DELETE` | `/credit-cards/:id` | **204** sin cuerpo (soft delete) | 404 |
| `POST` | `/credit-cards/validate` | **200** reporte de reglas, **sin guardar** | 400 si falta un campo |

"Activas" = no eliminadas (`deleted_at IS NULL`). Los estados posibles son `ACTIVE`, `BLOCKED` y `CANCELLED`.

### Crear una tarjeta

```bash
curl -i -X POST http://localhost:3000/api/v1/credit-cards \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e01",
    "cardNumber": "4111 1111 1111 1111",
    "expiry": "12/29",
    "cvv": "123",
    "creditLimit": 5000
  }'
```

```json
{
  "id": "9b1e1008-b6c3-49c1-a028-44a594e18248",
  "userId": "8f6d3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e01",
  "network": "VISA",
  "maskedNumber": "**** **** **** 1111",
  "expiry": "12/29",
  "creditLimit": 5000,
  "status": "ACTIVE",
  "createdAt": "2026-10-15T22:25:48.659Z",
  "updatedAt": "2026-10-15T22:25:48.659Z"
}
```

### Formato de error

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "La solicitud contiene datos inválidos",
    "issues": [
      { "field": "userId", "message": "userId es obligatorio" },
      { "field": "creditLimit", "message": "creditLimit es obligatorio" }
    ]
  }
}
```

Códigos: `VALIDATION_FAILED`, `CARD_RULES_FAILED`, `UNKNOWN_USER`, `MALFORMED_JSON`, `NOT_FOUND`, `DUPLICATE_CARD`, `INTERNAL_ERROR`.

## Reglas de validación de tarjetas

Definidas como **datos** en [`src/cards/card-rules.ts`](src/cards/card-rules.ts): agregar una red es agregar una fila.

| Red | Inicio (prefijo) | Longitud | Código de seguridad |
|-----|------------------|----------|---------------------|
| Visa | `4` | 13, 16, 19 | CVV · 3 dígitos |
| Mastercard | `51`–`55` o `222100`–`272099` | 16 | CVC · 3 dígitos |
| American Express | `34` o `37` | 15 | CID · 4 dígitos |
| Discover | `6011`, `65`, `644`–`649` | 16, 19 | CID · 3 dígitos |

Además se verifica el **dígito de control (Luhn)** y que la fecha `MM/AA` tenga formato válido, mes entre 01 y 12, y **no esté vencida** (la tarjeta vale hasta el último día de su mes).

**No se detiene en el primer error:** devuelve *todas* las reglas incumplidas, con un id estable (`rule`) y un mensaje que dice qué se esperaba y qué llegó:

```bash
curl -s -X POST http://localhost:3000/api/v1/credit-cards/validate \
  -H 'Content-Type: application/json' \
  -d '{ "cardNumber": "3782822463100051", "expiry": "13/20", "cvv": "12a" }'
```

```json
{
  "valid": false,
  "network": "AMEX",
  "violations": [
    { "field": "cardNumber", "rule": "number.length", "message": "American Express requiere 15 dígitos; se recibieron 16" },
    { "field": "cardNumber", "rule": "number.luhn",   "message": "El número no supera la verificación del dígito de control (algoritmo de Luhn)" },
    { "field": "expiry",     "rule": "expiry.month",  "message": "El mes de vencimiento debe estar entre 01 y 12; se recibió 13" },
    { "field": "cvv",        "rule": "cvv.format",    "message": "El código de seguridad solo puede contener dígitos" }
  ]
}
```

La suite [`tests/card-rules.test.ts`](tests/card-rules.test.ts) documenta cada caso que **no** cumple las reglas (límites de rangos de prefijos, longitudes, CVV por red, fechas vencidas, etc.).

## Modelo relacional

```
users                          credit_cards
─────────────────────          ──────────────────────────────────────────
id          UUID  PK  ◄──┐     id            UUID  PK
full_name   TEXT         └──── user_id       UUID  FK -> users.id
email       TEXT  UNIQUE       network       card_network  (VISA|MASTERCARD|AMEX|DISCOVER)
created_at  TIMESTAMPTZ        last4         CHAR(4)
                               fingerprint   CHAR(64)      HMAC-SHA256 del número
                               expiry_month  SMALLINT      1..12
                               expiry_year   SMALLINT
                               credit_limit  NUMERIC(12,2) >= 0
                               status        card_status   (ACTIVE|BLOCKED|CANCELLED)
                               created_at / updated_at (trigger) / deleted_at (soft delete)
```

- Índice único parcial `(user_id, fingerprint) WHERE deleted_at IS NULL`: un usuario no puede repetir una tarjeta vigente, pero puede volver a registrarla después de eliminarla.
- `updated_at` lo mantiene un trigger.
- **RLS activado** en ambas tablas: la API REST automática de Supabase no las expone con las llaves públicas. El backend se conecta como el rol dueño.

Scripts: [`db/001_schema.sql`](db/001_schema.sql) (estructura) y [`db/002_seed.sql`](db/002_seed.sql) (3 usuarios de prueba con UUID fijos). Ambos son idempotentes.

## Seguridad

- El **número completo y el CVV nunca se guardan ni se devuelven**: solo `last4` y una huella HMAC-SHA256 con un secreto del servidor (para detectar duplicados).
- SQL 100 % parametrizado, cuerpo limitado a 10 KB y esquemas estrictos que rechazan campos desconocidos.
- Los errores inesperados se registran en el servidor pero no se filtran al cliente.
- Pendiente para producción: autenticación, tokenización con un proveedor PCI DSS y verificación del certificado TLS de Supabase (`DATABASE_CA_CERT`).

## Ejecutar

```bash
cp .env.example .env     # completar DATABASE_URL y CARD_FINGERPRINT_SECRET
npm run db:migrate       # aplica db/*.sql en Supabase (o pegarlos en el SQL Editor)
npm run dev              # http://localhost:3000/api/v1/credit-cards
npm test                 # 65 pruebas, no necesitan base de datos
```

`DATABASE_URL` sale de Supabase → botón **Connect** → **Session pooler** (puerto 5432, funciona con IPv4).

## Probar con Postman o REST Client

- [`docs/postman_collection.json`](docs/postman_collection.json): importar en Postman. La carpeta *Flujo feliz* recorre los 5 endpoints en orden y guarda el id creado; *Errores del contrato* y *Reglas de tarjeta* cubren los casos de fallo.
- [`docs/requests.http`](docs/requests.http): para la extensión REST Client de VS Code.

## Arquitectura

```
src/
├── server.ts               arranque, inyección de dependencias y apagado ordenado
├── app.ts                  buildApp(): Express sin abrir el puerto (para supertest)
├── config.ts               variables de entorno validadas con zod
├── db.ts                   pool de conexiones a Supabase (TLS)
├── http/                   ApiError, middleware de validación y de errores
└── cards/
    ├── card-rules.ts       reglas de red, Luhn, vencimiento y CVV (sin dependencias)
    ├── card.schemas.ts     forma de las solicitudes (zod)
    ├── card.service.ts     lógica de negocio (CardService)
    ├── card.repository.ts  interfaz CardRepository + PgCardRepository
    └── card.router.ts      rutas HTTP
```

El servicio depende de la **interfaz** `CardRepository`. En producción recibe `PgCardRepository`; en las pruebas, un repositorio en memoria ([`tests/support`](tests/support)). Así los 5 endpoints se prueban sin base de datos.

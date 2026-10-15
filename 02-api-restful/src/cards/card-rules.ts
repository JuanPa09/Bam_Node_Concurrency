/**
 * Reglas de validación de tarjetas.
 *
 * Las redes se describen como DATOS (prefijos, longitudes y largo del código
 * de seguridad) en lugar de una cadena de if/else. Agregar una red nueva es
 * agregar una fila a NETWORK_RULES.
 *
 * `inspectCard` no se detiene en el primer error: devuelve TODAS las reglas
 * incumplidas para mostrar con claridad por qué una tarjeta no es válida.
 *
 * Alcance: se valida formato, red, longitud, dígito verificador (Luhn),
 * vencimiento y código de seguridad. NO se verifica con el emisor que la
 * tarjeta exista ni que tenga fondos.
 */

export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER';

export interface NetworkRule {
  network: CardNetwork;
  label: string;
  /** Rangos de prefijo inclusivos. [51, 55] = empieza con 51..55. */
  prefixes: ReadonlyArray<readonly [number, number]>;
  lengths: readonly number[];
  securityCode: { name: string; digits: number };
}

export const NETWORK_RULES: readonly NetworkRule[] = [
  {
    network: 'VISA',
    label: 'Visa',
    prefixes: [[4, 4]],
    lengths: [13, 16, 19],
    securityCode: { name: 'CVV', digits: 3 },
  },
  {
    network: 'MASTERCARD',
    label: 'Mastercard',
    prefixes: [[51, 55], [222100, 272099]],
    lengths: [16],
    securityCode: { name: 'CVC', digits: 3 },
  },
  {
    network: 'AMEX',
    label: 'American Express',
    prefixes: [[34, 34], [37, 37]],
    lengths: [15],
    securityCode: { name: 'CID', digits: 4 },
  },
  {
    network: 'DISCOVER',
    label: 'Discover',
    prefixes: [[6011, 6011], [65, 65], [644, 649]],
    lengths: [16, 19],
    securityCode: { name: 'CID', digits: 3 },
  },
];

/** Identificador estable de cada regla (útil para clientes y pruebas). */
export type RuleId =
  | 'number.format'
  | 'number.network'
  | 'number.length'
  | 'number.luhn'
  | 'expiry.format'
  | 'expiry.month'
  | 'expiry.expired'
  | 'cvv.format'
  | 'cvv.length';

export interface RuleViolation {
  field: 'cardNumber' | 'expiry' | 'cvv';
  rule: RuleId;
  message: string;
}

export interface CardCandidate {
  cardNumber: string;
  /** Formato MM/AA, por ejemplo "08/28". */
  expiry: string;
  cvv: string;
}

export interface CardInspection {
  valid: boolean;
  network: CardNetwork | null;
  /** Número sin espacios ni guiones (solo vive en memoria). */
  digits: string;
  expiry: { month: number; year: number } | null;
  violations: RuleViolation[];
}

const ONLY_DIGITS = /^\d+$/;
const EXPIRY_FORMAT = /^(\d{2})\/(\d{2})$/;

/** Quita espacios y guiones que el usuario suele escribir entre bloques. */
export function normalizeCardNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

/** Encuentra la red cuyo rango de prefijos contiene el número. */
export function detectNetwork(digits: string): NetworkRule | null {
  return (
    NETWORK_RULES.find((rule) =>
      rule.prefixes.some(([from, to]) => {
        const size = String(from).length;
        if (digits.length < size) return false;
        const prefix = Number(digits.slice(0, size));
        return prefix >= from && prefix <= to;
      }),
    ) ?? null
  );
}

/** Algoritmo de Luhn (mod 10) sobre una cadena de solo dígitos. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Una tarjeta es válida hasta el último día de su mes de vencimiento. */
function isExpired(month: number, year: number, today: Date): boolean {
  const firstDayAfterExpiry = new Date(year, month, 1); // mes 0-indexado => mes siguiente
  return today.getTime() >= firstDayAfterExpiry.getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function inspectCard(candidate: CardCandidate, today: Date = new Date()): CardInspection {
  const violations: RuleViolation[] = [];
  const digits = normalizeCardNumber(candidate.cardNumber);

  // --- Número --------------------------------------------------------
  let rule: NetworkRule | null = null;

  if (!ONLY_DIGITS.test(digits)) {
    violations.push({
      field: 'cardNumber',
      rule: 'number.format',
      message: 'El número solo puede contener dígitos (se permiten espacios o guiones entre bloques)',
    });
  } else {
    rule = detectNetwork(digits);

    if (rule === null) {
      violations.push({
        field: 'cardNumber',
        rule: 'number.network',
        message:
          'El prefijo no corresponde a ninguna red soportada (Visa 4, Mastercard 51-55 / 222100-272099, ' +
          'American Express 34 / 37, Discover 6011 / 65 / 644-649)',
      });
    } else if (!rule.lengths.includes(digits.length)) {
      violations.push({
        field: 'cardNumber',
        rule: 'number.length',
        message: `${rule.label} requiere ${rule.lengths.join(' o ')} dígitos; se recibieron ${digits.length}`,
      });
    }

    if (!passesLuhn(digits)) {
      violations.push({
        field: 'cardNumber',
        rule: 'number.luhn',
        message: 'El número no supera la verificación del dígito de control (algoritmo de Luhn)',
      });
    }
  }

  // --- Vencimiento ---------------------------------------------------
  let expiry: CardInspection['expiry'] = null;
  const match = EXPIRY_FORMAT.exec(candidate.expiry.trim());

  if (match === null) {
    violations.push({
      field: 'expiry',
      rule: 'expiry.format',
      message: `La fecha de vencimiento debe tener formato MM/AA; se recibió "${candidate.expiry}"`,
    });
  } else {
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);

    if (month < 1 || month > 12) {
      violations.push({
        field: 'expiry',
        rule: 'expiry.month',
        message: `El mes de vencimiento debe estar entre 01 y 12; se recibió ${match[1]}`,
      });
    } else {
      expiry = { month, year };
      if (isExpired(month, year, today)) {
        const lastDay = new Date(year, month, 0).getDate();
        violations.push({
          field: 'expiry',
          rule: 'expiry.expired',
          message: `La tarjeta venció el ${lastDay}/${pad2(month)}/${year}`,
        });
      }
    }
  }

  // --- Código de seguridad -------------------------------------------
  const cvv = candidate.cvv.trim();

  if (!ONLY_DIGITS.test(cvv)) {
    violations.push({
      field: 'cvv',
      rule: 'cvv.format',
      message: 'El código de seguridad solo puede contener dígitos',
    });
  } else if (rule !== null && cvv.length !== rule.securityCode.digits) {
    const { name, digits: expected } = rule.securityCode;
    violations.push({
      field: 'cvv',
      rule: 'cvv.length',
      message: `${rule.label} usa ${name} de ${expected} dígitos; se recibieron ${cvv.length}`,
    });
  } else if (rule === null && (cvv.length < 3 || cvv.length > 4)) {
    violations.push({
      field: 'cvv',
      rule: 'cvv.length',
      message: `El código de seguridad debe tener 3 o 4 dígitos; se recibieron ${cvv.length}`,
    });
  }

  return {
    valid: violations.length === 0,
    network: rule?.network ?? null,
    digits,
    expiry,
    violations,
  };
}

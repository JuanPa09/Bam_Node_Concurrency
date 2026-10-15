import { describe, expect, it } from 'vitest';
import { detectNetwork, inspectCard, passesLuhn, type RuleId } from '../src/cards/card-rules.ts';

// Fecha fija para que las pruebas de vencimiento no dependan del día real.
const TODAY = new Date(2026, 9, 15); // 15 de octubre de 2026

const ok = { expiry: '12/29', cvv: '123' };

function rulesOf(cardNumber: string, expiry = ok.expiry, cvv = ok.cvv): RuleId[] {
  return inspectCard({ cardNumber, expiry, cvv }, TODAY).violations.map((v) => v.rule);
}

describe('detección de red por prefijo (tabla del profe)', () => {
  it.each([
    ['4111111111111111', 'VISA', 'empieza con 4'],
    ['5555555555554444', 'MASTERCARD', 'rango 51-55'],
    ['2221000000000009', 'MASTERCARD', 'inicio del rango 222100'],
    ['2720990000000007', 'MASTERCARD', 'fin del rango 272099'],
    ['378282246310005', 'AMEX', 'empieza con 37'],
    ['341111111111111', 'AMEX', 'empieza con 34'],
    ['6011111111111117', 'DISCOVER', 'empieza con 6011'],
    ['6500000000000002', 'DISCOVER', 'empieza con 65'],
    ['6440000000000005', 'DISCOVER', 'inicio del rango 644'],
    ['6499999999999996', 'DISCOVER', 'fin del rango 649'],
  ])('%s -> %s (%s)', (number, network) => {
    expect(detectNetwork(number)?.network).toBe(network);
  });

  it.each([
    ['2220990000000000', 'justo antes de 222100'],
    ['2721000000000000', 'justo después de 272099'],
    ['5600000000000000', '56 no es Mastercard'],
    ['6430000000000000', '643 está fuera de 644-649'],
    ['30569309025904', 'Diners Club no está soportada'],
  ])('%s no pertenece a ninguna red (%s)', (number) => {
    expect(detectNetwork(number)).toBeNull();
  });
});

describe('algoritmo de Luhn', () => {
  it('acepta números de prueba conocidos', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('378282246310005')).toBe(true);
  });

  it('rechaza un número con el último dígito alterado', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);
  });
});

describe('tarjetas válidas', () => {
  it.each([
    ['Visa 16', '4111 1111 1111 1111', '123'],
    ['Visa 13', '4222222222222', '123'],
    ['Visa 19', '4111111111111111110', '123'],
    ['Mastercard', '5555-5555-5555-4444', '123'],
    ['Mastercard serie 2', '2223003122003222', '123'],
    ['American Express (CID 4)', '3782 822463 10005', '1234'],
    ['Discover', '6011111111111117', '123'],
  ])('%s', (_label, cardNumber, cvv) => {
    const result = inspectCard({ cardNumber, expiry: '12/29', cvv }, TODAY);
    expect(result.violations).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('el mes de vencimiento en curso todavía es válido', () => {
    expect(rulesOf('4111111111111111', '10/26')).toEqual([]);
  });
});

describe('casos que NO cumplen las reglas', () => {
  it.each<[string, string, string, string, RuleId[]]>([
    // descripción, número, expiry, cvv, reglas esperadas
    ['letras en el número', '4111abcd11111111', '12/29', '123', ['number.format']],
    ['red no soportada', '30569309025904', '12/29', '123', ['number.network']],
    ['Visa con 15 dígitos', '411111111111116', '12/29', '123', ['number.length']],
    ['Amex con 16 dígitos', '3782822463100051', '12/29', '1234', ['number.length', 'number.luhn']],
    ['Mastercard con dígito de control alterado', '5555555555554443', '12/29', '123', ['number.luhn']],
    ['fecha sin formato MM/AA', '4111111111111111', '2029-12', '123', ['expiry.format']],
    ['mes 13', '4111111111111111', '13/29', '123', ['expiry.month']],
    ['mes 00', '4111111111111111', '00/29', '123', ['expiry.month']],
    ['vencida el mes pasado', '4111111111111111', '09/26', '123', ['expiry.expired']],
    ['vencida hace años', '4111111111111111', '01/20', '123', ['expiry.expired']],
    ['CVV con letras', '4111111111111111', '12/29', '12a', ['cvv.format']],
    ['Visa con CVV de 4', '4111111111111111', '12/29', '1234', ['cvv.length']],
    ['Mastercard con CVC de 2', '5555555555554444', '12/29', '12', ['cvv.length']],
    ['Amex con CID de 3', '378282246310005', '12/29', '123', ['cvv.length']],
    ['Discover con CID de 4', '6011111111111117', '12/29', '1234', ['cvv.length']],
  ])('%s', (_label, cardNumber, expiry, cvv, expected) => {
    const result = inspectCard({ cardNumber, expiry, cvv }, TODAY);
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.rule)).toEqual(expected);
  });

  it('reporta todas las reglas incumplidas a la vez, no solo la primera', () => {
    const result = inspectCard({ cardNumber: '3782822463100051', expiry: '01/24', cvv: '12' }, TODAY);
    expect(result.violations.map((v) => v.rule)).toEqual([
      'number.length',
      'number.luhn',
      'expiry.expired',
      'cvv.length',
    ]);
  });

  it('los mensajes explican qué se esperaba y qué se recibió', () => {
    const [violation] = inspectCard({ cardNumber: '378282246310005', expiry: '12/29', cvv: '123' }, TODAY).violations;
    expect(violation?.message).toBe('American Express usa CID de 4 dígitos; se recibieron 3');
  });
});

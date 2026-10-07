import {
  formatLocalPhone,
  isValidCedula,
  normalizeEcPhone,
  normalizeName,
  validateRegistration,
} from './registration';

describe('isValidCedula', () => {
  it('accepts valid cédulas, including ones with a leading zero', () => {
    expect(isValidCedula('1710034065')).toBe(true);
    expect(isValidCedula('0912345675')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidCedula('0912345678')).toBe(false);
  });

  it('rejects invalid province, third digit or length', () => {
    expect(isValidCedula('2512345678')).toBe(false);
    expect(isValidCedula('0962345675')).toBe(false);
    expect(isValidCedula('091234567')).toBe(false);
    expect(isValidCedula('09123456755')).toBe(false);
    expect(isValidCedula('09123a5675')).toBe(false);
  });
});

describe('normalizeEcPhone', () => {
  it.each([
    ['0991234567'],
    ['099 123 4567'],
    ['+593 99 123 4567'],
    ['593991234567'],
    ['991234567'],
  ])('normalizes %s to E.164', (input) => {
    expect(normalizeEcPhone(input)).toBe('+593991234567');
  });

  it('rejects landlines and short numbers', () => {
    expect(normalizeEcPhone('042123456')).toBeNull();
    expect(normalizeEcPhone('09912345')).toBeNull();
  });

  it('formats back to local style', () => {
    expect(formatLocalPhone('+593983120430')).toBe('098 312 0430');
  });
});

describe('normalizeName', () => {
  it('trims, collapses spaces and capitalizes', () => {
    expect(normalizeName('  maría   JOSÉ  pérez ')).toBe('María José Pérez');
    expect(normalizeName("o'connor ñuñez")).toBe("O'Connor Ñuñez");
  });
});

describe('validateRegistration', () => {
  it('returns normalized data for valid input', () => {
    const result = validateRegistration({
      fullName: 'ana lucía torres',
      cedula: '0912345675',
      phone: '099 123 4567',
    });
    expect(result).toEqual({
      ok: true,
      data: { fullName: 'Ana Lucía Torres', cedula: '0912345675', phone: '+593991234567' },
    });
  });

  it('requires at least first and last name', () => {
    const result = validateRegistration({ fullName: 'Ana', cedula: '0912345675', phone: '0991234567' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.fullName).toBeTruthy();
  });

  it('reports every invalid field', () => {
    const result = validateRegistration({ fullName: '', cedula: '123', phone: 'abc' });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['cedula', 'fullName', 'phone']);
  });
});

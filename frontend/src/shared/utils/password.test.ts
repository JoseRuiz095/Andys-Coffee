import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES, isValidEmail, validatePassword } from './password'

describe('validatePassword', () => {
  it('accepts a password with a letter and a number, as typed (spaces included)', () => {
    expect(validatePassword('Clave1234 ')).toBeNull()
    expect(validatePassword(' abcdefg1')).toBeNull()
  })

  it('rejects empty, short, too long and missing letter or number', () => {
    expect(validatePassword('')).toBe('Ingresa una contraseña.')
    expect(validatePassword('abc1')).toMatch(/al menos 8/)
    expect(validatePassword(`a1${'x'.repeat(71)}`)).toMatch(/72/)
    expect(validatePassword('abcdefgh')).toMatch(/una letra y un número/)
    expect(validatePassword('12345678')).toMatch(/una letra y un número/)
  })

  it('the checklist rules agree with the validation', () => {
    const password = 'abcdefg1'
    expect(PASSWORD_RULES.every((rule) => rule.test(password))).toBe(true)
    expect(PASSWORD_RULES.find((rule) => rule.id === 'number')?.test('abcdefgh')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('checks the basic shape', () => {
    expect(isValidEmail('ana@andys.mx')).toBe(true)
    expect(isValidEmail('ana@andys')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

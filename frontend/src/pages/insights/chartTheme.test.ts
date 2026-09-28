import { describe, expect, it } from 'vitest'
import { formatNotaDe10, notaTooltipFormatter } from './chartTheme'

describe('formatNotaDe10', () => {
  it('formata a média com uma casa sobre 10', () => {
    expect(formatNotaDe10(7.46)).toBe('7,5/10')
    expect(formatNotaDe10(10)).toBe('10,0/10')
  })

  it('mostra "—" sem valor', () => {
    expect(formatNotaDe10(null)).toBe('—')
    expect(formatNotaDe10(undefined)).toBe('—')
  })
})

describe('notaTooltipFormatter', () => {
  it('formata números e trata o resto como ausente', () => {
    expect(notaTooltipFormatter(6)).toBe('6,0/10')
    expect(notaTooltipFormatter(null)).toBe('—')
    expect(notaTooltipFormatter('6')).toBe('—')
  })
})

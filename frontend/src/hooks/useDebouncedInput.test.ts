import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedInput } from './useDebouncedInput'

const DELAY = 300

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(committed = '') {
  const onCommit = vi.fn()
  const hook = renderHook(({ value }) => useDebouncedInput(value, onCommit, DELAY), {
    initialProps: { value: committed },
  })
  return { ...hook, onCommit }
}

describe('useDebouncedInput', () => {
  it('o rascunho começa com o valor confirmado', () => {
    const { result } = setup('alien')

    expect(result.current[0]).toBe('alien')
  })

  it('atualiza o rascunho na hora e confirma só depois do atraso', () => {
    const { result, onCommit } = setup()

    act(() => result.current[1]('ali'))
    expect(result.current[0]).toBe('ali')
    act(() => vi.advanceTimersByTime(DELAY - 1))
    expect(onCommit).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('ali')
  })

  it('digitação contínua gera uma única confirmação com o texto final', () => {
    const { result, onCommit } = setup()

    for (const texto of ['a', 'al', 'ali']) {
      act(() => result.current[1](texto))
      act(() => vi.advanceTimersByTime(100))
    }
    act(() => vi.advanceTimersByTime(DELAY))

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('ali')
  })

  it('não confirma quando o rascunho volta ao valor já confirmado', () => {
    const { result, onCommit } = setup('alien')

    act(() => result.current[1]('alie'))
    act(() => result.current[1]('alien'))
    act(() => vi.advanceTimersByTime(DELAY))

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('mudança externa do valor confirmado substitui o rascunho sem reconfirmar o antigo', () => {
    const { result, rerender, onCommit } = setup('alien')

    act(() => result.current[1]('alienígena'))
    rerender({ value: '' })
    expect(result.current[0]).toBe('')

    act(() => vi.advanceTimersByTime(DELAY * 2))
    expect(onCommit).not.toHaveBeenCalled()
  })

  describe('com toCommitted (rascunho que vira outro valor confirmado)', () => {
    // Como no ano: texto inválido confirma "sem filtro" ('').
    const toCommitted = (texto: string) => (/^\d{4}$/.test(texto) ? texto : '')

    function setupNormalized(committed: string) {
      const onCommit = vi.fn()
      const hook = renderHook(
        ({ value }) => useDebouncedInput(value, onCommit, DELAY, toCommitted),
        { initialProps: { value: committed } },
      )
      return { ...hook, onCommit }
    }

    it('confirma quando o valor equivalente difere do confirmado', () => {
      const { result, onCommit } = setupNormalized('1994')

      act(() => result.current[1]('19'))
      act(() => vi.advanceTimersByTime(DELAY))

      expect(onCommit).toHaveBeenCalledExactlyOnceWith('19')
    })

    it('mantém o rascunho quando a mudança confirmada é a que ele produz', () => {
      const { result, rerender } = setupNormalized('1994')

      act(() => result.current[1]('19'))
      rerender({ value: '' })

      expect(result.current[0]).toBe('19')
    })

    it('substitui o rascunho quando a mudança confirmada vem de fora', () => {
      const { result, rerender } = setupNormalized('')

      act(() => result.current[1]('19'))
      rerender({ value: '2020' })

      expect(result.current[0]).toBe('2020')
    })

    it('não confirma rascunho cujo valor equivalente já é o confirmado', () => {
      const { result, onCommit } = setupNormalized('')

      act(() => result.current[1]('19'))
      act(() => vi.advanceTimersByTime(DELAY))

      expect(onCommit).not.toHaveBeenCalled()
    })
  })

  it('informa se o rascunho já assentou (passou o atraso sem digitação)', () => {
    const { result } = setup('')
    expect(result.current[2]).toBe(true)

    act(() => result.current[1]('19'))
    expect(result.current[2]).toBe(false)

    act(() => vi.advanceTimersByTime(DELAY))
    expect(result.current[2]).toBe(true)
  })

  it('não repete a confirmação quando o valor confirmado fica diferente do rascunho', () => {
    // Ex.: o ano "01979" é confirmado como 1979; o rascunho continua "01979".
    const { result, rerender, onCommit } = setup('')

    act(() => result.current[1]('01979'))
    act(() => vi.advanceTimersByTime(DELAY))
    rerender({ value: '' })
    rerender({ value: '' })

    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})

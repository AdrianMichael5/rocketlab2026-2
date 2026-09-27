import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_NAME, usePageTitle } from './usePageTitle'

afterEach(() => {
  document.title = ''
})

describe('usePageTitle', () => {
  it('põe o título da página antes do nome da aplicação', () => {
    renderHook(() => usePageTitle('Novo filme'))

    expect(document.title).toBe(`Novo filme · ${APP_NAME}`)
  })

  it('usa só o nome da aplicação enquanto o título não é conhecido', () => {
    renderHook(() => usePageTitle(null))

    expect(document.title).toBe(APP_NAME)
  })

  it('acompanha mudanças do título', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: null as string | null },
    })

    rerender({ title: 'Alien' })

    expect(document.title).toBe(`Alien · ${APP_NAME}`)
  })
})

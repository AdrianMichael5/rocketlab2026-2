import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { MOCK_POSTER_URL } from '../../stories/fixtures/movies'
import { withQueryClient } from '../../stories/fixtures/withQueryClient'
import { MovieForm } from './MovieForm'
import { EMPTY_MOVIE_FORM, type MovieFormValues } from './movieFormModel'

const FILLED: MovieFormValues = {
  titulo: 'Alien, o Oitavo Passageiro',
  diretores: ['Ridley Scott'],
  ano_lancamento: '1979',
  data_lancamento: '1979-05-25',
  generos: ['Ficção científica', 'Horror'],
  duracao_minutos: '117',
  status_filme: 'Lançado',
  sinopse: 'A tripulação da nave Nostromo recebe um sinal misterioso de um planeta distante.',
  url_poster: MOCK_POSTER_URL,
}

/** Formulário de cadastro/edição. Gêneros vêm do cache mockado; nada chama a API. */
const meta = {
  title: 'Pages/MovieForm',
  component: MovieForm,
  decorators: [withQueryClient],
  args: {
    initial: EMPTY_MOVIE_FORM,
    submitLabel: 'Cadastrar filme',
    cancelTo: '/',
    // Salvar "dá certo" na hora; a ação aparece na aba Actions.
    onSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof MovieForm>

export default meta
type Story = StoryObj<typeof meta>

export const Vazio: Story = {}

export const Preenchido: Story = {
  args: { initial: FILLED, submitLabel: 'Salvar alterações' },
}

/** Valores inválidos + envio: as mensagens vêm da validação real do formulário. */
export const ComErrosDeValidacao: Story = {
  args: {
    initial: {
      ...FILLED,
      titulo: '',
      ano_lancamento: '1500',
      data_lancamento: '',
      duracao_minutos: 'duas horas',
      url_poster: 'poster.jpg',
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Cadastrar filme' }))

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    )
    await expect(canvas.getByText('Informe o título.')).toBeVisible()
    await expect(canvas.getByText('O ano deve estar entre 1888 e 2100.')).toBeVisible()
    await expect(canvas.getByText('Informe um número inteiro de 0 a 1000.')).toBeVisible()
    await expect(
      canvas.getByText('Informe uma URL http(s) completa (ex.: https://…).'),
    ).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

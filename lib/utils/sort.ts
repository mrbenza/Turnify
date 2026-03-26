const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' })

/** Ordina un array di oggetti per il campo `nome` con ordinamento naturale (Area1, Area2, …, Area10). */
export function sortByNome<T extends { nome: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.nome, b.nome))
}

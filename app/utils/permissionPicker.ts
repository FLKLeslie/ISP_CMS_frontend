// The logic behind the permission picker, as plain functions so it can be tested
// (npm run check:access). The rule the picker enforces for the person using it:
//
//   * ticking a permission also ticks everything it needs (you can't "record payments"
//     without being able to see payments, customers and subscriptions), and
//   * unticking one also unticks everything that needs it.
//
// The server applies the first rule too (accounts/access.py: normalize), so an account can
// never end up half-working whatever a client sends; this just makes it visible while choosing.
import type { PermissionInfo } from '~/types/api/superadmin'

/** `keys` plus everything they require, transitively - returned in catalog order. */
export function withRequirements(keys: Iterable<string>, catalog: readonly PermissionInfo[]): string[] {
  const byKey = new Map(catalog.map((p) => [p.key, p]))
  const result = new Set<string>()
  const pending = [...keys].filter((k) => byKey.has(k))
  while (pending.length) {
    const key = pending.pop() as string
    if (result.has(key)) continue
    result.add(key)
    pending.push(...(byKey.get(key)?.requires ?? []))
  }
  return catalog.map((p) => p.key).filter((k) => result.has(k))
}

/** Every permission that needs `key`, directly or through another one. */
export function dependentsOf(key: string, catalog: readonly PermissionInfo[]): string[] {
  const found = new Set<string>()
  let grew = true
  while (grew) {
    grew = false
    for (const p of catalog) {
      if (found.has(p.key)) continue
      if (p.requires.includes(key) || p.requires.some((r) => found.has(r))) { found.add(p.key); grew = true }
    }
  }
  return catalog.map((p) => p.key).filter((k) => found.has(k))
}

/** The selection after ticking or unticking `key`, with the knock-on changes applied. */
export function toggled(selected: readonly string[], key: string, on: boolean, catalog: readonly PermissionInfo[]): string[] {
  if (on) return withRequirements([...selected, key], catalog)
  const removed = new Set([key, ...dependentsOf(key, catalog)])
  return withRequirements(selected.filter((k) => !removed.has(k)), catalog)
}

/** Do two selections hold exactly the same permissions? (order doesn't matter) */
export function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set([...a, ...b]).size === a.length
}

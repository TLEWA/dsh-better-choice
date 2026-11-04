/**
 * Dev-only shim for `@deepseek-ai/dsh-client-ui-slots`. The published package
 * ships typings that import `./contract.ts` / `./renderer.ts` sources it does
 * not include, so TypeScript cannot resolve the module from npm. These shapes
 * mirror the runtime services this plugin touches; the file is excluded from
 * the published artifacts (`files` only ships `lib`).
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** Slot contract table; owners extend it through declaration merging. */
  export interface SlotMap {}

  /** Locale namespace table; dictionary owners extend it the same way. */
  export interface LocaleNamespaceMap {}

  /** One slot registration definition (only the fields this plugin sets). */
  export interface SlotEntryDef {
    name: string
    priority?: number
    select?: (owner: { pendingInteraction?: unknown }) => unknown
    locale?: string
    store?: unknown
  }

  /** The slot registry service exposed on the client context. */
  export interface SlotRegistry {
    inject(name: string, factory: () => () => void): () => void
    register(definition: SlotEntryDef, component?: unknown): () => void
  }
}

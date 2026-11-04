/**
 * Dev-only context augmentation for the two client services this plugin
 * injects. The runtime packages register themselves through services that the
 * npm typings do not expose (their declaration entry does not resolve), so a
 * minimal, faithful augmentation lives here to let `tsc --noEmit` check the
 * plugin itself. Excluded from published artifacts.
 */
import type {} from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Slot registry: contributes components to declared slot chains. */
    slots: import('@deepseek-ai/dsh-client-ui-slots').SlotRegistry
    /** Locale registry: contributes dictionaries for one namespace. */
    locale: {
      register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
    }
  }
}

// Type-only side-effect imports: pull the real client contract augmentations
// (Context.slots / Context.locale, SlotMap, LocaleNamespaceMap) from the
// packages that own them, instead of redeclaring them in local shims.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

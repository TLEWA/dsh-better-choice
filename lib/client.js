window.__ModuleLoader__.load({
  id: "dsh-better-choice",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/draft-store.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function createQuestionNoteDraftStore() {
  return (0, import_dsh_client_store.defineStore)({
    init: () => ({ progressByRequest: {} }),
    persist: "dsh.better-choice.drafts.v1",
    actions: {
      replace: (draft, requestKey, progress) => {
        draft.progressByRequest[requestKey] = progress;
      },
      clear: (draft, requestKey) => {
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => key !== requestKey)
        );
      },
      prune: (draft, keep) => {
        const live = new Set(keep);
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => live.has(key))
        );
      }
    }
  });
}

// src/client/composer.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/answer.ts
function hasAnswer(draft) {
  return draft.selected.length > 0 || draft.custom.trim() !== "" || Object.values(draft.notes).some((note) => note.trim() !== "");
}
function mergeAnswer(value, item) {
  if (value === void 0 || value.skipped) return { id: item.id, selected: [] };
  const custom = value.custom.trim();
  const keepSelection = item.multiSelect === true || custom === "";
  const parts = [];
  const push = (label, note, selected) => {
    if (note === "") return;
    const prefix = label === "" ? "" : `${label}: `;
    parts.push(`${selected ? "" : "(\u672A\u9009) "}${prefix}${note}`);
  };
  for (const label of value.selected) push(label, (value.notes[label] ?? "").trim(), keepSelection);
  for (const [label, rawNote] of Object.entries(value.notes)) {
    if (value.selected.includes(label)) continue;
    push(label, rawNote.trim(), false);
  }
  if (custom !== "") parts.push(custom);
  const text = parts.join("\n");
  return {
    id: item.id,
    selected: keepSelection ? value.selected : [],
    ...text === "" ? {} : { custom: text }
  };
}
function mergeAnswers(values, questions) {
  return { answers: questions.map((item, index) => mergeAnswer(values[index], item)) };
}

// src/client/side.ts
var service = null;
function setSideAskService(next) {
  service = next;
}
function getSideAskService() {
  return service;
}
async function askSide(sessionId, input, signal) {
  if (service === null) throw new Error("\u65C1\u95EE\u540E\u7AEF\u5C1A\u672A\u5C31\u7EEA");
  return service.ask(sessionId, input, signal);
}

// src/client/styles.ts
var STYLES = "/* Enhanced question composer styles: a verbatim copy of the official\r\n   QuestionComposer.bc_module.bc_css (same tokens, same geometry) plus the\r\n   `.bc_supplementRow` seat the note input takes under the selected option. */\r\n\r\n/* The takeover seats where the input card sits, centered on the InputBar\r\n   axis at the shared content width (input card - 32): sides = clearance +\r\n   16px so the relation also holds on narrow viewports. */\r\n.bc_frame {\r\n  display: flex;\r\n  justify-content: center;\r\n  padding: 6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;\r\n}\r\n\r\n/* Figma Input 973:36348 body over the 1019:36938 header: no banner strip \u2014\r\n   the card keeps zero padding and sections carry their own insets. */\r\n.bc_card {\r\n  display: flex;\r\n  flex-direction: column;\r\n  width: 100%;\r\n  max-width: var(--dsh-chat-content-width);\r\n  /* Composer seat sits in a fixed-height conversation column (overflow\r\n     hidden): cap the card against the viewport and scroll the option list\r\n     so header and footer actions stay reachable on long batches. */\r\n  max-height: min(60vh, 520px);\r\n  padding: 0 0 10px;\r\n  border: 0;\r\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2-darkmode-thin);\r\n  border-radius: var(--dsw-radius-xl);\r\n  background: var(--dsw-specific-input-major);\r\n  box-shadow: var(--dsw-elevation-panel);\r\n  color: var(--dsw-alias-label-primary);\r\n  overflow: hidden;\r\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\r\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\r\n}\r\n\r\n.bc_card,\r\n.bc_card * {\r\n  box-sizing: border-box;\r\n}\r\n\r\n/* Collapsed to the header strip: drop the height cap and the inner scroll\r\n   seat so the card hugs the title row. */\r\n.bc_cardMinimized {\r\n  max-height: none;\r\n}\r\n\r\n/* The header strip is the whole card when collapsed. */\r\n.bc_cardMinimized .bc_header {\r\n  padding-bottom: 14px;\r\n}\r\n\r\n/* Header button group: minimize sits next to the close action. */\r\n.bc_headerActions {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.bc_waitButton {\r\n  white-space: nowrap;\r\n}\r\n\r\n.bc_waitStatus {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 12px;\r\n  line-height: 24px;\r\n  white-space: nowrap;\r\n}\r\n\r\n/* Figma 1019:36938 header: heading block left, close right; the pager sits\r\n   in the footer to balance the card. */\r\n.bc_header {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  justify-content: space-between;\r\n  gap: 16px;\r\n  flex-shrink: 0;\r\n  padding: 20px 16px 0 24px;\r\n}\r\n\r\n.bc_headingBlock {\r\n  min-width: 0;\r\n}\r\n\r\n.bc_eyebrow {\r\n  margin-bottom: 5px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.bc_title {\r\n  margin: 0;\r\n  font-size: 16px;\r\n  line-height: 22px;\r\n  font-weight: 500;\r\n}\r\n\r\n.bc_detail {\r\n  margin: 0 2px 8px;\r\n}\r\n\r\n.bc_footerActions {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 12px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.bc_pager {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.bc_progress {\r\n  padding: 0 4px;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 14px;\r\n  line-height: 24px;\r\n  font-weight: 500;\r\n  white-space: nowrap;\r\n  word-spacing: -2px;\r\n}\r\n\r\n.bc_iconButton {\r\n  display: grid;\r\n  place-items: center;\r\n  width: 24px;\r\n  height: 24px;\r\n  padding: 0;\r\n  border: none;\r\n  border-radius: 999px;\r\n  corner-shape: round;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  cursor: pointer;\r\n}\r\n\r\n.bc_iconButton:hover:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.bc_iconButton:disabled {\r\n  color: var(--dsw-alias-label-dimmed);\r\n  cursor: default;\r\n}\r\n\r\n.bc_body {\r\n  display: flex;\r\n  flex: 1 1 auto;\r\n  flex-direction: column;\r\n  min-height: 0;\r\n  overflow-y: auto;\r\n  overscroll-behavior: contain;\r\n}\r\n\r\n.bc_options {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 1px;\r\n  margin: 8px 0 0;\r\n  padding: 4px 12px;\r\n}\r\n\r\n.bc_option {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  gap: 8px;\r\n  width: 100%;\r\n  min-height: 40px;\r\n  flex-shrink: 0;\r\n  padding: 8px 12px 8px 8px;\r\n  border: 1px solid transparent;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: transparent;\r\n  color: inherit;\r\n  text-align: left;\r\n  cursor: pointer;\r\n  transition: background-color 120ms ease, border-color 120ms ease;\r\n}\r\n\r\n.bc_option:hover:not(:disabled),\r\n.bc_optionSelected {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.bc_optionSelected {\r\n  border-color: var(--dsw-alias-border-l2);\r\n}\r\n\r\n.bc_option:disabled {\r\n  cursor: default;\r\n}\r\n\r\n/* Leading indicator (20\xD720): single-select shows the option number,\r\n   multi-select swaps in a checkbox. */\r\n.bc_number {\r\n  display: grid;\r\n  place-items: center;\r\n  flex: 0 0 20px;\r\n  width: 20px;\r\n  height: 20px;\r\n  margin-top: 2px;\r\n  border-radius: var(--dsw-radius-xs);\r\n  background: var(--dsw-alias-bg-overlay);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 12px;\r\n  font-weight: 500;\r\n  line-height: 18px;\r\n}\r\n\r\n/* Multi-select box (figma 1055:41594): a radius-4 box centered in the\r\n   20px indicator seat; the check icon stacks over it in the same grid cell. */\r\n.bc_checkbox {\r\n  display: grid;\r\n  place-items: center;\r\n  flex: 0 0 20px;\r\n  width: 20px;\r\n  height: 20px;\r\n  margin-top: 2px;\r\n}\r\n\r\n.bc_checkbox::before {\r\n  content: '';\r\n  grid-area: 1 / 1;\r\n  width: 14px;\r\n  height: 14px;\r\n  border: 0.5px solid var(--dsw-alias-border-l4);\r\n  border-radius: var(--dsw-radius-xs);\r\n  transition: background-color 120ms ease, border-color 120ms ease;\r\n}\r\n\r\n.bc_checkbox > svg {\r\n  grid-area: 1 / 1;\r\n}\r\n\r\n/* Checked: label-primary fill with a primary-foreground check. */\r\n.bc_checkboxChecked {\r\n  color: var(--dsw-alias-label-primary-foreground);\r\n}\r\n\r\n.bc_checkboxChecked::before {\r\n  border-color: var(--dsw-alias-label-primary);\r\n  background: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.bc_optionCopy {\r\n  min-width: 0;\r\n  flex: 1;\r\n}\r\n\r\n.bc_optionLine {\r\n  display: flex;\r\n  align-items: baseline;\r\n  flex-wrap: wrap;\r\n  gap: 2px 6px;\r\n}\r\n\r\n.bc_optionLabel {\r\n  font-size: 14px;\r\n  line-height: 24px;\r\n  font-weight: 500;\r\n}\r\n\r\n.bc_badge {\r\n  padding: 0 4px;\r\n  border-radius: var(--dsw-radius-xs);\r\n  background: var(--dsw-specific-sidebar-nav-item-active-accent);\r\n  color: var(--dsw-alias-button-info-fill);\r\n  font-size: 11px;\r\n  line-height: 18px;\r\n  font-weight: 600;\r\n}\r\n\r\n.bc_description {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 14px;\r\n  line-height: 24px;\r\n  font-weight: 400;\r\n}\r\n\r\n/* Read-only note standing in for a question the user skipped. */\r\n.bc_reviewNote {\r\n  margin: 0;\r\n  padding: 8px 12px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 14px;\r\n  line-height: 24px;\r\n}\r\n\r\n/* Custom answer row: an option-shaped row whose copy is an inline text\r\n   input; focus or a typed draft lifts it to the selected look. */\r\n.bc_customRow {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  gap: 8px;\r\n  width: 100%;\r\n  min-height: 40px;\r\n  flex-shrink: 0;\r\n  padding: 8px 12px 8px 8px;\r\n  border: 1px solid transparent;\r\n  border-radius: var(--dsw-radius-md);\r\n  transition: background-color 120ms ease, border-color 120ms ease;\r\n}\r\n\r\n.bc_customRow:hover,\r\n.bc_customRow:focus-within,\r\n.bc_customRowActive {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.bc_customRow:focus-within,\r\n.bc_customRowActive {\r\n  border-color: var(--dsw-alias-border-l2);\r\n}\r\n\r\n/* Supplement note row (dsh-question-note): an input rendered directly UNDER\r\n   the selected option and indented one indicator-seat (20px) plus one gap\r\n   (8px) to the right, so its left edge aligns with the option LABEL instead\r\n   of the option's number badge \u2014 visually a subordinate note of that option,\r\n   never a peer option row. Width stays auto: inside the column-flex .bc_options\r\n   container the row stretches to the container minus the indent margin. */\r\n.bc_supplementRow {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  gap: 8px;\r\n  min-height: 36px;\r\n  flex-shrink: 0;\r\n  margin: 2px 0 4px 28px;\r\n  padding: 6px 12px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-bg-module-platform);\r\n  transition: border-color 120ms ease;\r\n}\r\n\r\n.bc_supplementRow:focus-within {\r\n  border-color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n/* Auto-growing free-text answer (see AnswerField): mirror and textarea share\r\n   one grid cell, the mirror sizes it, and the textarea stretches to it. The\r\n   two layers MUST keep identical type, padding and wrapping. */\r\n.bc_field {\r\n  display: grid;\r\n  min-width: 0;\r\n  --dsh-answer-field-padding: 0;\r\n}\r\n\r\n.bc_field > * {\r\n  grid-area: 1 / 1;\r\n  min-width: 0;\r\n  padding: var(--dsh-answer-field-padding);\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 24px;\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n  overflow-wrap: anywhere;\r\n}\r\n\r\n/* The height ruler, never painted. Growth stops at 6 lines. */\r\n.bc_fieldMirror {\r\n  box-sizing: content-box;\r\n  max-height: 144px;\r\n  overflow: hidden;\r\n  visibility: hidden;\r\n}\r\n\r\n.bc_fieldInput {\r\n  resize: none;\r\n  overflow-y: auto;\r\n  border: none;\r\n  outline: none;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-primary);\r\n  caret-color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n.bc_fieldInput::placeholder {\r\n  color: var(--dsw-alias-label-caption);\r\n}\r\n\r\n/* Inline variant: the row's copy column, borrowing the row's chrome. */\r\n.bc_customInline {\r\n  flex: 1;\r\n}\r\n\r\n/* Optionless question: the free-form answer is the whole body, so it carries\r\n   its own frame. */\r\n.bc_customBlock {\r\n  min-height: 64px;\r\n  flex-shrink: 0;\r\n  margin: 0 12px;\r\n  border: 0.5px solid var(--dsw-alias-border-l4);\r\n  border-radius: var(--dsw-radius-lg);\r\n  background: var(--dsw-alias-bg-module-platform);\r\n  --dsh-answer-field-padding: 8px 12px;\r\n}\r\n\r\n.bc_customBlock:focus-within {\r\n  border-color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n.bc_footer {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 12px;\r\n  flex-shrink: 0;\r\n  margin-top: 12px;\r\n  padding: 0 10px 0 18px;\r\n}\r\n\r\n.bc_feedback {\r\n  flex: 1;\r\n  min-height: 16px;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  text-align: right;\r\n}\r\n\r\n@media (max-width: 720px) {\r\n  .bc_card {\r\n    border-radius: var(--dsw-radius-xl);\r\n  }\r\n\r\n  .bc_header {\r\n    padding: 10px 12px 0 18px;\r\n  }\r\n\r\n  .bc_options {\r\n    padding: 4px 8px;\r\n  }\r\n\r\n  .bc_title {\r\n    font-size: 15px;\r\n    line-height: 21px;\r\n  }\r\n\r\n  .bc_option,\r\n  .bc_customRow,\r\n  .bc_supplementRow {\r\n    padding: 8px 6px;\r\n  }\r\n\r\n  .bc_footer {\r\n    align-items: flex-end;\r\n    padding: 0 10px;\r\n  }\r\n\r\n  .bc_footerActions {\r\n    flex-shrink: 0;\r\n  }\r\n}\r\n\r\n@media (prefers-reduced-motion: reduce) {\r\n  .bc_option,\r\n  .bc_customRow,\r\n  .bc_supplementRow {\r\n    transition: none;\r\n  }\r\n}\r\n\n\n/* ===== dsh-better-choice additions ===== */\n\n/* Right-click affordance on an option row. */\n.bc_noteAffordance {\n  display: inline-flex;\n  align-items: center;\n  gap: 3px;\n  margin-left: auto;\n  padding-left: 8px;\n  color: var(--dsw-alias-label-caption);\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 18px;\n  white-space: nowrap;\n  opacity: 0;\n  transition: opacity 120ms ease;\n}\n\n.bc_option:hover .bc_noteAffordance,\n.bc_optionNoteOpen .bc_noteAffordance {\n  opacity: 1;\n}\n\n.bc_optionNoteOpen {\n  border-color: var(--dsw-alias-state-business-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.bc_noteDot {\n  display: inline-block;\n  width: 5px;\n  height: 5px;\n  border-radius: 999px;\n  background: var(--dsw-alias-state-business-primary);\n}\n\n.bc_supplementRow {\n  position: relative;\n}\n\n.bc_supplementRow .bc_fieldInput {\n  min-height: 24px;\n}\n\n/* ===== side question (btw-like) ===== */\n\n/* The card is capped at min(60vh, 520px) and .bc_body ships with\n   min-height: 0, so a long side answer used to win the height fight: the\n   option list collapsed to ~39px while the thread kept its 230px. While a\n   side thread exists, floor the choices and let the side panel yield height\n   first (its thread scrolls inside). min() keeps short viewports usable. */\n.bc_bodyBeside {\n  /* The floor is bounded by the card's own cap: 200px when the card is tall\n     enough, less on short viewports, so header/footer can never be pushed\n     out of the card. ~260px is the fixed chrome (header, footer, threaded\n     side panel minimum, gaps). */\n  min-height: min(200px, calc(min(66vh, 560px) - 260px));\n}\n\n/* A taller cap only for the live card: with the choice area floored at 200px\n   the side thread would otherwise be squeezed to ~69px and become unreadable\n   itself. The :not(.bc_cardMinimized) guard keeps the collapsed card untouched. */\n.bc_card:not(.bc_cardMinimized) {\n  max-height: min(66vh, 560px);\n}\n\n.bc_sideAsk {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  flex-shrink: 0;\n  margin: 10px 12px 0;\n  padding: 10px 0 0;\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n/* Only once a side answer exists does the panel compete for height: it then\n   shrinks before the choices and scrolls its thread. Without this class the\n   empty input row keeps its old size. */\n.bc_sideAskThreaded {\n  flex: 0 1 auto;\n  min-height: 118px;\n  overflow: hidden;\n}\n\n.bc_sideHeader,\n.bc_sideInputRow,\n.bc_sideError {\n  flex-shrink: 0;\n}\n\n.bc_sideHeader {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.bc_sideTitle {\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 18px;\n}\n\n.bc_sideHint {\n  color: var(--dsw-alias-label-caption);\n  font-size: 11px;\n  line-height: 16px;\n  text-align: right;\n}\n\n.bc_thread {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  flex: 1 1 auto;\n  min-height: 0;\n  max-height: 230px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding-right: 2px;\n}\n\n.bc_turn {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n\n.bc_questionBubble {\n  align-self: flex-end;\n  max-width: 88%;\n  padding: 6px 10px;\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.bc_answerBubble {\n  align-self: stretch;\n  padding: 2px 2px 2px 10px;\n  border-left: 2px solid var(--dsw-alias-state-business-primary);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  line-height: 20px;\n  word-break: break-word;\n}\n\n.bc_answerLabel {\n  margin-bottom: 2px;\n  color: var(--dsw-alias-label-caption);\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.bc_pendingAnswer {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.bc_sideInputRow {\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;\n}\n\n/* The side box grows with its text exactly like an answer field: the hidden\n   mirror owns the height, so the box caps at six short lines instead of\n   staying one row tall while the text overflows. */\n.bc_sideField {\n  flex: 1;\n  min-width: 0;\n  min-height: 36px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-bg-module-platform);\n  --dsh-answer-field-padding: 7px 10px;\n}\n\n/* Mirror and textarea MUST share type and padding with the box above. */\n.bc_sideField > * {\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.bc_sideField .bc_fieldMirror {\n  max-height: 120px;\n}\n\n.bc_sideField:focus-within {\n  border-color: var(--dsw-alias-state-business-primary);\n}\n\n.bc_sideField .bc_fieldInput:disabled {\n  color: var(--dsw-alias-label-dimmed);\n}\n\n.bc_sideError {\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n";
var cx = {
  "module": "bc_module",
  "css": "bc_css",
  "supplementRow": "bc_supplementRow",
  "frame": "bc_frame",
  "card": "bc_card",
  "cardMinimized": "bc_cardMinimized",
  "header": "bc_header",
  "headerActions": "bc_headerActions",
  "waitButton": "bc_waitButton",
  "waitStatus": "bc_waitStatus",
  "headingBlock": "bc_headingBlock",
  "eyebrow": "bc_eyebrow",
  "title": "bc_title",
  "detail": "bc_detail",
  "footerActions": "bc_footerActions",
  "pager": "bc_pager",
  "progress": "bc_progress",
  "iconButton": "bc_iconButton",
  "body": "bc_body",
  "options": "bc_options",
  "option": "bc_option",
  "optionSelected": "bc_optionSelected",
  "number": "bc_number",
  "checkbox": "bc_checkbox",
  "checkboxChecked": "bc_checkboxChecked",
  "optionCopy": "bc_optionCopy",
  "optionLine": "bc_optionLine",
  "optionLabel": "bc_optionLabel",
  "badge": "bc_badge",
  "description": "bc_description",
  "reviewNote": "bc_reviewNote",
  "customRow": "bc_customRow",
  "customRowActive": "bc_customRowActive",
  "field": "bc_field",
  "fieldMirror": "bc_fieldMirror",
  "fieldInput": "bc_fieldInput",
  "customInline": "bc_customInline",
  "customBlock": "bc_customBlock",
  "footer": "bc_footer",
  "feedback": "bc_feedback",
  "noteAffordance": "bc_noteAffordance",
  "optionNoteOpen": "bc_optionNoteOpen",
  "noteDot": "bc_noteDot",
  "bodyBeside": "bc_bodyBeside",
  "sideAsk": "bc_sideAsk",
  "sideAskThreaded": "bc_sideAskThreaded",
  "sideHeader": "bc_sideHeader",
  "sideInputRow": "bc_sideInputRow",
  "sideError": "bc_sideError",
  "sideTitle": "bc_sideTitle",
  "sideHint": "bc_sideHint",
  "thread": "bc_thread",
  "turn": "bc_turn",
  "questionBubble": "bc_questionBubble",
  "answerBubble": "bc_answerBubble",
  "answerLabel": "bc_answerLabel",
  "pendingAnswer": "bc_pendingAnswer",
  "sideField": "bc_sideField"
};

// src/client/composer.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var EMPTY_TURNS = [];
var MAX_SIDE_TURNS = 20;
var EMPTY_QUESTION = { id: "", question: "", options: [] };
var EMPTY_DRAFT = { selected: [], notes: {}, custom: "", skipped: false };
var REMOVED_CARD = {
  state: "open",
  waitState: "counting",
  countdown: void 0,
  channel: "none",
  closed: true
};
function cls(...values) {
  return values.filter(Boolean).join(" ");
}
function parseRecommendedLabel(label) {
  const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;
  return suffix.test(label) ? { label: label.replace(suffix, ""), recommended: true } : { label, recommended: false };
}
function recommendedFirstOption(question) {
  const label = question.options?.[0]?.label;
  return label !== void 0 && parseRecommendedLabel(label).recommended ? label : void 0;
}
function isQuestionDraftProgress(value, questionCount) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const progress = value;
  if (typeof progress.index !== "number" || !Number.isInteger(progress.index) || progress.index < 0 || progress.index >= questionCount || !Array.isArray(progress.drafts) || progress.drafts.length !== questionCount || progress.wait !== void 0 && progress.wait !== "editing" && progress.wait !== "waiting") return false;
  return progress.drafts.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const draft = item;
    return Array.isArray(draft.selected) && draft.selected.every((label) => typeof label === "string") && typeof draft.custom === "string" && typeof draft.skipped === "boolean" && (draft.notes === void 0 || typeof draft.notes === "object" && draft.notes !== null && !Array.isArray(draft.notes) && Object.values(draft.notes).every((note) => typeof note === "string"));
  });
}
function isComposing(event) {
  return event.nativeEvent.isComposing || Reflect.get(event.nativeEvent, "keyCode") === 229;
}
function sessionIdOf(props, frame, carrierSessionId) {
  if (typeof carrierSessionId === "string" && carrierSessionId !== "") return carrierSessionId;
  if (typeof props.sessionId === "string" && props.sessionId !== "") return props.sessionId;
  const session = props.session;
  const fromSession = session?.sessionId ?? session?.id;
  if (typeof fromSession === "string" && fromSession !== "") return fromSession;
  const host = frame?.closest("[data-conversation-session]");
  return host?.getAttribute("data-conversation-session") ?? "";
}
function AnswerField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cls(
    cx.field,
    props.variant === "side" ? cx.sideField : props.variant === "inline" ? cx.customInline : cx.customBlock
  ), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "aria-hidden": true, className: cx.fieldMirror, children: `${props.value}
` }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "textarea",
      {
        autoFocus: props.autoFocus,
        className: cx.fieldInput,
        value: props.value,
        disabled: props.disabled,
        rows: 1,
        placeholder: props.placeholder,
        "aria-label": props.ariaLabel ?? props.placeholder,
        onFocus: props.onFocus,
        onChange: props.onChange,
        onKeyDown: props.onKeyDown
      }
    )
  ] });
}
var Markdown = (0, import_react.memo)(function Markdown2(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.MarkdownText, { ...props });
});
function QuestionNoteComposer(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    QuestionNoteFlow,
    {
      pending: props.matched,
      t: props.t,
      useStore: props.useStore,
      actions: props.actions,
      sessionId: props.sessionId,
      session: props.session
    },
    props.matched.key
  );
}
function QuestionNoteFlow({ pending, t, useStore, actions, sessionId, session }) {
  const questions = pending.questions;
  const review = pending.review;
  const markdownLabels = (0, import_react.useMemo)(() => ({
    code: { copyLabel: t("copy"), copiedLabel: t("copied"), toolbarLabels: { codeLabel: t("codeBlock.title"), wrapLabel: t("codeBlock.wrap"), unwrapLabel: t("codeBlock.unwrap") } },
    footnotes: t("markdown.footnotes")
  }), [t]);
  const initialDrafts = (0, import_react.useMemo)(() => {
    const recorded = new Map((review ?? []).map((answer) => [answer.id, answer]));
    return questions.map((item) => {
      const answer = recorded.get(item.id);
      const custom = answer?.custom ?? "";
      const recommended = review === void 0 ? recommendedFirstOption(item) : void 0;
      return {
        selected: answer === void 0 && recommended !== void 0 ? [recommended] : [...answer?.selected ?? []],
        notes: {},
        custom,
        // A recorded answer with no selection and no custom text was skipped.
        skipped: answer !== void 0 && answer.selected.length === 0 && custom === ""
      };
    });
  }, [questions, review]);
  const stored = useStore((state) => state.progressByRequest[pending.key]);
  const validStored = isQuestionDraftProgress(stored, questions.length) ? stored : void 0;
  const storedProgress = review === void 0 ? validStored : void 0;
  const index = validStored?.index ?? 0;
  const drafts = (0, import_react.useMemo)(() => (storedProgress?.drafts ?? initialDrafts).map((item) => ({ ...item, notes: item.notes ?? {} })), [initialDrafts, storedProgress]);
  const restoredWait = (0, import_react.useMemo)(() => storedProgress?.wait ?? (storedProgress?.drafts.some((item, itemIndex) => item.selected.length !== initialDrafts[itemIndex]?.selected.length || item.selected.some((label, labelIndex) => label !== initialDrafts[itemIndex]?.selected[labelIndex]) || Object.values(item.notes ?? {}).some((note) => note !== "") || item.custom !== "" || item.skipped) === true ? "editing" : void 0), [initialDrafts, storedProgress]);
  const [busy, setBusy] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const card = (0, import_react.useSyncExternalStore)(pending.subscribe, pending.snapshot) ?? REMOVED_CARD;
  const canSubmit = card.channel !== "none";
  const locked = busy !== null || review !== void 0;
  const sentVia = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (sentVia.current !== "waterfall" || card.state !== "continued") return;
    sentVia.current = null;
    setBusy(null);
    setError({ key: "error.resubmit" });
  }, [card.state]);
  (0, import_react.useEffect)(() => {
    if (card.closed) actions.clear(pending.key);
  }, [actions, card.closed, pending.key]);
  (0, import_react.useEffect)(() => {
    actions.prune(pending.liveKeys());
  }, [pending]);
  const waitDisposition = (0, import_react.useRef)(restoredWait);
  (0, import_react.useEffect)(() => {
    if (waitDisposition.current === "waiting") pending.takeTime();
    if (waitDisposition.current === "editing") pending.engage();
  }, [pending]);
  const countdown = card.countdown;
  const [minimized, setMinimized] = (0, import_react.useState)(false);
  const focusedQuestions = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const answerSurface = (0, import_react.useRef)(null);
  const question = questions[index] ?? EMPTY_QUESTION;
  const draft = drafts[index] ?? EMPTY_DRAFT;
  const hasOptions = (question.options?.length ?? 0) > 0;
  const isLastQuestion = index === questions.length - 1;
  const [openNotes, setOpenNotes] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  (0, import_react.useEffect)(() => {
    setOpenNotes(/* @__PURE__ */ new Set());
  }, [index, pending.key]);
  const [sideThreads, setSideThreads] = (0, import_react.useState)({});
  const [sideInput, setSideInput] = (0, import_react.useState)("");
  const [sideBusyKeys, setSideBusyKeys] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [sideErrorByKey, setSideErrorByKey] = (0, import_react.useState)({});
  const sideAborts = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const threadRef = (0, import_react.useRef)(null);
  const frameRef = (0, import_react.useRef)(null);
  const threadKey = `${String(pending.key)}:${String(index)}`;
  const sideThread = sideThreads[threadKey] ?? EMPTY_TURNS;
  const sideBusy = sideBusyKeys.has(threadKey);
  const sideError = sideErrorByKey[threadKey] ?? null;
  (0, import_react.useEffect)(() => () => {
    for (const controller of sideAborts.current.values()) controller.abort();
  }, []);
  (0, import_react.useEffect)(() => {
    const element = threadRef.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  }, [sideThread]);
  const markSideBusy = (key, busy2) => {
    setSideBusyKeys((current) => {
      if (current.has(key) === busy2) return current;
      const next = new Set(current);
      if (busy2) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const setSideErrorFor = (key, message) => {
    setSideErrorByKey((current) => {
      if (message === null) {
        if (current[key] === void 0) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      return current[key] === message ? current : { ...current, [key]: message };
    });
  };
  const appendSideTurn = (key, turn) => {
    setSideThreads((current) => ({
      ...current,
      // Keep the thread bounded: a long card session must not grow without limit.
      [key]: [...current[key] ?? [], turn].slice(-MAX_SIDE_TURNS)
    }));
  };
  const updateSideTurn = (key, id, update) => {
    setSideThreads((current) => {
      const thread = current[key];
      if (thread === void 0 || !thread.some((turn) => turn.id === id)) return current;
      return { ...current, [key]: thread.map((turn) => turn.id === id ? update(turn) : turn) };
    });
  };
  const cancelSide = (key) => {
    const controller = sideAborts.current.get(key);
    if (controller === void 0) return;
    controller.abort();
    sideAborts.current.delete(key);
    markSideBusy(key, false);
    setSideThreads((current) => ({
      ...current,
      [key]: (current[key] ?? []).map((turn) => turn.pending ? { ...turn, pending: false, error: t("side.cancelled") } : turn)
    }));
  };
  const replaceProgress = (nextIndex, nextDrafts) => {
    actions.replace(pending.key, {
      index: nextIndex,
      drafts: nextDrafts,
      ...waitDisposition.current === void 0 ? {} : { wait: waitDisposition.current }
    });
  };
  const takeTime = () => {
    waitDisposition.current = "waiting";
    pending.takeTime();
    replaceProgress(index, drafts);
  };
  const engage = () => {
    if (waitDisposition.current !== void 0) return;
    waitDisposition.current = "editing";
    pending.engage();
  };
  const focusAnswerSurface = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.holdFocus();
  };
  const blurAnswerSurface = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.releaseFocus();
  };
  const focusSidePanel = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.holdFocus();
  };
  const blurSidePanel = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.releaseFocus();
  };
  (0, import_react.useEffect)(() => {
    const release = () => {
      pending.releaseFocus();
    };
    const refocus = () => {
      if (waitDisposition.current === "editing") {
        pending.engage();
        return;
      }
      if (answerSurface.current?.contains(document.activeElement) === true) pending.holdFocus();
    };
    const visibilityChanged = () => {
      if (document.hidden) release();
      else refocus();
    };
    window.addEventListener("blur", release);
    window.addEventListener("focus", refocus);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      release();
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [pending]);
  const dismissFlow = () => {
    if (pending.dismissal === "hide") {
      void pending.dismiss();
      return;
    }
    if (!canSubmit) {
      setError({ key: "error.unavailable" });
      return;
    }
    setBusy("cancel");
    setError(null);
    sentVia.current = "waterfall";
    void pending.dismiss().catch((cause) => {
      sentVia.current = null;
      setBusy(null);
      setError({ text: cause instanceof Error ? cause.message : String(cause) });
    });
  };
  const updateDraft = (update, nextIndex = index) => {
    engage();
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index ? update(item) : item);
    replaceProgress(nextIndex, nextDrafts);
    setError(null);
  };
  const closeUnselectedNotes = (selected) => {
    setOpenNotes((current) => {
      const next = new Set([...current].filter((item) => selected.includes(item)));
      return next.size === current.size ? current : next;
    });
  };
  const choose = (label) => {
    let nextSelected = [];
    updateDraft((current) => {
      if (question.multiSelect === true) {
        const selected = current.selected.includes(label) ? current.selected.filter((item) => item !== label) : [...current.selected, label];
        nextSelected = selected;
        return { ...current, selected, skipped: false };
      }
      nextSelected = [label];
      return { ...current, selected: [label], custom: "", skipped: false };
    });
    closeUnselectedNotes(nextSelected);
  };
  const openNote = (label) => {
    if (locked) return;
    let nextSelected = [];
    updateDraft((current) => {
      const selected = question.multiSelect === true ? current.selected.includes(label) ? current.selected : [...current.selected, label] : [label];
      nextSelected = selected;
      return { ...current, selected, skipped: false };
    });
    closeUnselectedNotes(nextSelected);
    setOpenNotes((current) => {
      const next = new Set(current);
      next.add(label);
      return next;
    });
  };
  const completed = (item) => hasAnswer(item) || item.skipped;
  const submitDrafts = (values) => {
    const missing = values.findIndex((item) => !completed(item));
    if (missing >= 0) {
      replaceProgress(missing, values);
      setError({ key: "error.incomplete" });
      return;
    }
    if (!canSubmit) {
      setError({ key: "error.unavailable" });
      return;
    }
    const answer = mergeAnswers(values, questions);
    setBusy("answer");
    setError(null);
    const channel = pending.snapshot().channel;
    sentVia.current = channel === "waterfall" ? "waterfall" : null;
    void pending.answer(answer).then(() => {
      if (channel !== "rpc") return;
      sentVia.current = null;
      setBusy(null);
      setError(null);
      void pending.dismiss().catch(() => {
        setError({ key: "status.sent" });
      });
    }).catch((cause) => {
      sentVia.current = null;
      setBusy(null);
      setError({ text: cause instanceof Error ? cause.message : String(cause) });
    });
  };
  const continueFlow = () => {
    if (!hasAnswer(draft)) {
      setError({ key: "error.unanswered" });
      return;
    }
    if (index < questions.length - 1) {
      replaceProgress(index + 1, drafts);
      setError(null);
      return;
    }
    submitDrafts(drafts);
  };
  const noteDraft = (label, event) => {
    const value = event.target.value;
    updateDraft((current) => ({
      ...current,
      notes: { ...current.notes, [label]: value },
      skipped: false
    }));
  };
  const draftCustom = (event) => {
    const value = event.target.value;
    updateDraft((current) => ({
      ...current,
      selected: question.multiSelect === true ? current.selected : [],
      custom: value,
      skipped: false
    }));
    if (question.multiSelect !== true) closeUnselectedNotes([]);
  };
  const continueFromCustom = (event) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
    event.preventDefault();
    continueFlow();
  };
  const skipQuestion = () => {
    engage();
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index ? { selected: [], notes: {}, custom: "", skipped: true } : item);
    replaceProgress(index < questions.length - 1 ? index + 1 : index, nextDrafts);
    setError(null);
    if (index < questions.length - 1) {
      return;
    }
    submitDrafts(nextDrafts);
  };
  const sendSide = () => {
    const requestKey = threadKey;
    if (locked || sideAborts.current.has(requestKey)) return;
    const text = sideInput.trim();
    if (text === "") {
      setSideErrorFor(requestKey, t("side.empty"));
      return;
    }
    const target = sessionIdOf({ sessionId, session }, frameRef.current, pending.sessionId);
    if (target === "") {
      setSideErrorFor(requestKey, t("side.noSession"));
      return;
    }
    const id = `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
    const history = (sideThreads[requestKey] ?? []).filter((turn) => !turn.pending && turn.answer !== void 0 && turn.answer !== "").map((turn) => ({ question: turn.question, answer: turn.answer ?? "" }));
    const questionsContext = questions.map((item, itemIndex) => {
      const value = drafts[itemIndex];
      return {
        title: item.question,
        header: item.header,
        detail: item.detail,
        multiSelect: item.multiSelect === true,
        options: item.options?.map((option) => ({
          label: option.label,
          description: option.description
        })),
        selected: value.selected,
        notes: value.notes,
        custom: value.custom,
        skipped: value.skipped
      };
    });
    setSideInput("");
    setSideErrorFor(requestKey, null);
    engage();
    const controller = new AbortController();
    sideAborts.current.set(requestKey, controller);
    markSideBusy(requestKey, true);
    appendSideTurn(requestKey, { id, question: text, pending: true });
    void askSide(target, {
      question: text,
      questions: questionsContext,
      activeIndex: index,
      thread: history
    }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind !== "text") throw new Error(result.text !== "" ? result.text : t("side.failed"));
      const answer = result.text.trim();
      if (answer === "") throw new Error(t("side.failed"));
      updateSideTurn(requestKey, id, (turn) => ({ ...turn, pending: false, answer }));
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      const hint = /busy|忙|占用/i.test(message) ? `
${t("side.busyHint")}` : "";
      updateSideTurn(requestKey, id, (turn) => ({
        ...turn,
        pending: false,
        error: `${t("side.failed")}\uFF1A${message}${hint}`
      }));
    }).finally(() => {
      if (sideAborts.current.get(requestKey) !== controller) return;
      sideAborts.current.delete(requestKey);
      markSideBusy(requestKey, false);
    });
  };
  const sideKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
    event.preventDefault();
    sendSide();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: frameRef, className: cx.frame, "data-question-key": pending.key, "data-better-choice": true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "section",
    {
      className: cls(cx.card, minimized && cx.cardMinimized),
      "aria-labelledby": `question-${pending.key}-${String(index)}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: cx.header, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.headingBlock, children: [
            question.header !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.eyebrow, children: question.header }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: cx.title, id: `question-${pending.key}-${String(index)}`, children: question.question })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.headerActions, children: [
            countdown !== void 0 && card.waitState !== "waiting" && card.waitState !== "editing" && card.waitState !== "continued" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.waitStatus, children: t(countdown.running ? "wait.countdown" : "wait.paused", {
              seconds: Math.ceil(countdown.remainingMs / 1e3)
            }) }),
            countdown !== void 0 && card.waitState !== "waiting" && card.waitState !== "editing" && card.waitState !== "continued" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", className: cx.waitButton, onClick: takeTime, children: t("wait.takeTime") }),
            card.state === "continued" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.waitStatus, children: t("wait.continued") }),
            countdown !== void 0 && (card.waitState === "waiting" || card.waitState === "editing") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.waitStatus, children: t("wait.held") }),
            review !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.waitStatus, children: t("review.status") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: cx.iconButton,
                "aria-label": t(minimized ? "nav.maximize" : "nav.minimize"),
                title: t(minimized ? "nav.maximize" : "nav.minimize"),
                "aria-expanded": !minimized,
                disabled: busy !== null,
                onClick: () => {
                  setMinimized((current) => !current);
                },
                children: minimized ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: cx.iconButton,
                "aria-label": t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                title: t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                disabled: busy !== null,
                onClick: dismissFlow,
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, {})
              }
            )
          ] })
        ] }),
        !minimized && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              ref: answerSurface,
              className: cls(cx.body, sideThread.length > 0 && cx.bodyBeside),
              "data-question-scroll": true,
              onFocusCapture: focusAnswerSurface,
              onBlurCapture: blurAnswerSurface,
              children: [
                question.detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.detail, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, { text: question.detail, labels: markdownLabels }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.options, role: question.multiSelect === true ? "group" : "radiogroup", children: [
                  (question.options ?? []).map((option, optionIndex) => {
                    const selected = draft.selected.includes(option.label);
                    const display = parseRecommendedLabel(option.label);
                    const note = draft.notes[option.label] ?? "";
                    const supplementHere = review === void 0 && !locked && openNotes.has(option.label);
                    const accessibleName = [
                      display.label,
                      display.recommended ? t("option.recommended") : "",
                      option.description ?? "",
                      note !== "" ? t("note.affordance.filled") : ""
                    ].filter((part) => part !== "").join("\uFF0C");
                    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: cls(
                            cx.option,
                            selected && question.multiSelect !== true && cx.optionSelected,
                            openNotes.has(option.label) && cx.optionNoteOpen
                          ),
                          role: question.multiSelect === true ? "checkbox" : "radio",
                          "aria-checked": selected,
                          "aria-label": accessibleName,
                          title: review === void 0 ? t("note.affordance") : void 0,
                          disabled: locked,
                          onClick: () => {
                            choose(option.label);
                          },
                          onContextMenu: (event) => {
                            if (review !== void 0 || locked) return;
                            event.preventDefault();
                            event.stopPropagation();
                            openNote(option.label);
                          },
                          onKeyDown: (event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            submitDrafts(drafts);
                          },
                          children: [
                            question.multiSelect === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cls(cx.checkbox, selected && cx.checkboxChecked), "aria-hidden": "true", children: selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 12 }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.number, children: optionIndex + 1 }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.optionCopy, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: cx.optionLine, children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.optionLabel, children: display.label }),
                              display.recommended && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.badge, children: t("option.recommended") }),
                              option.description !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.description, children: option.description })
                            ] }) }),
                            review === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: cx.noteAffordance, "aria-hidden": "true", children: [
                              note !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.noteDot }),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 11 }),
                              note !== "" ? t("note.affordance.filled") : t("note.affordance")
                            ] })
                          ]
                        }
                      ),
                      supplementHere && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.supplementRow, "data-note-for": option.label, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        AnswerField,
                        {
                          variant: "inline",
                          value: note,
                          disabled: locked,
                          autoFocus: true,
                          placeholder: t("note.placeholder"),
                          onChange: (event) => {
                            noteDraft(option.label, event);
                          },
                          onKeyDown: continueFromCustom
                        }
                      ) })
                    ] }, `${option.label}-${String(optionIndex)}`);
                  }),
                  review !== void 0 && draft.skipped && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: cx.reviewNote, children: t("review.skipped") }),
                  (review === void 0 || draft.custom !== "") && (hasOptions ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cls(cx.customRow, draft.custom !== "" && cx.customRowActive), children: [
                    question.multiSelect === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        className: cls(cx.checkbox, draft.custom !== "" && cx.checkboxChecked),
                        "aria-hidden": "true",
                        children: draft.custom !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 12 })
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.number, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 12 }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      AnswerField,
                      {
                        variant: "inline",
                        value: draft.custom,
                        disabled: locked,
                        placeholder: t("custom.placeholder"),
                        onChange: draftCustom,
                        onKeyDown: continueFromCustom
                      }
                    )
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    AnswerField,
                    {
                      autoFocus: canSubmit && countdown === void 0 && !locked && !focusedQuestions.current.has(index),
                      variant: "block",
                      value: draft.custom,
                      disabled: locked,
                      placeholder: t("custom.placeholder"),
                      onFocus: () => {
                        focusedQuestions.current.add(index);
                      },
                      onChange: draftCustom,
                      onKeyDown: continueFromCustom
                    }
                  ))
                ] })
              ]
            }
          ),
          review === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              className: cls(cx.sideAsk, sideThread.length > 0 && cx.sideAskThreaded),
              "data-better-choice-side": true,
              onFocusCapture: focusSidePanel,
              onBlurCapture: blurSidePanel,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.sideHeader, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.sideTitle, children: t("side.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx.sideHint, children: t("side.hint") })
                ] }),
                sideThread.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.thread, ref: threadRef, "data-side-thread": true, children: sideThread.map((turn) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.turn, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.questionBubble, children: turn.question }),
                  turn.pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.pendingAnswer, children: t("side.answering") }) : turn.error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.sideError, children: turn.error }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.answerBubble, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.answerLabel, children: t("side.answer") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, { text: turn.answer ?? "", labels: markdownLabels })
                  ] })
                ] }, turn.id)) }),
                sideError !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.sideError, children: sideError }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.sideInputRow, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    AnswerField,
                    {
                      variant: "side",
                      value: sideInput,
                      disabled: sideBusy || locked,
                      placeholder: t("side.placeholder"),
                      ariaLabel: t("side.title"),
                      onChange: (event) => {
                        setSideInput(event.target.value);
                        setSideErrorFor(threadKey, null);
                      },
                      onKeyDown: sideKeyDown
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    import_dsh_client_ui_primitives.Button,
                    {
                      variant: "outline",
                      disabled: sideBusy || locked || sideInput.trim() === "",
                      onClick: sendSide,
                      children: sideBusy ? t("side.answering") : t("side.send")
                    }
                  ),
                  sideBusy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: () => {
                    cancelSide(threadKey);
                  }, children: t("side.cancel") })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: cx.footer, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.pager, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: cx.iconButton,
                  "aria-label": t("nav.prev"),
                  disabled: index === 0 || busy !== null,
                  onClick: () => {
                    replaceProgress(index - 1, drafts);
                    setError(null);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, {})
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: cx.progress, children: [
                index + 1,
                " / ",
                questions.length
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: cx.iconButton,
                  "aria-label": t("nav.next"),
                  disabled: isLastQuestion || busy !== null,
                  onClick: () => {
                    replaceProgress(index + 1, drafts);
                    setError(null);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx.feedback, role: "status", children: error === null ? null : "key" in error ? t(error.key) : error.text }),
            review === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx.footerActions, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: busy !== null, onClick: skipQuestion, children: t("action.skip") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                import_dsh_client_ui_primitives.Button,
                {
                  variant: "primary",
                  disabled: busy !== null || !hasAnswer(draft) || isLastQuestion && !canSubmit,
                  onClick: continueFlow,
                  children: busy === "answer" ? t("submitting") : isLastQuestion ? t("submit") : t("action.next")
                }
              )
            ] })
          ] })
        ] })
      ]
    }
  ) });
}

// src/client/carrier.ts
function isPlanReviewRequest(questions) {
  if (questions.length !== 1) return false;
  const question = questions[0];
  if (question === void 0) return false;
  const intent = question.intent;
  if (intent?.kind !== "plan-review" || question.detail === void 0) return false;
  if (question.multiSelect === true) return false;
  const options = question.options ?? [];
  if (options.length > 2) return false;
  return options.some((option) => option.label === intent.approve);
}
function isQuestionCarrier(value) {
  if (typeof value !== "object" || value === null) return false;
  const carrier = value;
  return typeof carrier.key === "string" && (carrier.sessionId === void 0 || typeof carrier.sessionId === "string") && Array.isArray(carrier.questions) && carrier.questions.length > 0 && (carrier.review === void 0 || Array.isArray(carrier.review)) && (carrier.dismissal === "hide" || carrier.dismissal === "cancel") && typeof carrier.subscribe === "function" && typeof carrier.snapshot === "function" && typeof carrier.takeTime === "function" && typeof carrier.engage === "function" && typeof carrier.holdFocus === "function" && typeof carrier.releaseFocus === "function" && typeof carrier.answer === "function" && typeof carrier.dismiss === "function" && typeof carrier.liveKeys === "function";
}
function selectQuestionCarrier(owner) {
  const carrier = owner.pendingInteraction;
  if (!isQuestionCarrier(carrier)) return null;
  if (isPlanReviewRequest(carrier.questions)) return null;
  return carrier;
}

// src/client/locales.ts
var zh = {
  "error.incomplete": "\u8BF7\u5148\u5B8C\u6210\u8FD9\u9053\u95EE\u9898\u3002",
  "error.unanswered": "\u8BF7\u9009\u62E9\u4E00\u4E2A\u9009\u9879\u6216\u586B\u5199\u81EA\u5B9A\u4E49\u7B54\u6848\u3002",
  "error.unavailable": "\u5F53\u524D\u65E0\u6CD5\u63D0\u4EA4\uFF0C\u8BF7\u7A0D\u5019\u518D\u8BD5\u3002",
  "error.resubmit": "\u56DE\u7B54\u672A\u9001\u8FBE\uFF0C\u5DE5\u4F5C\u5DF2\u7EE7\u7EED\uFF0C\u8BF7\u518D\u63D0\u4EA4\u4E00\u6B21\u3002",
  "status.sent": "\u56DE\u7B54\u5DF2\u53D1\u9001\uFF1B\u9762\u677F\u672A\u80FD\u5173\u95ED\u3002",
  "wait.takeTime": "\u6162\u6162\u56DE\u7B54",
  "wait.countdown": "{seconds} \u79D2\u540E\u7EE7\u7EED\u5DE5\u4F5C",
  "wait.paused": "\u5DF2\u6682\u505C \xB7 \u5269\u4F59 {seconds} \u79D2",
  "wait.held": "\u4F1A\u4E00\u76F4\u7B49\u4F60\u56DE\u7B54",
  "wait.continued": "\u5DF2\u7EE7\u7EED\u5DE5\u4F5C\uFF0C\u4ECD\u53EF\u56DE\u7B54",
  "review.status": "\u5DF2\u56DE\u7B54",
  "review.skipped": "\u8FD9\u9053\u95EE\u9898\u5F53\u65F6\u88AB\u8DF3\u8FC7\u3002",
  "nav.prev": "\u4E0A\u4E00\u9898",
  "nav.next": "\u4E0B\u4E00\u9898",
  "nav.minimize": "\u6536\u8D77\u95EE\u9898\u5361\u7247",
  "nav.maximize": "\u5C55\u5F00\u95EE\u9898\u5361\u7247",
  "nav.cancel": "\u653E\u5F03\u6574\u7EC4\u95EE\u9898",
  "nav.close": "\u6536\u8D77\u95EE\u9898\u9762\u677F\uFF0C\u53EF\u4ECE\u5DE5\u5177\u8C03\u7528\u91CD\u65B0\u6253\u5F00",
  "option.recommended": "\u63A8\u8350",
  "custom.placeholder": "\u8F93\u5165\u4F60\u7684\u7B54\u6848",
  "action.skip": "\u8DF3\u8FC7",
  "action.next": "\u4E0B\u4E00\u9898",
  "submit": "\u63D0\u4EA4\u7B54\u6848",
  "submitting": "\u63D0\u4EA4\u4E2D\u2026",
  "copy": "\u590D\u5236",
  "copied": "\u5DF2\u590D\u5236",
  "codeBlock.title": "\u4EE3\u7801\u5757",
  "codeBlock.wrap": "\u81EA\u52A8\u6362\u884C",
  "codeBlock.unwrap": "\u53D6\u6D88\u6362\u884C",
  "markdown.footnotes": "\u811A\u6CE8",
  "note.affordance": "\u53F3\u952E\u8865\u5145",
  "note.affordance.filled": "\u5DF2\u8865\u5145",
  "note.placeholder": "\u8865\u5145\u8BF4\u660E \xB7 \u4F1A\u968F\u8FD9\u4E2A\u9009\u9879\u4E00\u8D77\u53D1\u7ED9\u6A21\u578B",
  "side.title": "\u65C1\u95EE\u6A21\u578B",
  "side.hint": "\u4E0D\u63D0\u4EA4\u7B54\u6848 \xB7 \u5148\u95EE\u6E05\u695A\u518D\u9009",
  "side.placeholder": "\u56F4\u7ED5\u9009\u9879\u95EE\u70B9\u4EC0\u4E48\uFF0CEnter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C",
  "side.send": "\u63D0\u95EE",
  "side.cancel": "\u53D6\u6D88\u65C1\u95EE",
  "side.cancelled": "\u65C1\u95EE\u5DF2\u53D6\u6D88\u3002",
  "side.answering": "\u6B63\u5728\u56DE\u7B54\u2026",
  "side.answer": "\u65C1\u95EE\u56DE\u7B54",
  "side.empty": "\u8BF7\u8F93\u5165\u65C1\u95EE\u5185\u5BB9\u3002",
  "side.noSession": "\u65C1\u95EE\u4E0D\u53EF\u7528\uFF1A\u672A\u627E\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "side.failed": "\u65C1\u95EE\u5931\u8D25",
  "side.busyHint": "\u5982\u679C Agent \u6B63\u5FD9\uFF0C\u53EF\u5148\u70B9\u300C\u6162\u6162\u56DE\u7B54\u300D\u518D\u8BD5\u3002"
};
var en = {
  "error.incomplete": "Please complete this question first.",
  "error.unanswered": "Please select an option or enter a custom answer.",
  "error.unavailable": "Cannot submit right now; try again in a moment.",
  "error.resubmit": "The answer did not arrive before work continued; submit it again.",
  "status.sent": "Reply sent; the panel could not close.",
  "wait.takeTime": "Take time",
  "wait.countdown": "Continuing in {seconds}s",
  "wait.paused": "Paused \xB7 {seconds}s remaining",
  "wait.held": "Waiting until you answer",
  "wait.continued": "Work continued \u2014 you can still answer",
  "review.status": "Answered",
  "review.skipped": "This question was skipped.",
  "nav.prev": "Previous question",
  "nav.next": "Next question",
  "nav.minimize": "Collapse the question card",
  "nav.maximize": "Expand the question card",
  "nav.cancel": "Dismiss all questions",
  "nav.close": "Close the panel \u2014 reopen it from the tool call",
  "option.recommended": "Recommended",
  "custom.placeholder": "Type your answer",
  "action.skip": "Skip",
  "action.next": "Next",
  "submit": "Submit",
  "submitting": "Submitting\u2026",
  "copy": "Copy",
  "copied": "Copied",
  "codeBlock.title": "Code block",
  "codeBlock.wrap": "Wrap lines",
  "codeBlock.unwrap": "Unwrap lines",
  "markdown.footnotes": "Footnotes",
  "note.affordance": "Right-click to note",
  "note.affordance.filled": "Noted",
  "note.placeholder": "Optional note \xB7 sent to the model with this option",
  "side.title": "Ask the model",
  "side.hint": "Not an answer \xB7 ask first, choose after",
  "side.placeholder": "Ask about these options \u2014 Enter sends, Shift+Enter adds a line",
  "side.send": "Ask",
  "side.cancel": "Cancel side question",
  "side.cancelled": "Side question cancelled.",
  "side.answering": "Answering\u2026",
  "side.answer": "Side answer",
  "side.empty": "Enter a side question first.",
  "side.noSession": "Side questions are unavailable: the current session was not found.",
  "side.failed": "Side question failed",
  "side.busyHint": "If the agent is busy, choose \u201CTake time\u201D first and retry."
};

// src/client/index.ts
var inject = ["slots", "locale", "remote", "remote.commands"];
var NS = "better-choice";
var CHAIN_PRIORITY = -10;
var STYLE_ID = "dsh-better-choice-styles";
function installStyles() {
  const existing = document.getElementById(STYLE_ID);
  const style = existing ?? document.createElement("style");
  if (existing === null) {
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== STYLES) style.textContent = STYLES;
  style.dataset.bcUsers = String(Number(style.dataset.bcUsers ?? "0") + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = Math.max(Number(style.dataset.bcUsers ?? "1") - 1, 0);
    if (left > 0) {
      style.dataset.bcUsers = String(left);
      return;
    }
    style.remove();
  };
}
function createSideAskService(remote) {
  return {
    async ask(sessionId, input, signal) {
      const line = `/bc-ask ${JSON.stringify(input)}`;
      const response = await remote.commands.execute(sessionId, line, [], signal);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "\u65C1\u95EE\u8C03\u7528\u5931\u8D25");
      }
      const result = response.value?.result;
      const kind = typeof result?.kind === "string" ? result.kind : "error";
      const text = typeof result?.text === "string" ? result.text : "";
      if (kind === "success" || kind === "text") return { kind: "text", text };
      throw new Error(text !== "" ? text : "\u65C1\u95EE\u6CA1\u6709\u8FD4\u56DE\u6587\u5B57\u56DE\u7B54");
    }
  };
}
function apply(ctx) {
  ctx.effect(installStyles, "dsh-better-choice: styles");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-better-choice: dictionaries");
  const remote = ctx.get("remote");
  if (remote !== void 0 && remote !== null) {
    const service2 = createSideAskService(remote);
    setSideAskService(service2);
    ctx.effect(() => () => {
      if (getSideAskService() === service2) setSideAskService(null);
    }, "dsh-better-choice: side-ask bridge");
  }
  const draftStore = createQuestionNoteDraftStore();
  ctx.effect(() => ctx.slots.inject("conversation.composer", () => ctx.slots.register(
    {
      name: "conversation.composer",
      priority: CHAIN_PRIORITY,
      select: selectQuestionCarrier,
      locale: NS,
      store: draftStore
    },
    QuestionNoteComposer
  )), "dsh-better-choice: composer");
}
    return module.exports;
  }
});
//# sourceMappingURL=client.js.map

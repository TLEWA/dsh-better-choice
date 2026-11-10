import { randomUUID } from "node:crypto";
const name = "better-choice";
const inject = ["commands", "subagents", "tools"];
const COMMAND = "bc-ask";
const MAX_TOKENS = 32e3;
const TIMEOUT_MS = 30 * 6e4;
const DENY = "\u65C1\u95EE\u53EA\u5141\u8BB8\u6587\u5B57\u56DE\u7B54\uFF0C\u7981\u6B62\u6267\u884C\u4EFB\u4F55\u5DE5\u5177\u3002";
const ownedIds = /* @__PURE__ */ new Set();
const ownedObjects = /* @__PURE__ */ new WeakSet();
function isSideChild(agent) {
  if (agent === void 0 || agent === null) return false;
  if (ownedObjects.has(agent)) return true;
  if (agent.session !== void 0 && ownedObjects.has(agent.session)) return true;
  const id = typeof agent.id === "string" ? agent.id : agent.session?.id ?? agent.session?.header?.id;
  return typeof id === "string" && ownedIds.has(id);
}
function textOf(value) {
  return typeof value === "string" ? value.trim() : "";
}
function parsePayload(raw) {
  try {
    const value = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
    return value;
  } catch {
    return void 0;
  }
}
function optionsOf(value) {
  if (!Array.isArray(value)) return [];
  const options = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const option = item;
    const label = textOf(option.label);
    if (label === "") continue;
    const description = textOf(option.description);
    options.push(description === "" ? { label } : { label, description });
  }
  return options;
}
function notesOf(value) {
  const notes = /* @__PURE__ */ Object.create(null);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return notes;
  for (const [label, note] of Object.entries(value)) {
    const text = textOf(note);
    if (text !== "") notes[label] = text;
  }
  return notes;
}
function labelsOf(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((label) => typeof label === "string" && label.trim() !== "" ? [label] : []);
}
function normalizeCard(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const card = value;
  return {
    title: textOf(card.title),
    header: textOf(card.header),
    detail: textOf(card.detail),
    multiSelect: card.multiSelect === true,
    options: optionsOf(card.options),
    selected: labelsOf(card.selected),
    notes: notesOf(card.notes),
    custom: textOf(card.custom),
    skipped: card.skipped === true
  };
}
function renderCard(card, position, total, active) {
  const lines = [`\u3010\u95EE\u9898 ${String(position + 1)}/${String(total)}\u3011${active ? "\uFF08\u5F53\u524D\u6B63\u5728\u770B\uFF09" : ""}`];
  const header = textOf(card.header);
  const title = textOf(card.title);
  const detail = textOf(card.detail);
  const selected = labelsOf(card.selected);
  const notes = notesOf(card.notes);
  const options = optionsOf(card.options);
  if (header !== "") lines.push(`\u5206\u7EC4\uFF1A${header}`);
  if (title !== "") lines.push(`\u6807\u9898\uFF1A${title}`);
  if (detail !== "") lines.push(`\u8BF4\u660E\uFF1A${detail}`);
  lines.push(`\u7C7B\u578B\uFF1A${card.multiSelect === true ? "\u591A\u9009" : "\u5355\u9009"}`);
  if (options.length > 0) {
    lines.push("\u9009\u9879\uFF1A");
    for (const option of options) {
      const marker = selected.includes(option.label) ? "[\u5DF2\u9009]" : "[\u672A\u9009]";
      const description = option.description === void 0 ? "" : `\uFF1A${option.description}`;
      const note = notes[option.label];
      lines.push(`- ${marker} ${option.label}${description}${note === void 0 ? "" : `\uFF08\u5907\u6CE8\uFF1A${note}\uFF09`}`);
    }
  } else if (selected.length > 0) {
    lines.push(`\u5DF2\u9009\uFF1A${selected.join("\u3001")}`);
  }
  const known = new Set(options.map((option) => option.label));
  for (const [label, note] of Object.entries(notes)) {
    if (known.has(label)) continue;
    lines.push(`- [\u5907\u6CE8] ${label}\uFF1A${note}`);
  }
  const custom = textOf(card.custom);
  if (custom !== "") lines.push(`\u81EA\u5B9A\u4E49\u8F93\u5165\uFF1A${custom}`);
  if (card.skipped === true) lines.push("\u72B6\u6001\uFF1A\u7528\u6237\u6682\u65F6\u8DF3\u8FC7\u4E86\u8FD9\u9053\u9898");
  return lines.join("\n");
}
function renderThread(value) {
  if (!Array.isArray(value)) return "";
  const turns = [];
  let position = 0;
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const turn = item;
    const question = textOf(turn.question);
    const answer = textOf(turn.answer);
    if (question === "" || answer === "") continue;
    position += 1;
    turns.push(`${String(position)}. \u95EE\uFF1A${question}`, `   \u7B54\uFF1A${answer}`);
  }
  return turns.length === 0 ? "" : ["\u3010\u4E4B\u524D\u7684\u65C1\u95EE\u3011", ...turns].join("\n");
}
function buildPrompt(payload) {
  const question = textOf(payload.question);
  const wireCards = Array.isArray(payload.questions) ? payload.questions : payload.card === void 0 ? [] : [payload.card];
  const entries = [];
  for (const [position, card] of wireCards.entries()) {
    const normalized = normalizeCard(card);
    if (normalized !== void 0) entries.push({ card: normalized, position });
  }
  const requestedIndex = typeof payload.activeIndex === "number" && Number.isInteger(payload.activeIndex) ? payload.activeIndex : 0;
  const exact = entries.findIndex((entry) => entry.position === requestedIndex);
  const activeIndex = entries.length === 0 ? 0 : exact >= 0 ? exact : Math.min(Math.max(requestedIndex, 0), entries.length - 1);
  const thread = renderThread(payload.thread);
  return [
    "\u3010\u65C1\u95EE\u6A21\u5F0F\u3011",
    "\u4F60\u6B63\u5728\u56DE\u7B54\u7528\u6237\u7684\u65C1\u95EE\uFF0C\u4E0D\u662F\u5728\u56DE\u7B54\u5F85\u51B3\u95EE\u9898\u3002",
    "\u53EA\u8F93\u51FA\u6587\u5B57\u56DE\u7B54\uFF0C\u4E0D\u8981\u8C03\u7528\u4EFB\u4F55\u5DE5\u5177\uFF0C\u4E0D\u8981\u66FF\u7528\u6237\u505A\u9009\u62E9\uFF0C\u4E5F\u4E0D\u8981\u7EE7\u7EED\u539F\u4EFB\u52A1\u3002",
    "\u8BF7\u7ED3\u5408\u4E0B\u9762\u7684\u95EE\u9898\u5361\u7247\u548C\u4E4B\u524D\u7684\u65C1\u95EE\u56DE\u7B54\u7528\u6237\u3002",
    "\u7528\u6237\u63D0\u5230\u300C\u521A\u624D\u300D\u300C\u4E0A\u4E00\u6761\u300D\u65F6\uFF0C\u4F18\u5148\u6307\u3010\u4E4B\u524D\u7684\u65C1\u95EE\u3011\uFF0C\u800C\u4E0D\u662F\u4E3B\u4F1A\u8BDD\u3002",
    ...entries.length === 0 ? [] : ["", "\u3010\u5F85\u51B3\u95EE\u9898\u3011", ...entries.map((entry, index) => renderCard(entry.card, index, entries.length, index === activeIndex))],
    ...thread === "" ? [] : ["", thread],
    "",
    "\u3010\u7528\u6237\u7684\u65C1\u95EE\u3011",
    question
  ].join("\n");
}
function sanitizeAnswer(text) {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "").replace(/<function_call>[\s\S]*?<\/function_call>/gi, "").trim();
}
function fail(text) {
  return { kind: "error", text };
}
function waitUnlessAborted(result, signal, release) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      settled = true;
      signal.removeEventListener("abort", stop);
    };
    const stop = () => {
      queueMicrotask(() => {
        if (settled) return;
        finish();
        release();
        resolve(void 0);
      });
    };
    result.then(
      (value) => {
        if (settled) return;
        finish();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        finish();
        reject(error);
      }
    );
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  });
}
async function handleSideAsk(ctx, invocation) {
  const payload = parsePayload(invocation.rawInput);
  if (payload === void 0) return fail("\u65C1\u95EE\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E\u3002");
  const question = textOf(payload.question);
  if (question === "") return fail("\u8BF7\u8F93\u5165\u65C1\u95EE\u5185\u5BB9\u3002");
  const agent = invocation.agent;
  if (agent === void 0 || agent === null) return fail("\u65C1\u95EE\u4E0D\u53EF\u7528\uFF1A\u672A\u627E\u5230\u5F53\u524D\u4F1A\u8BDD\u3002");
  if (invocation.signal.aborted) return fail("\u65C1\u95EE\u5DF2\u53D6\u6D88\u3002");
  const provider = ctx.subagents.getProvider("fork");
  if (provider?.inheritsParentContext !== true) {
    return fail("\u65C1\u95EE\u4E0D\u53EF\u7528\uFF1A\u5F53\u524D DSH \u7248\u672C\u6CA1\u6709\u53EF\u7EE7\u627F\u4E0A\u4E0B\u6587\u7684 fork \u5B50\u4EE3\u7406\u3002");
  }
  if (typeof ctx.subagents.startActivation !== "function") {
    return fail("\u65C1\u95EE\u4E0D\u53EF\u7528\uFF1A\u5F53\u524D DSH \u7248\u672C\u4E0D\u652F\u6301 fork \u5B50\u4EE3\u7406\u542F\u52A8\u3002");
  }
  const parentMax = agent.options?.maxTokens;
  const maxTokens = typeof parentMax === "number" && parentMax > 0 ? Math.min(MAX_TOKENS, parentMax) : MAX_TOKENS;
  const childId = randomUUID();
  ownedIds.add(childId);
  let childAgent;
  const stopCreated = ctx.on?.("agent/created", ({ agent: created }) => {
    if (created?.id !== childId) return;
    childAgent = created;
    ownedObjects.add(created);
    if (created.session !== void 0) ownedObjects.add(created.session);
  });
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = AbortSignal.any([invocation.signal, timeout]);
  let activation;
  let started = false;
  let disposing;
  const disposeChild = () => {
    disposing ??= Promise.resolve(activation?.dispose()).then(() => void 0).catch(() => void 0);
    return disposing;
  };
  const releaseOwnership = () => {
    ownedIds.delete(childId);
    if (childAgent !== void 0) {
      ownedObjects.delete(childAgent);
      if (childAgent.session !== void 0) ownedObjects.delete(childAgent.session);
    }
  };
  try {
    activation = await ctx.subagents.startActivation({
      provider: "fork",
      label: "BC \u65C1\u95EE",
      childId,
      request: {
        parent: agent,
        agentOptions: { maxTokens },
        // One trailing user message is the only new input. A completed parent
        // turn is replayed by the fork provider; a pending tool-call turn is
        // not part of the seed, so the card context travels in this prompt.
        prompt: [{ type: "text", text: buildPrompt(payload) }]
      },
      signal,
      delivery: "caller"
    });
    started = true;
    const result = await waitUnlessAborted(activation.result, signal, () => {
      void disposeChild();
    });
    if (result === void 0) return fail("\u65C1\u95EE\u5DF2\u53D6\u6D88\u3002");
    if (result.stopReason === "aborted") return fail("\u65C1\u95EE\u5DF2\u53D6\u6D88\u3002");
    const text = sanitizeAnswer(result.output.filter((block) => block.type === "text").map((block) => block.text ?? "").join(""));
    if (result.stopReason !== "completed") {
      const reason = result.stopReason === "max-tokens" ? "\u65C1\u95EE\u8F93\u51FA\u8FBE\u5230\u4E0A\u9650\u3002" : `\u65C1\u95EE\u672A\u5B8C\u6210\uFF08${result.stopReason}\uFF09\u3002`;
      return fail(text === "" ? reason : `${reason}

${text}`);
    }
    if (text === "") return fail("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u5185\u5BB9\u3002");
    return { kind: "success", text };
  } catch (error) {
    if (signal.aborted) return fail("\u65C1\u95EE\u5DF2\u53D6\u6D88\u3002");
    const message = error instanceof Error ? error.message : String(error);
    return fail(`\u65C1\u95EE\u5931\u8D25\uFF1A${message}`);
  } finally {
    stopCreated?.();
    if (started) {
      await disposeChild();
      releaseOwnership();
    } else if (typeof ctx.subagents.drainChildren === "function") {
      try {
        await ctx.subagents.drainChildren(agent, [childId]);
        releaseOwnership();
      } catch (error) {
        ctx.logger?.warn("better-choice: failed to drain a rejected side-ask child", error);
      }
    }
  }
}
function apply(ctx) {
  const releaseGuard = ctx.tools.guard((exec) => isSideChild(exec.agent) ? DENY : void 0);
  ctx.effect?.(() => releaseGuard);
  ctx.commands.register({
    name: COMMAND,
    description: "\u5411\u5F53\u524D\u4F1A\u8BDD\u7684 fork \u5B50\u4EE3\u7406\u63D0\u51FA\u4E00\u4E2A\u53EA\u8BFB\u65C1\u95EE\u3002",
    input: { hint: "\u65C1\u95EE\u5185\u5BB9\uFF08JSON\uFF0C\u7531\u95EE\u9898\u5361\u81EA\u52A8\u751F\u6210\uFF09" },
    // The payload contains the whole pending card; never persist it in the
    // command log alongside the conversation.
    recordInput: false,
    handler: (invocation) => handleSideAsk(ctx, invocation)
  });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map

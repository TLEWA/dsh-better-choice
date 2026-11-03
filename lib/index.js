const name = "better-choice";
const inject = ["commands", "llm"];
const HISTORY_LIMIT = 12e4;
const MAX_TOKENS = 700;
const COMMAND = "bc-ask";
function hasToolCall(message) {
  if (!Array.isArray(message.content)) return false;
  return message.content.some((block) => {
    if (typeof block !== "object" || block === null) return false;
    return block.type === "tool-call";
  });
}
function conversationHistory(agent) {
  let source;
  try {
    source = agent.session?.deriveMessages?.() ?? [];
  } catch {
    return [];
  }
  const messages = source.filter(
    (message) => typeof message === "object" && message !== null
  );
  while (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === "tool" || last.role === "assistant" && hasToolCall(last)) {
      messages.pop();
      continue;
    }
    break;
  }
  return messages;
}
function trimHistory(messages) {
  let used = 0;
  let first = messages.length;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const size = JSON.stringify(messages[index]).length;
    if (first < messages.length && used + size > HISTORY_LIMIT) break;
    used += size;
    first = index;
  }
  while (first < messages.length) {
    const role = messages[first].role;
    if (role === "tool" || role === "assistant" && hasToolCall(messages[first])) {
      first += 1;
      continue;
    }
    break;
  }
  return messages.slice(first);
}
function renderCard(card) {
  const lines = [];
  const title = typeof card.title === "string" ? card.title.trim() : "";
  const header = typeof card.header === "string" ? card.header.trim() : "";
  const detail = typeof card.detail === "string" ? card.detail.trim() : "";
  if (header !== "") lines.push(`\u5206\u7C7B\uFF1A${header}`);
  if (title !== "") lines.push(`\u95EE\u9898\uFF1A${title}`);
  if (detail !== "") lines.push(`\u8865\u5145\u8BF4\u660E\uFF1A${detail}`);
  const options = Array.isArray(card.options) ? card.options : [];
  if (options.length > 0) {
    lines.push("\u9009\u9879\uFF1A");
    options.forEach((option, index) => {
      if (typeof option !== "object" || option === null) return;
      const record = option;
      const label = typeof record.label === "string" ? record.label : "";
      const description = typeof record.description === "string" ? record.description.trim() : "";
      if (label === "") return;
      lines.push(`${String(index + 1)}. ${label}${description === "" ? "" : ` \u2014\u2014 ${description}`}`);
    });
  }
  const selected = Array.isArray(card.selected) ? card.selected.filter((item) => typeof item === "string") : [];
  if (selected.length > 0) lines.push(`\u5F53\u524D\u5DF2\u9009\uFF1A${selected.join("\u3001")}`);
  const notes = typeof card.notes === "object" && card.notes !== null ? card.notes : {};
  const noteLines = Object.entries(notes).filter((entry) => typeof entry[1] === "string" && entry[1].trim() !== "").map(([label, note]) => `${label}\uFF1A${note.trim()}`);
  if (noteLines.length > 0) lines.push(`\u7528\u6237\u8865\u5145\uFF1A${noteLines.join("\uFF1B")}`);
  const custom = typeof card.custom === "string" ? card.custom.trim() : "";
  if (custom !== "") lines.push(`\u7528\u6237\u81EA\u7531\u8F93\u5165\uFF1A${custom}`);
  return lines.join("\n");
}
function buildPrompt(payload) {
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  const card = payload.card === void 0 ? "" : renderCard(payload.card);
  return [
    "\u3010\u65C1\u95EE\u6A21\u5F0F\u3011",
    "\u7528\u6237\u6B63\u5728\u56DE\u7B54\u4E0B\u9762\u7684\u5F85\u51B3\u95EE\u9898\uFF0C\u6682\u65F6\u4E0D\u80FD\u63D0\u4EA4\uFF0C\u4E8E\u662F\u5148\u5411\u4F60\u63D0\u4E00\u4E2A\u65C1\u95EE\u3002\u4E0A\u9762\u7684\u5BF9\u8BDD\u5C31\u662F\u5F53\u524D\u4F1A\u8BDD\u7684\u771F\u5B9E\u4E0A\u4E0B\u6587\u3002",
    "\u8BF7\u76F4\u63A5\u56DE\u7B54\u65C1\u95EE\uFF0C\u8981\u6C42\uFF1A",
    "- \u57FA\u4E8E\u5DF2\u53D1\u751F\u7684\u5BF9\u8BDD\u3001\u95EE\u9898\u3001\u9009\u9879\u548C\u7528\u6237\u5F53\u524D\u7684\u8865\u5145\u6765\u56DE\u7B54\uFF0C\u4E0D\u8981\u53EA\u590D\u8FF0\u5361\u7247\u3002",
    "- \u7B80\u6D01\u51C6\u786E\uFF0C\u901A\u5E38 1-4 \u53E5\uFF0C\u4E0D\u8981\u91CD\u590D\u95EE\u9898\u3002",
    "- \u4E0D\u8981\u66FF\u7528\u6237\u505A\u9009\u62E9\uFF0C\u4E0D\u8981\u7EE7\u7EED\u539F\u4EFB\u52A1\uFF0C\u4E0D\u8981\u8C03\u7528\u4EFB\u4F55\u5DE5\u5177\u3002",
    "- \u4FE1\u606F\u786E\u5B9E\u4E0D\u8DB3\u65F6\u660E\u786E\u6307\u51FA\u7F3A\u5C11\u4EC0\u4E48\uFF0C\u4E0D\u8981\u7F16\u9020\u3002",
    card === "" ? "" : `
\u3010\u95EE\u9898\u5361\u7247\u3011
${card}`,
    `
\u3010\u7528\u6237\u7684\u65C1\u95EE\u3011
${question}`
  ].filter((part) => part !== "").join("\n");
}
async function streamText(stream) {
  let text = "";
  for await (const chunk of stream) {
    if (chunk.type === "text-delta" && typeof chunk.text === "string") {
      text += chunk.text;
      continue;
    }
    if (chunk.type === "finish") {
      const reason = chunk.reason;
      if (reason === "error" || chunk.kind === "error") {
        const failure = chunk.failure;
        throw new Error(typeof failure?.message === "string" ? failure.message : "\u6A21\u578B\u8C03\u7528\u5931\u8D25");
      }
      continue;
    }
    if (chunk.kind === "error") {
      const failure = chunk.failure;
      throw new Error(typeof failure?.message === "string" ? failure.message : "\u6A21\u578B\u8C03\u7528\u5931\u8D25");
    }
  }
  return text.trim();
}
function apply(ctx) {
  ctx.commands.register({
    name: COMMAND,
    description: "Answer a side question for the pending question card",
    input: { hint: "<json>" },
    async handler({ agent, rawInput, signal }) {
      let payload;
      try {
        payload = JSON.parse(rawInput.trim());
      } catch {
        return { kind: "error", text: "\u65C1\u95EE\u8BF7\u6C42\u683C\u5F0F\u65E0\u6548" };
      }
      const question = typeof payload.question === "string" ? payload.question.trim() : "";
      if (question === "") return { kind: "error", text: "\u65C1\u95EE\u5185\u5BB9\u4E3A\u7A7A" };
      const provider = agent.options?.provider ?? "";
      const model = agent.options?.model ?? "";
      if (provider === "" || model === "") {
        return { kind: "error", text: "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B\u8DEF\u7531" };
      }
      signal.throwIfAborted();
      try {
        const history = trimHistory(conversationHistory(agent));
        const header = agent.session?.requestHeader?.();
        const tools = Array.isArray(header?.tools) && header.tools.length > 0 ? header.tools : void 0;
        const toolHistory = agent.session?.toolHistory?.();
        const text = await streamText(ctx.llm.stream({
          provider,
          model,
          ...agent.options?.reasoningEffort === void 0 ? {} : { reasoningEffort: agent.options.reasoningEffort },
          ...tools === void 0 ? {} : { tools },
          ...toolHistory === void 0 ? {} : { toolHistory },
          maxTokens: MAX_TOKENS,
          // Reuse the session's own derived messages as the prefix. We only
          // append; the session log itself is never touched, so the main
          // conversation's cacheable prefix stays intact.
          messages: [
            ...history,
            {
              role: "user",
              content: [{ type: "text", text: buildPrompt(payload) }]
            }
          ]
        }));
        if (text === "") return { kind: "error", text: "\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u5185\u5BB9" };
        return { kind: "success", text };
      } catch (error) {
        return {
          kind: "error",
          text: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map

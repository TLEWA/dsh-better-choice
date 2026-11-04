# AI 使用与代码来源声明

[简体中文](AI_USAGE.md) · [English](AI_USAGE.en.md)

本文说明 `dsh-better-choice` 中人工智能（AI）的参与范围、人工审核方式、代码引用
来源与免责边界。它不改变 [LICENSE](LICENSE)（MIT）的任何条款。

## 1. 结论摘要

- 本项目的**源码与文档主要由 AI 辅助生成**，由项目所有者提出需求、审阅并验证。
- AI 不是版权主体；本项目按 MIT 许可发布，使用者获得的权利与义务以 MIT 为准。
- 项目**不提供任何担保**。AI 生成的代码可能包含错误、遗漏或不适用于你的环境。
- 第三方代码的版权与许可单独列在 [NOTICE.md](NOTICE.md)，不因本项目采用 MIT 而改变。

## 2. 使用的工具与模型

- 开发环境：DeepSeek Harness（DSH）编码智能体。
- 模型：`deepseek-flash`（DeepSeek）。
- 交互方式：项目所有者以自然语言提出需求、指出缺陷并确认行为；智能体读取 DSH 内置
  包接口、官方问题卡组件与参考插件源码，编写/重构代码、文档与测试，并在本机验证。

## 3. AI 参与的范围

| 部分 | AI 参与程度 | 说明 |
| --- | --- | --- |
| `src/client/*` | 高 | 问题卡增强、旁问线程、载体识别与样式生成 |
| `src/index.ts` | 高 | `bc-ask` 命令、fork 子代理激活、旁问提示词 |
| `scripts/*` | 高 | esbuild 构建与 CSS 前缀生成 |
| `test/*.test.mjs` | 高 | 包清单、产物与宿主命令测试 |
| `README*.md` / `NOTICE*.md` / 本文 | 高 | 由 AI 起草并随代码更新 |
| 需求、缺陷判断、最终取舍 | 人类 | 由项目所有者决定 |

没有人类逐行重写全部代码。人工审核以**行为验证**为主：阅读关键路径、运行测试、
在真实 DSH 客户端中触发问题卡并观察结果。

## 4. 已验证与未验证

已验证：

- `npm run build`、`npm run check` 通过；
- 8 项 `node:test` 通过：包元数据与 `files`、`dsh` 清单、客户端 ModuleLoader 信封、
  宿主插件导出、`bc-ask` 启动 fork 子代理、执行期 guard 拒绝子代理工具、多题/线程
  提示词、stopReason 分支与非法/空请求拒绝；
- 在 Windows 上的 DSH 桌面端 Web GUI（`127.0.0.1:9260`）中打开一个真实的待决问题，
  用 CDP `Input.dispatchMouseEvent` 发送右键 `mousePressed` / `mouseReleased`：
  - 右键后选项 A 被选中，其下方出现补充输入框；
  - 输入备注并提交后，模型回复中显示「选项A / 补充备注：测试备注-仅验证」，
    证明备注被合并进 `custom` 并送达模型；
- 在独立 `bc-test` profile（`127.0.0.1:7166`）中真机验证旁问：卡片内旁问框可发起
  `bc-ask`，宿主生成独立 fork 子会话；子代理能复述父会话首条指令（seed 生效）。
  首轮主请求与紧随的 fork 子请求 `cacheReadTokens` 均为 8448；父会话完成一轮后，
  子请求增至 9344（前缀缓存命中）；父会话 `command/run` 不含 args
  （`recordInput: false` 生效）。
- 在 DSH `0.2.2-rc.1` Web 宿主（`127.0.0.1:9687`）用 CDP `Input.dispatchMouseEvent`
  复验完整链路：右键选项出现补充框，输入「不要香菜」后提交的答案显示为
  「B 沙拉，不要香菜」；fork 旁问返回回答、卡片保持待答，提交后正常关闭。
  同一版本下 `npm run typecheck` 直接针对真实客户端契约包通过。

未完全验证：

- 所有 DSH 版本、主题、缩放比例与多显示器组合；
- macOS / Linux 客户端；
- 多选备注的 `(未选)` 标记、连续多题、超时后续答等所有分支的逐项人工验证；
- 超长会话接近模型上下文窗口时的边界行为；
- 与其他第三方 composer 插件同时接管同一槽位时的组合行为。

## 5. 代码来源与引用

- 问题卡组件结构与样式改编自 [`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note)
  （MIT，NedFlanders），复用范围与许可证全文见 [NOTICE.md](NOTICE.md)。
- 旁问交互受 [`dsh-btw`](https://github.com/MichengAI/dsh-btw)（Apache-2.0）启发；
  本项目通过宿主公开的 `ctx.subagents.startActivation` 与 fork provider 自行实现，
  未复制其源代码。
- 对接 DSH 内置包时只读取其公开接口、类型与运行时行为，**未复制内置包源代码**。
- 仓库历史（Git commits）记录了每次变更。

## 6. 数据与隐私

- 插件在本地运行，**不包含遥测、统计上报或第三方远程请求**。
- 旁问会把「当前会话已有上下文 + 你输入的问题 + 当前问题卡片」发送给**当前会话
  配置的模型提供商**；这与正常对话走同一条模型通道，不额外发往其他服务。
- 插件不把旁问问答写回父会话；fork 子代理有独立的子会话日志（与普通子代理相同）。
  旁问问题正文不会写入父会话的 `command/run`（`recordInput: false`），刷新或关闭卡片后
  当前页面内的旁问线程消失。
- 补充备注只随答案进入正常的 `ask_user_question` 回答，不单独上传。

## 7. 使用建议

1. 在生产环境采用前，阅读 `lib/client.js` 与 `lib/index.js`，确认行为符合预期。
2. 运行 `npm test` 与 `npm run check`。
3. 保留 `NOTICE.md` 与 `LICENSE`，以满足上游 MIT 的署名要求。
4. 若发现 AI 生成代码导致的问题，请提交 issue 或 PR；欢迎人工修正。

## 8. 免责声明

本项目按“现状”提供，不附带任何明示或默示的担保，包括但不限于适销性、特定用途适用性
与不侵权担保。使用本项目造成的任何直接或间接损失，作者与贡献者不承担责任。完整条款
以 [LICENSE](LICENSE) 为准。

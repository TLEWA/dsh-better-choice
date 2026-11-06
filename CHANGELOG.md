# 更新日志

记录本项目的所有重要变更。版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

[简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md)

## [1.0.4] - 2026-11-06

### 修复

- 右键打开某个选项的补充说明后再点另一个选项，原来的选项仍留着蓝色高亮，看起来
  像“点不动、切不过去”。现在点击（或在单选里右键）使其他选项失选时，会一并关闭
  那些选项的补充输入行；已输入的补充文字仍保存在草稿里，提交时按“(未选)”带上，
  不会丢失。
- 旁问返回长回答后，旁问面板会把上方的选项区压到只剩几十像素（实测 39px）。现在
  有旁问线程时选项区保底 `min(200px, calc(min(66vh,560px) - 260px))`，旁问面板先
  让出高度并在自己的线程内滚动；卡片上限由 `min(60vh,520px)` 提到
  `min(66vh,560px)`。没有旁问线程时卡片尺寸与之前完全一致。

### 兼容

- 已在 DSH `0.2.2-rc.1` Web 宿主真机验证：右键补充、切换选项、长旁问回复下的
  卡片布局、最小化、自定义答案替换选择均正常。

## [1.0.3] - 2026-11-05

### 变更

- `package.json` 新增 `engines.dsh: ">=0.2.0-rc.1 <0.3.0-0"`，显式声明适配的
  DSH 版本区间。DSH 插件市场与宿主据此展示、校验兼容版本（此前未声明
  `engines.dsh`，市场显示为不限版本）。
- 无运行时代码改动。
- Release 工作流额外上传版本无关的 `dsh-better-choice.tgz`，便于长期引用
  `releases/latest/download/` 链接。

### 兼容

- 适配 DSH `0.2.0-rc.1` 起的 `0.2.x`；已在 `0.2.2-rc.1` Web 宿主真机验证。

## [1.0.2] - 2026-11-05

### 变更

- 开发期类型检查改为直接使用真实 DSH `0.2.2-rc.1` 客户端契约包
  （`dsh-client-ui-renderer`、`dsh-client-ui-session`、`dsh-client-ui-slots`、
  `dsh-client-locale`、`dsh-client-ui-conversation`），删除会遮蔽真实类型的本地
  ambient shim；`types/client-env.d.ts` 只做类型引入。`npm run typecheck`
  现在能真实暴露槽位与 `PendingQuestion` 契约变化。
- devDependencies 新增 `@deepseek-ai/dsh-client-ui-renderer` 与
  `@deepseek-ai/dsh-client-ui-session`（`^0.2.2-rc.1`）。

### 兼容

- 已在 DSH `0.2.2-rc.1` Web 宿主真机验证：问题卡渲染、CDP 真实右键补充、
  补充内容合并进答案、fork 旁问、提交并关闭卡片全部正常。
- 宿主命令、subagent、tool guard、slot 链与 `PendingQuestion` 契约在 0.2.2-rc.1
  下均无破坏性变化；本轮没有客户端或宿主运行时代码改动，peer 依赖保持
  `^0.2.0-rc.1`（`0.2.0-rc` 族均可安装）。

## [1.0.1] - 2026-11-04

### 修复

- 旁问框不会再让 timed 卡片在你阅读或撰写旁问时继续倒计时：聚焦暂停、失焦恢复，
  发送旁问后卡片进入「会一直等你回答」。此前等待回答期间可能超时，导致卡片无法提交、
  只能关闭。
- 旁问状态改为按题隔离：忙碌、错误、取消不再串题；新增「取消旁问」按钮可中止进行中的
  回答，每个线程最多保留 20 轮。
- 宿主对旁问线程连续编号（1、2、3，而不是 1、3、5）；活动题按原始 wire 位置标记；
  用户跳过某题时会写进提示词。
- `startActivation` 在 fork 子代理已建立后抛错时，子代理仍受只读 guard 约束，不再漏出。
- 单选答案带自定义文本时提交空的 `selected`，与官方组件一致。
- 只有真正能打开补充框时才拦截选项右键菜单；选项的无障碍名称包含描述、推荐与备注状态；
  空问题批次有兜底，不再可能崩溃。
- 客户端 `RemoteCommands` 类型改为真实的 `remote.commands.execute` 形状；
  `@deepseek-ai/dsh-api-remotes` 补进 peerDependencies。

### 变更

- 旁问改为 fork 子代理（`ctx.subagents.startActivation` + `delivery: 'caller'`），
  不再直接调用 `ctx.llm.stream`。fork seed 截止到父会话最后一个已完成 `turn/end`，
  复用父会话已完成回合的前缀与提示缓存，且不写入父会话。
- 每次旁问都在执行期受 guard 约束：子代理不能调用工具；父调用 `signal` 加 30 分钟
  watchdog 可取消；输出上限 `min(32000, parent.maxTokens)`。
- 客户端会把全部问题、当前题下标、备注以及本线程之前的旁问一起交给宿主；宿主显式渲染，
  并提示模型「刚才 / 上一条」优先指旁问线程。
- `bc-ask` 使用 `recordInput: false` 注册，父会话的 `command/run` 不再持久化问题正文。
- 新增 `tsconfig.json` 与 `npm run typecheck`（`prepack`/`prepublishOnly` 也会执行）；
  测试增至 12 项。
- 文档补充 fork 架构、只读 guard、倒计时暂停/进入等待的行为与缓存说明。

## [1.0.0] - 2026-11-04

首次公开发布。

### 新增

- 右键选项展开补充说明输入框；单选、多选都按选项保存，提交时合并进答案的 `custom`。
- 卡片底部旁问框：不离开卡片就能向当前模型提问，得到只读回答。
- 旁问复用会话的派生历史、模型路由、工具声明与工具历史，但不写入会话，主提示前缀与
  缓存保持不变。
- 跟随 DSH locale 的中英文案。

### 兼容

- DSH 客户端 `0.2.0-rc` 族（`^0.2.0-rc.1`）。
- Node.js 20 或更高。

### 说明

- 只接管通用选择题；计划审查、审批等卡片仍由官方组件处理。
- 无遥测、无远程端点；旁问不执行任何工具。

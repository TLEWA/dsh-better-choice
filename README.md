# dsh-better-choice

<img src="https://raw.githubusercontent.com/TLEWA/dsh-better-choice/main/assets/icon-180.png" width="96" align="right" alt="插件图标" />

[![CI](https://github.com/TLEWA/dsh-better-choice/actions/workflows/ci.yml/badge.svg)](https://github.com/TLEWA/dsh-better-choice/actions/workflows/ci.yml)
[![Release](https://github.com/TLEWA/dsh-better-choice/actions/workflows/release.yml/badge.svg)](https://github.com/TLEWA/dsh-better-choice/releases)
[![npm version](https://img.shields.io/npm/v/dsh-better-choice.svg)](https://www.npmjs.com/package/dsh-better-choice)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[简体中文](README.md) · [English](README.en.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）的 `ask_user_question`
问题卡片加两个能力：

- **右键选项写补充**：右键任意选项，就在该选项下方展开一个补充说明输入框；
  提交时说明与所选项一起交给模型，不用把一整段解释塞进「其他」。
- **先问一句再选**：卡片底部有一个旁问框，基于当前会话的真实上下文回答你的疑问；
  答案只显示在卡片里，不提交、不污染主对话，也不替你做出选择。

左键选择、跳过、上一题 / 下一题、倒计时与「慢慢回答」等官方行为全部保留。
计划审查（plan-review）、审批等非通用问题卡片仍由官方组件处理。

## 功能

| 能力 | 行为 |
| --- | --- |
| 右键展开补充框 | 右键选项即展开输入框，并在不覆盖底部自定义答案时选中该项；切到下一题时自动收起，文字保留 |
| 每个选项独立记忆 | 单选、多选都按选项分别保存补充内容，切换选项不会串稿 |
| 提交不改变协议 | `selected` 仍是原始选项文字；补充说明合并进 `custom`，无补充时与官方请求完全一致 |
| 未选也可备注 | 多选时给未勾选的选项写了备注，提交文本会标注 `(未选)`，模型能分清语气 |
| 旁问当前会话 | 以 fork 子代理复用当前会话已完成的上下文、模型与工具声明，回答「这个选项到底什么意思」这类问题 |
| 旁问不打断作答 | 每题独立线程、可连续追问；聚焦旁问框时卡片倒计时暂停，失焦恢复；点「提问」后卡片进入等待，不再超时 |
| 旁问可取消 | 回答中显示「取消旁问」，取消后线程里留下已取消提示，可以换个问法再问；取消或 30 分钟超时会停止并释放后台 fork 子代理 |
| 旁问只读 | 执行期拦截一切工具调用，不继续原任务、不替用户选择；输出上限 32K tokens（不超过父会话上限） |
| 官方交互保留 | 左键选择、自由输入行、跳过、翻页、倒计时、超时后续答、已结算回看均不受影响 |

### 右键补充

单选时右键某个选项，会先选中它，再在选项下方展开输入框；如果底部已经写了自定义答案，
则以自定义答案为准，不再改变选中，备注按 `(未选)` 提交。填写的内容不会替换选项，
而是作为该选项的附注：

```json
{
  "answers": [
    {
      "id": "question-id",
      "selected": ["方案 B"],
      "custom": "方案 B: 先灰度 5%，观察一小时再全量"
    }
  ]
}
```

多选时每个选项各有一条附注，提交时一行一个：

```text
方案 A: 需要保留旧接口
方案 C: 下个迭代再删
```

没有填写任何附注时，请求与官方完全一致，不额外生成 `custom`。

### 旁问

问题卡片底部有「先问一句」输入区。Enter 发送，Shift+Enter 换行；回答完成后写入卡片，
可以继续追问。旁问使用当前会话的模型与上下文，但：

- 会启动一个 fork 子代理；它通过 `delivery: 'caller'` 挂在当前命令调用上，不排队等父回合，
  所以父会话正卡在 `ask_user_question` 时也能回答；
- 不把问答写回父会话的消息流；子代理有独立的子会话日志，父会话只记录
  `command/run`、`subagent/catalog` / `command/done`（不记录问题正文）；
- 执行期 guard 拒绝一切工具调用，不改文件，也不替你提交答案。

倒计时开着也来得及想：把光标放进旁问框，卡片会显示「已暂停」（倒计时停住），失焦后
自动恢复；点「提问」后卡片进入「会一直等你回答」，不会再因为等回答而超时。旁问线程按题
分开保存，切题再回来仍能看到原来的问答；回答中可点「取消旁问」中止，每个线程最多保留
20 轮，避免长会话无限增长。

适合问：「这两个选项在生产环境下的差别是什么？」「选 B 的话需要改哪些文件？」
「刚才那个结论的依据在哪？」——问完再点选项。

## 安装

要求 DSH 0.2.0-rc 族（`engines.dsh: >=0.2.0-rc.1 <0.3.0-0`，客户端内置包
`^0.2.0-rc.1`），Node.js 20+；已在 DSH `0.2.2-rc.1` 上验证。

### 从 npm 安装（推荐）

1. 打开侧边栏 **插件** 页 → **安装插件**；
2. 输入包名并确认：

   ```text
   dsh-better-choice
   ```

3. 安装完成后硬刷新（`Ctrl+Shift+R`）；若宿主半边未生效，重启桌面端。

固定版本：

```text
dsh-better-choice@1.2.0
```

命令行等价写法：

```powershell
dsh plugin --profile desktop add dsh-better-choice@1.2.0
```

### 从 GitHub 安装

仓库的 `lib/` 已是可直接运行的产物，安装时不需要本地构建：

```text
https://github.com/TLEWA/dsh-better-choice
```

固定到标签：

```text
https://github.com/TLEWA/dsh-better-choice#v1.2.0
```

或直接安装 Release 附件：

```text
https://github.com/TLEWA/dsh-better-choice/releases/latest/download/dsh-better-choice.tgz
```

命令行等价写法：

```powershell
dsh plugin --profile desktop add github:TLEWA/dsh-better-choice#v1.2.0
```

### 从源码安装

```powershell
git clone https://github.com/TLEWA/dsh-better-choice.git
cd dsh-better-choice
npm install
npm run build
npm test
dsh plugin --profile desktop add .
```

安装或升级后硬刷新页面；宿主命令 `bc-ask` 未注册时，旁问框会提示失败，重启桌面端即可。

## 使用

1. 等模型发起一个普通的选择题；
2. 想补充约束：右键选项，写完后正常提交；
3. 想先确认信息：在底部旁问框提问，看完回答再选；
4. 两者可以同时使用，旁问内容不会进入最终答案。

右键在触控板上通常是双指点按；没有右键的设备仍可正常左键作答，只是用不到补充框。

## 实现

### 客户端：接在官方 composer 链上

浏览器半边向 `conversation.composer` 链式槽注册，`priority: -10`（官方默认 0），
因此先于官方组件被询问。选择器以结构化方式识别通用 `PendingQuestion` 载体；
识别失败或不是通用问题卡时返回 `null`，自动落回官方组件。

组件本身是官方通用问题流程的移植：保留卡片结构、推荐标记解析、倒计时、
自由输入行与提交逻辑，只增加「按选项的补充框」与「底部旁问线程」。
样式由官方问题卡 CSS 派生并加 `bc_` 前缀，避免污染其他插件。

### 宿主：一个只读的旁问命令

旁问通过本插件自己的命令 `bc-ask` 完成，客户端把问题、全部问题卡片、已写备注和本线程
之前的旁问序列化后交给宿主。宿主：

- 用 `ctx.subagents.startActivation({ provider: 'fork', delivery: 'caller' })` 启动一个
  fork 子代理；fork provider 会把父会话最后一个 `turn/end` 之前的已完成回合作为 seed，
  当前尚未完成的 tool-call 回合不会进入 seed；
- 只追加一条尾部 user 消息（旁问模式 + 问题卡片 + 之前的旁问 + 本次问题），不改 system、
  不改工具声明、不重写历史，因此前缀与父会话已完成回合保持一致；
- 子代理继承父会话的 provider / model / reasoningEffort，`maxTokens` 取
  `min(32000, parent.maxTokens)`；父调用的 signal 与 30 分钟 watchdog 一起透传；
- 子代理执行期挂 `tools.guard`，任何工具调用都会被拒绝；回答只取文本，并清理模型误发的
  `<tool_call>` 伪影；
- 子代理不把问答写回父 session；父会话只落 `command/run`、`subagent/catalog` 与
  `command/done`，且 `recordInput: false` 不记录问题正文。

fork 子代理复用父会话已完成回合的前缀，provider 可以命中已有 prompt cache。实测主请求与
紧随其后的 fork 子请求都会报告非零 `cacheReadTokens`，并随父会话已完成回合增长（本机
DeepSeek 路由为自动前缀缓存）。

## 目录

```text
src/index.ts                 宿主入口：bc-ask 命令、fork 子代理、旁问提示词
src/client/index.ts          客户端入口：样式、词典、slot 注册、旁问桥
src/client/composer.tsx      增强问题卡：右键补充、旁问线程、提交组装
src/client/carrier.ts        结构化识别通用 PendingQuestion
src/client/draft-store.ts    草稿与备注的跨渲染存储
src/client/side.ts           旁问服务接口
src/client/locales.ts        中英文案
src/client/styles.ts         由 scripts/gen-css.mjs 生成的样式
scripts/build.mjs            esbuild 构建（客户端 CJS 信封 + 宿主 ESM）
scripts/gen-css.mjs          从参考样式生成带前缀的 CSS
scripts/upstream-composer.module.css  上游 MIT 样式（已内置，构建无需外部目录）
lib/                         构建产物（已提交，可直接安装）
cordis.patch.yml             bundle patch：把宿主行插入 profile 插件树
test/package.test.mjs        包元数据、产物与清单校验
```

## 开发

```powershell
npm install
npm run build
npm run check
npm test          # node:test
npm pack
```

`npm pack` 的 `prepack` 会重新构建、检查并跑测试。客户端产物是带
`window.__ModuleLoader__` 信封的 CJS，宿主产物是不打包的 ESM。

## 兼容性

按 DSH 客户端 `0.2.2-rc.1` 的 composer 槽与 `PendingQuestion` 契约做类型校验，
manifest 的 `engines.dsh` 声明为 `>=0.2.0-rc.1 <0.3.0-0`，peer 依赖声明为
`^0.2.0-rc.1`；已在 `0.2.2-rc.1` Web 宿主真机验证。DSH 升级若改动
问题卡内部结构：

- 识别失败时增强卡片不接管，官方问题卡仍可用；
- 旁问依赖宿主命令、`ctx.subagents.startActivation` 与 fork provider；接口变化时旁问会报错，
  但不影响正常作答。

## 已知限制

- 只接管通用选择题；计划审查、审批等卡片保持官方实现。
- 旁问固定在当前会话的模型上，不提供单独选择模型或推理强度的入口。
- 旁问是只读的：需要读文件、跑命令才能回答的问题，应直接在对话里问。
- fork seed 只包含父会话最后一个已完成回合；当前未完成的回合（例如正在等待回答的这一轮）
  不会进入 seed，旁问需要从问题卡片和之前的旁问里了解它。
- 旁问回答目前是完成后整段出现，不是逐字流式显示；超长回答受 32K 输出上限约束。
- 没有右键输入的设备无法使用补充框，但左键作答完全不受影响。

## 我的其他 DSH 项目

问题卡片只是 DSH 的一小块。下面这些插件也都由我维护，按需取用。

- **[dsh-sidebar-row-menu](https://github.com/TLEWA/dsh-sidebar-row-menu)** —— 侧栏行的右键菜单：工作区菜单与原生会话菜单扩展，带「打开方式」二级菜单、置顶应用、逐项菜单位置与已归档会话清理。
- **[dsh-sidebar-organizer](https://github.com/TLEWA/dsh-sidebar-organizer)** —— 七区域布局整理器：侧栏、侧栏底部、对话标签、输入框、会话头部、右侧栏、设置导航都能长按拖拽排序，面板可以收进「更多」再拖回来。
- **[dsh-if](https://github.com/TLEWA/dsh-if)** —— `/if` 命令：让模型结合上文判断条件，成立才把下面的指令作为用户消息发出。
- **[dsh-utf8-output](https://github.com/TLEWA/dsh-utf8-output)** —— 修复 Windows 下 DSH 子进程 GBK/CP936/GB18030 输出乱码。
- **[dsh-opencode-go-router](https://github.com/TLEWA/dsh-opencode-go-router)** —— 上下文折叠或系统提示被重写后轮换 OpenCode Go 路由，少丢一点提示缓存。
- **[dsh-fastload](https://github.com/TLEWA/dsh-fastload)** —— 长会话首屏历史瘦身：缩小首次打开时的历史页，同时保留用户实际看到的尾部内容。
- **[dsh-ptc-noargs](https://github.com/TLEWA/dsh-ptc-noargs)** —— 修复 PTC `run_code` 中无参工具调用被拒绝的问题：把省略或 `undefined` 的首参归一化为 `{}`。

## 许可与来源

本项目以 [MIT](LICENSE) 发布。问题卡的组件结构与样式派生自
[`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note)
（MIT，NedFlanders）；旁问交互参考了
[`dsh-btw`](https://github.com/MichengAI/dsh-btw)（Apache-2.0）的设计。
具体复用范围与许可证全文见 [NOTICE.md](NOTICE.md)；
AI 参与范围与验证边界见 [AI_USAGE.md](AI_USAGE.md)。

DSH 本身及其内置包的版权归 DeepSeek 所有，不因本项目的 MIT 许可而改变。

版本变更见 [更新日志](CHANGELOG.md)（[English](CHANGELOG.en.md)）。

## Codex PR 审阅

本仓采用[中心 CI](https://github.com/TLEWA/dsh-plugin-ci)的 v1 公共审阅规则，实际规则保存在 AGENTS.md。云端 Codex 审阅 PR 及新提交，维护者最终批准并合并；审阅结论必须对应最新提交。审阅消耗订阅用量，漏触发时可用 `@codex review` 补审。

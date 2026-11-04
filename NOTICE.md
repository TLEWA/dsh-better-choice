# NOTICE / 第三方声明

[简体中文](NOTICE.md) · [English](NOTICE.en.md)

`dsh-better-choice`（MIT）的问题卡组件与样式改编自现有 DSH 插件
[`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note)。下列版权与
许可条件适用于被改编的部分；其余代码版权归本项目贡献者所有。

## dsh-question-note

- 作者：NedFlanders
- 版本：0.3.0
- 许可证：MIT
- 仓库：https://github.com/buaaflyaway/dsh-question-note
- 复用范围：
  - 问题卡组件结构、选项渲染、推荐标记解析、倒计时/等待状态、自由输入行与提交流程
    （`src/client/composer.tsx` 在其基础上增加右键补充与旁问线程）；
  - 载体识别与草稿存储思路（`src/client/carrier.ts`、`src/client/draft-store.ts`）；
  - 问题卡样式（`scripts/gen-css.mjs` 读取其 `composer.module.css`，加 `bc_` 前缀后
    生成 `src/client/styles.ts`）。

`dsh-question-note` 自身是 DSH 官方 `QuestionComposer` 的移植；DSH 及其内置包的版权归
DeepSeek 所有，本项目只通过公开接口与运行时行为对接，不主张其版权。

## dsh-btw

- 作者：MichengAI
- 许可证：Apache-2.0
- 仓库：https://github.com/MichengAI/dsh-btw
- 关系：旁问的产品交互（卡片内独立提问、只读回答、不打断主任务）受其启发。
  本项目通过宿主公开的 `ctx.subagents.startActivation` 与 fork provider 自行实现，
  未复制其源代码。

## AI 辅助说明

本项目的代码与文档在 AI 辅助下完成，范围、验证方式与免责声明见
[AI_USAGE.md](AI_USAGE.md)。

---

### MIT License (dsh-question-note)

Copyright (c) 2026 NedFlanders

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

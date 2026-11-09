# AGENTS.md

本仓库是一个 DSH 插件。开工前先读仓库的 `README.md`；通用流程与检查项看中心仓的 [PROCESS.md](https://github.com/TLEWA/dsh-plugin-ci/blob/v1/PROCESS.md) 与 [docs/gates.md](https://github.com/TLEWA/dsh-plugin-ci/blob/v1/docs/gates.md)。本文件只强调本类仓库最容易出错的点。

## 插件的硬性约束

- `package.json` 必须有顶层 `engines.dsh`；写在 `dsh.engines.dsh` 会被忽略。
- `dsh.manifestVersion` 必须是 1，`dsh.bundle.patch` 必须指向真实存在的 `cordis.patch.yml`。
- `cordis.patch.yml` 里 `insert[].name` 必须等于包名；`id` 是用户可见的短名，不要随意改。
- `dsh.client.inject` 只允许 `@deepseek-ai/*`，裸模块名（如 `react`）不会被打包。
- 构建产物（`lib/`）要提交；改源码必须重新构建并一起提交，否则 `artifacts.fresh` 会红。
- `package.json` 的 `scripts.prepublishOnly` 必须调用 `dsh-ci-gate --prepublish`；它拦截本机 `npm publish`，不要删除或绕过。

## 本仓库专属

TypeScript 双半：`src/index.ts` 是宿主，`src/client/**` 是客户端；`lib/` 是构建产物，必须提交。

- 不要手改 `lib/*.js` / `lib/*.js.map`；改源码后跑 `npm run build`，把 js 与 map 一起提交。
- 客户端 bundle 必须是 `window.__ModuleLoader__` 信封的 CJS + sourcemap；平台模块
  （react / react-dom / cordis / zod / @tanstack/react-virtual / @deepseek-ai/dsh-client-*）
  保持 external，不要打进 bundle。
- `npm run typecheck` 是 strict + noEmit，PR 前必须过。`npm test` 只显式跑
  `test/answer.test.mjs`、`test/package.test.mjs`；新增测试要同步加到 `scripts.test`。
- 客户端挂在 `conversation.composer` priority -10；识别失败必须返回 null，让官方问题卡接管，
  不能抛错或吞掉卡片。
- 旁问是只读的：执行期 guard 拒绝一切工具，不写回父会话；fork seed 只含父会话最后一个已完成回合。
- `lib/client.js.map` 的 `sourcesContent` 必须是 LF；构建会把 CRLF 归一，重新构建后确认 map 变化合理。
- 已知限制要保留在 README/AGENTS：只接管通用选择题、旁问固定当前模型、回答非流式、
  无右键设备不可用补充框。

## 每次改动

1. 从最新 main 开 `feat/` 或 `fix/` 分支。
2. 改代码、测试、双语文档与 CHANGELOG（同一个 PR）。
3. 本地跑 gate，全绿再 push；不要复制 gate 脚本，CI 会通过 `.ci` 运行中心仓的版本。
4. 开 PR 并按模板勾选；`ci / ci-ok` 通过后由维护者合并。改 CI、AGENTS 或 PR 模板必须加 `ci-change`；
   `human-approved` 只能由人加，模型不得自行添加。

```bash
npx --yes --package=github:TLEWA/dsh-plugin-ci#v1 dsh-ci-gate
npm run build
npm run check
npm run typecheck
npm test
```

## 发布

只由维护者打 tag 触发 `release.yml`。模型不得执行 `npm publish`、不得改版本号（除非在 `release/` 分支上且被明确要求）。

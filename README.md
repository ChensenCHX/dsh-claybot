# dsh-claybot

**以 DeepSeek Harness 插件形式实现的拟人 Bot。**

dsh-claybot 不是单个 agent，而是一个以聊天为主、常驻运行的 multi-agent agent group：由一组 DeepSeek Harness（DSH）插件维持同一“心智”下的多个专职 agent——**Workspace** 负责感知、决策与路由；私有的 **Thought** 只思考、不发言；**Speaker** 是唯一的文本出口；**ID** agent 维护长期记忆与人格。心智之外的一切——聊天渠道、人工注入、时间——都是可独立安装的 **IO provider**。

> **状态：pre-alpha。** 项目处于早期建设阶段：尚无可用构建，接口与包名仍可能变化。

## 设计

- **一个心智，多个角色。** Workspace 独占注意力与路由；Thought 各自处理“心里挂着的事”；Speaker 是文本外出的唯一通道；ID agent 维护长期记忆。Worker 角色后续加入。
- **一切外部能力都是 IO provider。** bot 不直接对接任何平台。聊天渠道、人工注入、定时事件都走同一套 provider 契约；渠道可以独立安装、替换，或由第三方实现，不需要改核心。
- **默认持久。** 单写者引擎 + 持久化副作用队列 + outbox，保证重启安全：事件只处理一次，消息只发送一次。
- **记忆是产品的一部分。** 由实体、条目与引用构成的记忆，带衰减与召回工具；维护循环与 ID agent 保持记忆和人格一致。
- **工具与技能可配置。** 各角色从配置获得工具授权；技能可在运行时创建和编辑。

## 包（规划中）

| 包 | 类型 | 用途 |
| --- | --- | --- |
| `dsh-claybot` | DSH bundle | 核心引擎、会话、提示词、工具、IO 层与技能 |
| `dsh-claybot-contracts` | 库 | IO provider 的公开 SDK 与类型 |
| `dsh-claybot-memory` | DSH 插件 | 长期记忆与人格维护 |
| `dsh-claybot-ioprovider-napcat` | DSH bundle | 通过 NapCat / OneBot 接入 QQ |
| `dsh-claybot-ioprovider-manual-input` | DSH bundle | 人工注入文本与 CLI |
| `dsh-claybot-ioprovider-schedule` | DSH bundle | 定时事件与提醒 |

以上包均尚未发布。

## 仓库结构（规划中）

```text
packages/           核心 bundle 与共享库
default-providers/  官方 IO provider
tests/              跨包测试与测试装置
examples/           DSH profile 示例
docs/               定稿文档
```

## 路线图

1. 仓库与包脚手架
2. 核心领域（引擎、持久化副作用、outbox）与 contracts
3. 角色、会话与提示词组装
4. 长期记忆与人格维护
5. 工具、技能与角色授权
6. IO 层与三个官方 IO provider
7. QQ/NapCat 渠道
8. 角色流程与端到端验证
9. 首个公开发布版本

## 环境要求（规划中）

- DeepSeek Harness 0.2.x
- 通过 `node:sqlite` 访问 SQLite
- Node.js 运行时由 DSH host 提供

## 开发

项目暂不可运行。首批包建立后补安装、构建与测试说明。

## 许可证

待定。后续预计使用 BSD/MIT 协议，具体版本尚未确定。

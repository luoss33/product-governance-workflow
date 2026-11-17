# 产品治理工作流

**给经常评审和修改需求的产品团队用的本地 AI 工作流。** 每轮评审之后，可以查清哪条规则生效、谁确认了这次变化、哪些页面、流程和 PRD 还待更新。

**[下载 ZIP，解压使用](https://github.com/luoss33/product-governance-workflow/releases/latest/download/product-governance-workflow.zip)** · [快速上手](docs/quickstart.md) · [看一次需求变更](<examples/活动报名取消/演练产物.md>)

![从原始来源、人工决策到现行规范和交付物，Wiki 用来查背景和历史](docs/images/governance-chain.png)

## 从自增长知识库到产品治理

我原本想让 AI 帮我管产品项目。用久了，最花时间的是防止 AI 把项目改错。

最早我借鉴卡帕西的 LLM Wiki，让 AI 持续整理纪要和评审资料、更新主题页、连上相关来源。回查早期讨论顺手了，换个会话也能接着做。[卡帕西的 LLM Wiki 原文](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

需求反复调整之后，新规则已经定了，AI 下一轮还可能引用旧原型。规范改了，页面或 PRD 也可能还沿用旧写法。我需要在每次变更后知道哪一版生效、哪次确认替换了旧规则，以及哪份交付物还待同步。

## 一次需求变更怎么走

[原始来源](<01、来源/README.md>) → [人工决策](<02、决策/README.md>) → [现行规范](<03、当前规范/README.md>) → [交付物](<04、资产/README.md>)

1. **先审方案。** AI 对照现行规则，给出一个推荐、完整的待确认规则和受影响的交付物。
2. **人确认规则。** 决策记录保留确认原话、依据和替代关系。每个主题用一份现行规范记录有效规则。
3. **按范围同步。** AI 按授权更新受影响的流程、页面、原型或 PRD，再核对场景、记录同步状态。正式交付按具体资产、版本和范围验收。

[Wiki](<05、Wiki/README.md>) 用来查背景和历史。[治理协议](<00、工作台/治理协议.md>) 说明怎么确认规则、同步普通资产和处理锁定文件。

## 活动报名取消示例

第一次确认活动开始前可取消。复评把截止点提前到距活动开始至少 24 小时。旧决策仍可查，现行规范和页面方案按新的时间边界同步，页面方案待评审。[查看两轮输出](<examples/活动报名取消/演练产物.md>) · [跟做案例](<examples/活动报名取消/README.md>)

## 在本地试用

1. 下载并解压 ZIP。
2. 在能读写本地文件的 AI 工具中打开包含 `AGENTS.md` 的文件夹。
3. 把第一份纪要放到 `01、来源`，请 AI 先读 `AGENTS.md` 并给出方案。也可以从随包的活动报名案例开始。

包里有[产品变更工作流](.agents/skills/product-change-workflow/SKILL.md)、[业务事实治理](.agents/skills/business-spec-manager/SKILL.md)两份 AI 指引，以及空白登记表、流程和页面模板。[快速上手](docs/quickstart.md) · [MIT 许可证](LICENSE)

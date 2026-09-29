# FL-REC-001 仓库完整性矩阵

| 仓库 | 克隆类型 | 两轮fsck退出码 | 默认检出 | 远端分支/标签 | 子模块 | LFS | 第二次验证 | 等级 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fastlink-prime-wallet | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlik-backend | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlik-app | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlik-Admin | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlik-Website | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlink-control-plane | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |
| fastlink-recovery-archive | 非浅/非partial；无alternates | 0 / 0 | 通过 / 干净 | 完整匹配 | 无 | 无指针/无属性 | 通过 | A |

A：远端可独立恢复；B：条件性可恢复（外部依赖/对象/权限缺口）；C：仅有未经完整验证的本地/历史证据；D：授权远端及已知证据不足以恢复。本次为A×7，B/C/D均为0；不是预设必须全部A级。

每轮确认默认分支、HEAD、完整引用对象可读取、非浅非partial、无对象替代路径、fsck --full --strict退出0、默认工作区干净。所有Git树对象也检查了mode=160000及.gitmodules/.gitattributes；结果均无；小blob标准LFS指针数为0。

两轮对象清单SHA-256、默认树、引用清单、文件数一致；全部分支尖端与远端身份核验快照一致。标签使用refs/tags/<name>^{commit}比较API提交目标，避免注释标签对象与目标提交混淆。

详见 [recovery-rounds.json](evidence/recovery-rounds.json)、[repeatability.json](evidence/repeatability.json)、[dependency-audit.json](evidence/dependency-audit.json)。目录为临时验证资产，不自动替代正式工作区；A不覆盖本地独有提交和未提交内容。

# FL-REC-001 自测报告

## 恢复验收用例

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| REC-T01 | PASS | 7远端可访问，14次独立HTTPS克隆成功，无失败重试 |
| REC-T02 | PASS | 各默认分支main及完整HEAD与API输入一致 |
| REC-T03 | PASS | 14仓非浅克隆、非partial、无alternates |
| REC-T04 | PASS | 14次fsck --full --strict退出0，无其他诊断 |
| REC-T05 | PASS | 分支/标签全部对应API；引用目标对象可读取 |
| REC-T06 | PASS | 14个默认工作区可检出且干净 |
| REC-T07 | PASS（无依赖） | 全部本地Git树无gitlink/.gitmodules，无需子模块远端访问 |
| REC-T08 | PASS（无依赖） | 全部Git树无.gitattributes，小blob无LFS标准指针；没有需下载LFS对象 |
| REC-T09 | PASS | 原89688文件0变化0缺失，5仓主要Git状态相同 |
| REC-T10 | PASS（含未映射项） | 45候选逐项关联，7范围内树匹配、38无完整匹配；5Git的HEAD可达性已核验 |
| REC-T11 | PASS | 新报告扫描结果见security-scan.json；不扫描/宣称七仓全部历史安全 |
| REC-T12 | PASS | scope-validation.json核对只新增本工单报告目录，无恢复源码 |
| REC-T13 | PASS | 第二轮新空目录、新HTTPS下载、无共享对象；默认HEAD/树/refs/对象摘要全等 |
| REC-T14 | PASS | 恢复过程无tar/unzip/包内查看步骤；只Git检出和对象级检查 |
| REC-T15 | PASS | 治理文档可通过独立revert PR撤销，不涉及原资产或恢复目录 |

程序化核验明细见 [test-results.json](evidence/test-results.json)。PR创建后状态及CI最终结果另由HANDOFF补充，不预写尚未发生的检查。

## 原现场比较方法

对开工时的89688个非node_modules普通文件计算原字节SHA-256，结束后按同一清单逐一重算；不将用户脏文件与Git HEAD比较。原始清单只保留本地，其SHA在local-evidence-hashes.json。5个Git工作区分别比较HEAD、porcelain全量状态、diff --binary、heads/remotes/tags/stash及index哈希。未清理原工作树或Git对象，未移动历史bundle。

## 内容清单与重复性方法

对象清单摘要：对cat-file取得的OID、类型、大小排序后以换行连接计算SHA-256。树清单摘要：对git ls-tree -r -z --full-tree HEAD原始字节计算SHA-256。两轮完整引用行、默认HEAD/树和对象摘要均一致。Git自身对象标识为SHA-1，与报告SHA-256用途分开。

## 未运行项及原因

不运行七仓依赖安装、应用构建、测试脚本、生产制品或线上冒烟：本工单只验Git恢复，且恢复出的代码未授权执行。LFS下载和子模块递归克隆未运行，因为已核实无依赖；没有因此隐藏必需对象缺口。未展开历史bundle、Release附件或归档包，未核验数据库与凭据。

报告仓库现有PR检查可按既有流程运行；不更改CI。所有“PASS”仅对应本表限定范围，不代表业务、安全或发布验收通过。门禁2/3由总控决定，未合并、未部署、未闭环。

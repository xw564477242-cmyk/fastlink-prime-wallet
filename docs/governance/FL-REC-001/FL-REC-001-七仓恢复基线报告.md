# FL-REC-001 七仓恢复基线报告

## 目标与边界

从已授权GitHub远端建立七仓独立恢复验证，不依赖原工作区、历史bundle或来源不明副本作为成功依据。首次核验：2026-09-29T06:13:13.452150+00:00；对象及引用是该核验窗口内的快照，未来远端变化须重新核验。

“A”仅指当前授权远端公开给该账号的分支、标签及其Git历史可独立恢复；不包括服务器隐藏/已删除引用、服务端reflog、GitHub Release附件、Actions制品、数据库、环境变量、线上镜像或本地独有提交。恢复成功不代表安全扫描通过或业务运行通过。

## 隔离与输入

- 原项目根目录：/Users/ck/Downloads/fastlink-prime-wallet-dev-release，受保护，只读。
- 第1轮：/private/tmp/FL-REC-001/round-1/<repo>。
- 第2轮：/private/tmp/FL-REC-001/round-2/<repo>。
- 报告工作区：/private/tmp/FL-GOV-001-review；复用上一工单干净独立克隆，从最新dev建立本工单分支。此目录不属于恢复验证目录。
- 工具：git version 2.54.0 (Apple Git-157)；Python 3.14.3；Git子模块功能随Git提供；git-lfs未安装。
- 开始可用磁盘：113532317696字节；每次新增克隆前设15GiB停止阈值，无触发。未删除原资产腾挪空间。
- 访问：已有GitHub授权，通过HTTPS独立下载；报告URL采用github.com/<owner>/<repo>，不含认证信息。
- 两轮均逐仓执行指定顺序；每仓每轮1次成功，无失败重试。

## 七仓结果

| 仓库 | 默认分支 | 默认HEAD | 分支数 | 标签数 | 第一/二轮耗时秒 | 等级 |
| --- | --- | --- | --- | --- | --- | --- |
| fastlink-prime-wallet | main | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18 | 81 | 0 | 4.154 / 5.762 | A |
| fastlik-backend | main | 74e5be019c8c91acee6ca241956fc24dfe8ae826 | 314 | 0 | 9.857 / 9.958 | A |
| fastlik-app | main | fb05291c5c68d979bbd864fae4e9493d64479560 | 76 | 0 | 3.811 / 3.84 | A |
| fastlik-Admin | main | 7228905b4319187db40754832d30c6d9bbe2ff8f | 64 | 0 | 4.519 / 4.838 | A |
| fastlik-Website | main | 7b5440772069cecc03a1682bc5d2140317c54edb | 66 | 0 | 3.429 / 3.871 | A |
| fastlink-control-plane | main | 3396b1e57fd4e94981bfe626d1e4bbf1844643c6 | 58 | 0 | 4.119 / 4.04 | A |
| fastlink-recovery-archive | main | a09e6221f5530a42820fe35168254260560a172f | 1 | 1 | 11.64 / 7.71 | A |

七仓均可访问。仓库用途上的恢复归档为fastlink-recovery-archive；它在GitHub的archived标志为false，不能把用途与平台只读归档状态混淆。其余六库亦archived=false。

## 可重复步骤

以下是给获授权执行端的操作说明；将OWNER、REPO、EMPTY_DIR替换为核实值。必须使用新的空目录，不复用原工作区或首轮对象：

```text
GIT_LFS_SKIP_SMUDGE=1 GIT_TERMINAL_PROMPT=0 git -c core.hooksPath=/dev/null clone --no-checkout --no-local https://github.com/OWNER/REPO.git EMPTY_DIR
git -C EMPTY_DIR rev-parse --is-shallow-repository
git -C EMPTY_DIR symbolic-ref --short HEAD
git -C EMPTY_DIR rev-parse HEAD
git -C EMPTY_DIR fsck --full --strict
git -C EMPTY_DIR for-each-ref --format='%(refname)|%(objectname)|%(objecttype)' refs/heads refs/remotes refs/tags
git -C EMPTY_DIR cat-file --batch-all-objects --batch-check='%(objectname) %(objecttype) %(objectsize)'
git -C EMPTY_DIR -c core.hooksPath=/dev/null -c filter.lfs.required=false -c filter.lfs.smudge= -c filter.lfs.process= restore --source=HEAD --staged --worktree .
git --no-optional-locks -C EMPTY_DIR status --porcelain=v1 --untracked-files=all
```

克隆不设depth/filter，不设置共享对象或alternates，不运行项目脚本。跳过LFS smudge仅用于安全检出检查，**不能据此认定LFS已恢复**：需另核验指针、属性和对象。若发现依赖或缺失，必须降级或单独验证。本次全部Git树中无.gitmodules、.gitattributes或gitlink；全部本地小blob（≤4096字节）中无LFS标准指针头，不存在本轮需下载的LFS对象，故工具缺失不构成本轮恢复缺口。

第二轮从同一授权远端重新执行，比较默认HEAD/树、全部分支标签、引用清单、排序后的对象OID/类型/大小清单SHA-256；两轮不得设置alternates。预期结果：shallow=false、fsck退出0、无缺失引用对象、工作区干净、两轮关键值相同。

复现脚本仅存本地证据包，其SHA在evidence/procedure-hashes.json；不进入仓库或现有流水线。脚本检查依赖时只记录位置、OID和数量，不输出blob内容。

## 归档与现场保护

归档库进行同样的Git层完整性与检出检查；Git检出只是恢复版本控制中的文件，未打开或解压任何归档包，未执行归档里的代码。历史原bundle未读取、移动、解压或上传。

原89,688个纳入范围的文件SHA-256复核一致，变化0、缺失0；5个原Git工作区HEAD/status/diff/主要refs/index一致。node_modules内容与Git对象字节不在该文件哈希范围，Git状态另核验；应用检查点引用不在主要引用不变声明内。

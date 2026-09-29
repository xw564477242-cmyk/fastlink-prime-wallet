# FL-GOV-001 Git 分支基线表

远端核验日期：2026-09-29；精确 UTC 时间见各 evidence JSON。原仓库没有 fetch、prune 或更新引用。远端 API 读取采用分页，比较使用固定提交 SHA；原本地缓存另列，不能当作新鲜远端基线。

## 七库远端基线

远端显示形式统一为 github.com/<owner>/<仓库名>；无认证信息、查询参数或完整凭据。七库默认分支均为 main；默认 main 本身不违反本工单环境映射，不做默认分支变更。

| 仓库 | 默认 | dev | test | uat | main | 分支数 | 标签数 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fastlink-prime-wallet | main | 49d29d86202a557d688d56db9202334f8a09996b | 7433607f6b10135e0f116853687cae614db13d6d | 缺失 | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18 | 80 | 0 |
| fastlik-backend | main | b337bc96dfd587326a3c43d890d22ca251ca932d | 1efc76ea79d61dd0affda87b014ea4a36101cf26 | 缺失 | 74e5be019c8c91acee6ca241956fc24dfe8ae826 | 314 | 0 |
| fastlik-app | main | 91ce890fcb27ed042d9547d3083c63bd2e2e31d6 | 89a5eed87395670f99a94e4075f25a5846d7892a | 缺失 | fb05291c5c68d979bbd864fae4e9493d64479560 | 76 | 0 |
| fastlik-Admin | main | 9c2ae0034e5104e331f01dd2146d00e164b1d844 | 4fd40f20f2ca27e9bb1ad9e7dd9c531964235732 | 缺失 | 7228905b4319187db40754832d30c6d9bbe2ff8f | 64 | 0 |
| fastlik-Website | main | 798a9f8f51dce62c7136962f99c04e51b650cf2c | 90a7345e8b9e281b0acffc34f6c0971e30513ab5 | 缺失 | 7b5440772069cecc03a1682bc5d2140317c54edb | 66 | 0 |
| fastlink-control-plane | main | ccaeaeca55fba2b0c50bdfb971d60af00e4bb16c | 缺失 | 缺失 | 3396b1e57fd4e94981bfe626d1e4bbf1844643c6 | 58 | 0 |
| fastlink-recovery-archive | main | 缺失 | 缺失 | 缺失 | a09e6221f5530a42820fe35168254260560a172f | 1 | 1 |

五个应用库的 dev/test/main 在 API 中 protected=true；控制库 dev/main 及归档 main 为 false。只读取保护标志，未声称逐条审计了 required checks、管理员绕过和规则集。归档库是恢复用途，缺少环境分支不自动认定业务发布违规；适用性须评审确定。

## 提交包含关系

base 为较低环境分支，head 为较高环境分支；base独有=API behind_by，head独有=API ahead_by。diverged 表示双方都有独有提交。仅名称存在不足以证明晋升；缺 uat 时完整链无法验证。分叉可能包括环境配置提交或历史合并方式，不直接证明丢失或越级部署。

| 仓库 | base → head | 关系 | base独有 | head独有 |
| --- | --- | --- | --- | --- |
| fastlink-prime-wallet | dev → test | diverged | 168 | 4 |
| fastlink-prime-wallet | dev → uat | missing branch | — | — |
| fastlink-prime-wallet | dev → main | diverged | 192 | 11 |
| fastlink-prime-wallet | test → uat | missing branch | — | — |
| fastlink-prime-wallet | test → main | diverged | 28 | 11 |
| fastlink-prime-wallet | uat → main | missing branch | — | — |
| fastlik-backend | dev → test | diverged | 499 | 1 |
| fastlik-backend | dev → uat | missing branch | — | — |
| fastlik-backend | dev → main | diverged | 645 | 2 |
| fastlik-backend | test → uat | missing branch | — | — |
| fastlik-backend | test → main | diverged | 147 | 2 |
| fastlik-backend | uat → main | missing branch | — | — |
| fastlik-app | dev → test | diverged | 150 | 1 |
| fastlik-app | dev → uat | missing branch | — | — |
| fastlik-app | dev → main | diverged | 175 | 12 |
| fastlik-app | test → uat | missing branch | — | — |
| fastlik-app | test → main | diverged | 26 | 12 |
| fastlik-app | uat → main | missing branch | — | — |
| fastlik-Admin | dev → test | diverged | 66 | 1 |
| fastlik-Admin | dev → uat | missing branch | — | — |
| fastlik-Admin | dev → main | diverged | 90 | 7 |
| fastlik-Admin | test → uat | missing branch | — | — |
| fastlik-Admin | test → main | diverged | 25 | 7 |
| fastlik-Admin | uat → main | missing branch | — | — |
| fastlik-Website | dev → test | diverged | 107 | 2 |
| fastlik-Website | dev → uat | missing branch | — | — |
| fastlik-Website | dev → main | diverged | 145 | 6 |
| fastlik-Website | test → uat | missing branch | — | — |
| fastlik-Website | test → main | diverged | 40 | 6 |
| fastlik-Website | uat → main | missing branch | — | — |
| fastlink-control-plane | dev → test | missing branch | — | — |
| fastlink-control-plane | dev → uat | missing branch | — | — |
| fastlink-control-plane | dev → main | diverged | 88 | 2 |
| fastlink-control-plane | test → uat | missing branch | — | — |
| fastlink-control-plane | test → main | missing branch | — | — |
| fastlink-control-plane | uat → main | missing branch | — | — |
| fastlink-recovery-archive | dev → test | missing branch | — | — |
| fastlink-recovery-archive | dev → uat | missing branch | — | — |
| fastlink-recovery-archive | dev → main | missing branch | — | — |
| fastlink-recovery-archive | test → uat | missing branch | — | — |
| fastlink-recovery-archive | test → main | missing branch | — | — |
| fastlink-recovery-archive | uat → main | missing branch | — | — |

完整 base/head/merge-base SHA 见 [remote-relations.json](evidence/remote-relations.json)。六个原库均缺 uat；控制库缺 test；五个应用库 dev/test/main 均分叉，控制库 dev/main 也分叉。**不能认定符合完整逐级晋升链，也不自动合并修复。**

## 本地状态、上游与历史

[local-repositories.json](evidence/local-repositories.json) 保存每个本地分支、上游、缓存 ahead/behind、远端引用、标签、工作树、未合并分支和不可达提交。所有本地仓库标签数均为 0。逐文件状态清单仅在本地证据包。

- 主工作区：0 暂存、2 未暂存、58,152 未跟踪文件（--untracked-files=all；普通 status 会将 outputs 折叠）。改动文件是 AGENTS.md、docs/history-journal.md；不属于本工单提交。
- 主工作区当前分支对缓存上游领先 2；本地 dev 对缓存 origin/dev 落后 6。缓存 origin/dev=1a2d4586…，本次远端 dev=49d29d86202a…，缓存已过期。这些计数仅描述缓存，不是新鲜远端差集。
- 004 干净，但活动分支无上游，origin 为本地路径；ec29d29 与 8aefe846 在其缓存远端集合之外，不推断在全部 GitHub 仓库不可恢复。
- FAST-001 游离 HEAD 且有 1 未跟踪文件；032/040 为干净的浅克隆、活动分支无上游。浅克隆 fsck 通过不证明完整历史。
- 五个仓库 fsck 均返回 0；主库存在 1 个不经 reflog 可达的 commit，004 存在 6 个。这是 --no-reflogs --unreachable 的结果，不等于对象损坏或已永久丢失，未 GC、未删除、未尝试历史修复。

## 命名与提交格式

本地各活动分支均不是本工单规范的 feature/FL-… 形式，FAST-001 无分支。完整远端异常名称清单在 remote-repositories.json。每库 dev/main 各最多 30 条近期提交及本地 HEAD 最多 30 条按格式核验，只记录 SHA 与 compliant，不复制提交正文。合并提交也按严格格式标识为偏差，供评审判定例外；不重写历史。

新治理工作分支为 feature/FL-GOV-001-git-governance，基于远端 dev 的 49d29d86202a557d688d56db9202334f8a09996b，单独克隆，不共享受保护现场的 .git。

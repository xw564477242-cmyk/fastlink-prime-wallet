# FL-GOV-001 自测报告

## 执行范围与结论

文档及证据变更；无需重新构建或运行在线业务冒烟。对文档完整性、数量、SHA、分支关系、敏感信息、路径和范围进行本地核验；原工作区保持只读。PR 的最终 head、状态和 CI 结果见交接附录，不把尚未完成的远端检查写成通过。

| 用例 | 本轮结果 | 证据/说明 |
| --- | --- | --- |
| GOV-T01 | 已执行 | 全目录发现 5 Git；含依赖遍历；子模块、嵌套库和失效 worktree 已登记 |
| GOV-T02 | 已执行，有差异 | 七远端身份均核实；仅新钱包本地 Git；其他本地状态未知 |
| GOV-T03 | 已执行 | 受保护现场；前后状态/HEAD/ref/index/内容哈希复核见 preservation-check |
| GOV-T04 | 已执行 | 五个完整 HEAD SHA；远端分支固定 SHA |
| GOV-T05 | 已执行，有缺失 | 六库 uat、控制库 test、归档 dev/test/uat 缺失，适用性已区分 |
| GOV-T06 | 已执行，有偏差 | API 按不可变 SHA 比较；diverged/缺分支逐项记录 |
| GOV-T07 | 已执行，有偏差 | 本地 refs/upstream/cache ahead-behind；过期缓存不当作实时结论 |
| GOV-T08 | 已执行，有偏差 | 活动分支及各 dev/main 最多30条近期提交，异常不改写 |
| GOV-T09 | 已执行 | 新增文件规则扫描，结果见 local-validation；历史扫描候选另表 |
| GOV-T10 | 已执行 | diff 仅 docs/governance/FL-GOV-001；无业务、配置变更 |
| GOV-T11 | 提交后核验 | 最终交接记录 PR base=dev、OPEN、未合并；创建前不计通过 |
| GOV-T12 | 部分验证 | 本地前端 SHA匹配；CF/镜像历史证据一致，当前线上未验证 |
| GOV-T13 | 已执行 | 与用户 AGENTS 的五门禁、角色、命名及环境路径一致 |
| GOV-T14 | 已执行 | 通过未来独立 revert PR 撤销；无运行态回滚需求 |

## 已运行现有测试

在独立 dev 克隆执行：

```text
/Users/ck/.bun/bin/bun test ./src/lib/prime-wallet-readiness.test.ts
/opt/homebrew/bin/node --test ./scripts/readiness-deployment-contract.test.mjs
```

结果：4 个 Bun 测试通过，22 个断言；7 个 Node 测试通过，共 11 项通过、0 失败。原现场复核：5 个仓库 HEAD、状态、分支/远端/标签/stash、diff 和 index 全部一致，89,688 个文件 SHA-256 全部一致，无缺失。首次 `bun run test:readiness` 因 shell PATH 无 bun 返回127，随后使用已安装 Bun 1.3.14 和 Node 绝对路径执行同两项脚本成功。未安装依赖、未修改锁文件。

未运行完整前端构建、lint、其余业务测试：本轮仅文档/证据，无业务依赖或配置变更。现有远端 PR CI 若要求这些检查，由既有流程执行并在交接中如实列出。未运行部署冒烟，因为工单明确禁止部署；未访问线上数据库、资金链路或秘密存储。

## 复核方法

以下 Git 命令为只读（在要检查的仓库执行）：

```text
git --no-optional-locks status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
git for-each-ref --format='%(refname)|%(objectname)|%(upstream:short)|%(upstream:track)' refs/heads refs/remotes
git worktree list --porcelain
git submodule status
git fsck --full --no-reflogs --unreachable
git rev-list --left-right --count refs/heads/dev...refs/heads/test
```

缺少分支时最后一条不可用，应记录缺失，不补造分支。上游计数依赖本地引用时效；浅克隆不能证明完整对象图。远端用 `gh api --paginate --slurp repos/OWNER/REPO/branches?per_page=100` 读取，再用 `gh api repos/OWNER/REPO/compare/BASE_SHA...HEAD_SHA` 比较 evidence 所列 SHA（OWNER/REPO/BASE_SHA/HEAD_SHA 为替换位，执行前填入已核验对象）。不输出 raw remote URL 或 credential config。

目录 SHA 复核：从本文件所在目录执行 `shasum -a 256 -c FILE-SHA256SUMS.txt`；校验文件自身不自包含。所有原始本地证据文件名与 SHA 在 evidence/local-evidence-manifest.json。

## 门禁结论

门禁1已获用户批准。提交材料不等于修复全部历史偏差，也不等于门禁2/3自动通过；提交后交由总控判断。当前线上快照未验证及其他例外须保留，未获书面例外前不宣称全部验收通过。尚未合并、尚未部署、工单未闭环。

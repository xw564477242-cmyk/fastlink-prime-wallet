# DEV-UI-001-B04-R1｜余额契约校验修订交付

状态：人工口径已确认，前端修订与本地验证完成，**等待独立评审；B04 未自行解除**。资产看板继续暂停。

## 1. 交付与基线

- [本次增量 Diff](DEV-UI-001-B04-R1-incremental.patch)：以本次开工前工作区为基线，仅含余额校验、相关测试及历史差异报告的追加说明，不包含之前公共底座和 R1 的未提交变更。
- [更新后的契约差异记录](DEV-UI-001-BLOCKER-REPORT-2026-09-15.md)：第 7 节追加本次人工裁决；原始章节及此前交付文件保留。

实际修改文件：`src/lib/backend-api.ts`、`src/lib/wallet-balance-summary-adversarial.test.ts`、上述差异报告。未修改后端、会话/请求安全机制、其他业务适配、页面或样式，未提交、推送或部署。

## 2. 人工确认口径与变更

| 字段 | 本次人工确认的独立含义 |
| --- | --- |
| availableBalance | ACTIVE 账户已入账金额汇总 |
| ledgerBalance | 查询范围内全部账户状态的已入账与待入账金额汇总 |
| pendingBalance | 查询范围内待入账金额汇总，不代表冻结金额 |

依据：后端 `wallet-accounting.service.ts` 的 endUserBalanceSummary 与既有冻结账户测试夹具，经本次工单人工确认用于前端对齐。冻结账户“可用 0、账面 7、待入账 0”为有效响应。**未取得 Railway 原始响应验证，不宣称真实环境联调通过。**

`GET /api/v1/wallet/balances` 的方法、路径、响应结构均不变。仅移除 normalizeWalletBalanceResponse 中的 `available + pending = ledger` 判断，以及仅被该判断使用的私有 walletBalanceMantissa 辅助函数。各字段仍单独经过原 walletBalanceDecimal 校验并原样返回，不作 Number 转换、舍入或金额运算，不新增等式、大小关系或冻结金额字段。

## 3. 保留检查清单

- 原始输入必须为字符串，JSON 可解析，字符/UTF-8 字节限制仍为 32,768。
- 顶层仅 items；明细仍严格要求 assetCode、availableBalance、ledgerBalance、pendingBalance、updatedAt，禁止额外字段。
- 数组完整性、最大 50 项、资产代码格式、严格升序与唯一性、日期格式与合法日期校验不变。
- 三个金额字段均为必填字符串；原 18 位整数/18 位小数边界、总长度、符号、负零、前导零、尾零、指数表示规则全部保留。
- 返回字段白名单和记录 Object.freeze 行为不变；不补零、不添加计算字段。
- 会话、跨环境、过期/卸载回写拦截与防重复实现不变，原安全测试继续运行。
- 查询覆盖范围与金额边界是否适用于更大汇总的其他缺口仍待确认，不借本次修订调整上限或精度。

已将原金额格式校验与结构解析源码片段同开工前版本比较，确认未变。

## 4. 回归测试

只把依赖旧等式的 `ledgerBalance="99"` 拒绝预期改为原值通过，并重命名该测试以去掉“ledger equation”。原非法格式、时间戳、数组、白名单、排序、身份绑定等测试保留。

新增 3 项：

1. 人工批准的冻结账户 `0 / 7 / 0` 通过，字段值、输出键和只读记录保持不变。
2. 合法零值、18 位小数字符串和独立金额关系原样返回，不产生计算字段、不施加新大小关系。关系测试为解析器模拟输入，不表示真实余额。
3. 每个必填字段缺失被拒绝；三个金额字段逐一拒绝 null、数字、布尔、数组、对象及原有非法金额格式/超精度输入。

先改测试、尚未修订实现时：专项 9 pass、3 fail，确认旧等式阻断已批准样例。
修订后专项：12 pass、0 fail、114 assertions。

## 5. 最终验证记录

按 TEST → SANDBOX 执行，均为本地模拟与构建：

| 验证 | 结果 |
| --- | --- |
| `VITE_FASTLINK_API_URL=/api VITE_FASTLINK_ENVIRONMENT=TEST bun test` | 564 pass，0 fail；62 files，4593 assertions |
| TEST `bun run build` | 通过 |
| `VITE_FASTLINK_API_URL=/api VITE_FASTLINK_ENVIRONMENT=SANDBOX bun test` | 564 pass，0 fail；62 files，4593 assertions |
| SANDBOX `bun run build` | 通过 |
| `tsc --noEmit` | 通过，无诊断 |
| 修改的两个 TS 文件 ESLint | 通过，无诊断 |
| 增量补丁 `git apply --reverse --check` | 通过；仅检查，未回退文件 |
| `git diff --check` | 通过 |

全量测试包含既有会话、跨环境、过期响应、卸载及防重复测试。测试夹具/本地模拟不能替代 Railway 原始响应或真实环境验收；未调用资金或 Thredd 接口。未变更 UI，无需新增状态截图。

## 6. 停止点

提交本增量供独立评审，不自行解除 B04，不恢复资产看板或其他页面。B03 真实 Cookie、代理与双环境联调仍待验证；其他金额边界、查询覆盖范围缺口不随本次修订解除。

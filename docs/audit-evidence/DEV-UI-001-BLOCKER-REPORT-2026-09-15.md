# DEV-UI-001｜开工核验与阻塞报告

日期：2026-09-15。状态：**Step1 依赖检查未通过，暂停 B/C/D/E 页面实施**。

本轮仅核验并新增本报告；未修改前后端代码、配置或已有文档，未提交、推送、部署或调用资金/Thredd 接口。以下为源码与仓库文档检查，不能视为 Railway 联调通过。

## 1. 核验范围与证据等级

- 前端：`/Users/ck/Downloads/fastlink-prime-wallet-dev-release`，HEAD `33d70fa51bc33c3d9858d54f7ef71315fcfefabb`。
- 后端（只读）：`/Users/ck/Downloads/fastlik-backend`，HEAD `9777084124316c4b13b5dc8cbb34ebbe6bf7ea5e`。
- 前端开工前已有基线、历史日志修改及多份未跟踪文件；本报告不将这些变更归入本工单。
- 已读取 `AGENTS.md`、`docs/environment/DEV-BASELINE.md`，遵循 Lovable 不改写已发布历史及蓝图布局约束。
- 在两个项目的文件清单及前端跟踪文件中未找到 `FRONTEND-BASELINE.md`；未找到独立 Railway-Demo 视觉基线文件。
- 已阅读 `docs/FASTLINK_WALLET_RUNTIME.md` 和后端 `docs/prime-wallet-backend-p1-contract.md` 的相关契约。前者仍描述 Bearer/sessionStorage，当前实现为 Cookie，须保留此差异供裁决。
- 未定位到可以证明当前余额冻结口径已在 Railway 验证的脱敏原始响应。源码、测试 fixture 和文档均不能替代历史已验证报文；未舍弃任何历史记录。
- 下列接口结论统一标记：**源码核验，待历史样例或联调复核**。测试文件只读检查，未执行测试。

## 2. 阻塞与所需裁决

| 编号 | 已查明问题及证据 | 影响与解除条件 |
| --- | --- | --- |
| B01 | `FRONTEND-BASELINE.md` 未找到；现有样式源码存在，但未找到其与冻结 Railway-Demo 版本的对应证据 | 补齐前端基线位置或由设计端明确现有组件/样式为指定基线，包含金额、遮罩、权限和异常规则 |
| B02 | `src/routes/__root.tsx` 挂载会话和 Query Provider；异常走整页 ErrorComponent。`ui/dialog.tsx`、`ui/alert-dialog.tsx` 只是基础控件，未找到全局异常弹窗及异常去重接入 | Step1 全局异常弹窗依赖未完成；须由底座工单补齐或提供已有实现位置，不在本页面工单中新建全局机制 |
| B03 | `src/lib/backend-api.ts:20` 读取构建环境，`:55` 将 runtime 冻结；未找到全局环境切换入口/状态机制 | 现有会话隔离可复用，但不能宣称支持工单要求的全局切换。须明确按独立构建切换是否满足基线，或先完成 Step1 切换机制 |
| B04 | 前端 `src/lib/backend-api.ts:2826` 强制 available + pending = ledger；后端 `wallet-accounting.service.ts:514` 的 available 仅含 ACTIVE 已入账余额，ledger 含全部状态的 posted + pending | 冻结/关闭账户非零金额可被前端当作无效响应拒绝。暂停余额适配；需历史报文或联调确认实际契约并裁决前端适配规则，不能直接改写既有契约校验 |
| B05 | 余额响应不含资产名称、账户状态、网络或操作权限；源码另有 accounts/assets 接口，但 Dashboard 采用资产还是账户明细维度尚无完整确认 | 不从余额猜测状态、不把 pending 当冻结；确认明细维度和独立请求组合后补齐映射 |
| B06 | `/deposit`、`/withdraw` 是 UnavailableFeature；`/history` 为卡交易流水，`/assets/fiat` 内有钱包流水能力 | 确认充值空态入口的禁用规则与钱包流水目标路由/参数；不擅自开发目标页面、不将卡流水当钱包流水 |

### B04 的具体证据

后端现有测试 `src/wallet/wallet-accounting.service.spec.ts:548` 明确包含冻结 USD 账户，响应预期为 `availableBalance="0"`、`ledgerBalance="7"`、`pendingBalance="0"`。前端现有等式判断会拒绝该响应。这是测试夹具证据，不是用户余额或 Railway 实测金额。本轮未修改任何校验逻辑。

另一个数量口径缺口：后端查询先 `take: 50` 账户，再按资产汇总（`wallet-accounting.service.ts:531` 附近）；控制器说明为最多 50 个资产。超过 50 个账户时是否仍代表完整资产总览需确认，不应宣称全量总资产。

## 3. Step1 底座检查

| 依赖 | 检查结果 | 位置 |
| --- | --- | --- |
| React/TSX 与路由 | 已有 React 19、TanStack Router、TypeScript；首页 `/` 存在 | `package.json`、`src/routes/index.tsx`、`src/routeTree.gen.ts` |
| 会话门禁 | 已有 checking 阶段拦截、无会话不渲染 Outlet | `src/routes/__root.tsx` SessionBoundary |
| 会话状态 | 已有环境/过期判断、身份与 epoch 防止旧请求提交、401 失效策略 | `src/lib/backend-session.tsx`、`src/lib/backend-session-policy.ts` |
| 请求封装 | 已有 Cookie credentials、no-store、Trace、20 秒超时、外部 AbortSignal | `src/lib/backend-api.ts:834` |
| 余额状态与防重复 | activeRequestRef 锁、scopeKey、会话 generation、卸载 abort/isCurrent 已有 | `src/hooks/use-home-wallet-balances.ts`、`src/lib/home-wallet-balance-state.ts` |
| 错误分类 | 请求层保留 HTTP status；余额 hook 丢失详细类型并统一为 unavailable。不能区分 403 与普通失败；初次失败时 canRefresh=false | 同上；需要在契约裁决后处理，现状不满足验收 |
| 环境配置 | 有配置与匹配检查；无已确认的全局切换机制 | `src/lib/backend-api.ts:20`、B03 |
| 通用组件与样式 | 有可复用实现，尚缺正式前端基线对应确认 | 第 5 节 |
| 全局异常弹窗 | 未找到已挂载的统一弹窗及去重机制 | B02 |

结论：底座部分能力存在，**不能判定 Step1 整体就绪**。

## 4. 已核实接口与字段映射（受阻项明确留缺）

后端 `src/main.ts:46` 设置 `/api` 前缀。前端余额读要求 `VITE_FASTLINK_API_URL=/api` 和会话环境 TEST/SANDBOX；本轮未读取或变更部署秘密。

| UI 项 | 方法、路径、参数与 JSON 路径 | 类型、业务含义、转换/缺失处理 | 源码依据与差异 |
| --- | --- | --- | --- |
| 环境 | 无新增请求；`VITE_FASTLINK_ENVIRONMENT` → `backendRuntime.environment` | trim + uppercase；缺失视为配置错误，禁止默认 TEST/SANDBOX | 前端 `backend-api.ts:20-59` |
| 会话校验 | GET `/api/v1/session`；无业务参数，Cookie；`$.actorId/tenantId/customerId/environment/expiresAt/idleExpiresAt` | 后端身份字段、ISO 日期字符串；当前前端类型未含 idleExpiresAt；身份不可用时不展示数据 | 后端 `end-user-session.controller.ts` CompatibilityController、SessionGuard；前端 `backend-api.ts:3816` |
| 按资产汇总 | GET `/api/v1/wallet/balances`；无查询参数，租户/客户/环境取自会话；`$.items[]` | 有界数组；空数组表示无返回资产，不填虚构零值；完整性受 50 账户限制待确认 | 后端 `end-user-wallet.controller.ts:225`、`wallet.service.ts:48`、`wallet-accounting.service.ts:514` |
| 资产代码 | 同上 `$.items[].assetCode` | string，非可空声明；当前前端限定大写字母数字 2–12 位，保持原标识；不存在独立名称字段 | 后端 `dto/end-user-wallet-balance-summary.dto.ts`；前端 `backend-api.ts:2639` |
| 可用金额 | 同上 `$.items[].availableBalance` | decimal string，ACTIVE 的 posted 合计，单位为 assetCode；不转 Number、不舍入 | 后端 accounting `:540-558`；前端 WalletAssetAccount；B04 |
| 账面金额 | 同上 `$.items[].ledgerBalance` | decimal string，所有查询到的账户 posted + pending 合计；不能宣称可用金额 | 同上；B04 |
| 待入账金额 | 同上 `$.items[].pendingBalance` | decimal string，pending 合计；不是冻结余额，不从其他金额推导 | 同上；DTO 的说明较宽泛，以服务实现为源码证据 |
| 更新时间 | 同上 `$.items[].updatedAt` | 后端 Date（JSON ISO 字符串），组内最新时间；当前适配校验毫秒 UTC 格式 | accounting `:549-559`；前端 `backend-api.ts:2646` |
| 金额精度 | 上述三个余额字段 | 持久化 Decimal(36,18)，后端 Decimal.toFixed() 字符串；前端最多 18 位整数/18 位小数，拒绝多余尾零。汇总可超过单账户整数位边界，待确认 | 后端 `prisma/schema.prisma:1267-1268`；前端 `backend-api.ts:2663` |
| 名称/网络/链/账户状态/操作权限 | balances 无对应路径 | **未完成映射**。不得把缺失当作 ACTIVE、可操作或零金额；需 B05 裁决 | 余额 DTO 无这些字段；另见 accounts/assets 控制器，未自行增加页面请求 |
| 错误 | 非 2xx → BackendApiError(status, traceId, message)；timeout → 408；网络 → 0；401 → 会话失效 | 未知错误用通用提示；权限状态及弹窗去重受 B02 与现有 hook 丢失错误类别阻塞 | 前端 `backend-api.ts:834-903`、`backend-session-policy.ts` |
| U卡 | 无接口，静态“卡片功能待开放” | 不代表真实卡状态，无业务动作 | 工单冻结内容 |

上述金额/更新时间字段为 DTO 非可空声明；前端严格解析器遇缺失或无效值当前抛出整组错误，没有实现工单要求的字段级“—”及差异提示。修复方式须保留安全检查并在 B04 裁决后落实，未自行宽松化解析。

补充发现（未选入页面契约）：GET `/api/v1/wallet/total-assets?valuationAssetId=flp_asset_usd` 在后端源码存在，返回 `$.totalLedgerValue`、`$.totalAvailableValue`、`$.valuationAssetCode`、`$.valuationMode` 等。`wallet-accounting.service.ts:590` 使用静态 SANDBOX USD 参考表。它不是实时价格或已批准的统一折算口径，本轮不使用、不发起请求；保留为待裁决差异。

## 5. 现有组件清单

- 导航外壳：`src/components/MobileShell.tsx`，底部六项导航，`max-w-md` 宽度、`pb-28` 内容避让；不应重构。
- 原首页视觉：`src/routes/index.tsx` 的 `mx-6 mt-6`、`rounded-3xl` 概览卡、`rounded-2xl` 操作入口、既有渐变与字体。
- 通用控件：`src/components/ui/{card,button,badge,skeleton,alert,dialog,alert-dialog}.tsx`。
- 弹窗：`src/components/ActionModal.tsx` 为业务确认/待处理/成功弹窗，不等同全局异常处理。
- 不可用态：`src/components/UnavailableFeature.tsx`。
- 设计变量：`src/styles.css`，深色背景、绿色 primary、橙色 accent、Inter/Space Grotesk、radius 变量与既有阴影。
- 原首页还读取卡列表和卡流水并显示最近交易，不符合本工单五区目标；待解除阻塞后在首页范围内按冻结蓝图替换。本轮未触碰这些调用。

## 6. 交付与自检

| 项目 | 本轮结果 |
| --- | --- |
| A 仓库与字段核验 | 已提供可定位证据、部分实际映射；完整映射受 B04/B05 阻塞，不宣称完成 |
| Step1 依赖检查 | 未通过，详见 B01–B03 |
| B 五区 TSX / C 适配 / D 状态 | 未启动，遵守遇阻停止要求 |
| 布局与范围 | 未改代码，未自行调整五区或扩展其他页面 |
| 后端只读、历史证据保留 | 遵守；未修改契约/资金流程/安全机制 |
| TEST → SANDBOX | 均未开展；无真实环境验证或通过声明 |
| 页面截图 / 独立蓝图评审 | 无新页面，未生成截图，等待本报告回传裁决 |
| 前端代码 Diff | 无；本轮唯一新增交付为本报告。开工前已有变更不属于本工单 |

恢复条件：补齐/确认前端基线和 Step1 依赖，裁决余额等式、明细维度与入口契约；再继续五区 React-TSX 实施及 TEST → SANDBOX 验证。按工单暂停，不自动修复底座或开发其他页面。

## 7. B04 人工裁决与校验修订补充（DEV-UI-001-B04-R1）

以上为开工时的历史核验记录，原样保留。本次人工选择 A，确认用于前端对齐：availableBalance 为 ACTIVE 账户已入账金额汇总；ledgerBalance 为查询范围内全部账户状态的已入账与待入账汇总；pendingBalance 为查询范围内待入账汇总，不代表冻结金额。“0 / 7 / 0”为有效冻结账户响应。

证据等级：后端源码及测试夹具，经本次人工确认；**不是 Railway 原始响应验证**。前端仅移除 available + pending = ledger 判断及其专用辅助函数，保留各字段原值和既有严格解析规则，未新增其他金额关系。历史报文、差异记录及此前交付材料未替换。

B04 状态更新为“人工口径已确认，前端修订已提交，等待独立评审”，本次不自行解除。其他金额精度边界、尾零、数量上限和查询覆盖范围不随本次确认改变；B03 真实环境验证仍待安排，资产看板继续暂停。

修订说明、保留检查及验证结果见 [B04-R1 交付报告](DEV-UI-001-B04-R1-REVIEW.md)。

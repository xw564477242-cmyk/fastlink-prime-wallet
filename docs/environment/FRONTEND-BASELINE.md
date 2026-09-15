# FastLink 前端公共底座基线

版本：DEV-UI-000 V1.0，2026-09-15。适用范围：TEST / SANDBOX 公共底座。

## 1. 权责与确认状态

ChatGPT 冻结顶层布局、区块顺序与主要功能分区；Codex 复用组件实施，仅微调边距、字号、圆角等。布局变化回传设计端裁决。Railway 仅部署预览，用户浏览器验收。遵循 `DEV-BASELINE.md` 与根 `AGENTS.md` 的 Lovable 历史保护约束。

本轮工单指定现有组件及样式为实施参考，**未证明与历史 Railway-Demo 完全一致**。B01 的实施参考由本次工单确认，不修改旧记录。

2026-09-15 人工确认：B04 已解除，范围限于移除不适用的余额等式校验，冻结账户“可用 0 / 账面 7 / 待入账 0”按后端原值保留；格式、精度、必填项及其他安全检查保持不变。依据为源码及夹具经人工确认，不代表 Railway 实测通过。其他金融金额精度/舍入/折算/遮罩、查询覆盖范围、资产状态及业务权限缺口仍需分别核验；B03 未解除，资产看板继续暂停。

## 2. 导航与视觉参考

- `src/components/MobileShell.tsx` 导出 `MobileShell`、`StatusBar`。外壳 `mx-auto w-full max-w-md`（Tailwind 默认 28rem），底部固定六项导航、内容 `pb-28`。不得新增导航或改变断点/主要分区。
- `src/routes/index.tsx` 仅作现有视觉参考：`mx-6 mt-6`；概览 `rounded-3xl bg-gradient-card p-6 shadow-card`；操作入口 `rounded-2xl bg-surface py-4`。该页业务与布局不是新工单蓝图，本轮未改。
- 实际变量源为 `src/styles.css`，不另建样式体系。以下为当前值摘要，最终以源码为准：

| 变量 | 值 |
| --- | --- |
| `--background` / `--foreground` | `oklch(0.16 0.012 250)` / `oklch(0.98 0.005 250)` |
| `--surface` / `--surface-elevated` | `oklch(0.21 0.014 250)` / `oklch(0.25 0.016 250)` |
| `--card` / `--card-foreground` | `oklch(0.21 0.014 250)` / `oklch(0.98 0.005 250)` |
| `--primary` / `--primary-foreground` | `oklch(0.78 0.16 145)` / `oklch(0.15 0.02 250)` |
| `--accent` / `--destructive` | `oklch(0.72 0.15 60)` / `oklch(0.65 0.22 25)` |
| `--muted-foreground` / `--border` | `oklch(0.65 0.02 250)` / `oklch(0.28 0.014 250)` |
| `--font-sans` | Inter, sans-serif |
| `--font-display` | Space Grotesk, Inter, sans-serif |
| `--radius` | 1rem；sm/md 为减 4px/2px，lg 为基值，xl/2xl/3xl 加 4px/8px/12px |
| `--gradient-primary` | 135deg，`oklch(0.78 0.16 145)` → `oklch(0.72 0.15 175)` |
| `--gradient-card` | 135deg，`oklch(0.28 0.03 260)` → `oklch(0.19 0.02 250)` |
| `--shadow-glow` | `0 20px 60px -20px oklch(0.78 0.16 145 / 0.4)` |
| `--shadow-card` | `0 10px 40px -10px oklch(0 0 0 / 0.5)` |

## 3. 组件清单与调用示例

文件均相对仓库根目录。示例仅说明公共组件，不是新增业务页面。

| 文件 | 真实导出 | 变体 / 示例 / 限制 |
| --- | --- | --- |
| `src/components/ui/card.tsx` | Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent | 无 variant 参数；`<Card><CardContent>…</CardContent></Card>`；保留设计变量 |
| `src/components/ui/dialog.tsx` | Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription | 无样式变体；`<Dialog><DialogContent><DialogTitle>标题</DialogTitle><DialogDescription>说明</DialogDescription></DialogContent></Dialog>`；保留 Radix 焦点与键盘行为 |
| `src/components/ui/alert-dialog.tsx` | AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel | 无 variant；全局异常使用 PublicErrorProvider，业务方不再挂第二份 |
| `src/components/ui/button.tsx` | Button, buttonVariants（类型 ButtonProps） | variant: default/destructive/outline/secondary/ghost/link；size: default/sm/lg/icon；`<Button variant="outline" disabled={pending}>关闭</Button>`；加载禁用并配请求锁 |
| `src/components/ActionModal.tsx` | ActionModal（类型 ActionState） | idle/review/pending/success；`<ActionModal open={open} onClose={close} state="review" title="确认" />`；仅业务状态，不作全局异常 |
| `src/components/ui/skeleton.tsx` | Skeleton | 无 variant；`<Skeleton className="h-4 w-24" />`，只表示加载，不能显示零金额 |
| `src/components/ui/alert.tsx` | Alert, AlertTitle, AlertDescription | default/destructive；`<Alert variant="destructive"><AlertTitle>未完成</AlertTitle></Alert>`；局部错误拥有者不得再报告同一全局异常 |
| `src/components/ui/badge.tsx` | Badge, badgeVariants（类型 BadgeProps） | default/secondary/destructive/outline；`<Badge variant="outline">TEST</Badge>`；不从余额生成状态 |
| `src/components/UnavailableFeature.tsx` | UnavailableFeature | `title` 必填；`<UnavailableFeature title="未开放功能" />`；不可冒充空资产或无权限 |
| `src/components/MobileShell.tsx` | MobileShell, StatusBar | `<MobileShell>{children}</MobileShell>`；不重新设计全局外壳 |
| `src/components/PublicErrorProvider.tsx` | PublicErrorProvider, PublicErrorDialog, usePublicError | 根级统一挂载；业务接入只调用 hook；完整协议见下 |

## 4. 环境与会话

- `src/lib/frontend-runtime.ts` 校验 `VITE_FASTLINK_ENVIRONMENT`，trim/uppercase 后只接受 TEST/SANDBOX；`VITE_FASTLINK_API_URL` 仅接受标准化后的 `/api`。不猜默认环境，不允许跨域后端域名。
- 构建或启动配置选择环境；无运行时切换按钮。切换必须停止旧服务、使用新变量重新构建/启动、重新验证会话。
- 缺失/无效配置由根级 SessionBoundary 展示配置错误；request 的 requireRuntime 阻止发送请求。前后端环境不匹配由既有 BackendSessionProvider 拒绝提交会话，受保护 Outlet 不渲染。
- 保留 checking、Cookie `credentials: include`、`cache: no-store`、Trace、20 秒 timeout、AbortSignal、身份/环境/epoch 保护与既有 401 invalidation；403 不登出。
- `FrontendScope` 为每个会话对象代次建立独立 QueryClient 和异常队列；代次更换立即向子树提供新实例，旧实例 cleanup 取消查询、清空缓存。原 router 级无作用域 QueryClient 已移除，后续查询必须通过当前 `useQueryClient()` 获取，不能另建跨会话单例。
- 原余额 hook 的 scopeKey/generation、请求锁、卸载拦截完全保留，没有修改余额适配。
- 仓库检索到的 localStorage 仅语言偏好（i18n）；未发现持久化 Query 或资产/会话缓存。不新增令牌存储，不读 HttpOnly Cookie。CSRF 读取继续使用原有可读 CSRF Cookie。
- 浏览器 Cookie Domain/Path/SameSite/Secure、双环境真实部署域和代理路由隔离未真实验证。新前端缓存隔离不能代替这些部署证据。

配置示例：[TEST](frontend.test.env.example)、[SANDBOX](frontend.sandbox.env.example)。示例只有公开变量，没有凭据。

```sh
# 每次先停止旧服务；变量必须在构建时存在，不能只在构建产物启动时改名。
VITE_FASTLINK_ENVIRONMENT=TEST VITE_FASTLINK_API_URL=/api bun run build
# TEST 验证后再切换
VITE_FASTLINK_ENVIRONMENT=SANDBOX VITE_FASTLINK_API_URL=/api bun run build
```

后端代理保持既有 `src/server.ts`/部署配置负责，本轮不改。没有配置代理或登录条件时，不能据前端构建成功宣称真实会话联调通过。

## 5. 公共异常入口与重试契约

根接线：`BackendSessionProvider → FrontendScope → PublicErrorProvider + SessionBoundary`。渲染崩溃仍走根 ErrorComponent（此时子树/弹窗卸载）；共享 request 层不订阅全局弹窗。公共异常只接受已确认当前作用域的显式报告。

`usePublicError()` 返回报告函数，调用方在发请求前捕获它。必填 operation（固定非敏感操作名）、reason、isCurrent（已有请求代次检查）；可选 ownership 为 global/local/boundary，后两者不弹窗。全局拥有者不得同时局部 toast/setError 或再次 throw 到渲染边界。回调失败应 throw 给队列处理，不自行再次 report。

```tsx
const report = usePublicError();
// 放在已有请求处理逻辑内；isCurrent/readWithExistingLock/commit 为调用方已有能力。
report({
  operation: "approved-read",
  reason,
  isCurrent,
  retry: {
    safeReadOnly: true,
    run: async (signal, scopeCurrent) => {
      const result = await readWithExistingLock(signal);
      if (scopeCurrent() && isCurrent() && !signal.aborted) commit(result);
    },
  },
});
```

此例是接线协议而非可直接运行的业务函数。回调必须继续使用已有锁，将 signal 传入请求，提交状态前检查 scopeCurrent/isCurrent；不得在回调中操作资金、自动重放或绕过 guard。未能证明只读安全时不要提供 retry。公共层在执行前和完成后检查 scope/页面 lease/请求有效性；卸载时删除回调并 abort，在执行中的任意调用方代码仍须遵守取消协议。

分类：401 交既有 invalidate；403 标题“无权执行此操作”，仅关闭；网络/408 独立分类；其他 4xx 为业务失败；未知为通用服务错误；主动取消及 isCurrent=false 静默。BackendApiError 保留 HTTP、既有 code、traceId；request 将原有外部取消标记为 cancelled，同时保留原 status，避免改变既有消费者契约。

当前仓库没有集中、经确认的业务 code→安全中文映射；不能把原始 backend message 直接显示。公共层保留 code，使用通用业务失败说明，不编造业务含义。新增经过核验的文案映射应另有证据。

队列单实例只显示首项，其他 FIFO；key 包含环境/会话代次、operation、类别、HTTP/code，不以动态 trace/message 区分。显示/排队期间合并，首次接受后 2 秒内合并。显式重试有同步锁；成功关闭，失败更新当前项且合并同类排队项；401 清理，403 撤销重试。关闭和卸载均取消进行中的公共回调。

结构：标题→说明→可选追踪标识→关闭/可选重试。追踪标识限安全字符和长度，可选中查看/复制；不展示原始响应、堆栈或身份。初始焦点在关闭，Tab 在弹窗内循环，Escape 关闭并恢复焦点，重试中按钮禁用，关闭仍可取消。

### 未接入调用清单

本轮没有迁移任何业务调用。以下全部保留局部归属，不能认为已获得公共弹窗错误展示：

- `src/hooks/use-home-wallet-balances.ts`：余额，明确排除。
- 所有 `use-wallet-*`、`use-digital-asset-history`：钱包读写与流水。
- 所有 `use-card-*`、`use-virtual-card-create`：卡读写与交易。
- `use-fx-quote`、`use-kyc-status`：报价与 KYC。
- `src/routes/*` 内直接 backendApi 调用（包括 auth/profile/index）：原页面局部处理。
- `BackendSessionProvider` 的登录、恢复、刷新错误仍由既有会话流程持有；不重复普通异常弹窗。

公共入口以独立 `tests/frontend-foundation` 组件夹具及单元/挂载测试验证；该夹具无生产路由、无后端/资金/Thredd 请求，也不加入正式构建入口。

## 6. Bearer / Cookie 差异（保留历史）

| 项目 | 历史记录 | 当前源码与处理 |
| --- | --- | --- |
| 鉴权介质 | `docs/FASTLINK_WALLET_RUNTIME.md` Session boundary 写 Bearer 与 sessionStorage | `backend-api.ts` request 使用 credentials: include；未新增 Authorization/Bearer 存储 |
| 校验路由 | 同文档 GET `/api/v1/session` | `backendApi.session()` 同路由，既有 Provider 校验环境/过期 |
| Cookie | 历史文档未说明当前 Cookie 策略 | 当前后端 EndUserSessionController/Guard 为 Cookie；前端保留实现，不迁移认证 |
| 环境范围 | 历史文档包括 LOCAL/UAT/PRODUCTION | 本次公共底座工单明确限定 TEST/SANDBOX，历史文字保留，以本补充说明标记当前范围 |
| 证据等级 | 历史文件是记录，不等于当前运行时实测 | 本轮为源码核验＋本地模拟；Railway Cookie 属性、代理、历史契约一致性待联调 |

验证与解除证据见 [DEV-UI-000 交付报告](../audit-evidence/DEV-UI-000-DELIVERY.md)。B04 已按人工确认解除，修订证据见 [B04-R1 交付报告](../audit-evidence/DEV-UI-001-B04-R1-REVIEW.md)。归档报告保留当时“等待评审”的历史状态；当前状态以本节及第 1 节人工确认说明为准。B03 仍阻塞，资产看板继续暂停。

# DEV-UI-000｜公共底座交付与评审记录

2026-09-15；状态：**代码及本地验证完成，提交评审；真实部署联调未完成**。本轮不恢复 DEV-UI-001。

## 1. 交付索引

- [仅公共底座的完整代码 Diff](DEV-UI-000-code.patch)（包含新增源码、测试和本地组件夹具；文档与 PNG 作为独立交付）。
- [FRONTEND-BASELINE 与组件清单](../environment/FRONTEND-BASELINE.md)。
- [TEST 示例](../environment/frontend.test.env.example)、[SANDBOX 示例](../environment/frontend.sandbox.env.example)；切换步骤在基线第 4 节。
- Bearer/Cookie 差异、异常入口和未接入业务清单：基线第 5、6 节；旧 `FASTLINK_WALLET_RUNTIME.md` 仅追加勘误链接。
- [验证摘要](evidence/DEV-UI-000/validation.txt)。

## 2. 代码范围及安全边界

修改 `backend-api.ts` 的公共配置解析、错误元信息保留与取消标记；原余额等式、精度、适配、请求锁均未改。三处现有卡错误包装只透传 code/cancelled，不修改其业务逻辑或请求。新增 PublicErrorQueue/PublicErrorProvider/FrontendScope，在根公共层挂载。原路由级 QueryClient 替换为会话代次级缓存，移除无人使用的旧缓存上下文，业务路由不变。

源码 API/runtime 仍保留完整后端环境类型，实际前端配置只准 TEST/SANDBOX，这是本次工单授权的环境约束。原 Cookie、CSRF、401、过期与 timeout 策略保留。未修改后端、金额校验、资金流程、样式变量或导航；未发起 Thredd 请求、未开发资产看板/其他业务页面、未提交/推送/部署。

开工前存在的 `docs/environment/DEV-BASELINE.md`、`docs/history-journal.md` 修改和既有未跟踪报告/会话文件完全保留，不收录为本轮 Diff。

## 3. B01/B02/B03 解除证据

| 阻塞 | 代码/本地验证结论 | 剩余边界 |
| --- | --- | --- |
| B01 | 已解除本轮实施参考缺失：新增可定位基线，完整组件导出/变体/示例和视觉变量归集 | 不宣称与 Railway-Demo 完全一致；金额、遮罩、权限及 B04 留缺 |
| B02 | 已实现根挂载与公共入口；分类、FIFO、2 秒去重、单弹窗、安全只读重试、卸载/代次失效清理均有测试；浏览器完成焦点与禁用验证 | 业务调用尚未逐页接入，明确保留局部归属；无已核验集中业务 code 文案表，使用安全通用说明并保留 code |
| B03 | 已实现并验证 TEST/SANDBOX 配置规则、无默认回退、同源 /api、会话代次独立 Query 缓存及旧响应隔离 | 真实双环境会话/代理/Cookie 域属性未完成验证，不能宣称部署隔离已验收 |

B04 继续等待人工独立裁决。底座完成不等于资产看板获准开工。

## 4. 测试与构建

顺序按 TEST → SANDBOX；最终源码重新按此顺序执行全量测试和构建。

| 检查 | 结果 |
| --- | --- |
| `VITE_FASTLINK_API_URL=/api VITE_FASTLINK_ENVIRONMENT=TEST bun test` | 555 pass，0 fail，62 files，4507 assertions |
| 同配置 `bun run build` | 通过，生成本地构建产物，没有部署 |
| `VITE_FASTLINK_API_URL=/api VITE_FASTLINK_ENVIRONMENT=SANDBOX bun test` | 555 pass，0 fail，62 files，4507 assertions |
| 同配置 `bun run build` | 通过 |
| `tsc --noEmit` | 通过 |
| 本轮修改/新增 TypeScript 文件定向 ESLint | 通过，无错误/警告 |
| 仓库 `test:readiness` | Bun 4 pass；Node 7 pass，0 fail |
| `git diff --check` | 通过 |

新增自动化证据：

- `public-errors.test.ts`：分类、code/trace 安全文案、401/403 分离、已存在失效信号、取消/过期/归属静默、动态 trace 去重、FIFO、2 秒窗口、重试成功/失败/重复点击、卸载/无效作用域及旧回调拦截。
- `frontend-runtime.test.ts`：双环境标准化、拒绝缺失/无效/生产等环境、拒绝非同源地址。
- `frontend-request.test.ts`：真实共享封装使用模拟 fetch 验证 status/code/trace、Cookie/no-store、主动取消；无真实服务调用。
- `FrontendScope.test.tsx`：真实 Provider 挂载，会话更换、旧 Query 清理、延迟返回不能写入新缓存、401 后缓存隔离。
- 原 `backend-session*`、余额 hook 的跨环境/会话替换/过期/卸载/防重测试随全量执行继续通过；本轮未修改其业务实现。

现有工具告警：react-test-renderer 弃用提示；Vite 关于旧测试文件位于路由目录及部分导出不可拆包等提示。未因本工单重排其他文件或升级依赖。

## 5. 浏览器与截图

独立夹具 `tests/frontend-foundation` 只复用公共组件，无生产路由、后端/资金/Thredd 请求；错误均标注本地模拟。用 TEST 启动验证后停服，再以 SANDBOX 重启验证。375×812 窄屏和 1280×800 宽屏检查通过。

| 验证 | 证据 |
| --- | --- |
| TEST 窄屏标题→说明→追踪标识→关闭/重试 | [超时截图](evidence/DEV-UI-000/test-timeout-375.png) |
| 重试按钮加载禁用，同步锁防重复，焦点回关闭按钮 | [重试中截图](evidence/DEV-UI-000/test-retrying-375.png) |
| 403 仅关闭、不显示重试 | [无权限截图](evidence/DEV-UI-000/test-permission-375.png) |
| 失败更新同一弹窗，无叠加 | [失败截图](evidence/DEV-UI-000/test-retry-failed-375.png) |
| SANDBOX 启动标识与空队列 | [配置截图](evidence/DEV-UI-000/sandbox-fixture-375.png) |
| SANDBOX 双尺寸布局 | [窄屏](evidence/DEV-UI-000/sandbox-timeout-375.png)、[宽屏](evidence/DEV-UI-000/sandbox-timeout-1280.png) |

人工式浏览器操作证据：打开后焦点在“关闭”；Tab 移至“重试”，再 Tab 回“关闭”；Escape 关闭恢复到触发按钮。只读模拟重试成功后弹窗关闭，计数从 0 到 1，焦点回触发按钮。重试失败在同一 dialog ID 更新为超时。截图已检查，无横向溢出或文字裁切。

复验入口（仅本机）：

```sh
VITE_FASTLINK_API_URL=/api VITE_FASTLINK_ENVIRONMENT=TEST node_modules/.bin/vite --config tests/frontend-foundation/vite.config.ts
```

浏览器打开 `http://127.0.0.1:4179/`。用 SANDBOX 重启前先停止旧服务。夹具不加入正式应用构建。

## 6. 真实环境未完成项

本轮没有获取已批准的双环境预览/代理配置与有效测试会话。最初使用应用开发服务打开夹具路径被路由接管，既有会话恢复遇未配置后端代理而失败；随后改用完全独立的组件服务完成浏览器验证。此过程不构成真实 TEST 会话联调。

仍需按 TEST → SANDBOX 核验：实际构建环境标识、既有 `/api` 代理目的地、登录/会话恢复与前后端环境一致、Cookie 域/路径/SameSite/Secure、同一浏览器跨环境后旧会话不得可见。只允许会话及获准非资金请求，不用资金操作制造错误。未读取或搬运 HttpOnly Cookie，不修改代理或后端配置。

## 7. 自检结论

公共底座代码和本地验证可交付评审；真实部署验收保留未完成项。异常接入是显式选择，不在请求层无差别弹窗；既有业务页面未接入清单完整保留。环境选择采用构建/启动配置，不增加运行时切换。保留历史文档并链接差异，不以源码推导替代 Railway 真值。

收到评审结果前暂停；不自动解除 B04 或恢复 DEV-UI-001。

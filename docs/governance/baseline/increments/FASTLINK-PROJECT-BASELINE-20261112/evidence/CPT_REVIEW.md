# 第三组独审 · CardProductTemplate 目录接线

2026-11-12 · BASE-V1.8-20261108

**PASS_OFFLINE_ONLY**。审查范围是固定 UAT 正常 `AppModule` 中的 `GET /api/v1/cards/products` 和 `POST /api/v1/cards/opening-quotes`。**CardProductTemplate 整表真实迁移仍为 BLOCKED，批次 3.3 仍为 2/43。**

## 复核结论

- 两个入口保留 EndUser 会话守卫。报价 POST 保留 Origin 和 CSRF 校验。服务以正常会话 Cookie 独立签发 `enduser:cards:read` 上下文，比较 actor、subject、tenant、environment 和 session，再将固定只读事务交给产品和费率查询。两个查询无全局 Prisma 回退，目录读取单次尝试。会话 touch 和上下文管理仍由原受控入口执行。
- 业务读取失败时，回调将原异常作为结果交回 runtime。runtime 完成关闭并返回后，服务在 `scoped()` 之外抛出原异常。正常 `AppModule` 的 `AuditExceptionFilter` 仍生成脱敏通用 500 或原 Prisma 503 结构。上下文关闭异常走原脱敏 503，商品响应不会返回。8 秒阈值停止后续查询，已发语句退出后才继续关闭流程，实际 HTTP 响应时间取决于语句退出和事务结果。
- 最终 HTTP 合成用例采用真实 CardsController、CardsService、SharedContextService 和异常过滤器，以 mock runtime、会话服务和费率读取作隔离。源码断言 GET 200、P2022 脱敏 503、未知错误通用 500、报价 POST 201、缺 Origin 或 CSRF 时分别 403。403 两例同时断言未读目录、无 close 调用。上一版新增单元测试的独立执行回执为 12/12、退出码 0。本轮只静审最终变更，已改的异常用例断言原异常对象在一次关闭后传播。
- 交付目标限正常 `AppModule`。旧 `LaunchModule` 的已认证请求可进入 Serializable 事务，B10 Prisma 代理会拒绝新 runtime 的 ReadCommitted 嵌套事务。Wallet 预览也使用独立运行角色。现有发布封存及该入口的运行验收不以此候选替换。

## 本轮实算 SHA256

| 文件 | SHA256 |
| --- | --- |
| `backend/src/cards/cards.controller.ts` | `3cf434c507f613d21741ef029a32a5d3430cd12c5ac98f506be9c37227bb8f7a` |
| `backend/src/cards/cards.service.ts` | `8b6704fbf257ba41046101ccc4564b6ff78c784c45b5e77c21fc652a9f44e9e2` |
| `backend/src/cards/cards.module.ts` | `81b9ef4a4f06ad2db28b44b4977cbb7c9aaf69332976ab4591ddb93f47420aa8` |
| `backend/src/fees/fee-policy.service.ts` | `bb67da2515e99103e6f82bd3d79080ea8d7fd78d39361eac70fb71b452e89e47` |
| `backend/src/shared-context/shared-context.service.ts` | `78f89b67837ffbb354672d0e219e0f44082be2d6076876fb8eec20f510188bcc` |
| `backend/src/cards/card-product-context-wiring.spec.ts` | `2c8c30a2e211247397d29f6e0e5e2811dbcf22b9e7dc2495b8f930eb00d23e12` |
| `backend/test/card-products-read-contract.integration.e2e-spec.ts` | `ab8962ca543c98c165c15591bc65822afab81c5c7bcfd5d5a4be4d9c5d05525b` |

## 首表硬停

旧入口清单 SHA 为 `429bc2618d715a5423d2e19ce16a80ec11693d036f7ec43d14632fc9cba47d6e`，`liveEntrySHA256=null`。重算原 forward `6b1a81e1f16a696a4c33bbc9c3287cf8ecb6d0de7bea85612ae221c664a098cd` 与 rollback `6e91ffee9998d07fd9f16289857bd402d2d6af0afbecbc6c71b8de92b5216fbb`，均匹配清单。两文件均在第 5 行以 `P0001` 硬停，早于事务及任何 DDL。待完成其余可达读者、Admin 写入与 UPDATE/INSERT RETURNING 合同、可信身份分派和目标原生验收及回退绑定后，再提真实执行裁定。

本轮读取本地源码及旧草案，仅新增本回执。HTTP、数据库连接、SQL、迁移、部署与历史用例重跑均为 0。

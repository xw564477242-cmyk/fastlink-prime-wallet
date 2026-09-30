# 范围、来源与迁移执行

报告干净基点及功能分支起点：`5bd2f24ecf4497e44bde52d20a02d269c00ec98d`。
后端正式源码：`/Users/ck/Developer/FastLink/fastlik-backend`，HEAD `b337bc96dfd587326a3c43d890d22ca251ca932d`。
报告位于独立报告克隆；不切换、拉取覆盖或提交正式业务工作区。

51份SQL = 正式32份migration.sql + 5份rollback.sql + 开发9份migration.sql + 3份post-constraints.sql + prepare.sql + activate.sql。不是51份前向迁移。逐文件SHA-256、Git blob OID、源码行号事件见 evidence/migration-inventory.json。静态提取为保守词法扫描，不是完整SQL解释器；动态模板保留未展开标记。TRUNCATE词法出现也可能是权限枚举，不能直接称为执行语句。

正式前向顺序按Prisma目录顺序，32项与数据库迁移台账逐项对账。第一次尝试P1012、应用0步（缺DIRECT_URL）；第二次将DATABASE_URL和DIRECT_URL均指向同一全新隔离库后原样32步完成。未改schema、迁移或依赖。

用户明确例外：仅允许空白隔离数据库重建过程的DROP CONSTRAINT/DROP INDEX；正式第3步两项属该范围。未执行其他DROP、TRUNCATE或整改草案。

第二个全新空白隔离库设置 `fastlink.environment=UAT`，仅触发源码原有条件，不是连接真实UAT。前31步完成，第32步缺指定Thredd sandbox租户而失败。保留失败台账和错误类别，不创建该租户、不修复台账、不改SQL。第32步表未建立；因此后续只能称“UAT部分链状态”。

开发14文件已逐项静态盘点，运行态BLOCKED：独立开发历史基点及fastlink_dev_app拓扑没有安全重建依据，prepare含DROP POLICY且不在例外内。不把词法顺序当批准执行顺序，不把开发补丁直接叠加最新正式库。5份rollback明示NOT_RUN，非遗漏。

| 文件 | 来源 | 组内前向顺序 | 默认执行/处理 | UAT条件执行 |
|---|---|---:|---|---|
| `prisma/migrations/20260719000100_baseline/migration.sql` | formal_forward | 1 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000200_security_foundation/migration.sql` | formal_forward | 2 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000300_foundation_round_two/migration.sql` | formal_forward | 3 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000400_card_platform_week_one/migration.sql` | formal_forward | 4 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000500_card_lifecycle_phase_two/migration.sql` | formal_forward | 5 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000600_card_transition_lock/migration.sql` | formal_forward | 6 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000700_card_limits/migration.sql` | formal_forward | 7 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000800_card_replacement/migration.sql` | formal_forward | 8 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719000900_card_renewal/migration.sql` | formal_forward | 9 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260719124500_treasury_operations/migration.sql` | formal_forward | 10 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260720000100_api_client_scopes_and_rotation/migration.sql` | formal_forward | 11 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260720000200_ledger_wallet_journal/migration.sql` | formal_forward | 12 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260720000300_wallet_business_flow/migration.sql` | formal_forward | 13 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260720000400_card_sandbox_security/migration.sql` | formal_forward | 14 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721000100_sprint03_card_models/migration.sql` | formal_forward | 15 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721000300_fx_journal/migration.sql` | formal_forward | 16 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721000400_sprint08_business_closure/migration.sql` | formal_forward | 17 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721000500_approve_legacy_cardholders/migration.sql` | formal_forward | 18 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721000500_sprint11_merchant_qr/migration.sql` | formal_forward | 19 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260721110500_sprint12_card_financial_state/migration.sql` | formal_forward | 20 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260722000100_admin_sessions/migration.sql` | formal_forward | 21 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260722000200_evidence_center/migration.sql` | formal_forward | 22 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260725090000_p2_cookie_session_backend/migration.sql` | formal_forward | 23 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260725090000_p2_cookie_session_backend/rollback.sql` | rollback | — | NOT_RUN | 不适用/未运行 |
| `prisma/migrations/20260726130500_p3_dev_simulation_controls/migration.sql` | formal_forward | 24 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260728000100_add_test_environment/migration.sql` | formal_forward | 25 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260812000100_prime_wallet_p1_withdrawal_address_book/migration.sql` | formal_forward | 26 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260908000100_third_party_runtime_foundation/migration.sql` | formal_forward | 27 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260908000200_cregis_sandbox_safety_window/migration.sql` | formal_forward | 28 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260913000100_uat_runtime_rls_v1/migration.sql` | formal_forward | 29 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260913000100_uat_runtime_rls_v1/rollback.sql` | rollback | — | NOT_RUN | 不适用/未运行 |
| `prisma/migrations/20260913000200_uat_readiness_metadata_acl_v1/migration.sql` | formal_forward | 30 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260913000200_uat_readiness_metadata_acl_v1/rollback.sql` | rollback | — | NOT_RUN | 不适用/未运行 |
| `prisma/migrations/20260913000300_uat_webhook_retry_acl_v1/migration.sql` | formal_forward | 31 | PASS_DEFAULT | PASS |
| `prisma/migrations/20260913000300_uat_webhook_retry_acl_v1/rollback.sql` | rollback | — | NOT_RUN | 不适用/未运行 |
| `prisma/migrations/20260913000400_card_provider_control_plane_v1/migration.sql` | formal_forward | 32 | PASS_DEFAULT | BLOCKED |
| `prisma/migrations/20260913000400_card_provider_control_plane_v1/rollback.sql` | rollback | — | NOT_RUN | 不适用/未运行 |
| `prisma/dev-migrations/20260808_p1_admin_write_contract/migration.sql` | dev_forward | 1 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260808_p1_admin_write_contract/post-constraints.sql` | dev_post_constraints | — | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260808_p1_admin_write_rls_policy_fix/migration.sql` | dev_forward | 2 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260808_p1_card_fee_ledger_contract/migration.sql` | dev_forward | 3 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260808_p1_card_fee_ledger_contract/post-constraints.sql` | dev_post_constraints | — | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260810_p1_fee_execution/migration.sql` | dev_forward | 4 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260810_p1_fee_execution/post-constraints.sql` | dev_post_constraints | — | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260812_p1_non_card_wallet_flow_constraint/migration.sql` | dev_forward | 5 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260812_p1_withdrawal_address_rls_policy_fix/migration.sql` | dev_forward | 6 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260820_phase2_onchain_card_provider/migration.sql` | dev_forward | 7 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260825_ucard_core_saas_platform/migration.sql` | dev_forward | 8 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260901_cregis_sandbox_safety_window/migration.sql` | dev_forward | 9 | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260901_p1_end_user_auth_runtime_rls_v1/activate.sql` | dev_activate | — | BLOCKED | 不适用/未运行 |
| `prisma/dev-migrations/20260901_p1_end_user_auth_runtime_rls_v1/prepare.sql` | dev_prepare | — | BLOCKED | 不适用/未运行 |

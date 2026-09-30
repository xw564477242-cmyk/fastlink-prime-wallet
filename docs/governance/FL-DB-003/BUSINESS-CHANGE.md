# 业务仓库最小改动说明

- 仓库：`fastlik-backend`
- 基点：`b337bc96dfd587326a3c43d890d22ca251ca932d`
- 功能提交：`4fead5f3e007d6226d63e263991c2de680744424`
- Draft PR：[#334](https://github.com/xw564477242-cmyk/fastlik-backend/pull/334)，目标`dev`
- 范围：6个文件，251行新增、11行删除

修改文件：

1. `src/admin-auth/admin-bearer.guard.ts`
2. `src/admin-auth/admin-bearer.guard.spec.ts`
3. `src/common/auth/request-auth.ts`
4. `src/tenants/tenants.controller.ts`
5. `src/tenants/tenants.controller.spec.ts`
6. `test/admin-tenant-scope.integration.e2e-spec.ts`

守卫不再用优先级选择path、query或body租户；所有出现的租户候选必须完全一致。守卫通过后写入 `authorizedTenantId`，租户详情控制器不再读取原始`:id`作为服务参数。既有 `platform:tenants:read/write` 判定未新增、未扩大；其部署语义仍未验证。

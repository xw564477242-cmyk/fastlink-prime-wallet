# 52表操作契约审批矩阵（待批准）

52/52条目已枚举，全部保持BLOCKED。以下是保守建议，不是实际授权，也不代表合法业务路径已通过。平台Admin默认禁止跨租户；任何后台跨租户用途须逐项批准。资金功能继续关闭。JSON同名证据包含逐字段来源、主体、关系和需批准角色。

## DB5-CONTRACT-001｜AdminSession

- 模块：身份/权限
- 归属链：TenantUser via tenantUserId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：tokenHash
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-002｜ApiClient

- 模块：身份/权限
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：scopes
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-003｜ApiKey

- 模块：身份/权限
- 归属链：ApiClient via apiClientId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：keyHash
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-004｜AuditLog

- 模块：审计/事件/供应商调用
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定事件写入服务（待审批）；本租户审计审核角色（待审批）
- SELECT：候选：本租户审计角色仅脱敏必要列；请求/响应/载荷不可直接暴露，普通用户拒绝
- INSERT：候选：用途限定服务仅追加本租户记录；可信归属与外部载荷分别验证
- UPDATE：候选：仅专用处理角色更新投递/处理状态，原始证据不可改；字段白名单待批
- DELETE：建议拒绝，审计/证据仅追加保留
- 敏感字段名（仅目录，不含值）：metadata、ipAddress、userAgent、requestId
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-005｜Card

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：provider、providerPublicToken、maskedPan、last4、expiryMonth、expiryYear
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-006｜CardBalance

- 模块：卡
- 归属链：Card via cardId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：availableBalanceMinor、currentBalanceMinor、pendingAmountMinor、providerUpdatedAt
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-007｜CardEvent

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：payload
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-008｜CardHolder

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：profile
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-009｜CardLifecycleEvent

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-010｜CardLimit

- 模块：卡
- 归属链：Card via cardId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-011｜CardRenewal

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：oldExpiryMonth、oldExpiryYear、newExpiryMonth、newExpiryYear
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-012｜CardReplacement

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：reason
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-013｜CardRestriction

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：reason
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-014｜CardSecurityProfile

- 模块：卡
- 归属链：Card via cardId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：用途限定卡安全服务（待审批）
- SELECT：禁止用户/Admin直读PIN摘要和安全计数；专用安全函数是否可访问须审批
- INSERT：专用卡安全初始化入口待批，其他拒绝
- UPDATE：专用失败计数/锁定/安全更新入口待批；不得开放通用UPDATE
- DELETE：继续拒绝，生命周期待批
- 敏感字段名（仅目录，不含值）：pinHash、failedPinAttempts、pinUpdatedAt
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-015｜CardTransaction

- 模块：卡
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：providerTransactionId、amountMinor、providerPayload、authorizedAmountMinor、clearedAmountMinor、settledAmountMinor、reversedAmountMinor、refundedAmountMinor
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-016｜EndUserRefreshToken

- 模块：身份/权限
- 归属链：EndUserSession via sessionId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：tokenHash、revokeReason、rotatedToTokenId
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-017｜EndUserSession

- 模块：身份/权限
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：sessionTokenHash、csrfTokenHash、revokeReason、createdIpHash、userAgentHash
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-018｜EvidenceArtifact

- 模块：审计/事件/供应商调用
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定事件写入服务（待审批）；本租户审计审核角色（待审批）
- SELECT：候选：本租户审计角色仅脱敏必要列；请求/响应/载荷不可直接暴露，普通用户拒绝
- INSERT：候选：用途限定服务仅追加本租户记录；可信归属与外部载荷分别验证
- UPDATE：候选：仅专用处理角色更新投递/处理状态，原始证据不可改；字段白名单待批
- DELETE：建议拒绝，审计/证据仅追加保留
- 敏感字段名（仅目录，不含值）：request、response、contentHash
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-019｜FxConversion

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：sourceAmount、targetAmount、provider
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-020｜FxOrder

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：sourceAmount、targetAmount、provider
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-021｜FxRate

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：provider
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-022｜Journal

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：description
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-023｜JournalEntry

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-024｜Merchant

- 模块：商户/结算
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-025｜MerchantPayment

- 模块：商户/结算
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-026｜MerchantQrCode

- 模块：商户/结算
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-027｜Permission

- 模块：身份/权限
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：归属和平台权限模型未确认，所有运行身份继续拒绝；不得自行认定公共目录
- INSERT：继续拒绝；需独立批准权限模型及操作范围
- UPDATE：继续拒绝；需独立批准权限模型及操作范围
- DELETE：继续拒绝；需独立批准权限模型及操作范围
- 敏感字段名（仅目录，不含值）：scope、description
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-028｜ProviderOperation

- 模块：审计/事件/供应商调用
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定事件写入服务（待审批）；本租户审计审核角色（待审批）
- SELECT：候选：本租户审计角色仅脱敏必要列；请求/响应/载荷不可直接暴露，普通用户拒绝
- INSERT：候选：用途限定服务仅追加本租户记录；可信归属与外部载荷分别验证
- UPDATE：候选：仅专用处理角色更新投递/处理状态，原始证据不可改；字段白名单待批
- DELETE：建议拒绝，审计/证据仅追加保留
- 敏感字段名（仅目录，不含值）：requestHash、response、request
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-029｜Role

- 模块：身份/权限
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：归属和平台权限模型未确认，所有运行身份继续拒绝；不得自行认定公共目录
- INSERT：继续拒绝；需独立批准权限模型及操作范围
- UPDATE：继续拒绝；需独立批准权限模型及操作范围
- DELETE：继续拒绝；需独立批准权限模型及操作范围
- 敏感字段名（仅目录，不含值）：description
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-030｜RolePermission

- 模块：身份/权限
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：归属和平台权限模型未确认，所有运行身份继续拒绝；不得自行认定公共目录
- INSERT：继续拒绝；需独立批准权限模型及操作范围
- UPDATE：继续拒绝；需独立批准权限模型及操作范围
- DELETE：继续拒绝；需独立批准权限模型及操作范围
- 敏感字段名（仅目录，不含值）：roleId、permissionId
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-031｜SettlementBatch

- 模块：商户/结算
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：totalAmount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-032｜SettlementItem

- 模块：商户/结算
- 归属链：SettlementBatch via settlementBatchId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-033｜SimulationRecord

- 模块：模拟场景
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定SANDBOX测试任务（待审批）
- SELECT：仅任务自己的SANDBOX场景候选可读，其他身份拒绝
- INSERT：仅合成场景用途任务待审批，禁止生产数据
- UPDATE：只限已批准测试生命周期字段，归属不可改
- DELETE：当前拒绝；清理/重置属于保留审批事项，不纳入自动授权
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-034｜SimulationScenario

- 模块：模拟场景
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定SANDBOX测试任务（待审批）
- SELECT：仅任务自己的SANDBOX场景候选可读，其他身份拒绝
- INSERT：仅合成场景用途任务待审批，禁止生产数据
- UPDATE：只限已批准测试生命周期字段，归属不可改
- DELETE：当前拒绝；清理/重置属于保留审批事项，不纳入自动授权
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-035｜Tenant

- 模块：租户根
- 归属链：本表.id为租户根；需外部可信身份映射，不能接受客户端自选id
- 主体角色（建议）：TENANT_ADMIN（本租户必要信息）；USER（必要公开展示字段，待批）
- SELECT：候选：本租户最小展示列；租户列表及跨租户枚举拒绝
- INSERT：继续拒绝；开户/租户创建另批
- UPDATE：本租户展示字段是否可改待逐字段审批；环境/归属/权限不可改
- DELETE：继续拒绝
- 敏感字段名（仅目录，不含值）：待逐字段确认，不能解释为无敏感字段
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-036｜TenantCardProviderConfig

- 模块：供应商配置
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定供应商配置读取服务（待审批）
- SELECT：候选：服务端按租户+环境读取必要配置引用；客户端不可读取原配置或密钥引用；不读取秘密值
- INSERT：继续拒绝；供应商配置变更须专项授权与审计
- UPDATE：继续拒绝；供应商配置变更须专项授权与审计
- DELETE：继续拒绝；禁止影响可追溯配置历史
- 敏感字段名（仅目录，不含值）：provider、credentialSecretRef、webhookSecretRef、providerSettings
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-037｜TenantUser

- 模块：身份/权限
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：email、passwordHash
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-038｜TenantUserRole

- 模块：身份/权限
- 归属链：TenantUser via tenantUserId → 关联对象租户；须核验完整链及同租户约束
- 主体角色（建议）：用途限定认证服务（待审批）
- SELECT：候选：认证服务读取最少必要列；普通/租户Admin不得直接读取口令、token摘要或权限映射
- INSERT：候选：认证/权限服务按登录、发放或明确授权流程创建，不开放通用直写
- UPDATE：候选：认证服务仅过期、撤销、轮换状态；角色成员变更另行显式审批
- DELETE：默认拒绝；保留撤销记录，生命周期另批
- 敏感字段名（仅目录，不含值）：roleId、grantReason
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、身份认证资产负责人（自然人待指定）
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-039｜TreasuryPosition

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：availableBalance
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-040｜WalletAccount

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：postedBalance、pendingBalance
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-041｜WalletOperation

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：amount、failureReason
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-042｜WalletTransaction

- 模块：账本/钱包/资金
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-043｜WebhookEvent

- 模块：审计/事件/供应商调用
- 归属链：本表.tenantId → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定事件写入服务（待审批）；本租户审计审核角色（待审批）
- SELECT：候选：本租户审计角色仅脱敏必要列；请求/响应/载荷不可直接暴露，普通用户拒绝
- INSERT：候选：用途限定服务仅追加本租户记录；可信归属与外部载荷分别验证
- UPDATE：候选：仅专用处理角色更新投递/处理状态，原始证据不可改；字段白名单待批
- DELETE：建议拒绝，审计/证据仅追加保留
- 敏感字段名（仅目录，不含值）：provider、payload
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-044｜tenant_third_party_config

- 模块：供应商配置
- 归属链：本表.tenant_id → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定供应商配置读取服务（待审批）
- SELECT：候选：服务端按租户+环境读取必要配置引用；客户端不可读取原配置或密钥引用；不读取秘密值
- INSERT：继续拒绝；供应商配置变更须专项授权与审计
- UPDATE：继续拒绝；供应商配置变更须专项授权与审计
- DELETE：继续拒绝；禁止影响可追溯配置历史
- 敏感字段名（仅目录，不含值）：provider_type、provider_config_json
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Authentication/configuration/permission object: default deny until precise operation boundary approved.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-045｜third_party_asset_orders

- 模块：账本/钱包/资金
- 归属链：本表.tenant_id → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：external_provider_order_id、provider_type、amount、request_fingerprint、provider_call_state、provider_call_started_at、provider_call_completed_at、provider_evidence、review_reason
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-046｜third_party_callback_events

- 模块：审计/事件/供应商调用
- 归属链：本表.tenant_id → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：用途限定事件写入服务（待审批）；本租户审计审核角色（待审批）
- SELECT：候选：本租户审计角色仅脱敏必要列；请求/响应/载荷不可直接暴露，普通用户拒绝
- INSERT：候选：用途限定服务仅追加本租户记录；可信归属与外部载荷分别验证
- UPDATE：候选：仅专用处理角色更新投递/处理状态，原始证据不可改；字段白名单待批
- DELETE：建议拒绝，审计/证据仅追加保留
- 敏感字段名（仅目录，不含值）：provider_type、payload
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-047｜treasury_accounts

- 模块：旧资金目录
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：未确定；所有运行身份默认拒绝
- SELECT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- INSERT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- UPDATE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- DELETE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- 敏感字段名（仅目录，不含值）：balance、required_balance
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Legacy migration-only object: ownership and allowed operations BLOCKED pending explicit contract.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人、Git资产管理员
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-048｜treasury_fx_orders

- 模块：旧资金目录
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：未确定；所有运行身份默认拒绝
- SELECT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- INSERT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- UPDATE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- DELETE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- 敏感字段名（仅目录，不含值）：amount、result_amount、provider
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Legacy migration-only object: ownership and allowed operations BLOCKED pending explicit contract.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人、Git资产管理员
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-049｜treasury_operation_logs

- 模块：旧资金目录
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：未确定；所有运行身份默认拒绝
- SELECT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- INSERT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- UPDATE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- DELETE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- 敏感字段名（仅目录，不含值）：detail
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Legacy migration-only object: ownership and allowed operations BLOCKED pending explicit contract.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人、Git资产管理员
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-050｜treasury_settlements

- 模块：旧资金目录
- 归属链：未确认；缺少可验证租户/主体归属链，不允许推断为全局可读
- 主体角色（建议）：未确定；所有运行身份默认拒绝
- SELECT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- INSERT：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- UPDATE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- DELETE：BLOCKED：保持拒绝；先确认表来源、租户/主体及业务责任人，不推定平台跨租户权
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Legacy migration-only object: ownership and allowed operations BLOCKED pending explicit contract.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人、Git资产管理员
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-051｜ucard_card_base

- 模块：卡
- 归属链：本表.tenant_id → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：默认拒绝直连；候选：专用用途后端在可信身份、幂等及状态机约束下创建，逐入口审批
- UPDATE：默认拒绝直连；候选：用途后端受状态机约束更新，原/目标租户主体均校验，归属字段不可改
- DELETE：建议拒绝；历史/资金对象仅追加补偿，非资金对象删除须单独生命周期批准
- 敏感字段名（仅目录，不含值）：balance
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

## DB5-CONTRACT-052｜ucard_transactions

- 模块：卡
- 归属链：本表.tenant_id → Tenant.id；须同时核对环境及对象主体归属，列存在不等于授权可信
- 主体角色（建议）：USER（本人链确认后）；TENANT_ADMIN（本租户范围）；用途限定服务/任务（待审批）
- SELECT：候选：普通用户仅经可证明的本人归属链读取必要非敏感列；租户管理员仅本租户且按用途裁剪；主体链不明则拒绝
- INSERT：候选：用途限定账本/事件写入身份追加；须批准幂等、关联对象同租户及一致性规则，终端直写拒绝
- UPDATE：建议拒绝业务字段更新；更正采用独立补偿/追加流程
- DELETE：建议拒绝，保留审计链
- 敏感字段名（仅目录，不含值）：amount
- 间接访问：服务入口、视图、函数、trigger及父子关联必须使用同一授权对象；不能只核验本表tenant字段
- 保持拒绝原因：业务契约尚未批准；Scope identified; per-role CRUD and sensitive-column authorization not inferred.
- 需批准角色：项目所有者、全局安全负责人、后端与资金集成负责人
- 状态：BLOCKED—尚无项目所有者逐项批准；本矩阵不授权任何正向权限

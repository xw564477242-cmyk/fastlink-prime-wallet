# 字段、状态与业务确认边界

逐表机器记录为TABLE-CONTRACTS.json，逐角色操作记录为OPERATION-MATRIX.csv。源码where/data/select字段是“发生过何种访问”的静态证据，绝不是允许字段白名单；enum值是可能状态，不是获批状态转换图。关联字段、cascade也不等于业务删除许可。

## 每项审批必须包含

表ID、角色、CRUD、本人/租户/环境归属链、可读列、可写列、不可修改的owner/tenant/environment列、允许的状态起点与终点、前置条件、审计事件、Admin/任务例外、责任人及批准时间。没有正向允许时必须说明是明确业务禁止还是尚未确认；本轮只记录后者。审批可以批量提供，但必须枚举表ID/角色/操作及同一依据。

## 重点对象需要的非秘密业务输入

| 组 | 结构证据与当前缺口 | 必需决策 |
|---|---|---|
| Customer、WithdrawalAddress | DB5有两个隔离正向样例；Customer登录/注册调用超出该样例 | 正式注册/认证内部身份、本人可读列、地址修改/删除/默认唯一与归属不可变规则 |
| AdminSession、EndUserSession、EndUserRefreshToken、ApiKey | 令牌摘要字段存在，不读取值；认证前后路径混合 | 普通用户不可直接查询摘要；创建、刷新、吊销、失败计数及审计各自用途与最小字段 |
| Role、Permission、RolePermission | 无权威租户边界说明 | 平台字典还是租户自定义、谁可维护、不可提升自身权限的约束；当前UNKNOWN |
| TenantUserRole、CardBalance、CardLimit、CardSecurityProfile、SettlementItem等间接表 | 父对象链有结构证据 | 每跳归属约束、父子租户一致性、父记录迁移/删除/cascade边界及错误侧信道 |
| WalletAccount、WalletOperation、WalletTransaction及账本 | 状态/类型字段及写路径存在 | 本人关联完整链、金额/币种/状态不可随意更新、一致性与幂等、冲正而非删除的业务依据；资金功能不开放 |
| 卡、供应商事件、第三方订单/回调 | 有服务端映射及任务调用 | 供应商签名对应租户来源、回调重放、事件只追加、任务范围；禁止真实链路验证 |
| AuditLog | 当前审计写入结构存在 | 写入身份、不可改删规则、租户读取范围与保留期限由负责人批准 |
| 四个treasury_*历史表 | 当前Prisma缺模型；settlements的tenant文本不是FK证明 | 表仍适用与否、真实归属/环境、资金责任人及关系链；不套通用tenant策略 |

每张表的具体列、状态名、调用路径和待决策角色都在对应DB6-TABLE/DB6-DEC记录中，以上不替代54项矩阵。未确认自然人，不写成已获资产所有者认可。

归属明确仍不代表同租户所有人都可访问；tenant条件和subject条件独立。可选/NULL归属字段、共享资源、关联集合、批量操作、资源ID替换需各自规则；不得用NULL作全局可见哨兵。任一父对象不匹配须拒绝整次写入，不能部分写入后再报错。

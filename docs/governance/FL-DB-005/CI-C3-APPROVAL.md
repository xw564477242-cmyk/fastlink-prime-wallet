# C3精确修订及一次CI授权原文

来源：总控019fa6b7-4f28-7b62-b676-757be88c22f8，2026-10-01，追加记录。

【FL-DB-005 C3精确修订及一次CI授权】批准实施未应用诊断补丁SHA-256 `1b6ffa69933e30b5eed2d937e214bf0c18e525ec7d5a064580c5e0892022106d`，严格限定为修改`run.py`与`prepare_downloads.py`两文件、77行新增/4行删除；不得改变C2下载白名单、网络、输入、迁移、测试、权限或停止逻辑。诊断输出仅允许固定stage/domain/category枚举、合法HTTP状态/退出码和UTC时间；禁止异常文本、traceback、stderr/stdout、URL、包名、文件路径、命令参数、下载内容、环境变量或认证信息。批准在业务PR #336分支追加提交并推送，由`synchronize`触发一次新的“DB5等价隔离检查”；PR保持OPEN/Draft/dev/autoMerge=null，禁止Ready/merge/auto/deploy/release。原失败运行`36825857182`、artifact和HEAD完整保留。新运行若成功，提交完整HEAD绑定证据；若失败，只按有限诊断报告精确阶段/类别并立即停止，不自动修改、重跑或放宽。若诊断仍UNKNOWN或artifact缺失，T17保持BLOCKED并停止试错，需另行评审。治理证据随后追加，资金硬前置不解除。

本授权不覆盖未来失败修复或自动重跑；C2授权、原失败及诊断未知记录保留。

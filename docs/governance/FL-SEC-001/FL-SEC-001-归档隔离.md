# 历史归档隔离与覆盖

原资产只读，不改权限、不移动、不删除。处理域从创建时0700；内存读取常规成员，绝不调用extractall或执行归档内容。TAR符号/硬链接只登记目标文本HMAC，不创建、不跟随，继续后续常规成员；其他特殊类型、非法路径、加密、损坏或超限均明确阻断。ZIP单独检查路径、Unix类型与加密标记。

单成员512MiB、单归档4GiB、总展开20GiB、成员100000、压缩比100、递归深度3、磁盘余量10GiB。单流压缩同受输出字节和余量约束。bundle仅在既有隔离裸对象库验证和读取，禁用hooks，不检出。

UTF16证据中的偏移按分块基点加解码后UTF8位置记录，不冒充原始字节精确偏移；可通过编码标记及完整内容复跑定位。

内容定位链包括原始只读来源、每层容器SHA、格式、成员序号/名称及内容SHA；公开报告仅发布不可逆路径别名和内容摘要。第二轮重新读取原容器并遍历，不复用第一次展开字节。原定位链保存在0700受限目录。

|ID|格式|结论|
|---|---|---|
|ARC-01|zip|regular-content-scanned-links-not-followed|
|ARC-02|zip|regular-content-scanned-links-not-followed|
|ARC-03|gzip|regular-content-scanned-links-not-followed|
|ARC-04|gzip|regular-content-scanned-links-not-followed|
|ARC-05|gzip|regular-content-scanned-links-not-followed|
|ARC-06|zip|regular-content-scanned-links-not-followed|
|ARC-07|zip|regular-content-scanned-links-not-followed|
|ARC-08|gzip|regular-content-scanned-links-not-followed|
|ARC-09|zip|regular-content-scanned-links-not-followed|
|ARC-10|zip|regular-content-scanned-links-not-followed|
|ARC-11|zip|regular-content-scanned-links-not-followed|
|ARC-12|zip|regular-content-scanned-links-not-followed|
|ARC-13|gzip|regular-content-scanned-links-not-followed|
|ARC-14|gzip|regular-content-scanned-links-not-followed|
|ARC-15|gzip|regular-content-scanned-links-not-followed|
|ARC-16|bundle|regular-content-scanned-links-not-followed|
|ARC-17|gzip|regular-content-scanned-links-not-followed|
|ARC-18|zip|regular-content-scanned-links-not-followed|
|ARC-19|zip|regular-content-scanned-links-not-followed|
|ARC-20|gzip|regular-content-scanned-links-not-followed|

ARC-08后续150个常规成员已补扫；其链接保持仅登记。归档被扫描不代表可执行、安全运行或没有秘密。

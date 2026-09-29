# 历史bundle及归档隔离

隔离根从创建起0700，随机指纹密钥0600。隔离执行域对其他用户不可遍历；700不隔离同UID、管理员或root。原件保持原路径、内容和权限，因此本工单完成的是处理域隔离，并未封锁原件既有访问权限；进一步物理封存/权限调整需另行授权。

ZIP/TAR先验证成员路径、链接及特殊类型，不使用extractall，不执行归档程序。常规成员在内存中受控读取；bundle在隔离裸对象库验证/导入，禁用hooks，不检出。一个增量bundle的前置提交从本次隔离钱包对象库补齐，未更改原bundle或其他远端。

阈值：单成员512 MiB、单归档累计4 GiB、全任务累计20 GiB、10万成员、压缩比100、嵌套深度3、磁盘保留10 GiB。gzip/bzip2/xz单流同受输出与磁盘限制；单流512 MiB上限可能比多成员容器更保守。超限、加密、损坏、不支持格式或危险成员明确标记未完整扫描，不声称无秘密。

|ID|脱敏路径|字节|格式|结论|
|---|---|---:|---|---|
|ARC-01|path/f970dac3f9db8921|109935|zip|scanned-with-declared-rules|
|ARC-02|path/22b9730eef4f6fb6|1586370|zip|scanned-with-declared-rules|
|ARC-03|path/1a52c2ed040f7f66|576708|gzip|scanned-with-declared-rules|
|ARC-04|path/32146a9837de8760|495315|gzip|scanned-with-declared-rules|
|ARC-05|path/e5fea3e5b60c446b|110887|gzip|scanned-with-declared-rules|
|ARC-06|path/a31c5181af362e65|23632|zip|scanned-with-declared-rules|
|ARC-07|path/3281aa303c191201|11727|zip|scanned-with-declared-rules|
|ARC-08|path/976e1e49ed670a72|607766|gzip|not-completely-scanned|
|ARC-09|path/b6d1ae8e2d1c62bb|45012|zip|scanned-with-declared-rules|
|ARC-10|path/1088ef13fbeaed25|16952|zip|scanned-with-declared-rules|
|ARC-11|path/4b7dca80af1efb83|738275|zip|scanned-with-declared-rules|
|ARC-12|path/f4e5d0a5b5371c54|22434|zip|scanned-with-declared-rules|
|ARC-13|path/46a72300801ec1c8|76145|gzip|scanned-with-declared-rules|
|ARC-14|path/76df73cf1fb0cffe|95316|gzip|scanned-with-declared-rules|
|ARC-15|path/0cb260103d46497f|112576|gzip|scanned-with-declared-rules|
|ARC-16|path/0c0bc8de5dd600b2|3049|bundle|scanned-with-declared-rules|
|ARC-17|path/f400bf6e7ca07a2c|443689|gzip|scanned-with-declared-rules|
|ARC-18|path/a47d591c2472a268|641979|zip|scanned-with-declared-rules|
|ARC-19|path/f823f1522f23ec3f|364301|zip|scanned-with-declared-rules|
|ARC-20|path/de6bf2820e63b88d|1490534|gzip|scanned-with-declared-rules|

ARC-08的内层TAR含链接或特殊成员，处理到拒绝位置即停止，后续成员未完整扫描。外层可解压不等于整个归档完全扫描。

扫描器初次gzip调用错误已修正，受影响归档全部从原始只读来源重扫；最终结果不沿用该程序错误。原始尝试记录仅在本地受限区保留。所有隔离对象库及密钥暂保留，不自动删除，不认定为正式长期备份。

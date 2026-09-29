# 全项目秘密扫描范围

原目录共561,144个常规文件，逐项建立SHA-256及权限/属主基准，扫描覆盖条目数与其一致。依赖、缓存和构建产物未静默排除。Git pack/loose object物理文件采用完整对象枚举替代原始压缩字节的秘密判断，物理文件仍做前后哈希保护。五个原Git对象库包括不可达对象也被枚举；4个指定提交均包含在内。

七仓采用独立HTTPS mirror获取核验时广告的分支、标签及其他可见引用，包含GitHub公开给该账号的pull引用；blob、commit、tag内容扫描，tree路径及文件名检查。这里“其他可见引用”不代表服务器隐藏引用。14个既有恢复目录仅核对HEAD/状态，不计作新的扫描来源。

|仓库|分支|标签|其他可见引用|提交|blob|fsck|
|---|---:|---:|---:|---:|---:|---|
|fastlik-Admin|64|0|62|317|615|0|
|fastlik-Website|66|0|62|178|293|0|
|fastlik-app|76|0|77|285|812|0|
|fastlik-backend|314|0|336|1484|2900|0|
|fastlink-control-plane|58|0|63|353|473|0|
|fastlink-prime-wallet|82|0|77|437|1183|0|
|fastlink-recovery-archive|1|1|0|6|1396|0|

45个源码候选均有逐项覆盖记录（scope-coverage.json）；根候选与子候选重叠，文件数不得累加。后端023的15个修改和44个新增文件均在内容扫描范围，未修改资金逻辑。20个既有归档候选以及按魔数发现的其他容器均单独记账。

敏感文件名、ASCII字节形态、高熵、格式规则同时运行；补充UTF-16 LE/BE和带引号12/24词形态检查。范围与限制详见限制清单，不保证识别任意编码、加密、混淆或未知格式秘密。

原目录分类汇总：
- first-party-and-other：21,014文件，270,881,884字节；{'content-scanned': 21014}
- cache-build：68,674文件，588,483,002字节；{'content-scanned': 68674}
- dependencies：448,209文件，4,799,917,320字节；{'content-scanned': 448209}
- git-metadata：23,247文件，224,292,815字节；{'content-scanned': 175, 'git-object-store-alternative': 23072}

- SRC-01：path/7461c566a6395a1a，561144文件；{'content-scanned': 538072, 'git-object-store-alternative': 23072}
- SRC-02：path/056447a22f361ac4，303文件；{'content-scanned': 303}
- SRC-03：path/e583f7ac43a6bcbd，307文件；{'content-scanned': 307}
- SRC-04：path/4d14fc739fbbf7dc，367文件；{'content-scanned': 335, 'git-object-store-alternative': 32}
- SRC-05：path/cf9e045ddb9f8a34，30405文件；{'content-scanned': 30405}
- SRC-06：path/f482e28a3b697385，259文件；{'content-scanned': 259}
- SRC-07：path/40967f3fe7a4dbc1，108文件；{'content-scanned': 108}
- SRC-08：path/39bda770ea666a42，263文件；{'content-scanned': 263}
- SRC-09：path/a403000f30846827，2613文件；{'content-scanned': 2613}
- SRC-10：path/5db975c03b46dc53，263文件；{'content-scanned': 263}
- SRC-11：path/cf0afed7e50529f8，36835文件；{'content-scanned': 36835}
- SRC-12：path/0ef81b64b02264b9，2533文件；{'content-scanned': 2533}
- SRC-13：path/441d1ebab759b57b，777文件；{'content-scanned': 777}
- SRC-14：path/3524794894657487，30957文件；{'content-scanned': 30957}
- SRC-15：path/e32b08a3ef058168，153文件；{'content-scanned': 135, 'git-object-store-alternative': 18}
- SRC-16：path/e2890efc4be8b51e，777文件；{'content-scanned': 777}
- SRC-17：path/27c931663b16c7d5，7文件；{'content-scanned': 7}
- SRC-18：path/93f7593858ad7038，7文件；{'content-scanned': 7}
- SRC-19：path/ecf3c82dae1f6731，6文件；{'content-scanned': 6}
- SRC-20：path/7e7918c41880e91a，657文件；{'content-scanned': 657}
- SRC-21：path/8e32c78c7ceabe8a，678文件；{'content-scanned': 678}
- SRC-22：path/ea63d3d305f09644，30983文件；{'content-scanned': 30980, 'git-object-store-alternative': 3}
- SRC-23：path/ff24cd3abb5d736c，35040文件；{'content-scanned': 35040}
- SRC-24：path/8df7e80df36f7ef5，259文件；{'content-scanned': 259}
- SRC-25：path/6e0370fbed56271e，11文件；{'content-scanned': 11}
- SRC-26：path/013f8a335cda1244，9文件；{'content-scanned': 9}
- SRC-27：path/0ee0620af1f0b2fa，11文件；{'content-scanned': 11}
- SRC-28：path/6db116039f3ef4e7，8文件；{'content-scanned': 8}
- SRC-29：path/6cf1143d5557b68d，263文件；{'content-scanned': 263}
- SRC-30：path/d42dbbaad385aed4，795文件；{'content-scanned': 795}
- SRC-31：path/2aa5085c1637b412，30392文件；{'content-scanned': 30392}
- SRC-32：path/28e32a5fd823981c，36772文件；{'content-scanned': 36772}
- SRC-33：path/7284e429b4915fb8，682文件；{'content-scanned': 682}
- SRC-34：path/322d8091ebbec26e，2541文件；{'content-scanned': 2541}
- SRC-35：path/c95dbf6e0ea9c9b3，30398文件；{'content-scanned': 30398}
- SRC-36：path/7e6099eeb3367558，789文件；{'content-scanned': 789}
- SRC-37：path/473539bc718f6803，251文件；{'content-scanned': 251}
- SRC-38：path/45748989bd3bb220，144文件；{'content-scanned': 135, 'git-object-store-alternative': 9}
- SRC-39：path/3e6b326886c29b91，35027文件；{'content-scanned': 35027}
- SRC-40：path/28079504d7354ffe，762文件；{'content-scanned': 762}
- SRC-41：path/e06710a8ccabef4a，35034文件；{'content-scanned': 35034}
- SRC-42：path/8e29a53688c6b658，35029文件；{'content-scanned': 35029}
- SRC-43：path/08cea29e80efa18f，30396文件；{'content-scanned': 30396}
- SRC-44：path/e1b442a244d620ec，255文件；{'content-scanned': 255}
- SRC-45：path/4a656e03528474ea，30327文件；{'content-scanned': 30327}

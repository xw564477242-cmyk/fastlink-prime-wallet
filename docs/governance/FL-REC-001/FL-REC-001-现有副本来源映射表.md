# FL-REC-001 现有副本来源映射表

通过原目录非依赖package.json中的既有项目标识筛出45个源码候选目录（5个Git工作区、40个导出/候选/构建上下文）。标识只用于选择比较对象，不是可信来源证明。原目录其他未知资产和历史包继续保留未知状态，没有解包扩大扫描。

比较使用Git SHA-1 blob/tree身份，包含文件模式；对于有Git目录，取已跟踪路径的当前文件内容；无Git目录排除.git、node_modules、.output、.wrangler、dist、bun-cache、.cache、coverage和.DS_Store。**匹配只覆盖此范围**，不证明被排除或未跟踪内容安全/已保全。

结果：7个候选的范围内文件树与可达远端提交一致，38个没有完整树匹配；都只作为补充证据，不作为本工单独立恢复输入。对不匹配目录，与固定origin/dev比较的相同/变动/额外/缺失计数见下表。内容不在比较仓库可达对象集合中，不等于全项目唯一或已经丢失。

| 原相对路径 | 比较仓库 | Git | 文件数 | 范围内精确树匹配提交 | 对dev同/变/额外/缺失 | 远端对象集合无此blob数 |
| --- | --- | --- | --- | --- | --- | --- |
| . | fastlink-prime-wallet | 有 | 254 | 无完整树匹配 | 250/4/0/21 | 2 |
| outputs/B03-CREGIS-CLOSEOUT-002/candidate | fastlink-prime-wallet | 无 | 255 | 无完整树匹配 | 238/12/5/25 | 17 |
| outputs/B03-CREGIS-CLOSEOUT-002-R1/candidate | fastlink-prime-wallet | 无 | 259 | 无完整树匹配 | 236/14/9/25 | 23 |
| outputs/B03-CREGIS-CLOSEOUT-004/workspace | fastlink-prime-wallet | 有 | 260 | 无完整树匹配 | 228/22/10/25 | 31 |
| outputs/CREGIS-DEPOSIT-MAPPING/candidate | fastlink-prime-wallet | 无 | 255 | 无完整树匹配 | 238/12/5/25 | 17 |
| outputs/B03-CREGIS-CLOSEOUT-002-R2-SNAPSHOT-v1/source-snapshot | fastlink-prime-wallet | 无 | 259 | 无完整树匹配 | 236/14/9/25 | 23 |
| outputs/B03-CREGIS-CLOSEOUT-002-R2-SNAPSHOT-v1/evidence/online-baseline | fastlink-prime-wallet | 无 | 108 | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18, 8c1d3be110e98f39328a98cba122411b4689337f | 76/21/11/178 | 0 |
| outputs/CREGIS-FUNDS-022/candidate/frontend | fastlink-prime-wallet | 无 | 263 | 无完整树匹配 | 227/23/13/25 | 35 |
| outputs/CREGIS-FUNDS-022/candidate/backend | fastlik-backend | 无 | 806 | 无完整树匹配 | 749/13/44/0 | 57 |
| outputs/CREGIS-FUNDS-023/candidate/frontend | fastlink-prime-wallet | 无 | 263 | 无完整树匹配 | 227/23/13/25 | 35 |
| outputs/CREGIS-FUNDS-023/candidate/backend | fastlik-backend | 无 | 806 | 无完整树匹配 | 747/15/44/0 | 59 |
| outputs/CREGIS-FUNDS-008/candidate | fastlik-backend | 无 | 783 | 无完整树匹配 | 751/11/21/0 | 32 |
| outputs/CREGIS-FUNDS-006/candidate | fastlik-backend | 无 | 777 | 无完整树匹配 | 751/11/15/0 | 26 |
| outputs/DEV-VERSION-035/workspace | fastlink-prime-wallet | 无 | 108 | af9a99d97871d004024ab181feb5ed8b14b5640e, d972eea0c708840f016c32444018a420f9bf62c7 | 76/21/11/178 | 0 |
| outputs/DEV-VERSION-032/entry-workspace | fastlink-prime-wallet | 有 | 108 | af9a99d97871d004024ab181feb5ed8b14b5640e, d972eea0c708840f016c32444018a420f9bf62c7 | 76/21/11/178 | 0 |
| outputs/CREGIS-FUNDS-007/candidate | fastlik-backend | 无 | 777 | 无完整树匹配 | 751/11/15/0 | 26 |
| outputs/DEV-VERSION-034/source/head | fastlink-prime-wallet | 无 | 7 | 无完整树匹配 | 1/2/4/272 | 0 |
| outputs/DEV-VERSION-034/source/dev | fastlink-prime-wallet | 无 | 7 | 无完整树匹配 | 7/0/0/268 | 0 |
| outputs/DEV-VERSION-034/source/main | fastlink-prime-wallet | 无 | 6 | 无完整树匹配 | 1/2/3/272 | 0 |
| outputs/CREGIS-FUNDS-009/build-contexts/recovery | fastlik-backend | 无 | 657 | 无完整树匹配 | 657/0/0/105 | 0 |
| outputs/CREGIS-FUNDS-009/build-contexts/new | fastlik-backend | 无 | 678 | 无完整树匹配 | 646/11/21/105 | 32 |
| outputs/DEV-SANDBOX-FAST-001/workspace | fastlink-prime-wallet | 有 | 108 | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18, 8c1d3be110e98f39328a98cba122411b4689337f | 76/21/11/178 | 0 |
| outputs/CREGIS-FUNDS-005-R1/candidate | fastlik-backend | 无 | 777 | 无完整树匹配 | 751/11/15/0 | 26 |
| outputs/B03-CREGIS-CLOSEOUT-002-R2/candidate | fastlink-prime-wallet | 无 | 259 | 无完整树匹配 | 236/14/9/25 | 23 |
| outputs/DEV-MILESTONE-001-v1/05-external-evidence/019/source/candidate | fastlink-prime-wallet | 无 | 11 | 无完整树匹配 | 11/0/0/264 | 0 |
| outputs/DEV-MILESTONE-001-v1/05-external-evidence/019/source/test | fastlink-prime-wallet | 无 | 9 | 无完整树匹配 | 3/5/1/267 | 0 |
| outputs/DEV-MILESTONE-001-v1/05-external-evidence/019/source/dev | fastlink-prime-wallet | 无 | 11 | 无完整树匹配 | 11/0/0/264 | 0 |
| outputs/DEV-MILESTONE-001-v1/05-external-evidence/019/source/main | fastlink-prime-wallet | 无 | 8 | 无完整树匹配 | 2/2/4/271 | 0 |
| outputs/CREGIS-FUNDS-021/candidate/frontend | fastlink-prime-wallet | 无 | 263 | 无完整树匹配 | 227/23/13/25 | 35 |
| outputs/CREGIS-FUNDS-021/candidate/backend | fastlik-backend | 无 | 795 | 无完整树匹配 | 749/13/33/0 | 46 |
| outputs/CREGIS-FUNDS-019/candidate/frontend | fastlink-prime-wallet | 无 | 263 | 无完整树匹配 | 227/23/13/25 | 35 |
| outputs/CREGIS-FUNDS-019/candidate/backend | fastlik-backend | 无 | 789 | 无完整树匹配 | 749/13/27/0 | 40 |
| outputs/CREGIS-FUNDS-019/build-context | fastlik-backend | 无 | 682 | 无完整树匹配 | 641/14/27/107 | 41 |
| outputs/CREGIS-FUNDS-018/candidate/backend | fastlik-backend | 无 | 785 | 无完整树匹配 | 751/11/23/0 | 34 |
| outputs/CREGIS-FUNDS-020/candidate/frontend | fastlink-prime-wallet | 无 | 263 | 无完整树匹配 | 227/23/13/25 | 35 |
| outputs/CREGIS-FUNDS-020/candidate/backend | fastlik-backend | 无 | 789 | 无完整树匹配 | 749/13/27/0 | 40 |
| outputs/DEV-SANDBOX-FAST-004-R1/candidate | fastlink-prime-wallet | 无 | 251 | 无完整树匹配 | 239/11/1/25 | 12 |
| outputs/DEV-VERSION-040/workspace | fastlink-prime-wallet | 有 | 108 | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18, 8c1d3be110e98f39328a98cba122411b4689337f | 76/21/11/178 | 0 |
| outputs/CREGIS-FUNDS-002/candidate | fastlik-backend | 无 | 765 | 无完整树匹配 | 757/5/3/0 | 8 |
| outputs/CREGIS-FUNDS-002/base | fastlik-backend | 无 | 762 | b337bc96dfd587326a3c43d890d22ca251ca932d, 98a09f89e4d1c0bc845c162f3e179c6dcd0f6dd7 | 762/0/0/0 | 0 |
| outputs/CREGIS-FUNDS-005/candidate | fastlik-backend | 无 | 772 | 无完整树匹配 | 751/11/10/0 | 21 |
| outputs/CREGIS-FUNDS-004/candidate | fastlik-backend | 无 | 767 | 无完整树匹配 | 757/5/5/0 | 10 |
| outputs/DEV-SANDBOX-FAST-002/candidate | fastlink-prime-wallet | 无 | 255 | 无完整树匹配 | 253/2/0/20 | 2 |
| outputs/DEV-SANDBOX-FAST-002/base | fastlink-prime-wallet | 无 | 255 | 49d29d86202a557d688d56db9202334f8a09996b, d02e7a721224473ea5fc8153a2284d147a6bf990 | 255/0/0/20 | 0 |
| outputs/DEV-SANDBOX-FAST-004/candidate | fastlink-prime-wallet | 无 | 251 | 无完整树匹配 | 242/8/1/25 | 9 |

## 关键关联结论

- 主工作区HEAD 7581a751d5964d481d335131c856270ccc98238b不在新钱包新鲜远端可达集合；另有f9d14f1570b6aebeabd57093e0b749c5d0ee6f0a。原工作区2未暂存、58152未跟踪，未改变。
- 004 HEAD ec29d29ab39e6afff95650a8603b3a6529c86179及父版本8aefe84674d0d65be093f1f7d1a64f6fad8034da不在该新鲜集合；该仓本地分支还保留上述7581a75/f9d14f1。集合并集是4个提交，不重复计为6个。
- FAST-001、032、040的HEAD均可映射到新鲜远端可达提交。FAST-001仍有1个未跟踪文件，不能因已跟踪树相同而称全部资产已恢复。
- 后端023副本806文件，对固定dev b337bc96dfd587326a3c43d890d22ca251ca932d：747相同、15变动、44额外、0缺失；59个内容blob不在该后端远端可达对象集合。它是派生副本，不能标成单一可信远端提交。
- 未检查恢复归档库内部材料来寻找上述提交的快照；“原业务远端不可达”不等于“其他归档里没有安全快照”。

完整逐目录SHA、精确匹配列表与比较范围在 [source-mappings.json](evidence/source-mappings.json)。无覆盖、回写、合并、移动或删除任何原副本。

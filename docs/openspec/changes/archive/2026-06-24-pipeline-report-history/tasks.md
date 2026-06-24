## 1. 快照投影 + 历史 IO（纯/薄 IO，TDD）

- [x] 1.1 RED：写 `report-history.test.ts`——`historySnapshot(snap)` 投影 slim 记录(含 verificationTax=null/defectEscapeRate 保留;不含 traces/taxByTrace)
- [x] 1.2 RED：`readHistory` 逐行 parse、跳畸形行、缺文件 [](tmp 文件)
- [x] 1.3 GREEN：实现 `report-history.ts`:纯 `historySnapshot` + 薄 `appendHistory(path,rec)` + 薄 `readHistory(path)`

## 2. 看板趋势渲染（纯，TDD）

- [x] 2.1 RED：`renderBoard(snap, history)` 传 12 条 → 含「指标趋势」区且只渲最近 10 条(取末 10)
- [x] 2.2 RED：不传 / 传空 history → 无趋势区(既有无 history 调用零变化)
- [x] 2.3 GREEN：`board.ts` renderBoard 加可选 `history?` 参数 + 趋势表渲染

## 3. CLI + 接线

- [x] 3.1 `bin-archive.ts`(`npm run report:archive`)：collect → historySnapshot → appendHistory(`docs/metrics/history.jsonl`);`package.json` 加 script
- [x] 3.2 `bin-report.ts`：读 history(`readHistory`)传入 `renderBoard`,让看板渲趋势

## 4. 验证

- [x] 4.1 metrics gate 全绿(lint+tsc+vitest;historySnapshot/readHistory/趋势渲染穷尽精确断言)
- [x] 4.2 真实验证(非破坏)：临时 repo `report:archive` 跑两次 → history.jsonl 2 行 → `report` 看板趋势表显示 2 行;空 history → 无趋势区

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 `openspec validate pipeline-report-history --strict` 通过
- [x] 5.2 更新 `pipeline/README.md` 与 `docs/context/RESUME.md`(M4+ 续切片⑦ 完成、report 历史归档)
- [x] 5.3 复盘并入 `docs/plan/M4plus-event-log-retro.md`
- [x] 5.4 创建空 `docs/metrics/history.jsonl`(从空起步)
- [x] 5.5 `openspec archive pipeline-report-history` → `git commit` + `push`

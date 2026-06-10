# CONTEXT — ydd (YouDao Dictionary)

## 领域词汇表

| 术语 | 定义 |
|---|---|
| Flash Card | 用于间隔重复复习的卡片，正面显示英文单词，背面显示释义。 |
| History Database | `~/.ydd/history.db`，使用 `node:sqlite` 存储查询历史。每个单词一条记录。 |
| Query Count | 同一单词被查询的次数。多次查询表示该词很重要或容易忘记。 |
| SM-2 | SuperMemo 2 间隔重复算法，使用四个评级（Again/Hard/Good/Easy）计算下次复习时间。 |

# 埋点统计（Tracking）

RMLive 的埋点统一收敛到 `src/lib/tracking.ts`，基于**百度统计**（百度站长分析）的 `_hmt` 接口上报。所有业务代码**禁止**直接操作 `_hmt`，一律通过 `trackEvent(key, data)` 类型安全入口上报。

## 启用逻辑

| 环境 | 行为 |
| --- | --- |
| 开发 / mock（默认） | 关闭，`trackEvent` / `trackPageView` / `initTracking` 全部 no-op |
| 生产构建（默认） | 开启 |
| `VITE_TRACKING_ENABLED=1` | 强制开启（含开发环境；dev 下会**真实上报**到百度，同时输出 console 日志） |
| `VITE_TRACKING_ENABLED=0` | 强制关闭（含生产环境） |

判定函数：`isTrackingEnabled()`。未启用时不会注入百度脚本、不发送任何网络请求。

## 初始化

`src/main.ts` 在 `createApp` 之前调用 `initTracking()`（幂等）：

1. 检查 `isTrackingEnabled()`，关闭则直接返回；
2. 注入 `hm.baidu.com/hm.js?...` 脚本（带 `data-rmlive-analytics` 标记，防重复注入）；
3. 上报首屏 pageview（`_trackPageview`）。

## API

```ts
trackEvent(key, data)  // key 必须是 TrackEventMap 的键，data 类型由 key 决定
trackPageView(path?)   // 手动 PV；path 缺省时取当前 location。站点切换时由 rmData.selectZone 自动调用
```

## 事件目录

所有事件的 category / action / label / value 语义由 `EVENT_DEF` 唯一决定，新增事件必须同步更新此表与 `src/lib/__tests__/tracking.test.ts`。

| key | category | action | label | value |
| --- | --- | --- | --- | --- |
| `danmu.send` | 弹幕 | 发送 | zoneId | - |
| `danmu.send_fail` | 弹幕 | 发送失败 | zoneId | - |
| `danmu.connect` | 弹幕 | 连接 | zoneId | - |
| `danmu.disconnect` | 弹幕 | 断开 | zoneId | - |
| `danmu.receive_batch` | 弹幕 | 接收批量 | zoneId | 批大小(50) |
| `danmu.connect_error` | 错误 | 弹幕连接 | zoneId | - |
| `danmu.connect_fail` | 错误 | 弹幕连接失败 | zoneId | - |
| `engagement.support` | 互动 | 助威 | matchKey | 1 |
| `engagement.reaction` | 互动 | 表情 | matchKey:reactionId（无 matchKey 时仅 reactionId） | 1 |
| `player.ready` | 播放器 | 就绪 | - | - |
| `player.quality_change` | 播放器 | 切换清晰度 | quality | - |
| `player.perspective_change` | 播放器 | 切换视角 | perspective | - |
| `player.stream_retry` | 播放器 | 重试 | zoneId | - |
| `player.stream_error` | 错误 | 流错误 | zoneId | - |
| `nav.zone_change` | 导航 | 切换站点 | zoneId | - |
| `settings.theme` | 设置 | 主题 | dark / light | - |
| `settings.danmu` | 设置 | 弹幕开关 | 开 / 关 | - |
| `settings.pk` | 设置 | PK开关 | 开 / 关 | - |
| `settings.reaction` | 设置 | 对局评价开关 | 开 / 关 | - |
| `settings.notify_policy` | 设置 | 通知策略 | policy | - |
| `schedule.follow` | 订阅 | 关注比赛 | matchId | - |
| `schedule.unfollow` | 订阅 | 取消关注 | matchId | - |
| `notify.permission` | 通知 | 权限结果 | granted / denied / default | - |
| `content.team_data` | 内容 | 查看战队数据 | teamName | - |

## 口径约定

- **label 必须是受控短标识**：zoneId / matchKey / reactionId / policy 等。禁止使用 LeanCloud conversation id（roomId）、时间戳、自增数字等无界标识，避免后台 label 维度爆炸。
- **value 只表达数值口径**：`danmu.receive_batch` 的 value 为单次批大小（50），事件次数 × value ≈ 弹幕接收总量。不要上报累计值。
- undefined / null / 空白 label 不会入参上报；非有限数值（NaN/Infinity）不会入参上报。由 `buildBaiduPush` 统一清理。

## 埋点位置约定

- 优先在 **store action / composable** 层上报（状态迁移处），如 `rmData.selectZone`、`matchEngagement.sendSupport`、`useDanmuEmitter`；
- 组件内只允许在必要的显式用户动作中上报（如设置弹窗的权限请求）；
- **禁止**在模板 `@click` 内联调用，避免重复触发和难以测试。

## 新增一个事件

1. 在 `src/lib/tracking.ts` 的 `TrackEventMap` 添加 key 与 data 类型；
2. 在 `EVENT_DEF` 添加对应的 category / action / label / value builder；
3. 调用点使用 `trackEvent('xxx', { ... })`；
4. 更新上方事件目录表；
5. 在 `src/lib/__tests__/tracking.test.ts` 补断言（payload 映射、label/value 口径、undefined 清理）。

## 测试

```bash
pnpm test:run
```

tracking 单测覆盖：事件 payload 映射、label 收敛、value 口径、undefined/null/NaN 清理、disabled 状态 no-op。

## 注意

- 百度统计脚本仅在启用时注入；关闭时零请求。
- 埋点不上报用户身份或敏感字段。
- 开发环境默认关闭，避免污染生产统计；联调时用 `VITE_TRACKING_ENABLED=1`。

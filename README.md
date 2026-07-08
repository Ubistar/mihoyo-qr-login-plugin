# mihoyo-qr-login-plugin

独立版 Yunzai / TRSS-Yunzai 米哈游扫码登录插件。

本插件根据 `TRSS-Plugin/Apps/miHoYoLogin.js` 的扫码登录流程重写，只保留：

- 米哈游 App 扫码登录
- 米游社 Web 扫码登录
- 轮询二维码状态
- 换取 `cookie_token`
- 将 Cookie / Stoken 作为“私聊消息事件”投递给现有 Cookie 绑定插件处理

本插件不包含 TRSS-Plugin 的远程命令、脚本执行、文件管理、更新器等高风险功能；不保存 Cookie；不向第三方服务器上传 Cookie。

## 安装

在 Yunzai 根目录执行：

```bash
cd plugins
git clone <你的仓库地址> mihoyo-qr-login-plugin
cd mihoyo-qr-login-plugin
pnpm install --production
```

如果你是直接下载压缩包，把文件夹放到：

```text
Yunzai/plugins/mihoyo-qr-login-plugin
```

然后在该目录执行：

```bash
pnpm install --production
```

重启 Yunzai。

## 命令

```text
#米哈游登录
#米哈游扫码登录
#米游社登录
#米游社扫码登录
#扫码登录终止
#扫码登录帮助
```

建议优先使用：

```text
#米哈游登录
```

若不可用，再尝试：

```text
#米游社登录
```

## 安全说明

1. 本插件不会落盘保存 Cookie。
2. 控制台日志会隐藏 token / cookie_token / login_ticket 等敏感字段。
3. 群聊触发时不会把 Cookie 发到群里，只会尝试内部投递给 Cookie 绑定插件。
4. 私聊触发时会通过合并转发把 Cookie 展示给触发者，方便排查绑定失败。
5. 插件只依赖 `qrcode` 和 `node-fetch`。

## 兼容性

- Node.js 18+
- TRSS-Yunzai / Miao-Yunzai
- 需要已有 Cookie 绑定插件能识别普通私聊 Cookie 文本。

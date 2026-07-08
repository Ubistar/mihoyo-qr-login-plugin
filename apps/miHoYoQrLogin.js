import crypto from "node:crypto"
import fetch from "node-fetch"
import QRCode from "qrcode"
import plugin from "../../../lib/plugins/plugin.js"

const running = new Map()
const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

const APP_CREATE_QR = "https://passport-api.mihoyo.com/account/ma-cn-passport/app/createQRLogin"
const APP_QUERY_QR = "https://passport-api.mihoyo.com/account/ma-cn-passport/app/queryQRLoginStatus"
const WEB_CREATE_QR = "https://passport-api.mihoyo.com/account/ma-cn-passport/web/createQRLogin"
const WEB_QUERY_QR = "https://passport-api.mihoyo.com/account/ma-cn-passport/web/queryQRLoginStatus"
const COOKIE_BY_STOKEN = "https://passport-api.mihoyo.com/account/auth/api/getCookieAccountInfoBySToken"

function randomString(length) {
  let ret = ""
  for (let i = 0; i < length; i++) ret += chars[Math.floor(Math.random() * chars.length)]
  return ret
}

function md5(data) {
  return crypto.createHash("md5").update(data).digest("hex")
}

function ds(body = "") {
  const t = Math.floor(Date.now() / 1000)
  const r = randomString(6)
  const h = md5(`salt=JwYDpKvLj6MrMqqYU6jTKF17KNO2PXoS&t=${t}&r=${r}&b=${body}&q=`)
  return `${t},${r},${h}`
}

function appHeaders(deviceId) {
  return {
    "User-Agent": "HYPContainer/1.3.3.182",
    "x-rpc-app_id": "ddxf5dufpuyo",
    "x-rpc-client_type": "3",
    "x-rpc-device_id": deviceId,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}

function apiHeaders({ body = "", cookie = "" } = {}) {
  return {
    "x-rpc-app_version": "2.104.0",
    "DS": ds(body),
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-rpc-game_biz": "bbs_cn",
    "x-rpc-sys_version": "12",
    "x-rpc-device_id": randomString(16),
    "x-rpc-device_fp": randomString(13),
    "x-rpc-device_name": randomString(16),
    "x-rpc-device_model": randomString(16),
    "x-rpc-app_id": "bll8iq97cem8",
    "x-rpc-client_type": "2",
    "User-Agent": "Hyperion/550 CFNetwork/3860.500.112 Darwin/25.4.0",
    "Cookie": cookie,
  }
}

function webHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "x-rpc-app_id": "bll8iq97cem8",
    "x-rpc-device_id": randomString(16),
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}

async function appRequest(url, { deviceId, data } = {}) {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
    headers: appHeaders(deviceId),
  })
}

async function apiRequest(url, { data, cookie } = {}) {
  const body = data ? JSON.stringify(data) : ""
  return fetch(url, {
    method: data ? "POST" : "GET",
    body: data ? body : undefined,
    headers: apiHeaders({ body, cookie }),
  })
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie()
  if (typeof headers.raw === "function") return headers.raw()["set-cookie"] ?? []
  const combined = headers.get?.("set-cookie")
  return combined ? combined.split(/,(?=\s*[^;,]+=)/g) : []
}

function toQrImage(url) {
  return QRCode.toDataURL(url).then(dataUrl => segment.image(dataUrl.replace("data:image/png;base64,", "base64://")))
}

function button(text, callback) {
  if (!globalThis.segment?.button) return false
  return segment.button([{ text, callback }])
}

function cleanMessage(parts) {
  return parts.filter(Boolean)
}

function cookieSummary(cookie) {
  if (!cookie) return "空 Cookie"
  return cookie
    .split(";")
    .map(item => item.trim().split("=")[0])
    .filter(Boolean)
    .join("; ")
}

function safeJson(data) {
  return JSON.stringify(data, (key, value) => {
    if (["token", "cookie_token", "login_ticket", "stoken", "ltoken"].includes(key)) return "[redacted]"
    return value
  })
}

export class miHoYoQrLogin extends plugin {
  constructor() {
    super({
      name: "米哈游扫码登录独立版",
      dsc: "通过米哈游/米游社二维码登录并自动投递 Cookie 给已有 Cookie 绑定插件",
      event: "message",
      priority: 10,
      rule: [
        {
          reg: "^#?(米哈游|米游社)?(扫码)?登录终止$|^#?扫码登录终止$",
          fnc: "stopLogin",
        },
        {
          reg: "^#?米哈游扫码登录帮助$|^#?扫码登录帮助$",
          fnc: "help",
        },
        {
          reg: "^#?(米哈游|米游社)(扫码)?(登录|登陆|绑定)$|^#?(扫码|二维码|辅助)(登录|登陆|绑定)$",
          fnc: "qrLogin",
        },
      ],
    })
  }

  async help(e = this.e) {
    await e.reply([
      "米哈游扫码登录独立版\n",
      "#米哈游登录：App 扫码，优先产出 Cookie + Stoken\n",
      "#米游社登录：网页扫码，产出网页登录 Cookie\n",
      "#扫码登录终止：终止当前登录\n\n",
      "说明：插件不会保存 Cookie，不会上传 Cookie；只会伪造一条私聊 Cookie 消息交给你已安装的 Cookie 绑定插件处理。",
    ])
    return true
  }

  async stopLogin(e = this.e) {
    const key = String(e.user_id)
    if (!running.has(key)) {
      await e.reply("当前没有正在进行的扫码登录。", true, { recallMsg: 60 })
      return true
    }
    running.delete(key)
    await e.reply("已终止当前扫码登录。", true, { recallMsg: 60 })
    return true
  }

  async qrLogin(e = this.e) {
    const key = String(e.user_id)
    if (running.has(key)) {
      const state = running.get(key)
      await e.reply(
        cleanMessage([
          "你已有正在进行的扫码登录，请先完成或发送 #扫码登录终止。",
          state?.image,
          button("终止登录", "扫码登录终止"),
        ]),
        true,
        { recallMsg: 60 },
      )
      return true
    }

    const useWebLogin = /米游社/.test(e.msg)
    running.set(key, { mode: useWebLogin ? "web" : "app" })
    try {
      if (useWebLogin) return await this.webQrLogin(e, key)
      return await this.appQrLogin(e, key)
    } catch (err) {
      running.delete(key)
      logger.error(`[米哈游扫码登录] ${err.stack || err.message || err}`)
      await e.reply("登录失败：请确认二维码未过期、已在米游社 App 中确认，并检查控制台日志。", true, { recallMsg: 60 })
      return true
    }
  }

  async appQrLogin(e, key) {
    const deviceId = randomString(16)
    let res = await appRequest(APP_CREATE_QR, { deviceId })
    let data = await res.json()
    logger.mark(`[米哈游扫码登录] createQRLogin retcode=${data.retcode}`)

    if (data.retcode !== 0 || !data.data?.url || !data.data?.ticket) throw new Error(`创建二维码失败：${safeJson(data)}`)

    const image = await toQrImage(data.data.url)
    running.set(key, { mode: "app", image })
    await e.reply(
      cleanMessage(["请使用米游社 App 扫码并确认登录。", image, button("终止登录", "扫码登录终止")]),
      true,
      { recallMsg: 60 },
    )

    const confirmed = await this.pollAppQr(e, key, deviceId, data.data.ticket)
    if (!confirmed) return true

    const cookies = await this.buildCookiesFromAppToken(confirmed)
    await this.feedCookieMessages(e, cookies)
    await this.finishTips(e, cookies, "登录完成，已尝试自动绑定 Cookie 和 Stoken。")
    return true
  }

  async pollAppQr(e, key, deviceId, ticket) {
    let scanned = false
    for (let i = 0; i < 60; i++) {
      await Bot.sleep(5000)
      if (!running.has(key)) return this.replyStopped(e, "米哈游登录已终止。")

      const res = await appRequest(APP_QUERY_QR, { deviceId, data: { ticket } })
      const data = await res.json()

      if (data.retcode !== 0) {
        running.delete(key)
        await e.reply("二维码已过期，请重新登录。", true, { recallMsg: 60 })
        return false
      }

      if (data.data?.status === "Scanned" && !scanned) {
        scanned = true
        await e.reply(cleanMessage(["二维码已扫描，请在米游社 App 中确认登录。", button("终止登录", "扫码登录终止")]), true, {
          recallMsg: 60,
        })
      }

      if (data.data?.status === "Confirmed") {
        running.delete(key)
        logger.mark(`[米哈游扫码登录] queryQRLoginStatus confirmed=${safeJson({ retcode: data.retcode, status: data.data.status })}`)
        return data
      }
    }

    running.delete(key)
    await e.reply("登录超时，请重新发送 #米哈游登录。", true, { recallMsg: 60 })
    return false
  }

  async buildCookiesFromAppToken(data) {
    const userInfo = data.data?.user_info ?? {}
    const tokens = data.data?.tokens ?? []
    const uid = userInfo.aid || userInfo.uid || userInfo.account_id
    const mid = userInfo.mid
    const token = (tokens.find(item => item.name === "stoken" || item.name === "stoken_v2") || tokens[0])?.token

    if (!uid || !mid || !token) throw new Error(`登录返回缺少 uid/mid/stoken：${safeJson(data)}`)

    const stoken = `stoken=${token};stuid=${uid};mid=${mid}`
    const url = `${COOKIE_BY_STOKEN}?stoken=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}&mid=${encodeURIComponent(mid)}`
    const res = await apiRequest(url, { cookie: stoken })
    const cookieInfo = await res.json()
    logger.mark(`[米哈游扫码登录] getCookieAccountInfoBySToken retcode=${cookieInfo.retcode}`)

    if (!cookieInfo.data?.cookie_token) throw new Error(`换取 cookie_token 失败：${safeJson(cookieInfo)}`)

    const cookie = `ltoken=${token};ltuid=${uid};cookie_token=${cookieInfo.data.cookie_token}`
    return [cookie, stoken]
  }

  async webQrLogin(e, key) {
    const headers = webHeaders()
    let res = await fetch(WEB_CREATE_QR, { method: "POST", body: "{}", headers })
    let data = await res.json()
    logger.mark(`[米游社扫码登录] createQRLogin retcode=${data.retcode}`)

    if (data.retcode !== 0 || !data.data?.url || !data.data?.ticket) throw new Error(`创建二维码失败：${safeJson(data)}`)

    const image = await toQrImage(data.data.url)
    running.set(key, { mode: "web", image })
    await e.reply(cleanMessage(["请使用米游社 App 扫码并确认登录。", image, button("终止登录", "扫码登录终止")]), true, {
      recallMsg: 60,
    })

    const cookie = await this.pollWebQr(e, key, headers, data.data.ticket)
    if (!cookie) return true

    await this.feedCookieMessages(e, [cookie])
    await this.finishTips(e, [cookie], "登录完成，已尝试自动绑定网页登录 Cookie。")
    return true
  }

  async pollWebQr(e, key, headers, ticket) {
    let scanned = false
    for (let i = 0; i < 60; i++) {
      await Bot.sleep(5000)
      if (!running.has(key)) return this.replyStopped(e, "米游社登录已终止。")

      const res = await fetch(WEB_QUERY_QR, { method: "POST", body: JSON.stringify({ ticket }), headers })
      const setCookies = getSetCookies(res.headers)
      const data = await res.json()

      if (data.retcode !== 0) {
        running.delete(key)
        await e.reply("二维码已过期，请重新登录。", true, { recallMsg: 60 })
        return false
      }

      if (data.data?.status === "Scanned" && !scanned) {
        scanned = true
        await e.reply(cleanMessage(["二维码已扫描，请在米游社 App 中确认登录。", button("终止登录", "扫码登录终止")]), true, {
          recallMsg: 60,
        })
      }

      if (data.data?.status === "Confirmed") {
        running.delete(key)
        const cookie = setCookies.map(item => item.split(";")[0]).filter(Boolean).join(";")
        if (!cookie) throw new Error("网页登录已确认，但响应中没有 Set-Cookie")
        logger.mark(`[米游社扫码登录] queryQRLoginStatus confirmed=${safeJson({ retcode: data.retcode, status: data.data.status })}`)
        return cookie
      }
    }

    running.delete(key)
    await e.reply("登录超时，请重新发送 #米游社登录。", true, { recallMsg: 60 })
    return false
  }

  async replyStopped(e, text) {
    await e.reply(text, true, { recallMsg: 60 })
    return false
  }

  async feedCookieMessages(e, cookies) {
    for (const cookie of cookies) {
      const fakeEvent = {
        ...e,
        post_type: "message",
        message_type: "private",
        sub_type: "friend",
        isPrivate: true,
        isGroup: false,
        group: undefined,
        group_id: undefined,
        msg: cookie,
        raw_message: cookie,
        message: [{ type: "text", text: cookie }],
        reply: (msg, quote, opts) => e.reply(msg, quote, { ...opts, recallMsg: 60 }),
      }

      if (typeof Bot.em === "function") {
        Bot.em("message.private.friend", fakeEvent)
      } else {
        logger.warn("[米哈游扫码登录] Bot.em 不存在，无法自动投递 Cookie；请在私聊中手动发送 Cookie。")
      }
    }
  }

  async finishTips(e, cookies, title) {
    if (e.isPrivate && Bot.makeForwardArray) {
      const content = [title, ...cookies.map(cookie => `${cookieSummary(cookie)}\n${cookie}`)]
      await e.reply(await Bot.makeForwardArray(content))
      return
    }

    await e.reply(`${title}\n为保护隐私，Cookie 不会在群聊中展示。`, true, { recallMsg: 60 })
  }
}

import fs from "node:fs/promises"

const pluginName = "mihoyo-qr-login-plugin"

globalThis.segment ??= await import("oicq")
  .then(mod => mod.segment)
  .catch(() => globalThis.segment)

if (!Bot.makeForwardArray) {
  try {
    const common = (await import("../../lib/common/common.js")).default
    Bot.makeForwardArray = msg => common.makeForwardMsg({}, msg)
  } catch (err) {
    logger?.debug?.(`[${pluginName}] Bot.makeForwardArray fallback unavailable: ${err.message}`)
  }
}

Bot.sleep ??= time => new Promise(resolve => setTimeout(resolve, time))

const files = (await fs.readdir(`plugins/${pluginName}/apps`)).filter(file => file.endsWith(".js"))
const modules = await Promise.allSettled(files.map(file => import(`./apps/${file}`)))

export const apps = {}
for (const index in files) {
  const name = files[index].replace(/\.js$/, "")
  if (modules[index].status !== "fulfilled") {
    logger.error(`[${pluginName}] 载入插件错误：${name}`)
    logger.error(modules[index].reason)
    continue
  }
  Object.assign(apps, modules[index].value)
}

logger.info(logger.green?.(`- ${pluginName} 加载完成`) ?? `- ${pluginName} 加载完成`)

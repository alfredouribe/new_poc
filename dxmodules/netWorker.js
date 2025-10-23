//build:20240525
//用于简化net组件微光通信协议的使用，把net封装在这个worker里，使用者只需要订阅eventbus的事件就可以监听net
import log from './dxLogger.js'
import net from './dxNet.js'
import dxMap from './dxMap.js'
import std from './dxStd.js'
const map = dxMap.get('default')
const options = map.get("__net__run_init")

function run() {
    net.worker.beforeLoop(options)
    log.info('net worker start......')
    std.setInterval (function() {
        try {
            net.worker.loop()
        } catch (error) {
            log.error(error)
        }
    },100)
}
try {
    run()
} catch (error) {
    log.error(error)
}

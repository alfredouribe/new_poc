//build:20240524
//用于简化mqtt组件微光通信协议的使用，把mqtt封装在这个worker里，使用者只需要订阅eventcenter的事件就可以监听mqtt
import log from './dxLogger.js'
import net from './dxNet.js'
import mqtt from './dxMqtt.js'
import dxMap from './dxMap.js'
import std from './dxStd.js'
import * as os from "os";
const map = dxMap.get('default')
const id = "{{id}}"
const options = map.get("__mqtt__run_init" + id)
let connected = false
function run() {
    mqtt.init(options.mqttAddr, options.clientId, options.username, options.password, options.prefix, options.qos, options.willTopic, options.willMessage, options.id)
    log.info('mqtt start......,id =', id)
    os.sleep(2000)//等待2秒
    std.setInterval(() => {
        try {
            if (mqtt.isConnected(options.id) && net.getStatus().connected) {
                if (!connected) {
                    _fireChange(true)
                    if (options.subs) {
                        mqtt.subscribes(options.subs, options.qos, options.id)
                    }
                }
            } else {
                if (connected) {
                    _fireChange(false)
                }
                // 重连
                mqtt.reconnect(options.willTopic, options.willMessage, options.id)
                os.sleep(2000)//重连后等待2秒
            }
        } catch (error) {
            log.error(error)
        }
    }, 3000)
    std.setInterval(() => {
        // 连接成功后进入消息监听
        if (connected) {
            if (!mqtt.msgIsEmpty(options.id)) {
                let msg = mqtt.receive(options.id)
                __bus.fire(mqtt.RECEIVE_MSG + options.id, msg)//bus.newworker的时候会import eventbus as __bus
            }
        }
    }, 10);
}

try {
    run()
} catch (error) {
    log.error(error)
}

function _fireChange(status) {
    __bus.fire(mqtt.CONNECTED_CHANGED + options.id, status ? 'connected' : 'disconnected')//bus.newworker的时候会import eventbus as __bus
    connected = status
}

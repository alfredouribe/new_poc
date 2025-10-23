import log from '../dxmodules/dxLogger.js'
import std from '../dxmodules/dxStd.js'
import bus from '../dxmodules/dxEventBus.js'
import screen from './screen.js'
import driver from './driver.js'
import pool from '../dxmodules/dxWorkerPool.js'
import config from '../dxmodules/dxConfig.js'
import face from '../dxmodules/dxFace.js'
import net from '../dxmodules/dxNet.js'
import mqtt from '../dxmodules/dxMqtt.js'
import dxNfc from '../dxmodules/dxNfc.js'
import dxUart from '../dxmodules/dxUart.js'
import dxGpioKey from '../dxmodules/dxGpioKey.js'

let topics = ["getCode", face.RECEIVE_MSG, dxGpioKey.RECEIVE_MSG, "netGetWifiSsidList", "switchNetworkType", "access", "setConfig", dxNfc.RECEIVE_MSG, net.STATUS_CHANGE, mqtt.CONNECTED_CHANGED, mqtt.RECEIVE_MSG, dxUart.VG.RECEIVE_MSG + driver.uart485.id, dxUart.VG.RECEIVE_MSG + driver.uartCode.id]

function initController() {
    driver.gpio.init()
    driver.watchdog.init()
    driver.config.init()
    driver.gpiokey.init()
    driver.net.init()
    driver.sqlite.init()
    driver.alsa.init()
    driver.nfc.init()
    driver.nfc.eidInit()
    driver.uart485.init()
    driver.uartCode.init()
    driver.capturer.init()
    std.sleep(100)
    driver.face.init()
    std.sleep(100)
    driver.pwm.init()
    std.sleep(100)
    driver.mqtt.init()
    driver.autoRestart.init()
}

(function () {
    initController()
    screen.init()
    bus.newWorker('controller', '/app/code/src/controller.js')
    pool.init('/app/code/src/services.js', bus, topics, 5, 100)
    const appVersion = 'vf105_v12_access_2.0.1.1'
    config.setAndSave('sys.version', appVersion)
    config.setAndSave('sys.appVersion', appVersion)
    log.info("=================== version:" + appVersion + " ====================")
})();

std.setInterval(() => {
    try {
        driver.watchdog.feed("main", 30)
        driver.watchdog.loop()
        screen.loop()
    } catch (error) {
        log.error(error)
    }
}, 5)
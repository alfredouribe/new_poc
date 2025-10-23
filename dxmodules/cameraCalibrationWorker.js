//build:20240524
//用于简化cameraCalibration组件的使用，把cameraCalibration封装在这个worker里，使用者只需要订阅eventcenter的事件就可以监听cameraCalibration
import log from './dxLogger.js'
import cameraCalibration from './dxCameraCalibration.js'
import capturer from '../dxmodules/dxCapturer.js'
import bus from './dxEventBus.js'
import dxMap from './dxMap.js'
import std from './dxStd.js'
const map = dxMap.get('default')
const options = map.get("__cameraCalibration__run_init")

function run() {
    cameraCalibration.init()
    log.info('cameraCalibration start......')
    let startTime = new Date().getTime()
    let cnt = 0
    std.setInterval (function() {
        try {
            let imageRgb = capturer.readImage(options.capturerRgbId)
            let imageNir = capturer.readImage(options.capturerNirId)
            let res = cameraCalibration.calibrationFromImage(imageRgb, imageNir, cnt)
            if (res) {
                if (cnt >= 1) {
                    log.info("两次标定成功，结束标定")
                    cameraCalibration.getMap(imageRgb, imageNir, cnt, "/app/path.txt")
                    bus.fire(cameraCalibration.RECEIVE_MSG, "success1")
                    capturer.destroyImage(imageRgb)
                    capturer.destroyImage(imageNir)
                    return
                }
                log.info("第" + (cnt + 1) + "次标定成功")
                bus.fire(cameraCalibration.RECEIVE_MSG, "success0")
                cnt += 1
                log.info("开始进行第" + (cnt + 1) + "次标定")
            } else {
                log.error("第" + (cnt + 1) + "次标定失败，重试中")
            }
            capturer.destroyImage(imageRgb)
            capturer.destroyImage(imageNir)
            let endTime = new Date().getTime()
            if (endTime - startTime > options.timeout * 1000) {
                log.error('标定超时，请重新执行标定')
                bus.fire(cameraCalibration.RECEIVE_MSG, "timeout")
                return
            }
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
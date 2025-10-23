import * as os from "os"
import capturer from '../dxmodules/dxCapturer.js'
import cameraCalibration from '../dxmodules/dxCameraCalibration.js'
import face from '../dxmodules/dxFace.js'
import std from '../dxmodules/dxStd.js'
import common from '../dxmodules/dxCommon.js'
import utils from './common/utils/utils.js'
import alsa from '../dxmodules/dxAlsa.js'
import config from '../dxmodules/dxConfig.js'
import pwm from '../dxmodules/dxPwm.js'
import net from '../dxmodules/dxNet.js'
import ntp from '../dxmodules/dxNtp.js'
import mqtt from '../dxmodules/dxMqtt.js'
import dxMap from '../dxmodules/dxMap.js'
import sqliteService from "./service/sqliteService.js"
import mqttService from "./service/mqttService.js"
import logger from "../dxmodules/dxLogger.js"
import gpio from "../dxmodules/dxGpio.js"
import map from "../dxmodules/dxMap.js"
// import eid from "../dxmodules/dxEid.js"
import nfc from "../dxmodules/dxNfc.js"
import bus from "../dxmodules/dxEventBus.js"
import dxUart from "../dxmodules/dxUart.js"
import watchdog from "../dxmodules/dxWatchdog.js"
import base64 from "../dxmodules/dxBase64.js"
import dxGpioKey from "../dxmodules/dxGpioKey.js"
import dxDriver from "../dxmodules/dxDriver.js"
const driver = {}

driver.config = {
    init: function () {
        config.init()
        let mac = common.getUuid2mac(19)
        let uuid = common.getSn(19)
        if (!config.get('sys.mac') && mac) {
            config.set('sys.mac', mac)
        }
        if (!config.get('sys.uuid') && uuid) {
            config.set('sys.uuid', uuid)
        }
        // If SN is empty, use device UUID first
        if (!config.get('sys.sn') && uuid) {
            config.set('sys.sn', uuid)
        }
        if (!config.get('mqtt.clientId') && uuid) {
            config.set('mqtt.clientId', uuid)
        }
        config.save()
    }
}
driver.screen = {
    accessFail: function () {
        bus.fire('accessRes', false)
    },
    accessSuccess: function () {
        bus.fire('accessRes', true)
    },
    upgrade: function (data) {
        bus.fire('upgrade', data)
    },
    getCard: function (card) {
        driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/read.wav`)
        bus.fire('getCard', card)
    },
    hideSn: function (data) {
        bus.fire('hideSn', data)
    },
    appMode: function (data) {
        bus.fire('appMode', data)
    },
    hideIp: function (data) {
        bus.fire('hideIp', data)
    },
    changeLanguage: function () {
        bus.fire('changeLanguage')
    }
}
driver.sqlite = {
    init: function () {
        std.ensurePathExists('/app/data/db/app.db')
        sqliteService.init('/app/data/db/app.db')
    }
}

driver.pwm = {
    init: function () {
        // White light
        let luminanceWhite = config.get('base.luminanceWhite') ?? 80
        pwm.request(dxDriver.PWM.WHITE_SUPPLEMENT_CHANNEL);
        pwm.setPeriodByChannel(dxDriver.PWM.WHITE_SUPPLEMENT_CHANNEL, dxDriver.PWM.WHITE_SUPPLEMENT_PERIOD_NS)
        pwm.enable(dxDriver.PWM.WHITE_SUPPLEMENT_CHANNEL, true);
        pwm.setDutyByChannel(dxDriver.PWM.WHITE_SUPPLEMENT_CHANNEL, dxDriver.PWM.WHITE_SUPPLEMENT_PERIOD_NS - (dxDriver.PWM.WHITE_SUPPLEMENT_PERIOD_NS * (luminanceWhite / 100)))
        // Infrared
        let luminanceNir = config.get('base.luminanceNir') ?? 80
        pwm.request(dxDriver.PWM.NIR_SUPPLEMENT_CHANNEL);
        pwm.setPeriodByChannel(dxDriver.PWM.NIR_SUPPLEMENT_CHANNEL, dxDriver.PWM.NIR_SUPPLEMENT_PERIOD_NS)
        pwm.enable(dxDriver.PWM.NIR_SUPPLEMENT_CHANNEL, true);
        pwm.setDutyByChannel(dxDriver.PWM.NIR_SUPPLEMENT_CHANNEL, dxDriver.PWM.NIR_SUPPLEMENT_PERIOD_NS - (dxDriver.PWM.NIR_SUPPLEMENT_PERIOD_NS * (luminanceNir / 100)))
    },
    // Adjust white fill light brightness, 0-100
    luminanceWhite: function (value) {
        if (value < 0 || value > 100) {
            logger.error("[driver.pwm]: value should be between 0 and 100")
            return
        }
        pwm.setDutyByChannel(dxDriver.PWM.WHITE_SUPPLEMENT_CHANNEL, dxDriver.PWM.WHITE_SUPPLEMENT_PERIOD_NS - (dxDriver.PWM.WHITE_SUPPLEMENT_PERIOD_NS * (value / 100)))
    },
    // Adjust infrared fill light brightness, 0-100
    luminanceNir: function (value) {
        if (value < 0 || value > 100) {
            logger.error("[driver.pwm]: value should be between 0 and 100")
            return
        }
        pwm.setDutyByChannel(dxDriver.PWM.NIR_SUPPLEMENT_CHANNEL, dxDriver.PWM.NIR_SUPPLEMENT_PERIOD_NS - (dxDriver.PWM.NIR_SUPPLEMENT_PERIOD_NS * (value / 100)))
    }
}

driver.alsa = {
    init: function () {
        alsa.init()
        this.volume(config.get("base.volume"))
    },
    play: function (src) {
        alsa.play(src)
    },
    ttsPlay: function (text) {
        alsa.ttsPlay(text)
    },
    volume: function (volume) {
        if (volume === undefined || volume === null) {
            return alsa.getVolume()
        } else {
            function mapScore(input) {
                // Ensure input value is between 1–100
                if (input < 1 || input > 100) {
                    throw new Error('输入值必须在1到100之间');
                }
                if (input < 60 && input > 30) {
                    input = input * 1.2
                }
                if (input < 30 && input > 1) {
                    input = input * 2
                }
                return input
            }
            alsa.setVolume(mapScore(volume))
        }
    }
}

// Camera initialization
driver.capturer = {
    // RGB camera
    options1: {
        id: "rgb",
        path: dxDriver.CAPTURER.RGB_PATH,
        width: dxDriver.CAPTURER.RGB_WIDTH,
        height: dxDriver.CAPTURER.RGB_HEIGHT,
        preview_width: dxDriver.CAPTURER.RGB_HEIGHT,
        preview_height: dxDriver.CAPTURER.RGB_WIDTH,
        preview_mode: 2,
        preview_screen_index: 0 // Display order, larger number = higher priority
    },
    // Infrared摄像头
    options2: {
        id: "nir",
        path: dxDriver.CAPTURER.NIR_PATH,
        width: dxDriver.CAPTURER.NIR_WIDTH,
        height: dxDriver.CAPTURER.NIR_HEIGHT,
        preview_width: 150,
        preview_height: 200,
        preview_mode: 1,
        preview_left: 605,
        preview_top: 80,
        preview_screen_index: 1 // Display order, larger number = higher priority
    }, // Infrared摄像头

    init: function () {
        capturer.worker.beforeLoop(this.options1)
        capturer.worker.beforeLoop(this.options2)

        this.showNir(config.get("face.showNir"))
    },
    showNir: function (enable) {
        capturer.capturerEnable(enable, this.options2.id)
    },
    pictureDataToImage: function (base64Data) {
        return capturer.pictureDataToImage(base64Data, base64Data.length, 1)
    },
    imageToPictureFile: function (imageId, savePath) {
        return capturer.imageToPictureFile(imageId, 1, 0, 24, savePath)
    },
    imageToPictureFile2: function (imageId, savePath) {
        return capturer.imageToPictureFile(imageId, 1, 0, 100, savePath)
    },
    imageResizeResolution: function (imageId, width, height) {
        return capturer.imageResizeResolution(imageId, width, height, 0)
    },
    loop: function () {
        capturer.worker.loop(this.options1)
        capturer.worker.loop(this.options2)
    }
}
driver.nfc = {
    options: { m1: true, psam: false },
    init: function () {
        if (!config.get('sys.nfc')) {
            logger.debug("刷卡已关闭")
            return
        }
        this.options.useEid = config.get("sys.nfcIdentityCardEnable") == 3 ? 1 : 0
        nfc.worker.beforeLoop(this.options)
    },
    eidInit: function () {
        if (!config.get('sys.nfc')) {
            return
        }
        if (config.get("sys.nfcIdentityCardEnable") == 3) {
            nfc.eidUpdateConfig({ appid: "1621503", sn: config.get("sys.sn"), device_model: config.get("sys.appVersion") })
        }
    },
    loop: function () {
        if (!config.get('sys.nfc')) {
            this.loop = () => { }
        } else {
            this.loop = () => nfc.worker.loop(this.options)
        }
    }
}
driver.face = {
    init: function () {
        common.systemBrief('mkdir -p /app/data/user/temp/')
        let options = {
            dbPath: "/app/data/db/face.db",
            rgbPath: "/dev/video3",
            nirPath: "/dev/video0",
            capturerRgbId: "rgb",
            capturerNirId: "nir",
            dbMax: 5000, // Face registration limit
            score: config.get("face.similarity"),
            picPath: "/app/data/user/temp",
            gThumbnailHeight: 1280 / 6,
            gThumbnailWidth: 800 / 6,
            // Enable recheck
            recgFaceattrEnable: 1,
            // Liveness check switch
            livingCheckEnable: config.get("face.livenessOff"),
            // Liveness detection threshold
            livingScore: config.get("face.livenessVal"),
            // Mask detection switch
            detectMaskEnable: config.get("face.detectMask"),
            // Recheck interval
            recheckIntervalTime: 5000,
            // Detection timeout
            detectTimeoutTime: 1000
        }
        face.worker.beforeLoop(options)

        // Default to face recognition mode
        this.mode(0)
        // Disable all face recognition functions
        this.status(false)

        // Screen brightness
        this.setDisplayBacklight(config.get("base.brightness"))

        this.screenStatus(1)


        std.setInterval(() => {
            // Screen-off detection
            let screenOff = map.get("screenOff")
            if (screenOff.get("status") == 1) {
                this.setDisplayBacklight(0)
                this.screenStatus(0)
            }

            // Stop screen-off mode
            if (screenOff.get("status") != 1) {
                if (config.get("base.brightnessAuto") == 1) {
                    // Auto adjust screen brightness
                    let brightness = Math.floor(face.getIspBrightness() / 10)
                    brightness = brightness > 100 ? 100 : brightness
                    this.setDisplayBacklight(brightness)
                } else {
                    this.setDisplayBacklight(config.get("base.brightness"))
                }
            }
        }, 1000)
    },
    getTrackingBox: function () {
        return face.getTrackingBox()
    },
    loop: function () {
        face.worker.loop()
    },
    // Face thread enable switch
    status: function (flag) {
        console.log('---人脸检测' + (flag ? '开启' : '暂停') + '---');
        face.faceSetEnable(flag)
    },
    // 0 = recognition mode; 1 = registration mode
    mode: function (value) {
        console.log('---人脸' + (value ? '注册' : '识别') + '模式---');
        face.setRecgMode(value)
    },
    // Face registration
    reg: function (id, feature) {
        return face.addFaceFeatures(id, feature);
    },
    // Update configuration
    faceUpdateConfig: function (options) {
        console.log("更新人脸配置", JSON.stringify(options));
        face.faceUpdateConfig(options)
    },
    // Set screen brightness
    setDisplayBacklight: function (brightness) {
        brightness = brightness < 2 ? 2 : brightness
        face.setDisplayBacklight(brightness)
    },
    registerFaceByPicFile: function (userId, picPath) {
        return face.registerFaceByPicFile(userId, picPath)
    },
    clean: function () {
        // Clear face data — must be done before initializing face component, otherwise it will throw an error
        face.faceFeaturesClean()
        common.systemBrief("rm -rf /app/data/db/face.db")
        return !std.exist("/app/data/db/face.db")
    },
    delete: function (userId) {
        return face.deleteFaceFeatures(userId)
    },
    // Whether the screen is enabled
    screenStatus: function (status) {
        if (status) {
           // face.setPowerMode(0)
        } else {
            // face.setPowerMode(1)
        }
        // face.setEnableStatus(status)
    },
    // Convert file to base64
    fileToBase64: function (filePath) {
        function fileToUint8Array(filename) {
            // Read file
            const file = std.open(filename, "rb");
            if (!file) {
                throw new Error("无法打开文件");
            }

            // Get file size
            const size = std.seek(file, 0, std.SEEK_END)
            std.seek(file, 0, std.SEEK_SET)
            // Create ArrayBuffer and read file content
            const buffer = new ArrayBuffer(size);
            const array = new Uint8Array(buffer);
            std.read(file, array.buffer, 0, size);

            std.close(file);

            return array;
        }

        try {
            const data = fileToUint8Array(filePath);
            return base64.fromUint8Array(data);
        } catch (error) {
            logger.info(error);
        }
    }
}

driver.net = {
    init: function () {
        let dns = config.get("net.dns").split(",")
        let option = {
            type: config.get("net.type"),
            dhcp: config.get("net.dhcp"),
            ip: config.get("net.ip"),
            gateway: config.get("net.gateway"),
            netmask: config.get("net.mask"),
            dns0: dns[0],
            dns1: dns[1],
            macAddr: common.getUuid2mac()
        }
        logger.info("更新联网配置：", JSON.stringify(option));
        net.worker.beforeLoop(option)
        config.set("net.mac", common.getUuid2mac())
        if (config.get("net.type") == 2) {
            // Connect to WiFi using configuration file
            let ssid = utils.isEmpty(config.get('net.ssid')) ? "ssid" : config.get('net.ssid')
            let psk = utils.isEmpty(config.get('net.psk')) ? "psk" : config.get('net.psk')
            driver.net.netConnectWifiSsid(ssid, psk)
        }
        // Fix incorrect network switch status
        std.setInterval(() => {
            let status = net.getStatus()
            if (status.status != map.get("NET").get("status")) {
                status.type = config.get("net.type")
                bus.fire(net.STATUS_CHANGE, status)
            }
        }, 1000)
    },
    changeNetType: function () {
        // Apply lock
        if (map.get("NET").get("changeType") == "Y") {
            return
        }
        map.get("NET").put("changeType", "Y")
        let type = config.get("net.type")
        logger.info("切换网络", type);
        [1, 2, 4].filter(v => v != type).forEach(v => {
            logger.info("关闭网卡", v, net.cardEnable(v, false));
        })
        logger.info("设置主网卡", type, net.setMasterCard(type));
        logger.info("开启网卡", type, net.cardEnable(type, true));
        if (type == 2) {
            // Connect to WiFi using configuration file
            let ssid = utils.isEmpty(config.get('net.ssid')) ? "ssid" : config.get('net.ssid')
            let psk = utils.isEmpty(config.get('net.psk')) ? "psk" : config.get('net.psk')
            logger.info("连接wifi", ssid, psk);
            net.netConnectWifiSsid(ssid, psk)
        }
        if (type == 1 || type == 2) {
            let dns = config.get("net.dns").split(",")
            net.setModeByCard(type, config.get("net.dhcp"), config.get("net.dhcp") == 1 ? {
                ip: config.get("net.ip"),
                gateway: config.get("net.gateway"),
                netmask: config.get("net.mask"),
                dns0: dns[0],
                dns1: dns[1],
            } : undefined)
        }
        map.get("NET").del("changeType")
    },
    eidInit: function () {
        net.exit();
        common.systemWithRes(`pkill -9 -f 'wpa_supplicant|udhcpc'`, 5)
    },
    getStatus: function () {
        let status = net.getStatus()
        if (status.connected == true && status.status == 4) {
            return true
        } else {
            return false
        }

    },
    // Connect to WiFi
    netConnectWifiSsid: function (ssid, psk) {
        net.netConnectWifiSsid(ssid, psk, "")
    },
    // Get WiFi list
    netGetWifiSsidList: function () {
        if (!driver.net.getStatus()) {
            // If WiFi connection fails, list retrieval will fail — destroy first
            net.netDisconnetWifi()
        }
        let result = net.netGetWifiSsidList(1000, 5)
        if (!result || !result.results || result.results.length === 0) {
            return [];
        }
        let wifiList = []; // Initialize wifiList as an array
        result.results.forEach(element => wifiList.push(element.ssid)); // Add ssid to array using push method
        return wifiList;
    },
    cardReset: function () {
        // net.netCardReset(2,1)
    },
    loop: function () {
        net.worker.loop()
    }
}

driver.ntp = {
    loop: function () {
        // Check time every second; if the difference is greater than 2 seconds, resynchronize time
        let last = new Date().getTime()
        dxMap.get("NTP_SYNC").put("syncTime", last)
        std.setInterval(() => {
            let now = new Date().getTime()
            let diff = now - last
            if (diff > 2000) {
                dxMap.get("NTP_SYNC").put("syncTime", now)
                last = now
            }
        }, 1000)

        ntp.beforeLoop(config.get("ntp.server"), 9999999999999)
        this.ntpHour = config.get('ntp.hour')
        this.flag = true
        driver.ntp.loop = () => {
            if (config.get("ntp.ntp")) {
                ntp.loop()
                if (new Date().getHours() == this.ntpHour && this.flag) {
                    // Scheduled synchronization — perform immediate sync once
                    ntp.syncnow = true
                    this.flag = false
                }
                if (new Date().getHours() != this.ntpHour) {
                    // After this hour passes, allow synchronization again
                    this.flag = true
                }
            }
        }
    }
}
driver.sync = {
    // Simple async-to-sync implementation
    request: function (topic, timeout) {
        let map = dxMap.get("SYNC")
        let count = 0
        let data = map.get(topic)
        while (utils.isEmpty(data) && count * 10 < timeout) {
            data = map.get(topic)
            std.sleep(10)
            count += 1
        }
        let res = map.get(topic)
        map.del(topic)
        return res
    },
    response: function (topic, data) {
        let map = dxMap.get("SYNC")
        map.put(topic, data)
    }
}
driver.mqtt = {
    init: function () {
        mqtt.run({ mqttAddr: config.get("mqtt.addr"), clientId: config.get('mqtt.clientId') + std.genRandomStr(3), subs: mqttService.getTopics(), username: config.get("mqtt.username"), password: config.get("mqtt.password"), qos: config.get("mqtt.qos"), willTopic: config.get("mqtt.willTopic"), willMessage: JSON.stringify({ "uuid": config.get("sys.uuid") }) })
    },
    eidInit: function () {
        mqtt.destroy()
    },
    send: function (topic, payload,) {
        logger.info("[driver.mqtt] send :", topic)
        mqtt.send(topic, payload)
    },
    getOnlinecheck: function () {
        let timeout = config.get("mqtt.timeout")
        timeout = utils.isEmpty(timeout) ? 2000 : timeout
        return driver.sync.request("mqtt.getOnlinecheck", timeout)
    },
    getOnlinecheckReply: function (data) {
        driver.sync.response("mqtt.getOnlinecheck", data)
    },
    getStatus: function () {
        return mqtt.isConnected()
    },
    heartbeat: function () {
        if (utils.isEmpty(this.heart_en)) {
            let heart_en = config.get('sys.heart_en')
            this.heart_en = utils.isEmpty(heart_en) ? 0 : heart_en
            let heart_time = config.get('sys.heart_time')
            this.heart_time = utils.isEmpty(heart_time) ? 30 : heart_time < 30 ? 30 : heart_time
        }
        if (utils.isEmpty(this.lastHeartbeat)) {
            this.lastHeartbeat = 0
        }
        if (this.heart_en === 1 && (new Date().getTime() - this.lastHeartbeat >= (this.heart_time * 1000))) {
            this.lastHeartbeat = new Date().getTime()
            driver.mqtt.send("access_device/v2/event/heartbeat", JSON.stringify(mqttService.mqttReply(std.genRandomStr(10), undefined, mqttService.CODE.S_000)))
        }
    }
}

driver.gpio = {
    init: function () {
        gpio.init()
        gpio.request(dxDriver.GPIO.RELAY0)
    },
    open: function () {
        gpio.setValue(dxDriver.GPIO.RELAY0, 1);

        let relayTime = config.get("access.relayTime")

        std.setTimeout(() => {
            gpio.setValue(dxDriver.GPIO.RELAY0, 0);
        }, relayTime)
    },
    close: function () {
        gpio.setValue(dxDriver.GPIO.RELAY0, 0)
    }
}

driver.uart485 = {
    id: 'uart485',
    init: function () {
        dxUart.runvg({ id: this.id, type: dxUart.TYPE.UART, path: '/dev/ttySLB2', result: 0, passThrough: false })
        std.sleep(2000)
        dxUart.ioctl(6, '115200-8-N-1', this.id)
    },
    ioctl: function (data) {
        dxUart.ioctl(6, data, this.id)
    },
    send: function (data) {
        dxUart.send(data, this.id)
    },
    sendVg: function (data) {
        if (typeof data == 'object') {
            data.length = data.length ? data.length : (data.data ? data.data.length / 2 : 0)
        }
        dxUart.sendVg(data, this.id)
    }
}

driver.uartCode = {
    id: 'uartCode',
    init: function () {
        dxUart.runvg({ id: this.id, type: dxUart.TYPE.UART, path: '/dev/ttySLB1', result: 0, passThrough: false })
        std.sleep(500)
        dxUart.ioctl(6, '115200-8-N-1', this.id)
    },
    ioctl: function (data) {
        dxUart.ioctl(6, data, this.id)
    },
    send: function (data) {
        dxUart.send(data, this.id)
    },
    sendVg: function (data) {
        if (typeof data == 'object') {
            data.length = data.length ? data.length : (data.data ? data.data.length / 2 : 0)
        }
        dxUart.sendVg(data, this.id)
    },
}

// driver.eid = {
//     id: "eid",
//     active: function (sn, version, mac, codeMsg) {
//         return eid.active(sn, version, mac, codeMsg)
//     },
//     getVerion: function () {
//         return eid.getVersion()
//     }
// }
driver.gpiokey = {
    init: function () {
        dxGpioKey.worker.beforeLoop()
    },
    loop: function () {
        dxGpioKey.worker.loop()
    },
}
driver.watchdog = {
    init: function () {
        watchdog.open(1)
        watchdog.enable(1)
        watchdog.start(20000)
    },
    loop: function () {
        watchdog.loop(1)
    },
    feed: function (flag, timeout) {
        if (utils.isEmpty(this["feedTime" + flag]) || new Date().getTime() - this["feedTime" + flag] > 2000) {
            // Reduce watchdog feeding frequency — feed every 2 seconds
            this["feedTime" + flag] = new Date().getTime()
            watchdog.feed(flag, timeout)
        }
    }
}

driver.autoRestart = {
    lastRestartCheck: new Date().getHours(),  // Initialize with current hour instead of 0
    init: function () {
        // std.setInterval(() => {        // Check if a scheduled reboot is needed
        //     const now = new Date()
        //     const currentHour = now.getHours()
        //     // Execute only when hour equals set value and hasn't been checked yet
        //     if (currentHour === 3 && currentHour !== this.lastRestartCheck && now.getMinutes() === 0) {
        //         common.systemBrief('reboot')
        //     }
        //     // Update last checked hour
        //     this.lastRestartCheck = currentHour
        // }, 60000)
    }
}

export default driver

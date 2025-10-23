//build:20240715
//用于简化uart组件微光通信协议的使用，把uart封装在这个worker里，使用者只需要订阅eventcenter的事件就可以监听uart
import log from './dxLogger.js'
import uart from './dxUart.js'
import ble from './dxBle.js'
import common from './dxCommon.js';
import dxMap from './dxMap.js'
import * as os from "os";
import std from './dxStd.js'
const map = dxMap.get('default')
const id = "{{id}}"
const options = map.get("__vgble__run_init" + id)
const timeout = 10
const longTimeout = 500


// 写死的密钥
let BLE_KEY = [0x01, 0x23, 0x45, 0x67, 0x89, 0x01, 0x23, 0x45, 0x67, 0x89, 0x01, 0x23, 0x45, 0x67, 0x89, 0x01]

// 连接记录
let auth = [
    {
        random: [0],
        randomLen: 0,
        index: 0xff,
    },
    {
        random: [0],
        randomLen: 0,
        index: 0xff,
    },
    {
        random: [0],
        randomLen: 0,
        index: 0xff,
    },
]

function run() {
    uart.open(options.type, options.path, options.id)

    // 设置秘钥
    if(options.bleKey){
        BLE_KEY = options.bleKey
    }

    // 设置蓝牙名称、广播标识
    ble.setBleConfig({name: options.bleName}, options.id)

    log.info('vg ble start......,id =', id)
    std.setInterval(() => {
        try {
            // 蓝牙标准协议模式
            readPacket(true)
        } catch (error) {
            log.error(error)
        }
    }, 10)
}

function readPacket(noResult) {
    let buffer = ble.toHexadecimal(uart.receive(1, timeout, options.id))
    if (buffer.length <= 0) {
        return;
    }
    if (buffer == "55") {
        buffer = ble.toHexadecimal(uart.receive(1, timeout, options.id))
        if (buffer != "aa") {
            return;
        }
    } else {
        return;
    }
    let pack = {
        head: '55aa',
    };
    // 读取命令字（占用1Byte）
    let cmd = ble.toHexadecimal(uart.receive(1, timeout, options.id))
    pack.cmd = cmd;
    if (!noResult) {
        // 读取结果字（占用1Byte）
        let result = ble.toHexadecimal(uart.receive(1, timeout, options.id))
        pack.result = result;
    }
    // 命令头已解析完，读取长度字（占用2Byte）
    let bufferLen1 = uart.receive(1, timeout, options.id)
    let bufferLen2 = uart.receive(1, timeout, options.id)
    // 解析长度字，获取数据域长度
    let dataLen = parseInt(bufferLen1) + parseInt(bufferLen2) * 256

    // 根据长度字读取指定数据长度
    pack.dlen = dataLen
    if (dataLen > 0) {
        buffer = uart.receive(dataLen, longTimeout, options.id)
        if (buffer === null) {
            return;
        }
        pack.data = Array.from(buffer);
    } else {
        pack.data = 0
    }
    /* log.info("cmd: ", cmd)
    log.info("数据长度: ", dataLen)
    log.info("接收到的数据: ", common.arrayBufferToHexString(pack.data)) */

    // 读取1Byte的校验位
    pack.crc = ble.toHexadecimal(uart.receive(1, timeout, options.id))
    let crc = ble.genCrc(pack)
    if (crc != parseInt(pack.crc, 16)) {
        log.error("校验失败：" + JSON.stringify(pack) + "，正确的校验字：" + crc)
        return;
    }

    let res;
    switch (cmd) {
        case "07":
            // 获取随机数
            CMD07(pack);
            break;
        case "08":
            // 验证连接合法性
            CMD08(pack);
            break;
        case "60":
            // 蓝牙回复，回复查询的设备信息
            CMD60(pack);
            break;
        case "0f":
            // 业务逻辑，数据透传
            res = { cmd: pack.cmd, length: pack.dlen}
            if (pack.dlen > 0) {
                res.data = common.arrToHex(pack.data)
            }
            if (options.result) {
                res.result = pack.result
            }
            __bus.fire(ble.VG.RECEIVE_MSG + options.id, res)//bus.newworker的时候会import eventbus as __bus

            break;
        default:
            break;
    }
}

/**
 * 回复随机数
 */
function CMD07(pack) {
    let data = pack.data
    let index = data[pack.dlen - 1].toString(16).padStart(2, '0');
    // 记录连接标识
    log.info("index:" + index);
    let curr = 0
    for (let i = 0; i < 3; i++) {
        if (auth[i].index == 0xff) {
            curr = i
            break;
        }
    }
    if (pack.dlen == 1 || data[0] == 0x10) {
        log.info("random 16 byte");
        auth[curr].random = ble.getUrandom(16)
        auth[curr].randomLen = 16
    } else if (pack.dlen == 2 && data[0] == 0x20) {
        log.info("random 32 byte");
        auth[curr].random = ble.getUrandom(32)
        auth[curr].randomLen = 32
    } else {
        log.info("invalid pack");
        return
    }
    auth[curr].index = index

    let content = auth[curr].random + index
    pack = { "head": "55aa", "cmd": "07", "result": "00", "dlen": auth[curr].randomLen + 1, "data": content.match(/.{2}/g).map(v => parseInt(v, 16)) }
    pack.crc = ble.genCrc(pack)
    data = pack.head + pack.cmd + pack.result + common.decimalToLittleEndianHex(pack.dlen, 2) + pack.data.map(v => v.toString(16).padStart(2, '0')).join("") + pack.crc.toString(16).padStart(2, '0')
    ble.send485(data, options.id)
}

/**
 * 回复外部授权(判断连接的合法性)
 */
function CMD08(pack) {
    let data = pack.data
    let index = data[pack.dlen - 1].toString(16).padStart(2, '0');
    log.info("index:" + index);
    let curr = -1
    pack = { "head": "55aa", "cmd": "08", "result": "00", "dlen": 1, "data": index, }
    for (let i = 0; i < 3; i++) {
        // 查询指定的连接
        if (auth[i].index === index) {
            curr = i
            break;
        }
    }
    if (curr === -1) {
        log.info("extern auth failed");
        pack.result = "90"
    } else {
        // aes解密
        let key = BLE_KEY
        let cipher = data.slice(1, -1)
        let plain = common.aes128EcbDecrypt(cipher, key)
        if (plain.map((byte) => byte.toString(16).padStart(2, '0'))
            .join('') !== auth[curr].random) {
            log.info("extern auth failed");
            log.info("aes key: " + key);
            log.info("aes in: " + cipher);
            log.info("aes out: " + plain);
            pack.result = "90"
        } else {
            auth[curr].index = 0xff;
        }
    }

    pack.data = pack.data.match(/.{2}/g).map(v => parseInt(v, 16))
    pack.crc = ble.genCrc(pack)
    data = pack.head + pack.cmd + pack.result + common.decimalToLittleEndianHex(pack.dlen, 2) + pack.data.map(v => v.toString(16).padStart(2, '0')).join("") + pack.crc.toString(16).padStart(2, '0')
    ble.send485(data, options.id)
}

/**
 * 获取蓝牙的回复(查询蓝牙信息回复、修改蓝牙配置成功与否回复)
 */
function CMD60(pack) {
    let res = {}
    let data = pack.data.map(v => v.toString(16).padStart(2, '0'))
    if (data.slice(-1)[0] == 'fe') {
        data = data.slice(3, -1)
        let t = data[0]
        let l = data[1]
        let v = data.slice(2)
        if (t == '02') {
            if (v.length !== parseInt(l, 16)) {
                log.error("ble info data err")
                return
            }
            t = v[0]
            l = v[1]
            let bleName = ""
            if (l !== "00") {
                let v1 = v.slice(2, 2 + parseInt(l, 16))
                if (t !== '01') {
                    log.error("ble info data err")
                    return event
                }
                bleName = common.hexToString(v1.join(''))
            }
            log.info("bleInfo.name:" + bleName)
            if (bleName) {
                res.name = bleName
            }
            v = v.slice(2 + parseInt(l, 16))


            t = v[0]
            l = v[1]
            let v2 = v.slice(2)
            if (t !== '02') {
                log.error("ble info data err")
                return
            }
            let bleMac = v2.join('')
            log.info("bleInfo.mac:" + bleMac)
            if (bleMac) {
                res.mac = bleMac
            }
            // 查询蓝牙信息回复
            log.info("查询到的蓝牙信息: ", JSON.stringify(res))
        } else if (t == '01') {
            // 修改蓝牙信息回复
            log.info("修改蓝牙信息成功")
        } else {
            log.error("ble info data err")
            return
        }
    } else {
        log.info("other ble info data")
    }
}

try {
    run()
} catch (error) {
    log.error(error, error.stack)
}
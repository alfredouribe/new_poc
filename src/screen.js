import dxui from '../dxmodules/dxUi.js'
import dxMap from '../dxmodules/dxMap.js'
import log from '../dxmodules/dxLogger.js'
import net from '../dxmodules/dxNet.js'
import viewUtils from './view/viewUtils.js'
import i18n from './view/i18n.js'
import pinyin from './view/pinyin/pinyin.js'
import mainView from './view/mainView.js'
import idleView from './view/idleView.js'
import topView from './view/topView.js'
import appView from './view/appView.js'
import pwdView from './view/pwdView.js'
import newPwdView from './view/config/newPwdView.js'
import identityVerificationView from './view/config/identityVerificationView.js'
import configView from './view/config/configView.js'
import cloudCertView from './view/config/menu/cloudCertView.js'
import doorControlView from './view/config/menu/doorControlView.js'
import helpView from './view/config/menu/helpView.js'
import networkSettingView from './view/config/menu/networkSettingView.js'
import systemSettingView from './view/config/menu/systemSettingView.js'
import deviceInfoView from './view/config/menu/deviceInfoView.js'
import factoryTestView from './view/config/menu/factoryTestView.js'
import localUserView from './view/config/menu/localUserView.js'
import recordQueryView from './view/config/menu/recordQueryView.js'
import voiceBroadcastView from './view/config/menu/voiceBroadcastView.js'
import localUserAddView from './view/config/menu/localUser/localUserAddView.js'
import faceEnterView from './view/config/menu/localUser/faceEnterView.js'
import displaySettingView from './view/config/menu/systemSetting/displaySettingView.js'
import faceRecognitionSettingView from './view/config/menu/systemSetting/faceRecognitionSettingView.js'
import swipeCardRecognitionSettingView from './view/config/menu/systemSetting/swipeCardRecognitionSettingView.js'
import passLogSettingView from './view/config/menu/systemSetting/passLogSettingView.js'
import passwordOpenDoorSettingView from './view/config/menu/systemSetting/passwordOpenDoorSettingView.js'
import passwordManagementView from './view/config/menu/systemSetting/passwordManagementView.js'
import timeSettingView from './view/config/menu/systemSetting/timeSettingView.js'
import systemInfoView from './view/config/menu/deviceInfo/systemInfoView.js'
import dataCapacityInfoView from './view/config/menu/deviceInfo/dataCapacityInfoView.js'
import recordQueryDetailView from './view/config/menu/recordQuery/recordQueryDetailView.js'
import std from '../dxmodules/dxStd.js'
import bus from '../dxmodules/dxEventBus.js'
import driver from './driver.js'
import config from '../dxmodules/dxConfig.js'
import common from '../dxmodules/dxCommon.js'
import configService from './service/configService.js'
import sqliteService from './service/sqliteService.js'
import codeService from './service/codeService.js'
import face from '../dxmodules/dxFace.js'
import faceService from './service/faceService.js'
const screen = {}

screen.screenSize = {
    width: 800,
    height: 1280
}

// UI context
const context = {}

// Initialization method, called in main.js, only allowed to be called once
screen.init = function () {
    const loadMethod = dxui.loadMain
    dxui.loadMain = function (view) {
        if (screen.screenNow && screen.screenNow.id == view.id) {
            return
        }
        screen.screenNow = view
        pinyin.hide(true)
        loadMethod.call(dxui, view)
    }

    dxui.init({ orientation: 0 }, context);
    // Initialize all components
    pinyin.init(800, 400)

    viewUtils.confirmInit()

    mainView.init()
    idleView.init()
    topView.init()
    appView.init()
    pwdView.init()
    newPwdView.init()
    identityVerificationView.init()
    configView.init()

    cloudCertView.init()
    doorControlView.init()
    helpView.init()
    networkSettingView.init()
    systemSettingView.init()
    deviceInfoView.init()
    factoryTestView.init()
    localUserView.init()
    recordQueryView.init()
    voiceBroadcastView.init()

    localUserAddView.init()
    faceEnterView.init()

    displaySettingView.init()
    faceRecognitionSettingView.init()
    swipeCardRecognitionSettingView.init()
    passLogSettingView.init()
    passwordOpenDoorSettingView.init()
    passwordManagementView.init()
    timeSettingView.init()

    systemInfoView.init()
    dataCapacityInfoView.init()
    recordQueryDetailView.init()

    // Set language
    // i18n.setLanguage("en-US")
    i18n.setLanguage(config.get("base.language"))

    dxui.loadMain(mainView.screenMain)
    // dxui.loadMain(networkSettingView.screenMain)

    // Start screen saver timer
    idleTimerStart()

    // Bus events
    busEvents()

    // Real-time acquisition of click coordinates
    getClickPoint()

    // Hide keyboard
    hidePinyin()

    // Face tracking box
    faceTrackingBox()
}

function faceTrackingBox() {
    std.setInterval(() => {
        let data = driver.face.getTrackingBox()
        try {
            if (data) {
                data = JSON.parse(data)
                // Maximum 10 people
                if (data.type == "track" && data.faces.length <= 10) {
                    for (let i = 0; i < data.faces.length; i++) {
                        let item = data.faces[i]
                        screen.trackUpdate({ w: item.rect_render[2] - item.rect_render[0], h: item.rect_render[3] - item.rect_render[1], x: item.rect_render[0], y: item.rect_render[1] }, item.id, item.is_living)
                    }
                }
            }
        } catch (error) {
            log.info('screen.faceTrackingBox:', data);
            log.error("screen.faceTrackingBox:", error)
        }
    }, 110)
}

let changedClickPoint
let lastClickPoint = { x: 0, y: 0 }
let clickPoint
// Real-time acquisition of click coordinates
function getClickPoint() {
    const indev = NativeObject.APP.NativeComponents.NativeIndev
    std.setInterval(() => {
        clickPoint = {
            x: Math.abs(800 - indev.lvIndevGetPointVg().x),
            y: indev.lvIndevGetPointVg().y
        }

        if (lastClickPoint.x != clickPoint.x || lastClickPoint.y != clickPoint.y) {
            changedClickPoint = clickPoint
        } else {
            changedClickPoint = null
        }

        lastClickPoint = clickPoint
    }, 5)
}

function hidePinyin() {
    let showPoint
    const hideMethod = pinyin.hide
    const showMethod = pinyin.show
    // Lock
    let lock = false
    pinyin.hide = function (isForce) {
        if (isForce) {
            hideMethod.call(pinyin)
            lock = false
            return
        }
        if (lock) {
            return
        }
        lock = true
        hideMethod.call(pinyin)
        lock = false
    }
    pinyin.show = function (...args) {
        if (lock) {
            return
        }
        lock = true
        showMethod.call(pinyin, ...args)
        showPoint = clickPoint
        lock = false
    }
    std.setInterval(() => {
        if (showPoint && (Math.abs(showPoint.x - clickPoint.x) > 5 && Math.abs(showPoint.y - clickPoint.y) > 5)) {
            if (clickPoint.y < (1280 - (pinyin.getMode() == 1 ? 400 + 70 : 400))) {
                let defocus = dxMap.get("INPUT_KEYBOARD").get("defocus")
                if (defocus == "defocus") {
                    dxMap.get("INPUT_KEYBOARD").del("defocus")
                    showPoint = null
                    pinyin.hide()
                }
            }
        }
    }, 5)
}

class ScreenManager {
    constructor(callbacks = {}) {
        this.timers = {
            screenSaver: null,
            screenOff: null
        };

        // Default configuration
        this.config = {
            screenSaverDelay: 0, // Screen saver delay (milliseconds)
            screenOffDelay: 0    // Screen off delay (milliseconds)
        };

        // Callbacks
        this.callbacks = {
            onScreenSaverStart: callbacks.onScreenSaverStart || (() => { }),
            onScreenSaverEnd: callbacks.onScreenSaverEnd || (() => { }),
            onScreenOff: callbacks.onScreenOff || (() => { }),
            onScreenOn: callbacks.onScreenOn || (() => { })
        };

        this.resetTimers = this.resetTimers.bind(this);
    }

    // Configure time
    configure({ screenSaverDelay = 0, screenOffDelay = 0 }) {
        this.config.screenSaverDelay = screenSaverDelay;
        this.config.screenOffDelay = screenOffDelay;
        this.resetTimers();
    }

    // Reset timers
    resetTimers() {
        // Clear existing timers
        if (this.timers.screenSaver) {
            std.clearTimeout(this.timers.screenSaver);
        }
        if (this.timers.screenOff) {
            std.clearTimeout(this.timers.screenOff);
        }

        // Exit current state
        this.exitScreenStates();

        // Set new timers
        if (this.config.screenOffDelay > 0) {
            this.timers.screenOff = std.setTimeout(() => {
                this.enterScreenOff();
            }, this.config.screenOffDelay);
        }

        // Only set screen saver timer if screen off time is greater than screen saver time
        if (this.config.screenSaverDelay > 0 &&
            (this.config.screenSaverDelay < this.config.screenOffDelay || this.config.screenOffDelay == 0)) {
            this.timers.screenSaver = std.setTimeout(() => {
                this.enterScreenSaver();
            }, this.config.screenSaverDelay);
        }
    }

    // Enter screen saver state
    enterScreenSaver() {
        const mapUI = dxMap.get("UI")
        if (!mapUI.get("isScreenOff")) {
            mapUI.put("isScreenSaver", true)
            this.callbacks.onScreenSaverStart();
        }
    }

    // Enter screen off state
    enterScreenOff() {
        const mapUI = dxMap.get("UI")
        mapUI.put("isScreenOff", true)
        mapUI.put("isScreenSaver", false)
        this.callbacks.onScreenOff();
    }

    // Exit all screen states
    exitScreenStates() {
        const mapUI = dxMap.get("UI")
        const previousState = { isScreenOff: mapUI.get("isScreenOff"), isScreenSaver: mapUI.get("isScreenSaver") };
        mapUI.put("isScreenOff", false)
        mapUI.put("isScreenSaver", false)
        // Trigger corresponding callbacks if the state has changed
        if (previousState.isScreenSaver) {
            this.callbacks.onScreenSaverEnd();
        }
        if (previousState.isScreenOff) {
            this.callbacks.onScreenOn();
        }
    }

    // Get current state
    getState() {
        const mapUI = dxMap.get("UI")
        return { isScreenOff: mapUI.get("isScreenOff"), isScreenSaver: mapUI.get("isScreenSaver") };
    }

    // Clean up resources
    destroy() {
        if (this.timers.screenSaver) {
            std.clearTimeout(this.timers.screenSaver);
        }
        if (this.timers.screenOff) {
            std.clearTimeout(this.timers.screenOff);
        }
    }
}

let screenManager
function idleTimerStart() {
    // Create instance, passing callbacks
    screenManager = new ScreenManager({
        onScreenSaverStart: () => {
            screen.enterIdle()
        },
        onScreenSaverEnd: () => {
            screen.exitIdle(true)
        },
        onScreenOff: () => {
            dxMap.get("screenOff").put("status", 1)
            screen.screenNow.hide()
            topView.screenMain.hide()
        },
        onScreenOn: () => {
            screen.exitIdle(true)
            dxMap.get("screenOff").put("status", 0)
            screen.screenNow.show()
            topView.screenMain.show()
        }
    });

    // Configure time (milliseconds)
    screenManager.configure({
        // screenSaverDelay: 10000,  // Screen saver
        // screenOffDelay: 5000     // Screen off
        screenSaverDelay: config.get("base.screensaver") * 60 * 1000,  // Screen saver
        screenOffDelay: config.get("base.screenOff") * 60 * 1000     // Screen off
    });

    // Detect user touch
    let touchCount = 0
    std.setInterval(() => {
        let count = dxui.Utils.GG.NativeDisp.lvDispGetInactiveTime()
        if (count < touchCount) {
            screenManager.resetTimers();
        }
        touchCount = count
    }, 100);
}

screen.screenManagerRefresh = function () {
    screenManager.configure({
        screenSaverDelay: config.get("base.screensaver") * 60 * 1000,  // Screen saver
        screenOffDelay: config.get("base.screenOff") * 60 * 1000     // Screen off
    });
    screenManager.resetTimers();
}

let enterIdleTimer
// Enter screen saver
screen.enterIdle = function () {
    // Delay 1 second to prevent entering and exiting screen saver from triggering simultaneously.
    // If exit screen saver is not triggered within 1 second, it is considered to have entered screen saver.
    enterIdleTimer = std.setTimeout(() => {
        if (idleView.screenMain.isHide()) {
            viewUtils.confirmClose()
            dxui.loadMain(mainView.screenMain)
            idleView.screenMain.show()
            topView.changeTheme(false)
        }
    }, 1000)
}

// Exit screen saver
screen.exitIdle = function (isSelf) {
    if (enterIdleTimer) {
        std.clearTimeout(enterIdleTimer)
        enterIdleTimer = null
    }
    if (!isSelf) {
        screenManager.resetTimers();
    }
    if (!idleView.screenMain.isHide()) {
        idleView.screenMain.hide()
    }
}

screen.loop = function () {
    return dxui.handler()
}

// Cloud ID activation 0 Success Non-0 Failure
screen.nfcIdentityCardActivation = function (code) {
    return driver.eid.active(config.get("sys.sn"), config.get("sys.appVersion"), config.get("sys.mac"), code);

}

// Delete user
screen.deleteUser = function (user) {
    // TODO Delete user
    sqliteService.d1_person.deleteByUserId(user.userId)
    sqliteService.d1_permission.deleteByUserId(user.userId)
    sqliteService.d1_voucher.deleteByUserId(user.userId)
    let res = driver.face.delete(user.userId)

    return true
}

screen.updateUser = function (user) {
    // Modify user information
    let res = sqliteService.d1_person.updatenameAndExtraByUserId(user.userId, user.name, JSON.stringify({ type: user.type, idCard: user.idCard }))
    if (res != 0) {
        return false
    }
    // Handle credentials
    let ret
    if (user.pwd) {
        // Check if the credential exists in the database table
        let pwdData = sqliteService.d1_voucher.findByCodeAndType(user.pwd, "400");
        if (pwdData.length > 0 && pwdData[0].userId != user.userId) {
            // If it exists, cannot add, return failure
            log.info("Password duplicate");
            return "localUserAddView.failPwdRepeat"
        }
        // Check if there is a password credential, update if yes, add if no
        let countByuserIdAndType = sqliteService.d1_voucher.findByuserIdAndType(user.userId, "400");
        if (countByuserIdAndType.length > 0) {
            ret = sqliteService.d1_voucher.updatecodeByuserIdAndtype(user.userId, "400", user.pwd)
            if (ret != 0) {
                return false
            }
        } else {
            // Add a new one
            ret = sqliteService.d1_voucher.save({ keyId: std.genRandomStr(32), type: "400", code: user.pwd, userId: user.userId })
            if (ret != 0) {
                return false
            }
        }
    } else {
        // If there is no content, delete it from the database table
        sqliteService.d1_voucher.deleteByuserIdAndtype(user.userId, "400")
    }
    if (user.card) {
        // Check if the credential exists in the database table
        let cardData = sqliteService.d1_voucher.findByCodeAndType(user.card, "200");
        if (cardData.length > 0 && cardData[0].userId != user.userId) {
            // If it exists, cannot add, return failure
            log.info("Card duplicate");
            return "localUserAddView.failCardRepeat"
        }
        // Check if there is a password credential, update if yes, add if no
        let countByuserIdAndType = sqliteService.d1_voucher.countByuserIdAndType(user.userId, "200");
        if (countByuserIdAndType > 0) {
            ret = sqliteService.d1_voucher.updatecodeByuserIdAndtype(user.userId, "200", user.card)
            if (ret != 0) {
                return false
            }
        } else {
            // Add a new one
            ret = sqliteService.d1_voucher.save({ keyId: std.genRandomStr(32), type: "200", code: user.card, userId: user.userId })

            if (ret != 0) {
                return false
            }
        }
    } else {
        // If there is no content, delete it from the database table
        sqliteService.d1_voucher.deleteByuserIdAndtype(user.userId, "200")
    }
    if (user.face) {

        let findByuserIdAndType = sqliteService.d1_voucher.findByuserIdAndType(user.userId, "300");
        if (findByuserIdAndType.length <= 0) {
            let ret = driver.face.registerFaceByPicFile(user.userId, user.face)
            log.info("2 Register face, ret:", ret)
            if (ret != 0) {
                return faceService.regErrorEnum.picture[ret + '']
            }
            // After successful registration, move the original picture to the corresponding user directory
            let src = "/app/data/user/" + user.userId + "/register.jpg"
            std.ensurePathExists(src)
            common.systemBrief('mv ' + user.face + " " + src)

            // Add a new one
            ret = sqliteService.d1_voucher.save({ keyId: std.genRandomStr(32), type: "300", code: src, userId: user.userId })
            if (ret != 0) {
                return false
            }
        } else {
            // If it existed before and new face is provided, delete the old one first, then add the new one
            if (findByuserIdAndType[0].code != user.face) {
                // Delete old face
                driver.face.delete(user.userId)
                // Register new face
                let res = driver.face.registerFaceByPicFile(user.userId, user.face)
                log.info("3 Register face, res:", res)
                if (res != 0) {
                    return faceService.regErrorEnum.picture[res + '']
                }
                let src = "/app/data/user/" + user.userId + "/register.jpg"
                std.ensurePathExists(src)
                // Move the temporary directory face to the corresponding user folder
                common.systemBrief('mv ' + user.face + " " + src)
                ret = sqliteService.d1_voucher.updatecodeAndExtraByuserIdAndtype(user.userId, "300", src, JSON.stringify({ faceType: 0 }))

            }
        }
    } else {
        // If there is no content, delete it from the database table
        sqliteService.d1_voucher.deleteByuserIdAndtype(user.userId, "300")
        driver.face.delete(user.userId)
        common.systemBrief("rm -rf /app/data/user/" + user.userId)
    }

    return true
}

// Add user
screen.insertUser = async function (user) {
    // Start handling credentials
    const saveVoucher = async (type, code) => {
        if (type == "200") {
            let cardData = sqliteService.d1_voucher.findByCodeAndType(code, "200");
            if (cardData.length > 0 && cardData[0].userId != user.userId) {
                // If it exists, cannot add, return failure
                log.info("Card duplicate");
                return "localUserAddView.failCardRepeat"
            }
        }
        // When type is "300", first call a specific method to check if the credential can be saved
        if (type === "300") {
            let preCheckResult = await preSaveCheck(code); // Assuming this is the method you mentioned needs to be called
            if (preCheckResult !== true) { // If pre-check fails, return directly
                return preCheckResult;
            }
            code = "/app/data/user/" + user.userId + "/register.jpg"
        }

        if (type == "400") {
            let pwdData = sqliteService.d1_voucher.findByCodeAndType(code, "400");
            if (pwdData.length > 0 && pwdData[0].userId != user.userId) {
                // If it exists, cannot add, return failure
                log.info("Password duplicate");
                return "localUserAddView.failPwdRepeat"
            }
        }

        let keyId = std.genRandomStr(32);

        let extra = type == 300 ? JSON.stringify({ faceType: 0 }) : JSON.stringify({})
        let voucherRet = await sqliteService.d1_voucher.save({
            keyId: keyId,
            type: type,
            code: code,
            userId: user.userId,
            extra: extra
        });

        if (voucherRet != 0) {
            // If credential saving fails, delete the saved user information and possibly other saved credentials
            await sqliteService.d1_person.deleteByUserId(user.userId);
            await sqliteService.d1_voucher.deleteByUserId(user.userId);
            return false;
        }
        return true;
    };
    async function preSaveCheck(code) {
        let ret = driver.face.registerFaceByPicFile(user.userId, code)
        log.info("1 Register face, ret:", ret)
        if (ret != 0) {
            return faceService.regErrorEnum.picture[ret + '']
        }
        // After successful registration, move the original picture to the corresponding user directory
        let src = "/app/data/user/" + user.userId + "/register.jpg"
        std.ensurePathExists(src)
        common.systemBrief('mv ' + code + " " + src)
        return true;
    }

    let success = true;
    if (success === true && user.face && !(success = await saveVoucher("300", user.face)));
    if (success === true && user.pwd && !(success = await saveVoucher("400", user.pwd)));
    if (success === true && user.card && !(success = await saveVoucher("200", user.card)));


    if (success === true) {
        //{"id":"423","userId":"423","name":"Weiguang Interconnect","idCard":"123","pwd":"251574","card":"123"}
        // Save user information
        let personRet = await sqliteService.d1_person.save({
            userId: user.userId,
            name: user.name,
            extra: JSON.stringify({ type: user.type == 1 ? 1 : 0, idCard: user.idCard })
        });
        if (personRet != 0) {
            sqliteService.d1_voucher.deleteByUserId(user.userId);
            return "localUserAddView.failRepeat"
        }
        // Add a permanent permission entry
        sqliteService.d1_permission.save({ permissionId: user.userId, userId: user.userId, timeType: 0 })
    } else {
        await sqliteService.d1_voucher.deleteByUserId(user.userId);
    }

    return success;

}

// Get local user information
screen.getVoucher = function (userId) {

    let person = sqliteService.d1_person.find({ userId: userId });

    if (person.length < 0) {
        return
    }
    let pwd_voucher = sqliteService.d1_voucher.find({ userId: userId, type: "400" })[0] || undefined
    let card_voucher = sqliteService.d1_voucher.find({ userId: userId, type: "200" })[0] || undefined
    let face_voucher = sqliteService.d1_voucher.find({ userId: userId, type: "300" })[0] || undefined
    let idCard_voucher
    try {
        idCard_voucher = JSON.parse(person[0].extra).idCard
    } catch (error) {
    }

    return {
        id: userId,
        idCard: idCard_voucher ? idCard_voucher : undefined,
        card: card_voucher ? card_voucher.code : undefined,
        pwd: pwd_voucher ? pwd_voucher.code : undefined,
        face: face_voucher ? face_voucher.code : undefined,
        type: JSON.parse(person[0].extra).type
    }

}

screen.getUsers = function (page = 0, size = 6, userId, name) {
    if (userId || name) {
        let user = sqliteService.d1_person.findByUserId(userId)[0]
        if (user) {
            user.id = user.userId
            return { data: [user], totalPage: 1, totalSize: 1, currentPage: 1 }
        }
        // User names may be duplicated
        let users = sqliteService.d1_person.findByName(name)
        if (users && users.length > 0) {
            users.map(v => {
                v.id = v.userId
            })
            function chunkArray(arr, size) {
                // If the array is empty or size is zero, return an empty array
                if (arr.length === 0 || size <= 0) {
                    return [];
                }
                const result = [];
                // Use a loop to traverse the array and slice it by size
                for (let i = 0; i < arr.length; i += size) {
                    result.push(arr.slice(i, i + size));  // slice extracts elements within the specified range
                }
                return result;
            }
            const chunkedArray = chunkArray(users, size);
            return { data: chunkedArray[page], totalPage: Math.ceil(users.length / size), totalSize: users.length, currentPage: page + 1 }
        }
        return { data: [], totalPage: 0, totalSize: 0, currentPage: 1 }
    }
    let userCount = sqliteService.d1_person.count()
    let users = sqliteService.d1_person.findOrderByUserIdAsc({ page, size })
    if (users.length > 0) {
        users.forEach(element => { element.id = element.userId });
    }
    // Total pages
    let totalPage = Math.ceil(userCount / size)
    return { data: users, totalPage: totalPage, totalSize: userCount, currentPage: page + 1 }
}

// Get access records
screen.getPassRecord = function (page = 0, size = 6) {
    let passCount = sqliteService.d1_pass_record.count()
    let datas = sqliteService.d1_pass_record.findOrderByTimeDesc({ page, size })
    // Total pages
    let totalPage = Math.ceil(passCount / size)
    return { data: datas, totalPage: totalPage, totalSize: passCount, currentPage: page + 1 }
}

// Face enrollment start, UI control
screen.faceEnterStart = function (userId) {
    dxMap.get("UI").put("faceEnterStart", userId)
    driver.face.status(1)
    driver.face.mode(1)
}

// Face enrollment end, UI control
screen.faceEnterEnd = function () {
    dxMap.get("UI").del("faceEnterStart")
    driver.face.status(0)
    // driver.face.mode(0)
}

// Get card number start UI control
screen.getCardStart = function () {
    dxMap.get("UI").put("getCardStart", true)
}

// Get card number end UI control
screen.endCardEnd = function () {
    dxMap.get("UI").del("getCardStart")
}

// Start face recognition
screen.faceRecgStart = function () {
    driver.face.status(1)
    driver.face.mode(0)
}

// Face recognition pause
screen.faceRecgPause = function () {
    driver.face.status(0)
}

// Face enrollment result
screen.faceEnterResult = function (facePic) {
    if (facePic) {
        faceEnterView.successFlag = true
        // Success, display face photo
        localUserAddView.addFace(facePic)
        dxui.loadMain(localUserAddView.screenMain)
        faceEnterView.backCb()
    } else {
        // Failure, report error
        faceEnterView.timeout()
    }
}

// Face authentication start for non-recognition page, UI control
screen.faceAuthStart = function () {
    dxMap.get("UI").put("faceAuthStart", "Y")
    driver.face.status(1)
    driver.face.mode(0)
}

// Face authentication end for non-recognition page, UI control
screen.faceAuthEnd = function () {
    dxMap.get("UI").del("faceAuthStart")
    driver.face.status(0)
}

// Face authentication result for non-recognition page
screen.faceAuthResult = function (bool) {
    if (bool) {
        // Success, enter settings menu
        driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/recg_s.wav`)
        dxui.loadMain(configView.screenMain)
    } else {
        // Failure, report error
        driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/recg_f.wav`)
        identityVerificationView.statusPanel.fail()
    }
}

// Save configuration
screen.saveConfig = function (configAll) {
    if (configAll && configAll.net) {
        // Check if both ssid and psk exist
        if (configAll.net.ssid || configAll.net.psk) {
            // Add your extra operations here
            bus.fire("setConfig", configAll)
            return true
        }
    }
    return configService.configVerifyAndSave(configAll)
}

// Get configuration
screen.getConfig = function () {
    let config1 = config.getAll()
    return config1
}

// Password access
screen.pwdAccess = function (pwd) {
    // TODO Improve access logic
    bus.fire("access", { data: { type: "400", code: pwd } })
}

// Switch network type
screen.switchNetworkType = function (data) {
    bus.fire("switchNetworkType", data)
}

// Get wifi list
screen.netGetWifiSsidList = function () {
    bus.fire("netGetWifiSsidList")
}

screen.netWifiSsidList = function (data) {
    if (data.length == 0 && config.get("net.type") == 2) {
        // Wireless network
        std.setTimeout(() => {
            screen.netGetWifiSsidList()
        }, 1000)
        return
    }
    networkSettingView.wifiListData = data
    networkSettingView.wifiList.refresh()
}

// Connect to wifi
screen.netConnectWifiSsid = function (ssid, psk) {
    return driver.net.netConnectWifiSsid(ssid, psk)
}

// Get card number
screen.getCard = function (card) {
    localUserAddView.cardBoxInput.text(card)
}

// Bus events
function busEvents() {
    // Network status
    bus.on('netStatus', (data) => {
        console.log(JSON.stringify(data));
        let type = config.get("net.type")
        if (data.connected) {
            let ip = net.getModeByCard(type).param.ip
            mainView.ipLbl.text("IP:" + ip)
            config.setAndSave("net.ip", ip)
            config.setAndSave("net.mac", net.getMacaddr(type))
            topView.ethConnectState(true, type)
            networkSettingView.netInfo[10].label.dataI18n = "networkSettingView.networkConnected"
        } else {
            topView.ethConnectState(false, type)
            networkSettingView.netInfo[10].label.dataI18n = "networkSettingView.networkUnconnected"
        }
        i18n.refreshObj(networkSettingView.netInfo[10].label)
    })
    // mqtt connection status
    bus.on('mqttStatus', (data) => {
        if (data == "connected") {
            topView.mqttConnectState(true)
        } else {
            topView.mqttConnectState(false)
        }
    })
    bus.on("beginAddFace", screen.beginAddFace)
    bus.on("faceEnterResult", screen.faceEnterResult)
    bus.on("exitIdle", screen.exitIdle)
    bus.on("netGetWifiSsidList", screen.netGetWifiSsidList)
    bus.on("getCard", screen.getCard)
    bus.on("faceAuthResult", screen.faceAuthResult)
    bus.on("accessRes", screen.accessRes)
    // bus.on("trackUpdate", screen.trackUpdate)
    bus.on("hideSn", screen.hideSn)
    bus.on("changeLanguage", screen.changeLanguage)
    bus.on("hideIp", screen.hideIp)
    bus.on("screenManagerRefresh", screen.screenManagerRefresh)
    bus.on("netWifiSsidList", screen.netWifiSsidList)
    bus.on("appMode", screen.appMode)
    bus.on("upgrade", screen.upgrade)
    // bus.on("cardReset", screen.cardReset)
    bus.on("trackResult", screen.trackResult)
}

let setTimeout
screen.cardReset = function (msg) {
    if (msg.type == 2 && msg.status == 3) {
        setTimeout = std.setTimeout(() => {
            driver.net.cardReset()
        }, 30 * 1000);
    } else {
        if (setTimeout) {
            std.clearTimeout(setTimeout)
        }
    }
}

// Start face registration
screen.beginAddFace = function (data) {
    log.info('screen.beginAddFace', JSON.stringify(data));

    if (!data.fileName) {
        return screen.faceEnterResult()
    }

    driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/recognition_s.wav`)
    faceEnterView.statusPanel.success("faceEnterView.recogSuccess")
    // Save picture locally
    let src = `/app/data/user/register.jpg`
    common.systemBrief(`mv ${data.fileName} ${src}`)
    common.systemBrief(`rm -rf /app/data/user/temp/*`)

    screen.faceEnterResult(src)
}

// Access success/failure
screen.accessRes = function (bool) {
    if (bool) {
        mainView.statusPanel.success()
    } else {
        mainView.statusPanel.fail()
    }
}

// Switch app mode
screen.appMode = function (mode) {
    if (mode == 0) {
        // Switch to standard
        mainView.menuBtnBox.show()
        if (config.get("base.showProgramCode") == 1) {
            mainView.appBtnBox.show()
            deviceInfoView.sysInfo[3].obj.show()
        } else {
            mainView.appBtnBox.hide()
            deviceInfoView.sysInfo[3].obj.hide()
        }
        if (config.get("sys.pwd") == 1) {
            mainView.pwdBtnBox.show()
        } else {
            mainView.pwdBtnBox.hide()
        }
        mainView.miniBkgBox.hide()
    } else if (mode == 1) {
        // Switch to simple mode
        mainView.miniBkgBox.show()
        if (config.get("base.showProgramCode") == 1) {
            mainView.minAppBtnImg.show()
            deviceInfoView.sysInfo[3].obj.show()
        } else {
            mainView.minAppBtnImg.hide()
            deviceInfoView.sysInfo[3].obj.hide()
        }
        if (config.get("sys.pwd") == 1) {
            mainView.minPwdBtnImg.show()
        } else {
            mainView.minPwdBtnImg.hide()
        }
        mainView.menuBtnBox.hide()
    }
}

/**
 * * @param {object} data Coordinate information
 * @param {number} id face_id, used to associate with recognition name
 * @param {bool} isLiving Whether it is liveness
 */
screen.trackUpdate = function (data, id, isLiving) {
    let item = mainView.trackFaces[0]
    for (let i = 0; i < 10; i++) {
        let ele = mainView.trackFaces[i]
        if (ele.face_id == id) {
            item = ele
            break
        }
    }
    item.face_id = id

    if (item && item.timer) {
        std.clearTimeout(item.timer)
        item.timer = null
    }

    item.timer = std.setTimeout(() => {
        item.trackFace.hide()
        // item.trackFaceName.hide()
        if (item.timer) {
            std.clearTimeout(item.timer)
            item.timer = null
        }
    }, 300)

    let edge = data.w > data.h ? data.w : data.h
    let offset = Math.abs(data.w - data.h) / 2
    item.trackFace.show()
    item.trackFace.setSize(edge, edge)
    item.trackFace.radius(edge / 2)
    if (data.w > data.h) {
        item.trackFace.setPos(data.x, data.y - offset)
    } else {
        item.trackFace.setPos(data.x - offset, data.y)
    }

    item.trackFaceName.text(" ")

    if (item.result && item.result.result === true && item.result.id == id) {
        item.trackFace.setBorderColor(viewUtils.color.success)
        let user = sqliteService.d1_person.findByUserId(item.result.userId)[0]
        item.trackFaceName.text(user ? user.name : "")
    } else if (item.result && item.result.result === false && item.result.id == id) {
        item.trackFace.setBorderColor(viewUtils.color.fail)
    } else if (isLiving) {
        item.trackFace.setBorderColor(0xf3e139)
    } else {
        item.trackFace.setBorderColor(0xffffff)
    }
}

// Authentication result
screen.trackResult = function (data) {
    for (let i = 0; i < 10; i++) {
        let ele = mainView.trackFaces[i]
        if (ele.face_id == data.id) {
            ele.result = data
            return
        }
    }
}

screen.hideSn = function (bool) {
    if (bool) {
        mainView.bottomSnBtn.show()
    } else {
        mainView.bottomSnBtn.hide()
    }
}

screen.hideIp = function (bool) {
    if (bool) {
        mainView.ipLbl.show()
    } else {
        mainView.ipLbl.hide()
    }
}

screen.hideBottomBox = function (bool) {
    if (bool) {
        mainView.bottomBox.hide()
    } else {
        mainView.bottomBox.show()
    }
}

screen.changeLanguage = function () {
    i18n.setLanguage(screen.getConfig()['base.language'])
}

screen.upgrade = function (data) {
    const { title, content } = data
    viewUtils.confirmOpen(title, content)
}

export default screen
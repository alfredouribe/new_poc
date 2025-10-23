import logger from "../../dxmodules/dxLogger.js";
import dxCommon from "../../dxmodules/dxCommon.js";
import bus from "../../dxmodules/dxEventBus.js";
import dxMap from "../../dxmodules/dxMap.js";
import driver from "../driver.js";
import config from "../../dxmodules/dxConfig.js";
import sqliteService from "./sqliteService.js";
let map = dxMap.get("LOGIN")
const faceService = {}

faceService.receiveMsg = function (data) {
    logger.info('[faceService] receiveMsg :' + JSON.stringify(data))
    // Represents screen lock and screen off
    bus.fire("exitIdle")

    switch (data.type) {
        case "register":
            // Register face
            for (let i = 0; i < data.faces.length; i++) {
                const element = data.faces[i];
                bus.fire("beginAddFace", element)
            }
            break;
        case "compare":
            // Display name, meaning face has been registered, but permission may not be valid, requires further authentication
            for (let i = 0; i < data.faces.length; i++) {
                const element = data.faces[i];
                bus.fire("trackResult", { id: element.id, result: element.result, userId: element.userId })
                if (element.result) {
                    // Face similarity verification passed
                    let ret = sqliteService.d1_person.find({ userId: element.userId })
                    if (dxMap.get("UI").get("faceAuthStart") == "Y") {
                        // Currently in face login
                        if (JSON.parse(ret[0].extra).type != 0) {
                            bus.fire("faceAuthResult", true)
                        } else {
                            bus.fire("faceAuthResult", false)
                        }
                        return
                    }

                    switch (config.get("face.voiceMode")) {
                        case 0:
                            break;
                        case 1:
                            driver.alsa.ttsPlay(ret[0].name)
                            break;
                        case 2:
                            driver.alsa.ttsPlay(config.get("face.voiceModeDate") ? config.get("face.voiceModeDate") : "Welcome") // Translated "欢迎光临" to "Welcome"
                            break;
                        default:
                            break;
                    }

                    // Access authentication handling
                    bus.fire("access", { data: { type: "300", code: element.userId }, fileName: element.fileName })
                } else {
                    // Face similarity verification failed
                    if (dxMap.get("UI").get("faceAuthStart") == "Y") {
                        bus.fire("faceAuthResult", false)
                    } else {
                        switch (config.get("face.stranger")) {
                            case 0:
                                break;
                            case 1:
                                driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/register.wav`)
                                break;
                            case 2:
                                driver.alsa.play(`/app/code/resource/${config.get("base.language") == "CN" ? "CN" : "EN"}/wav/stranger.wav`)
                                break;
                            default:
                                break;
                        }
                        bus.fire("access", { data: { type: "300", code: element.userId }, fileName: element.fileName, similarity: false })
                    }
                }
            }
            break;
        default:
            break;
    }
}

faceService.regErrorEnum = {
    "callback": {
        title: "Registration Callback Status Enum", // Translated "注册回调状态枚举"
        "-1": "faceService.contrastFailure",
        "-2": "faceService.scalingFailure",
        "-3": "faceService.failedToSavePicture",
        "-4": "faceService.convertToBase64Fail",
    },
    "feature": {
        title: "Feature Value Registration Status Enum", // Translated "特征值注册状态枚举"
        "-1": "faceService.base64DecodingFail",
        "-10": "faceService.contrastFailure",
        "-11": "faceService.similarityOverheight",
    },
    "picture": {
        title: "Picture Registration Status Enum", // Translated "图片注册状态枚举"
        "-1": "faceService.fileDoesNotExist",
        "-2": "faceService.theImageFormatIsNotSupported",
        "-3": "faceService.pictureReadFailure",
        "-4": "faceService.thePictureSizeDoesNotMatch",
        "-5": "faceService.imageParsingFailure",
        "-6": "faceService.imageYUVProcessingFailed",
        "-7": "faceService.failedToConvertJpegToImage",
        "-8": "faceService.faceInformationExtractionFailed",
        "-9": "faceService.theFaceIsNotUnique",
        "-10": "faceService.contrastFailure",
        "-11": "faceService.similarityOverheight",
    }
}

export default faceService
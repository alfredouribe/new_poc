import * as os from "os"
import common from '../../../dxmodules/dxCommon.js'
import logger from "../../../dxmodules/dxLogger.js"
const utils = {}

// Get the downloadable file size from the URL (in bytes)
utils.getUrlFileSize = function (url) {
    let actualSize = common.systemWithRes(`wget --spider -S ${url} 2>&1 | grep 'Length' | awk '{print $2}'`, 100).match(/\d+/g)
    return actualSize ? parseInt(actualSize) : 0
}
// Check if it is ""/null/undefined
utils.isEmpty = function (str) {
    return (str === "" || str === null || str === undefined)
}
/**
 * Parse string and convert it to JSON, note that the value cannot contain a " character
 * @param {string} inputString 
 * @returns 
 */
utils.parseString = function (inputString) {
    // Get {} and the content between them
    inputString = inputString.slice(inputString.indexOf("{"), inputString.lastIndexOf("}") + 1)
    // key=value regex, key is \w+ (alphanumeric underscore, case-sensitive), can have spaces around =, value is \w+ or content between two adjacent " (including ")
    const keyValueRegex = /(\w+)\s*=\s*("[^"]*"|\w+(\.\w+)?)/g;
    let jsonObject = {};
    let match;
    while ((match = keyValueRegex.exec(inputString)) !== null) {
        let key = match[1];
        let value = match[2]
        if (/^\d+$/.test(value)) {
            // Integer
            value = parseInt(value)
        } else if (/^\d+\.\d+$/.test(value)) {
            // Decimal
            value = parseFloat(value)
        } else if (value == 'true') {
            value = true
        } else if (value == 'false') {
            value = false
        } else {
            // String
            value = value.replace(/"/g, '').trim()
        }
        jsonObject[key] = value;
    }
    return jsonObject;
}

/**
 * Wait for download result, note that the timeout must not exceed the watchdog time, otherwise slow download will cause a reboot
 * @param {string} update_addr Download address
 * @param {string} downloadPath Storage path
 * @param {number} timeout Timeout
 * @param {string} update_md5 md5 checksum
 * @param {number} fileSize File size
 * @returns Download result (boolean)
 */
utils.waitDownload = function (update_addr, downloadPath, timeout, update_md5, fileSize) {
    // Delete original file
    common.systemBrief(`rm -rf "${downloadPath}"`)
    // Asynchronous download
    common.systemBrief(`wget -c "${update_addr}" -O "${downloadPath}" &`)
    let startTime = new Date().getTime()
    while (true) {
        // Calculate the size of the downloaded file
        let size = parseInt(common.systemWithRes(`file="${downloadPath}"; [ -e "$file" ] && wc -c "$file" | awk '{print $1}' || echo "0"`, 100).split(/\s/g)[0])
        // If equal, download successful
        if (size == fileSize) {
            let ret = common.md5HashFile(downloadPath)
            if (ret) {
                let md5 = ret.map(v => v.toString(16).padStart(2, '0')).join('')
                if (md5 == update_md5) {
                    // md5 checksum successful, return true
                    return true
                }
            }
            common.systemBrief(`rm -rf "${downloadPath}"`)
            // md5 checksum failed, return false
            return false
        }
        // If download times out, delete the downloaded file and reboot, stop asynchronous download continuation
        if (new Date().getTime() - startTime > timeout) {
            vf203.pwm.fail()
            common.systemBrief(`rm -rf "${downloadPath}"`)
            // Immediate reboot
            this.restart()
            return false
        }
        os.sleep(100)
    }
}
// Immediate reboot
utils.restart = function () {
    common.systemBrief("reboot -f")
}

export default utils

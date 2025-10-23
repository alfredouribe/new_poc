import log from '../../dxmodules/dxLogger.js'
import dxMap from '../../dxmodules/dxMap.js'
import accessService from '../service/accessService.js'
import config from '../../dxmodules/dxConfig.js'
import driver from '../driver.js';
const nfcService = {}

nfcService.receiveMsg = function (data) {
    // log.info('[nfcService] receiveMsg :' + JSON.stringify(data))

    // First check if it is an ID card
    if (data.card_type && data.id) {
        if (dxMap.get("UI").get("getCardStart")) {
            driver.screen.getCard(data.id)
            return
        }
        // ID card physical card number / ordinary card
        accessService.access({ type: "200", code: data.id })
    } else if (data.name && data.sex && data.idCardNo) {
        if (dxMap.get("UI").get("getCardStart")) {
            driver.screen.getCard(data.idCardNo)
            return
        }
        // Cloud ID
        accessService.access({ type: "200", code: data.idCardNo });
    }

}
export default nfcService

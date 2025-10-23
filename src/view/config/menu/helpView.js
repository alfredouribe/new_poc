import dxui from '../../../../dxmodules/dxUi.js'
import viewUtils from "../../viewUtils.js"
import topView from "../../topView.js"
import configView from '../configView.js'
import i18n from "../../i18n.js"
const helpView = {}
helpView.init = function () {
    /**************************************************创建屏幕*****************************************************/
    const screenMain = dxui.View.build('helpView', dxui.Utils.LAYER.MAIN)
    helpView.screenMain = screenMain
    screenMain.scroll(false)
    screenMain.bgColor(0xffffff)
    screenMain.on(dxui.Utils.ENUM.LV_EVENT_SCREEN_LOADED, () => {
        topView.changeTheme(true)
    })

    const titleBox = viewUtils.title(screenMain, configView.screenMain, 'helpViewTitle', 'helpView.title')
    titleBox.align(dxui.Utils.ALIGN.TOP_MID, 0, 70)

    // 二维码
    const helpQrcode = dxui.View.build('helpQrcode', screenMain)
    viewUtils._clearStyle(helpQrcode)
    helpQrcode.setSize(344, 344)
    helpQrcode.align(dxui.Utils.ALIGN.TOP_MID, 0, 170)
    helpQrcode.bgOpa(0)

    const qrcode = dxui.View.build(helpQrcode.id + 'qrcode', helpQrcode)
    viewUtils._clearStyle(qrcode)
    qrcode.setSize(320, 320)
    qrcode.align(dxui.Utils.ALIGN.CENTER, 0, 0);
    const qrcodeObj = dxui.Utils.GG.NativeBasicComponent.lvQrcodeCreate(qrcode.obj, 320, 0x000000, 0xffffff)
    dxui.Utils.GG.NativeBasicComponent.lvQrcodeUpdate(qrcodeObj, '微信暂不支持展示二维码中的文本内容')


    const helpLabel = dxui.Label.build('helpLabel', screenMain)
    helpLabel.dataI18n='helpView.scanCode'
    helpLabel.align(dxui.Utils.ALIGN.TOP_MID, 0, 541)
    helpLabel.textFont(viewUtils.font(26))
}

export default helpView

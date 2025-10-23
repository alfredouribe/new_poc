const dxDriver = {}

/*************************************Device Resource Enumeration*************************************/

/**
 * GPIO device pins
 */
dxDriver.GPIO = {

    // Relay
    RELAY0:         44,
}

/**
 * Channel communication
 */
dxDriver.CHANNEL = {

    // 485       
    UART_PATH:      "/dev/ttySLB2",

    // USBHID
	USBHID_PATH:    "/dev/hidg1",
}

/**
 * Camera related parameters
 */
dxDriver.CAPTURER = {
    // Camera image width
	RGB_WIDTH:  1280,
    // Camera image height
	RGB_HEIGHT:	800,
    // Camera device files
    RGB_PATH:  "/dev/video3",

    // Camera image width
	NIR_WIDTH:  800,
    // Camera image height
	NIR_HEIGHT:	600,
    // Camera device files
    NIR_PATH:  "/dev/video0"
}

/**
 * PWM channel
 */
dxDriver.PWM = {

    // Fill light
    WHITE_SUPPLEMENT_CHANNEL:       4,
    WHITE_SUPPLEMENT_PERIOD_NS:     255000,
    WHITE_SUPPLEMENT_DUTY:          255000 * 255 / 255,
    
    NIR_SUPPLEMENT_CHANNEL:         7,
    NIR_SUPPLEMENT_PERIOD_NS:       255000,
    NIR_SUPPLEMENT_DUTY:            255000 * 255 / 255,
}

/**
 * GPIO pin function enumeration
 */
dxDriver.GPIO_FUNC = {
	GPIO_FUNC_3:    0x03,  //0011, GPIO as function 3 / device 3
	GPIO_OUTPUT0:   0x04,  //0100, GPIO output low  level
	GPIO_OUTPUT1:   0x05  //0101, GPIO output high level
};

/**
 * Door opening button
 */
dxDriver.GPIO_KEY_OPEN = 30

/**
 * Door magnetic status
 */
dxDriver.GPIO_KEY_SEN = 48



export default dxDriver
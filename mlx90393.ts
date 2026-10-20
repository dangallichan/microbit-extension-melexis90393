// code generated for D. Gallichan by Claude, date: 20/10/26
// MakeCode extension for the Melexis MLX90393 3-axis magnetometer
// (SparkFun Qwiic breakout) on the BBC micro:bit. I2C pins: P19 = SCL, P20 = SDA.

enum MLXAddress {
    //% block="0x0C (default)"
    Addr0C = 0x0C,
    //% block="0x0D"
    Addr0D = 0x0D,
    //% block="0x0E"
    Addr0E = 0x0E,
    //% block="0x0F"
    Addr0F = 0x0F
}

enum MLXAxis {
    //% block="X"
    X = 0,
    //% block="Y"
    Y = 1,
    //% block="Z"
    Z = 2
}

// Values are the GAIN_SEL register setting (0 = highest gain / most sensitive)
enum MLXGain {
    //% block="5x"
    Gain5x = 0,
    //% block="4x"
    Gain4x = 1,
    //% block="3x"
    Gain3x = 2,
    //% block="2.5x"
    Gain2_5x = 3,
    //% block="2x"
    Gain2x = 4,
    //% block="1.67x"
    Gain1_67x = 5,
    //% block="1.33x"
    Gain1_33x = 6,
    //% block="1x (default)"
    Gain1x = 7
}

// Values are the RES register setting; each step doubles µT per count
enum MLXResolution {
    //% block="16 bit (default)"
    Bits16 = 0,
    //% block="17 bit"
    Bits17 = 1,
    //% block="18 bit"
    Bits18 = 2,
    //% block="19 bit"
    Bits19 = 3
}

//% color="#7B3FA0" weight=60 icon="\uf076" block="MLX90393"
namespace mlx90393 {
    // Sensitivity in µT/LSB at RES = 0 and HALLCONF = 0xC, indexed by GAIN_SEL (datasheet table)
    const XY_SENS = [0.751, 0.601, 0.451, 0.376, 0.300, 0.250, 0.200, 0.150]
    const Z_SENS = [1.210, 0.968, 0.726, 0.605, 0.484, 0.403, 0.323, 0.242]

    let addr = 0x0C
    let gain = 7
    let res = 0
    // The chip's reset values (DIG_FILT = 0, OSR = 0) are a prohibited mode when
    // HALLCONF = 0xC (datasheet Table 1): the conversion is too short for the hall-plate
    // spinning to cancel the offset, which gives a large baseline error.
    // Defaults here match the ESPHome driver (Adafruit uses filter 7 / OSR 3).
    let filt = 6
    let osr = 2

    let rawX = 0
    let rawY = 0
    let rawZ = 0
    let rawT = 0
    let lastStatus = 0
    let measurementOk = false

    // ---------- low-level helpers ----------

    function send(bytes: number[], readLen: number): Buffer {
        pins.i2cWriteBuffer(addr, pins.createBufferFromArray(bytes))
        return pins.i2cReadBuffer(addr, readLen)
    }

    function command(cmd: number): number {
        lastStatus = send([cmd], 1).getUint8(0)
        return lastStatus
    }

    function readReg(reg: number): number {
        let b = send([0x50, reg << 2], 3)   // RR
        lastStatus = b.getUint8(0)
        return (b.getUint8(1) << 8) | b.getUint8(2)
    }

    function writeReg(reg: number, value: number) {
        let b = send([0x60, (value >> 8) & 0xFF, value & 0xFF, reg << 2], 1)   // WR
        lastStatus = b.getUint8(0)
    }

    // Read-modify-write so factory-trimmed reserved bits are preserved
    function updateReg(reg: number, mask: number, value: number) {
        let cur = readReg(reg)
        writeReg(reg, (cur & ~mask) | (value & mask))
    }

    function applyGain() {
        // reg 0x00: bits 6:4 = GAIN_SEL, bits 3:0 = HALLCONF (0xC is the default)
        updateReg(0, 0x007F, (gain << 4) | 0x0C)
    }

    function applyReg2() {
        // reg 0x02: bits 10:9 RES_Z, 8:7 RES_Y, 6:5 RES_X, 4:2 DIG_FILT, 1:0 OSR
        updateReg(2, 0x07FF, (res << 9) | (res << 7) | (res << 5) | (filt << 2) | osr)
    }

    // Worst-case conversion time for T+X+Y+Z, in ms (with margin)
    function conversionMs(): number {
        let perChannelUs = 67 + 64 * (1 << osr) * (2 + (1 << filt))
        return Math.ceil(perChannelUs * 4 * 1.2 / 1000) + 5
    }

    function decodeAxis(b: Buffer, offset: number): number {
        // Resolutions 2 and 3 return offset-binary (unsigned) values
        if (res == 2) {
            return b.getNumber(NumberFormat.UInt16BE, offset) - 32768
        } else if (res == 3) {
            return b.getNumber(NumberFormat.UInt16BE, offset) - 16384
        }
        return b.getNumber(NumberFormat.Int16BE, offset)
    }

    // ---------- blocks ----------

    /**
     * Reset the sensor and set default settings (1x gain, 16 bit, digital filter 6,
     * oversampling 2). Run this once at the start of your program.
     */
    //% block="initialise MLX90393 at address %address"
    //% weight=100
    export function init(address: MLXAddress = MLXAddress.Addr0C) {
        addr = address
        gain = 7
        res = 0
        filt = 6
        osr = 2
        command(0x80)       // EX: exit any mode
        basic.pause(5)
        command(0xF0)       // RT: reset
        basic.pause(10)
        applyGain()
        applyReg2()
    }

    /**
     * Returns true if the sensor acknowledges on the I2C bus.
     */
    //% block="MLX90393 connected"
    //% weight=95
    export function connected(): boolean {
        return pins.i2cWriteBuffer(addr, pins.createBufferFromArray([0x00])) == 0
    }

    /**
     * Take one measurement of the magnetic field and temperature.
     * Use the field blocks afterwards to read the result.
     */
    //% block="measure MLX90393"
    //% weight=90
    export function measure() {
        command(0x3F)       // SM: single measurement T+X+Y+Z
        basic.pause(conversionMs())
        let b = send([0x4F], 9)   // RM: read measurement
        lastStatus = b.getUint8(0)
        if (lastStatus & 0x10) {  // error bit
            measurementOk = false
            return
        }
        rawT = b.getNumber(NumberFormat.UInt16BE, 1)
        rawX = decodeAxis(b, 3)
        rawY = decodeAxis(b, 5)
        rawZ = decodeAxis(b, 7)
        measurementOk = true
    }

    /**
     * True if the last measurement completed without a sensor error.
     */
    //% block="last MLX90393 measurement ok"
    //% weight=85
    export function lastMeasurementOk(): boolean {
        return measurementOk
    }

    /**
     * Magnetic field along one axis from the last measurement, in microtesla (µT).
     */
    //% block="MLX90393 field %axis (µT)"
    //% weight=80
    export function field(axis: MLXAxis): number {
        let scale = (1 << res)
        if (axis == MLXAxis.X) return rawX * XY_SENS[gain] * scale
        if (axis == MLXAxis.Y) return rawY * XY_SENS[gain] * scale
        return rawZ * Z_SENS[gain] * scale
    }

    /**
     * Raw signed counts for one axis from the last measurement.
     */
    //% block="MLX90393 raw %axis"
    //% weight=75
    //% advanced=true
    export function raw(axis: MLXAxis): number {
        if (axis == MLXAxis.X) return rawX
        if (axis == MLXAxis.Y) return rawY
        return rawZ
    }

    /**
     * Total field strength |B| from the last measurement, in microtesla (µT).
     */
    //% block="MLX90393 field strength (µT)"
    //% weight=70
    export function magnitude(): number {
        let x = field(MLXAxis.X)
        let y = field(MLXAxis.Y)
        let z = field(MLXAxis.Z)
        return Math.sqrt(x * x + y * y + z * z)
    }

    /**
     * Sensor die temperature from the last measurement, in °C (approximate).
     */
    //% block="MLX90393 temperature (°C)"
    //% weight=65
    export function temperature(): number {
        return 25 + (rawT - 46244) / 45.2
    }

    /**
     * Write x, y and z (in µT) to the serial port as name:value lines,
     * which the MakeCode console graph plots directly.
     */
    //% block="plot MLX90393 field to serial"
    //% weight=60
    export function plotToSerial() {
        serial.writeValue("x", Math.round(field(MLXAxis.X) * 100) / 100)
        serial.writeValue("y", Math.round(field(MLXAxis.Y) * 100) / 100)
        serial.writeValue("z", Math.round(field(MLXAxis.Z) * 100) / 100)
    }

    // ---------- settings ----------

    /**
     * Set the sensor gain. Higher gain = finer resolution but smaller range.
     */
    //% block="set MLX90393 gain to %g"
    //% group="Settings" weight=50
    export function setGain(g: MLXGain) {
        gain = g
        applyGain()
    }

    /**
     * Set the ADC resolution for all axes. Each extra bit doubles the range per count.
     */
    //% block="set MLX90393 resolution to %r"
    //% group="Settings" weight=49
    export function setResolution(r: MLXResolution) {
        res = r
        applyReg2()
    }

    /**
     * Set the digital filter (0-7). Higher values reduce noise and offset error but slow
     * measurements. Low filter plus low oversampling is a prohibited mode on this sensor.
     */
    //% block="set MLX90393 digital filter to %f"
    //% f.min=0 f.max=7 f.defl=6
    //% group="Settings" weight=48
    export function setFilter(f: number) {
        filt = Math.constrain(f, 0, 7)
        applyReg2()
    }

    /**
     * Set the oversampling ratio (0-3). Higher values reduce noise and offset error but slow
     * measurements. Low filter plus low oversampling is a prohibited mode on this sensor.
     */
    //% block="set MLX90393 oversampling to %o"
    //% o.min=0 o.max=3 o.defl=2
    //% group="Settings" weight=47
    export function setOversampling(o: number) {
        osr = Math.constrain(o, 0, 3)
        applyReg2()
    }
}

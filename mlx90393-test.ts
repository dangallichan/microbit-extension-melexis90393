// code generated for D. Gallichan by Claude, date: 20/10/26
// MLX90393 extension test program (micro:bit, MakeCode)
//
// On start-up it calibrates (if CALIBRATE_ON_START is true): after a 3 s countdown,
// slowly rotate the sensor through all orientations until the progress bar fills.
//
// Controls:   A = next gain          B = next resolution
//             A+B = recalibrate      touch P1 (and hold GND) = next digital filter
//             touch P2 (and hold GND) = next oversampling
//
// Serial output (open "Show console Device"):
//   x, y, z  field in µT (plotted)        b  total field strength in µT (plotted)
//   lines starting with "#" are status messages (settings, calibration, temperature)

const ADDRESS = MLXAddress.Addr0C   // change if you've moved the A0/A1 solder jumpers
const PLOT_RAW = false              // true = also plot raw counts for X, Y, Z
const SAMPLE_PAUSE_MS = 50
const CALIBRATE_ON_START = true
const CALIBRATION_SECONDS = 15

const GAIN_NAMES = ["5x", "4x", "3x", "2.5x", "2x", "1.67x", "1.33x", "1x"]
const RES_NAMES = ["16 bit", "17 bit", "18 bit", "19 bit"]

let gainIdx = 7        // 1x, the sensor default
let resIdx = 0         // 16 bit
let filterIdx = 6      // matches the extension defaults
let osrIdx = 2
let settingsChanged = false
let calibrateRequested = CALIBRATE_ON_START
let busy = false       // true while calibrating: ignore buttons and touches
let sampleCount = 0

function round2(v: number): number {
    return Math.round(v * 100) / 100
}

// Settings are applied from the main loop (not the button handlers)
// so they never interleave with a measurement on the I2C bus.
function applySettings() {
    mlx90393.setGain(gainIdx)
    mlx90393.setResolution(resIdx)
    mlx90393.setFilter(filterIdx)
    mlx90393.setOversampling(osrIdx)
    // The extension raises combinations the sensor doesn't permit (filter 0 with OSR 0 or 1,
    // filter 1 with OSR 0), so read back what is really in use.
    filterIdx = mlx90393.digitalFilter()
    osrIdx = mlx90393.oversamplingSetting()
    serial.writeLine("# gain " + GAIN_NAMES[gainIdx]
        + " | " + RES_NAMES[resIdx]
        + " | filter " + filterIdx
        + " | oversampling " + osrIdx)
    settingsChanged = false
}

function runCalibration() {
    busy = true
    serial.writeLine("# calibrating in 3 s: rotate the sensor slowly through all orientations")
    for (let i = 3; i > 0; i--) {
        basic.showNumber(i)
        basic.pause(300)
    }
    basic.clearScreen()
    mlx90393.calibrate(CALIBRATION_SECONDS)
    if (mlx90393.calibrationOk()) {
        serial.writeLine("# calibration done")
        // copy these two lines into your own program to reuse the calibration
        serial.writeLine("mlx90393.setOffsets("
            + round2(mlx90393.calibrationOffset(MLXAxis.X)) + ", "
            + round2(mlx90393.calibrationOffset(MLXAxis.Y)) + ", "
            + round2(mlx90393.calibrationOffset(MLXAxis.Z)) + ")")
        serial.writeLine("mlx90393.setScales("
            + round2(mlx90393.calibrationScale(MLXAxis.X)) + ", "
            + round2(mlx90393.calibrationScale(MLXAxis.Y)) + ", "
            + round2(mlx90393.calibrationScale(MLXAxis.Z)) + ")")
        basic.showIcon(IconNames.Yes)
    } else {
        serial.writeLine("# calibration FAILED: not enough movement on every axis, try again")
        basic.showIcon(IconNames.No)
    }
    basic.pause(800)
    basic.clearScreen()
    calibrateRequested = false
    busy = false
}

input.onButtonPressed(Button.A, function () {
    if (busy) return
    gainIdx = (gainIdx + 1) % 8
    settingsChanged = true
    basic.showNumber(gainIdx)
})

input.onButtonPressed(Button.B, function () {
    if (busy) return
    resIdx = (resIdx + 1) % 4
    settingsChanged = true
    basic.showNumber(resIdx)
})

input.onButtonPressed(Button.AB, function () {
    if (busy) return
    calibrateRequested = true
})

input.onPinPressed(TouchPin.P1, function () {
    if (busy) return
    filterIdx = (filterIdx + 1) % 8
    settingsChanged = true
    basic.showNumber(filterIdx)
})

input.onPinPressed(TouchPin.P2, function () {
    if (busy) return
    osrIdx = (osrIdx + 1) % 4
    settingsChanged = true
    basic.showNumber(osrIdx)
})

// ---------- start-up ----------

mlx90393.init(ADDRESS)
if (mlx90393.connected()) {
    basic.showIcon(IconNames.Yes)
    serial.writeLine("# MLX90393 found")
} else {
    basic.showIcon(IconNames.No)
    serial.writeLine("# MLX90393 NOT found - check wiring (SDA = P20, SCL = P19) and address")
}
basic.pause(800)
basic.clearScreen()
serial.writeLine("# A = gain, B = resolution, A+B = recalibrate, P1 = filter, P2 = oversampling")

// ---------- main loop ----------

basic.forever(function () {
    if (calibrateRequested) {
        runCalibration()
    }
    if (settingsChanged) {
        applySettings()
    }

    mlx90393.measure()

    if (mlx90393.lastMeasurementOk()) {
        mlx90393.plotToSerial()                                   // x, y, z in µT (calibrated)
        serial.writeValue("b", round2(mlx90393.magnitude()))      // |B| in µT
        if (PLOT_RAW) {
            serial.writeValue("rawx", mlx90393.raw(MLXAxis.X))
            serial.writeValue("rawy", mlx90393.raw(MLXAxis.Y))
            serial.writeValue("rawz", mlx90393.raw(MLXAxis.Z))
        }
        sampleCount += 1
        if (sampleCount % 40 == 0) {
            serial.writeLine("# die temperature " + Math.round(mlx90393.temperature()) + " C")
        }
        // a single LED as a heartbeat so you can see it's running
        led.toggle(0, 0)
    } else {
        serial.writeLine("# measurement error")
        basic.showIcon(IconNames.No)
    }

    basic.pause(SAMPLE_PAUSE_MS)
})

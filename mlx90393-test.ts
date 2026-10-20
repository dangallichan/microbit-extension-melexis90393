// code generated for D. Gallichan by Claude, date: 20/10/26
// MLX90393 extension test program (micro:bit, MakeCode)
//
// Controls:   A = next gain      B = next resolution
//             A+B = next digital filter      Shake = next oversampling
//
// Serial output (open "Show console Device"):
//   x, y, z  field in µT (plotted)        b  total field strength in µT (plotted)
//   lines starting with "#" are status messages (setting changes, temperature)

const ADDRESS = MLXAddress.Addr0C   // change if you've moved the A0/A1 solder jumpers
const PLOT_RAW = false              // true = also plot raw counts for X, Y, Z
const SAMPLE_PAUSE_MS = 50

const GAIN_NAMES = ["5x", "4x", "3x", "2.5x", "2x", "1.67x", "1.33x", "1x"]
const RES_NAMES = ["16 bit", "17 bit", "18 bit", "19 bit"]

let gainIdx = 7        // 1x, the sensor default
let resIdx = 0         // 16 bit
let filterIdx = 6      // matches the extension defaults (filter 0 + OSR 0 is a prohibited mode)
let osrIdx = 2
let settingsChanged = false
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
    serial.writeLine("# gain " + GAIN_NAMES[gainIdx]
        + " | " + RES_NAMES[resIdx]
        + " | filter " + filterIdx
        + " | oversampling " + osrIdx)
    settingsChanged = false
}

input.onButtonPressed(Button.A, function () {
    gainIdx = (gainIdx + 1) % 8
    settingsChanged = true
    basic.showNumber(gainIdx)
})

input.onButtonPressed(Button.B, function () {
    resIdx = (resIdx + 1) % 4
    settingsChanged = true
    basic.showNumber(resIdx)
})

input.onButtonPressed(Button.AB, function () {
    filterIdx = (filterIdx + 1) % 8
    settingsChanged = true
    basic.showNumber(filterIdx)
})

input.onGesture(Gesture.Shake, function () {
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
serial.writeLine("# A = gain, B = resolution, A+B = filter, shake = oversampling")

// ---------- main loop ----------

basic.forever(function () {
    if (settingsChanged) {
        applySettings()
    }

    mlx90393.measure()

    if (mlx90393.lastMeasurementOk()) {
        mlx90393.plotToSerial()                                   // x, y, z in µT
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

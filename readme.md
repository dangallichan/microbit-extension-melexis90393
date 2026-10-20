# MLX90393 magnetometer

MakeCode extension for the Melexis MLX90393 3-axis magnetometer, e.g. the SparkFun Qwiic breakout, on the BBC micro:bit.

Built by Claude for D.Gallichan, 20/10/26 - and as such not everything is tested fully!

## Wiring

| Qwiic wire | micro:bit pin |
|---|---|
| Black (GND) | GND |
| Red (3.3V) | 3V |
| Blue (SDA) | P20 |
| Yellow (SCL) | P19 |

The default I2C address is 0x0C. The A0/A1 solder jumpers select 0x0D, 0x0E or 0x0F.

## Usage

```typescript
mlx90393.init()
basic.forever(function () {
    mlx90393.measure()
    mlx90393.plotToSerial()
    basic.pause(50)
})
```

`measure` takes one reading. The `field` blocks then return values in microtesla (µT), and `plotToSerial` writes `x`, `y` and `z` as `name:value` lines that the MakeCode console graph plots directly.

## Calibration

Every magnetometer reads a little off zero, and nearby metal and magnets add fixed fields of their own. Calibrate to remove these:

1. Run `calibrate MLX90393 for 15 s`.
2. While the progress bar fills, slowly rotate the sensor through as many orientations as you can (a figure-eight in the air works well), away from magnets, speakers and metal.

The extension records the minimum and maximum of each axis, sets each offset to the midpoint and scales the axes to equal range. After calibrating, the total field strength should stay near a constant value (about 49 µT in the UK) whichever way the sensor points. `MLX90393 calibration succeeded` is false if any axis moved less than 20 µT, in which case the old calibration is kept. The advanced blocks let you read the offsets and scales and set them again later (`set MLX90393 offsets` and `set MLX90393 scales`), so you don't have to recalibrate every time.

Calibrate with the sensor mounted where it will be used, because the parts around it change the local field. The datasheet allows the sensor's own zero offset to drift with temperature (up to ±1000 counts over the full temperature range, which is about ±150 µT at the default gain, and mostly at the extremes) and its sensitivity by ±3 %. If the temperature changes a lot, recalibrate.

## Settings

Call `initialise MLX90393` first, then change any of these. `initialise` always puts them back to the defaults shown. Gain and resolution set the measurement range and step size. Digital filter and oversampling trade **noise against speed**.

### Gain

Gain sets how many µT each count of the reading represents, and therefore the measurable range. Figures are for 16 bit resolution at the default hall configuration:

| Gain label | µT per count (X/Y) | µT per count (Z) | Approx. range (X/Y) |
|---|---|---|---|
| 5x | 0.751 | 1.210 | ±24,600 µT |
| 4x | 0.601 | 0.968 | ±19,700 µT |
| 3x | 0.451 | 0.726 | ±14,800 µT |
| 2.5x | 0.376 | 0.605 | ±12,300 µT |
| 2x | 0.300 | 0.484 | ±9,800 µT |
| 1.67x | 0.250 | 0.403 | ±8,200 µT |
| 1.33x | 0.200 | 0.323 | ±6,600 µT |
| **1x (default)** | **0.150** | **0.242** | **±4,900 µT** |

The labels follow the naming used by the Adafruit driver (the datasheet itself only gives the setting number 0 to 7), and they read the opposite way round to what you might expect: **1x is the most sensitive setting** (finest steps, narrowest range) and **5x is the least sensitive** (coarsest steps, widest range). The Earth's field (about 50 µT) is only a few hundred counts at 1x, so keep the default for compass-style use and move towards 5x only if you are measuring strong magnets and the readings saturate.

### Resolution

Every reading is a 16-bit number, but the sensor's converter is wider (about 17 bits). The resolution setting chooses which 16-bit slice of it you get, so each step **doubles the µT per count**:

| Setting | µT per count (X/Y, 1x gain) | Output range | Approx. range (X/Y, 1x gain) |
|---|---|---|---|
| **16 bit (default)** | 0.150 | ±32768 counts | ±4,900 µT |
| 17 bit | 0.300 | ±32768 counts | ±9,800 µT |
| 18 bit | 0.601 | ±22000 counts | ±13,200 µT |
| 19 bit | 1.202 | ±11000 counts | ±13,200 µT |

Keep 16 bit unless the readings are clipping. At 18 and 19 bit the sensor sends unsigned values with an offset, which the extension converts back to signed values for you. The resolution is the same for all three axes.

### Digital filter (0 to 7, default 6)

The sensor measures each axis with a converter followed by a digital filter. The filter setting chooses how long that filter is, and so how long each conversion takes. A **higher value gives a lower-noise reading but a slower one**: the conversion time contains a factor of (2 + 2^filter), which is 3 at filter 0, 10 at filter 3 and 130 at filter 7.

### Oversampling (0 to 3, default 2)

The oversampling ratio is how many times the sensor repeats each conversion and averages them (the conversion time contains a factor of 2^oversampling, so ×1, ×2, ×4 or ×8). Like the filter, a higher value gives a lower-noise reading and takes longer.

### Conversion time

The time to convert **one axis** is `67 µs + 64 µs × 2^oversampling × (2 + 2^filter)`. A measurement reads X, Y, Z and temperature. The datasheet gives these typical total times in milliseconds (Table 19, section 16.2.5):

| Filter | OSR 0 | OSR 1 | OSR 2 | OSR 3 |
|---|---|---|---|---|
| 0 | ✗ 1.27 | ✗ 1.84 | 3.00 | 5.30 |
| 1 | ✗ 1.46 | 2.23 | 3.76 | 6.84 |
| 2 | 1.84 | 3.00 | 5.30 | 9.91 |
| 3 | 2.61 | 4.53 | 8.37 | 16.05 |
| 4 | 4.15 | 7.60 | 14.52 | 28.34 |
| 5 | 7.22 | 13.75 | 26.80 | 52.92 |
| 6 | 13.36 | 26.04 | **51.38** | 102.07 |
| 7 | 25.65 | 50.61 | 100.53 | 200.37 |

The extension waits a little longer than this after starting each measurement (62 ms at the defaults), and retries the read if the sensor reports the data isn't ready yet. With the 50 ms pause in the examples above, the defaults give about 9 readings a second and filter 7 with oversampling 3 gives about 3 a second.

### Prohibited combinations

The sensor's default hall plate spinning mode limits how short a conversion can be, so the datasheet does not permit three combinations (marked ✗ in the table): **filter 0 with oversampling 0 or 1, and filter 1 with oversampling 0**. The chip's own power-on values are filter 0 and oversampling 0, one of the prohibited pairs. In testing with those values the total field strength read about 630 µT instead of about 50 µT. This is why the extension sets filter 6 and oversampling 2 at start-up, and why it raises a prohibited pair you ask for to the nearest permitted one (`MLX90393 digital filter setting` and `MLX90393 oversampling setting`, under Advanced, report what is really in use).

### How much noise to expect

In the datasheet's noise graphs (gain 1x, 16 bit) the points for different oversampling values fall on essentially the same curve. So **noise is set mainly by the total conversion time**, however you split it between filter and oversampling. Approximate RMS noise read off those graphs:

| Typical conversion time | X/Y noise | Z noise |
|---|---|---|
| 1.3 ms | 5 µT | 8 µT |
| 4 ms | 1.6 µT | 2.5 µT |
| 14 ms | 0.8 µT | 1.2 µT |
| 51 ms | 0.4 µT | 0.65 µT |
| 200 ms | 0.2 µT | 0.4 µT |

### Choosing settings

| Goal | Filter | Oversampling | Typical conversion | X/Y noise (approx.) |
|---|---|---|---|---|
| Lowest noise | 7 | 3 | 200 ms | 0.2 µT |
| Balanced (default) | 6 | 2 | 51 ms | 0.4 µT |
| Faster | 4 | 1 | 7.6 ms | 1.1 µT |
| Fastest permitted | 2 | 0 | 1.8 ms | 3 µT |

For checking a compass-style field of about 49 µT, the default has far lower noise than you need. If the readings wander by tens of µT, the cause is almost certainly an uncalibrated offset or a nearby magnet or piece of metal, not noise, so calibrate first. Lower the settings if you need more readings a second, and raise them if you need a steadier reading.

## Supported targets

* for PXT/microbit

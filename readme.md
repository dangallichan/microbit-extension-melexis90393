# MLX90393 magnetometer

MakeCode extension for the Melexis MLX90393 3-axis magnetometer, e.g. the SparkFun Qwiic breakout, on the BBC micro:bit.

Built by Claude for D.Gallichan, 20/10/26

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

`measure` takes one reading. The `field` blocks then return values in microtesla, and `plotToSerial` writes `x`, `y` and `z` as `name:value` lines that the MakeCode console graph plots directly.

## Settings

Gain, resolution, digital filter and oversampling can be changed after `init`. Field values are scaled using the datasheet sensitivity table for the chosen gain and resolution (assuming the default HALLCONF of 0xC).

## Supported targets

* for PXT/microbit

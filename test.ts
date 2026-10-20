// code generated for D. Gallichan by Claude, date: 20/10/26
// Test program for the MLX90393 extension: plots x, y, z (in µT) to the serial console

mlx90393.init()
basic.forever(function () {
    mlx90393.measure()
    mlx90393.plotToSerial()
    basic.pause(50)
})

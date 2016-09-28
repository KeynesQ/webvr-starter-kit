/**
 * Make noisy
 * @author KeynesQ
 * @since 20160922
 */
onmessage = function (e) {
    var dstData = e.data[0],
        dstBuff = dstData.data,
        srcBuff = e.data[1],
        w = e.data[2],
        h = e.data[3],
        mix = 0.6;
    var weights =  [0, -1, 0,  -1, 5, -1,  0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        y = h, x;
    while(y) {

        x = w;

        while(x) {

            var sy = y,
                sx = x,
                dstOff = (y * w + x) * 4,
                r = 0, g = 0, b = 0, a = 0;

            for (var cy = 0; cy < katet; cy++) {
                for (var cx = 0; cx < katet; cx++) {

                    var scy = sy + cy - half;
                    var scx = sx + cx - half;

                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {

                        var srcOff = (scy * w + scx) * 4;
                        var wt = weights[cy * katet + cx];

                        r += srcBuff[srcOff] * wt;
                        g += srcBuff[srcOff + 1] * wt;
                        b += srcBuff[srcOff + 2] * wt;
                        a += srcBuff[srcOff + 3] * wt;
                    }
                }
            }

            if (w - x > 8) {
                dstBuff[dstOff] = r * mix + srcBuff[dstOff] * (1 - mix);
                dstBuff[dstOff + 1] = g * mix + srcBuff[dstOff + 1] * (1 - mix);
                dstBuff[dstOff + 2] = b * mix + srcBuff[dstOff + 2] * (1 - mix);
                dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
            } else {
                dstBuff[dstOff] = srcBuff[dstOff];
                dstBuff[dstOff + 1] = srcBuff[dstOff + 1];
                dstBuff[dstOff + 2] = srcBuff[dstOff + 2];
                dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
            }
            x --;
        }
        y --;
    }
    postMessage([dstData]);
}

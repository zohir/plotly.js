/**
* Copyright 2012-2021, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = {
    colormodel: {
        // min and max define the numerical range accepted in CSS
        // If z(min|max)Dflt are not defined, z(min|max) will default to min/max
        rgb: {
            min: [0, 0, 0],
            max: [255, 255, 255],
            fmt: function(c) {return c.slice(0, 3);},
            suffix: ['', '', '']
        },
        rgba: {
            min: [0, 0, 0, 0],
            max: [255, 255, 255, 1],
            fmt: function(c) {return c.slice(0, 4);},
            suffix: ['', '', '', '']
        },
        rgba256: {
            colormodel: 'rgba', // because rgba256 is not an accept colormodel in CSS
            zminDflt: [0, 0, 0, 0],
            zmaxDflt: [255, 255, 255, 255],
            min: [0, 0, 0, 0],
            max: [255, 255, 255, 1],
            fmt: function(c) {return c.slice(0, 4);},
            suffix: ['', '', '', '']
        },
        hsl: {
            min: [0, 0, 0],
            max: [360, 100, 100],
            fmt: function(c) {
                var p = c.slice(0, 3);
                p[1] = p[1] + '%';
                p[2] = p[2] + '%';
                return p;
            },
            suffix: ['°', '%', '%']
        },
        hsla: {
            min: [0, 0, 0, 0],
            max: [360, 100, 100, 1],
            fmt: function(c) {
                var p = c.slice(0, 4);
                p[1] = p[1] + '%';
                p[2] = p[2] + '%';
                return p;
            },
            suffix: ['°', '%', '%', '']
        }
    },
    // For pixelated image rendering
    // http://phrogz.net/tmp/canvas_image_zoom.html
    // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
    pixelatedStyle: [
        'image-rendering: optimizeSpeed',
        'image-rendering: -moz-crisp-edges',
        'image-rendering: -o-crisp-edges',
        'image-rendering: -webkit-optimize-contrast',
        'image-rendering: optimize-contrast',
        'image-rendering: crisp-edges',
        'image-rendering: pixelated',
        ''
    ].join('; ')
};

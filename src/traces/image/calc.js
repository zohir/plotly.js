/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

// var Registry = require('../../registry');
// var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');

module.exports = function calc(gd, trace) {
    var xa = Axes.getFromId(gd, trace.xaxis || 'x');
    var ya = Axes.getFromId(gd, trace.yaxis || 'y');

    var x = trace.x - trace.xscale / 2;
    var y = trace.y + trace.yscale / 2;
    var h = trace.z.length;
    var w = trace.z[0].length;

    trace._extremes[xa._id] = Axes.findExtremes(xa, [x, x + w * trace.xscale]);
    trace._extremes[ya._id] = Axes.findExtremes(ya, [y, y - h * trace.yscale]);

    var cd0 = {
        x: x,
        y: y,
        z: trace.z,
        w: w,
        h: h
    };
    return [cd0];
};

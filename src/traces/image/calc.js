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

    var x = trace.x;
    var y = trace.y;
    var w = trace.z.length;
    var h = trace.z[0].length;

    // xa.makeCalcdata(trace, 'x');
    // ya.makeCalcdata(trace, 'y');

    trace._extremes[xa._id] = Axes.findExtremes(xa, [x, x + w]);
    trace._extremes[ya._id] = Axes.findExtremes(ya, [y, y - h]);

    var cd0 = {
        x: x,
        y: y,
        z: trace.z,
        w: w,
        h: h
    };
    return [cd0];
};

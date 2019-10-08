/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Fx = require('../../components/fx');
var Lib = require('../../lib');
// var Axes = require('../../plots/cartesian/axes');

module.exports = function hoverPoints(pointData, xval, yval) {
    var cd0 = pointData.cd[0];
    var trace = cd0.trace;
    var xa = pointData.xa;
    var ya = pointData.ya;

    if(Fx.inbox(xval - cd0.x, xval - (cd0.x + cd0.w * trace.xscale), 0) > 0 ||
            Fx.inbox(yval - cd0.y, yval - (cd0.y - cd0.h * trace.yscale), 0) > 0) {
        return;
    }

    // Find nearest pixel's index and pixel center
    var nx = Math.floor((xval - cd0.x) / trace.xscale);
    var ny = Math.floor(Math.abs(yval - cd0.y) / trace.yscale);

    var py = ya.c2p(cd0.y - (ny + 0.5) * trace.yscale);
    return [Lib.extendFlat(pointData, {
        index: [ny, nx], // FIXME
        x0: xa.c2p(cd0.x + nx * trace.xscale),
        x1: xa.c2p(cd0.x + (nx + 1) * trace.xscale),
        y0: py,
        y1: py,
    })];
};

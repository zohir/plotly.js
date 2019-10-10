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

    if(Fx.inbox(xval - cd0.x0, xval - (cd0.x0 + cd0.w * trace.dx), 0) > 0 ||
            Fx.inbox(yval - cd0.y0, yval - (cd0.y0 - cd0.h * trace.dy), 0) > 0) {
        return;
    }

    // Find nearest pixel's index and pixel center
    var nx = Math.floor((xval - cd0.x0) / trace.dx);
    var ny = Math.floor(Math.abs(yval - cd0.y0) / trace.dy);

    var py = ya.c2p(cd0.y0 - (ny + 0.5) * trace.dy);
    return [Lib.extendFlat(pointData, {
        index: [ny, nx], // FIXME
        x0: xa.c2p(cd0.x0 + nx * trace.dx),
        x1: xa.c2p(cd0.x0 + (nx + 1) * trace.dx),
        y0: py,
        y1: py,
    })];
};

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
    var xa = pointData.xa;
    var ya = pointData.ya;

    if(Fx.inbox(xval - cd0.x, xval - (cd0.x + cd0.w), 0) > 0 ||
            Fx.inbox(yval - cd0.y, yval - (cd0.y - cd0.h), 0) > 0) {
        return;
    }

    // Find nearest pixel's index and pixel center
    var nx = Math.floor(xval - cd0.x);
    var ny = Math.floor(Math.abs(yval - cd0.y));

    var px = xa.c2p(cd0.x + (nx + 0.5));
    var py = ya.c2p(cd0.y - (ny + 0.5));

    return [Lib.extendFlat(pointData, {
        index: [ny, nx], // FIXME
        x0: px,
        x1: px,
        y0: py,
        y1: py,
    })];

    // return [Lib.extendFlat(pointData, {
    //     index: [ny, nx],
    //     // never let a 2D override 1D type as closest point
    //     distance: pointData.maxHoverDistance,
    //     spikeDistance: pointData.maxSpikeDistance,
    //     x0: x0,
    //     x1: x1,
    //     y0: y0,
    //     y1: y1,
    //     xLabelVal: xl,
    //     yLabelVal: yl,
    //     zLabelVal: zVal,
    //     zLabel: zLabel,
    //     text: text
    // })];
};

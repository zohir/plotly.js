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

module.exports = function hoverPoints(pointData, xval, yval, hovermode, hoverLayer) {
    var cd0 = pointData.cd[0];
    var trace = cd0.trace;
    var xa = pointData.xa;
    var ya = pointData.ya;

    if(Fx.inbox(xval - cd0.x, xval - (cd0.x + cd0.w), 0) > 0 ||
            Fx.inbox(yval - cd0.y, yval - (cd0.y - cd0.h), 0) > 0) {
        return;
    }

    return [Lib.extendFlat(pointData, {
        index: [Math.round(xval - cd0.x), Math.abs(Math.round(yval - cd0.y))], // FIXME
        x0: xa.c2p(xval),
        x1: xa.c2p(xval + 1),
        y0: ya.c2p(yval),
        y1: ya.c2p(yval + 1),
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

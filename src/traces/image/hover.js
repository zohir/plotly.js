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
var Axes = require('../../plots/cartesian/axes');
var extractOpts = require('../../components/colorscale').extractOpts;

module.exports = function hoverPoints(pointData, xval, yval, hovermode, hoverLayer, contour) {
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

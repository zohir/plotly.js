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
var attributes = require('./attributes');
// var Axes = require('../../plots/cartesian/axes');

module.exports = function hoverPoints(pointData, xval, yval) {
    var cd0 = pointData.cd[0];
    var trace = cd0.trace;
    var xa = pointData.xa;
    var ya = pointData.ya;

    // Return early if not on image
    if(Fx.inbox(xval - cd0.x0, xval - (cd0.x0 + cd0.w * trace.dx), 0) > 0 ||
            Fx.inbox(yval - cd0.y0, yval - (cd0.y0 + cd0.h * trace.dy), 0) > 0) {
        return;
    }
    var ht;
    if(!trace.hovertemplate) {
        var colormodel = trace.colormodel;
        var dims = colormodel.length;
        var hoverinfo = cd0.hi || trace.hoverinfo;
        var parts = hoverinfo.split('+');

        ht = [];
        if(parts.indexOf('all') !== -1) parts = attributes.hoverinfo.flags;
        if(parts.indexOf('x') !== -1) ht.push('x: %{x}');
        if(parts.indexOf('y') !== -1) ht.push('y: %{y}');
        if(parts.indexOf('z') !== -1) ht.push('z: [%{z[0]}, %{z[1]}, %{z[2]}' + (dims === 4 ? ', %{z[3]}' : '') + ']');
        if(parts.indexOf('color') !== -1) {
            var colorstring = [];
            colorstring.push('<span style="text-transform:uppercase">%{colormodel}</span>: ');
            if(colormodel === 'hsl' || colormodel === 'hsla') {
                colorstring.push('[%{c[0]}°, %{c[1]}%, %{c[2]}%' + (dims === 4 ? ', %{c[3]}' : '') + ']');
            } else {
                colorstring.push('[%{c[0]}, %{c[1]}, %{c[2]}' + (dims === 4 ? ', %{c[3]}' : '') + ']');
            }
            ht.push(colorstring.join(''));
        }
        ht = ht.join('<br>');
    }

    // Find nearest pixel's index and pixel center
    var nx = Math.floor((xval - cd0.x0) / trace.dx);
    var ny = Math.floor(Math.abs(yval - cd0.y0) / trace.dy);

    var py = ya.c2p(cd0.y0 + (ny + 0.5) * trace.dy);
    return [Lib.extendFlat(pointData, {
        index: [ny, nx],
        x0: xa.c2p(cd0.x0 + nx * trace.dx),
        x1: xa.c2p(cd0.x0 + (nx + 1) * trace.dx),
        y0: py,
        y1: py,
        hovertemplate: ht
    })];
};

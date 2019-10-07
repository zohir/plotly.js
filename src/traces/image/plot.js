/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';
var d3 = require('d3');
var Lib = require('../../lib');
var xmlnsNamespaces = require('../../constants/xmlns_namespaces');

module.exports = function(gd, plotinfo, cdimage, imageLayer) {
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    Lib.makeTraceGroups(imageLayer, cdimage, 'hm').each(function(cd) {
        var plotGroup = d3.select(this);
        var cd0 = cd[0];
        var trace = cd0.trace;

        var x = cd0.x;
        var y = cd0.y;
        var z = cd0.z;
        var w = cd0.w;
        var h = cd0.h;
        var tupleLength = trace.colormodel.length;
        var left = xa.c2p(x);
        var right = xa.c2p(x + w);
        var top = ya.c2p(y);
        var bottom = ya.c2p(y + h);

        // TODO: do not draw image if it's out of range

        var imageWidth = Math.round(right - left);
        var imageHeight = Math.round(top - bottom);

        var canvas = document.createElement('canvas');
        canvas.width = cd0.w;
        canvas.height = cd0.h;
        var context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        for(var i = 0; i < cd0.w - 1; i++) {
            for(var j = 0; j < cd0.h - 1; j++) {
                context.fillStyle = trace.colormodel + '(' + z[i][j].slice(0, tupleLength).join(',') + ')';
                context.fillRect(j, i, 1, 1);
            }
        }

        var image3 = plotGroup.selectAll('image')
            .data(cd);

        image3.enter().append('svg:image').attr({
            xmlns: xmlnsNamespaces.svg,
            preserveAspectRatio: 'none'
        });

        image3.attr({
            height: imageHeight,
            width: imageWidth,
            x: left,
            y: top,
            'xlink:href': canvas.toDataURL('image/png')
        });

        image3.style({
            imageRendering: 'pixelated'
        });
    });
};

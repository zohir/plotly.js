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
var constants = require('./constants');

module.exports = function(gd, plotinfo, cdimage, imageLayer) {
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    Lib.makeTraceGroups(imageLayer, cdimage, 'im').each(function(cd) {
        var plotGroup = d3.select(this);
        var cd0 = cd[0];
        var trace = cd0.trace;

        var z = cd0.z;
        var tupleLength = trace.colormodel.length;
        var x0 = cd0.x0;
        var y0 = cd0.y0;
        var w = cd0.w;
        var h = cd0.h;
        var dx = trace.dx;
        var dy = trace.dy;
        var left = xa.c2p(x0);
        var right = xa.c2p(x0 + w * dx);
        var top = ya.c2p(y0);
        var bottom = ya.c2p(y0 + h * dy);

        var temp;
        if(right < left) {
            temp = right;
            right = left;
            left = temp;
        }

        if(bottom < top) {
            temp = top;
            top = bottom;
            bottom = temp;
        }

        // Reduce image size when zoomed in to save memory
        var extra = 0.5; // half the axis size
        left = Math.max(-extra * xa._length, left);
        right = Math.min((1 + extra) * xa._length, right);
        top = Math.max(-extra * ya._length, top);
        bottom = Math.min((1 + extra) * ya._length, bottom);
        var imageWidth = Math.round(right - left);
        var imageHeight = Math.round(bottom - top);

        // if image is entirely off-screen, don't even draw it
        var isOffScreen = (imageWidth <= 0 || imageHeight <= 0);
        if(isOffScreen) {
            var noImage = plotGroup.selectAll('image').data([]);
            noImage.exit().remove();
            return;
        }

        // Draw each pixel
        var canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        var context = canvas.getContext('2d');
        var ipx = function(i) {return Lib.constrain(Math.round(xa.c2p(x0 + i * dx) - left), 0, imageWidth);};
        var jpx = function(j) {return Lib.constrain(Math.round(ya.c2p(y0 + j * dy) - top), 0, imageHeight);};

        // Check which channel needs to be scaled
        var cr = constants.colormodel[trace.colormodel];
        var scale = [];
        var k;
        for(k = 0; k < tupleLength; k++) {
            if(cr.min[k] !== trace.zmin[k] || cr.max[k] !== trace.zmax[k]) {
                scale.push([k, (cr.max[k] - cr.min[k]) / (trace.zmax[k] - trace.zmin[k])]);
            }
        }

        // TODO: for performance, when image size is reduced, only loop over pixels of interest
        var c = []; var ch;
        for(var i = 0; i < cd0.w; i++) {
            for(var j = 0; j < cd0.h; j++) {
                c = z[j][i];
                for(k = 0; k < scale.length; k++) {
                    ch = scale[k][0];
                    c[ch] = (c[ch] - trace.zmin[ch]) * scale[k][1];
                    c[ch] = Lib.constrain(c[ch], cr.min[k], cr.max[k]);
                }
                context.fillStyle = trace.colormodel + '(' + cr.fmt(c).join(',') + ')';
                context.fillRect(ipx(i), jpx(j), ipx(i + 1) - ipx(i), jpx(j + 1) - jpx(j));
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
    });
};

// var canvas = document.createElement('canvas');
// canvas.width = cd0.w;
// canvas.height = cd0.h;
// var context = canvas.getContext('2d');
// for(var i = 0; i < cd0.w; i++) {
//     for(var j = 0; j < cd0.h; j++) {
//         context.fillStyle = trace.colormodel + '(' + z[j][i].slice(0, tupleLength).join(',') + ')';
//         context.fillRect(i, j, 1, 1);
//     }
// }
//
// TODO: support additional smoothing options
// https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
// http://phrogz.net/tmp/canvas_image_zoom.html
// image3
 // .attr('style', 'image-rendering: optimizeSpeed; image-rendering: -o-crisp-edges; image-rendering: -webkit-optimize-contrast; image-rendering: optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated;');

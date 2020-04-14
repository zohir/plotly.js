/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var Registry = require('../../registry');


function activateShape(gd, path, drawShapes) {
    var element = path.node();
    var id = +element.getAttribute('data-index');

    for(var q = 0; q < gd._fullLayout.shapes.length; q++) {
        var shapeIn = gd._fullLayout.shapes[q]._input;
        if(q === id && shapeIn.activable) {
            gd._fullLayout._activeShapeIndex = q;
            break;
        }
    }

    if(gd._fullLayout._activeShapeIndex >= 0) {
        drawShapes(gd);
    }
}

function eraseActiveShape(gd) {
    clearOutlineControllers(gd);

    var id = gd._fullLayout._activeShapeIndex;
    if(id >= 0) {
        var shapes = [];
        for(var q = 0; q < gd._fullLayout.shapes.length; q++) {
            var shapeIn = gd._fullLayout.shapes[q]._input;

            if(q !== id) {
                shapes.push(shapeIn);
            }
        }

        delete gd._fullLayout._activeShapeIndex;

        Registry.call('relayout', gd, {
            shapes: shapes
        });
    }
}

function clearOutlineControllers(gd) {
    var zoomLayer = gd._fullLayout._zoomlayer;
    if(zoomLayer) {
        zoomLayer.selectAll('.outline-controllers').remove();
    }
}

function clearSelect(gd) {
    clearOutlineControllers(gd);

    var zoomLayer = gd._fullLayout._zoomlayer;
    if(zoomLayer) {
        // until we get around to persistent selections, remove the outline
        // here. The selection itself will be removed when the plot redraws
        // at the end.
        zoomLayer.selectAll('.select-outline').remove();
    }

    gd._fullLayout._drawing = false;
}

module.exports = {
    activateShape: activateShape,
    eraseActiveShape: eraseActiveShape,
    clearOutlineControllers: clearOutlineControllers,
    clearSelect: clearSelect
};

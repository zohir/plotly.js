/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

module.exports = function clearSelect(gd) {
    var zoomLayer = gd._fullLayout._zoomlayer;
    if(zoomLayer) {
        zoomLayer.selectAll('.outline-controllers').remove();

        // until we get around to persistent selections, remove the outline
        // here. The selection itself will be removed when the plot redraws
        // at the end.
        zoomLayer.selectAll('.select-outline').remove();
    }

    gd._fullLayout._drawing = false;
};

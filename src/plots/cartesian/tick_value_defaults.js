/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var cleanTicks = require('./clean_ticks');

module.exports = function handleTickValueDefaults(containerIn, containerOut, coerce, axType, options) {
    function read(attr) {
        return containerIn[attr] || ((options || {}).axTemplate || {})[attr];
    }

    var _tick0 = read('tick0');
    var _dtick = read('dtick');
    var _tickvals = read('tickvals');
    var _tickmode = read('tickmode');
    var tickmode;

    if(_tickmode === 'array' &&
            (axType === 'log' || axType === 'date')) {
        tickmode = containerOut.tickmode = 'auto';
    } else {
        var tickmodeDefault = Array.isArray(_tickvals) ? 'array' :
            _dtick ? 'linear' :
            'auto';
        tickmode = coerce('tickmode', tickmodeDefault);
    }

    if(tickmode === 'auto') coerce('nticks');
    else if(tickmode === 'linear') {
        // dtick is usually a positive number, but there are some
        // special strings available for log or date axes
        // tick0 also has special logic
        var dtick = containerOut.dtick = cleanTicks.dtick(
            _dtick, axType);
        containerOut.tick0 = cleanTicks.tick0(
            _tick0, axType, containerOut.calendar, dtick);
    } else if(axType !== 'multicategory') {
        var tickvals = coerce('tickvals');
        if(tickvals === undefined) containerOut.tickmode = 'auto';
        else coerce('ticktext');
    }
};

/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = function eventData(out, pt) {
    out.colormodel = pt.trace.colormodel;
    var cd0 = pt.cd[0];
    var trace = cd0.trace;
    out.x = trace.x0 + trace.dx * pt.index[1];
    out.y = trace.y0 + trace.dy * pt.index[0];
    out.c = trace._scaler(cd0.z[pt.index[0]][pt.index[1]]);
    return out;
};

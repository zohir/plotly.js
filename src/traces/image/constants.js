/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

module.exports = {
    colormodel: {
        'rgb': [[0, 0, 0], [255, 255, 255], function(c) {return c.slice(0, 3);}],
        'rgba': [[0, 0, 0, 0], [255, 255, 255, 1], function(c) {return c.slice(0, 4);}],
        'hsl': [[0, 0, 0], [360, 100, 100], function(c) {
            c[1] = c[1] + '%';
            c[2] = c[2] + '%';
            return c.slice(0, 3);
        }],
        'hsla': [[0, 0, 0, 0], [360, 100, 100, 1], function(c) {
            c[1] = c[1] + '%';
            c[2] = c[2] + '%';
            return c.slice(0, 4);
        }]
    }
};

/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = {
    attributes: require('./attributes'),
    supplyDefaults: require('./defaults'),
    calc: require('./calc'),
    plot: require('./plot'),
    // colorbar: require('./colorbar'),
    style: require('./style'),
    hoverPoints: require('./hover'),

    moduleType: 'trace',
    name: 'image',
    basePlotModule: require('../../plots/cartesian'),
    categories: ['cartesian', 'svg', '2dMap'],
    animatable: false,
    meta: {
        description: [
        ].join(' ')
    }
};

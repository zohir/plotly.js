/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Plotly = require('./core');

// traces
Plotly.register([
    require('./bar'),
    require('./box'),
    require('./heatmap'),
    require('./histogram'),
    require('./scatterpolar')
]);

Plotly.register([
    require('./aggregate'),
    require('./filter'),
    require('./groupby'),
    require('./sort')
]);

module.exports = Plotly;

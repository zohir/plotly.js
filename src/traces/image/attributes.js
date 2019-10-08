/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var hovertemplateAttrs = require('../../plots/template_attributes').hovertemplateAttrs;
var extendFlat = require('../../lib/extend').extendFlat;

module.exports = extendFlat({
    z: {
        valType: 'data_array',
        role: 'info',
        editType: 'calc',
        // TODO: add description
        description: 'Values from 0 to 255'
    },
    x: {
        valType: 'number',
        dflt: 0,
        role: 'info',
        editType: 'plot',
        description: 'Set the image\'s x position'
    },
    y: {
        valType: 'number',
        dflt: 0,
        role: 'info',
        editType: 'plot',
        description: 'Set the image\'s y position'
    },
    // xscale: {
    //     valType: 'number',
    //     dflt: 1,
    //     editType: 'plot',
    //     description: 'Set the pixel horizontal size'
    // },
    // yscale: {
    //     valType: 'number',
    //     dflt: 1,
    //     editType: 'plot',
    //     description: 'Set the pixel vertical size'
    // },
    colormodel: {
        valType: 'enumerated',
        values: ['rgb', 'rgba', 'hsl', 'hsla'],
        dflt: 'rgb',
        role: 'info',
        editType: 'calc',
        description: 'Color model'
    },
    transpose: {
        valType: 'boolean',
        dflt: false,
        role: 'info',
        editType: 'calc',
        description: 'Transposes the z data.'
    },
    hovertemplate: hovertemplateAttrs({
        dflt: '<span style="text-transform:uppercase">%{colormodel}</span>: [%{z[0]}, %{z[1]}, %{z[2]}]'
    })
});

var Plotly = require('@lib/index');
var Lib = require('@src/lib');

var Image = require('@src/traces/image');

var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
// var supplyAllDefaults = require('../assets/supply_defaults');
var failTest = require('../assets/fail_test');

var customAssertions = require('../assets/custom_assertions');
var assertHoverLabelContent = customAssertions.assertHoverLabelContent;
var Fx = require('@src/components/fx');

// describe('image supplyDefaults', function() {
//     'use strict';
//
//     var traceIn;
//     var traceOut;
//
//     var layout = {
//         _subplots: {cartesian: ['xy'], xaxis: ['x'], yaxis: ['y']}
//     };
//
//     var supplyDefaults = Image.supplyDefaults;
//
//     beforeEach(function() {
//         traceOut = {};
//     });
//
//     it('should set visible to false when z is empty', function() {
//         traceIn = {
//             z: []
//         };
//         supplyDefaults(traceIn, traceOut);
//         expect(traceOut.visible).toBe(false);
//
//         traceIn = {
//             z: [[]]
//         };
//         supplyDefaults(traceIn, traceOut);
//         expect(traceOut.visible).toBe(false);
//
//         traceIn = {
//             z: [[], [], []]
//         };
//         supplyDefaults(traceIn, traceOut);
//         expect(traceOut.visible).toBe(false);
//
//         traceIn = {
//             type: 'image',
//             z: [[[255, 0, 0]]]
//         };
//         traceOut = Plots.supplyTraceDefaults(traceIn, {type: 'image'}, 0, layout);
//         expect(traceOut.visible).toBe(true);
//     });
//
//     it('should set visible to false when z is non-numeric', function() {
//         traceIn = {
//             type: 'heatmap',
//             z: [['a', 'b'], ['c', 'd']]
//         };
//         supplyDefaults(traceIn, traceOut, defaultColor, layout);
//         expect(traceOut.visible).toBe(false);
//     });
//
//     it('should set visible to false when z isn\'t column not a 2d array', function() {
//         traceIn = {
//             x: [1, 1, 1, 2, 2],
//             y: [1, 2, 3, 1, 2],
//             z: [1, ['this is considered a column'], 1, 2, 3]
//         };
//         supplyDefaults(traceIn, traceOut, defaultColor, layout);
//         expect(traceOut.visible).not.toBe(false);
//
//         traceIn = {
//             x: [1, 1, 1, 2, 2],
//             y: [1, 2, 3, 1, 2],
//             z: [[0], ['this is not considered a column'], 1, ['nor 2d']]
//         };
//         supplyDefaults(traceIn, traceOut, defaultColor, layout);
//         expect(traceOut.visible).toBe(false);
//     });
// });
//
// describe('image calc', function() {
//     'use strict';
//
//     function _calc(opts, layout) {
//         var base = { type: 'image' };
//         var trace = Lib.extendFlat({}, base, opts);
//         var gd = { data: [trace] };
//         if(layout) gd.layout = layout;
//
//         supplyAllDefaults(gd);
//         var fullTrace = gd._fullData[0];
//         var fullLayout = gd._fullLayout;
//
//         fullTrace._extremes = {};
//
//         // we used to call ax.setScale during supplyDefaults, and this had a
//         // fallback to provide _categories and _categoriesMap. Now neither of
//         // those is true... anyway the right way to do this though is
//         // ax.clearCalc.
//         fullLayout.xaxis.clearCalc();
//         fullLayout.yaxis.clearCalc();
//
//         var out = Image.calc(gd, fullTrace)[0];
//
//         return out;
//     }
// });

describe('image plot', function() {
    'use strict';

    var gd;

    beforeEach(function() {
        gd = createGraphDiv();
    });

    afterEach(destroyGraphDiv);

    it('should not draw traces that are off-screen', function(done) {
        var mock = require('@mocks/image_adventurer.json');
        var mockCopy = Lib.extendDeep({}, mock);

        function assertImageCnt(cnt) {
            var images = d3.selectAll('.im image');

            expect(images.size()).toEqual(cnt);
        }

        Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(function() {
            assertImageCnt(1);

            return Plotly.relayout(gd, 'xaxis.range', [-100, -50]);
        }).then(function() {
            assertImageCnt(0);

            return Plotly.relayout(gd, 'xaxis.autorange', true);
        }).then(function() {
            assertImageCnt(1);
        })
        .catch(failTest)
        .then(done);
    });

    [['dx', 2, 4], ['dy', 2, 4], ['z[5][5]', [[0, 0, 0, 1]], [[255, 0, 0, 1]]]].forEach(function(test) {
        var attr = test[0];
        it('should be able to restyle ' + attr, function(done) {
            var mock = require('@mocks/image_adventurer.json');
            var mockCopy = Lib.extendDeep({}, mock);

            function getImageURL() {
                return d3.select('.im > image').attr('href');
            }

            var imageURLs = [];

            Plotly.plot(gd, mockCopy).then(function() {
                imageURLs.push(getImageURL());

                return Plotly.restyle(gd, attr, test[1]);
            }).then(function() {
                imageURLs.push(getImageURL());

                expect(imageURLs[0]).not.toEqual(imageURLs[1]);

                return Plotly.restyle(gd, attr, test[2]);
            }).then(function() {
                imageURLs.push(getImageURL());

                expect(imageURLs[1]).not.toEqual(imageURLs[2]);

                return Plotly.restyle(gd, attr, test[1]);
            }).then(function() {
                imageURLs.push(getImageURL());

                expect(imageURLs[1]).toEqual(imageURLs[3]);
            })
            .catch(failTest)
            .then(done);
        });
    });

    // it('keeps the correct ordering after hide and show', function(done) {
    //     function getIndices() {
    //         var out = [];
    //         d3.selectAll('.im image').each(function(d) { out.push(d.trace.index); });
    //         return out;
    //     }
    //
    //     Plotly.newPlot(gd, [{
    //         type: 'heatmap',
    //         z: [[1, 2], [3, 4]]
    //     }, {
    //         type: 'heatmap',
    //         z: [[2, 1], [4, 3]],
    //         contours: {coloring: 'lines'}
    //     }])
    //     .then(function() {
    //         expect(getIndices()).toEqual([0, 1]);
    //         return Plotly.restyle(gd, 'visible', false, [0]);
    //     })
    //     .then(function() {
    //         expect(getIndices()).toEqual([1]);
    //         return Plotly.restyle(gd, 'visible', true, [0]);
    //     })
    //     .then(function() {
    //         expect(getIndices()).toEqual([0, 1]);
    //     })
    //     .catch(failTest)
    //     .then(done);
    // });
});

describe('image hover', function() {
    'use strict';

    var gd;

    describe('for `image_cat`', function() {
        beforeAll(function(done) {
            gd = createGraphDiv();

            var mock = require('@mocks/image_cat.json');
            var mockCopy = Lib.extendDeep({}, mock);

            Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(done);
        });

        afterAll(destroyGraphDiv);

        function _hover(gd, xval, yval) {
            var fullLayout = gd._fullLayout;
            var calcData = gd.calcdata;
            var hoverData = [];

            for(var i = 0; i < calcData.length; i++) {
                var pointData = {
                    index: false,
                    distance: 20,
                    cd: calcData[i],
                    trace: calcData[i][0].trace,
                    xa: fullLayout.xaxis,
                    ya: fullLayout.yaxis
                };

                var hoverPoint = Image.hoverPoints(pointData, xval, yval);
                if(hoverPoint) hoverData.push(hoverPoint[0]);
            }

            return hoverData;
        }

        it('should find closest point (case 1) and should', function() {
            var pt = _hover(gd, 0, 0)[0];
            expect(pt.index).toEqual([0, 0], 'have correct index');
        });

        it('should find closest point (case 2) and should', function() {
            var pt = _hover(gd, 50, 0)[0];
            expect(pt.index).toEqual([0, 50], 'have correct index');
        });
    });

    describe('for `image_adventurer`', function() {
        var mock = require('@mocks/image_adventurer.json');
        beforeAll(function() {
            gd = createGraphDiv();
        });

        afterAll(destroyGraphDiv);

        function _hover(x, y) {
            var evt = { xpx: x, ypx: y };
            return Fx.hover('graph', evt, 'xy');
        }

        it('should display RGB channel values', function(done) {
            var mockCopy = Lib.extendDeep({}, mock);
            mockCopy.data[0].colormodel = 'rgb';
            Plotly.newPlot(gd, mockCopy)
            .then(function() {_hover(205, 125);})
            .then(function() {
                assertHoverLabelContent({
                    nums: '<tspan style="text-transform:uppercase">rgb</tspan>: [54, 136, 153]',
                    name: 'trace 0'
                });
            })
            .catch(failTest)
            .then(done);
        });

        it('should display RGBA channel values', function(done) {
            var mockCopy = Lib.extendDeep({}, mock);
            Plotly.newPlot(gd, mockCopy)
            .then(function() {_hover(255, 295);})
            .then(function() {
                assertHoverLabelContent({
                    nums: '<tspan style="text-transform:uppercase">rgba</tspan>: [128, 77, 54, 254]',
                    name: 'trace 0'
                });
            })
            .catch(failTest)
            .then(done);
        });
    });
});

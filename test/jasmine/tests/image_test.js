var Plotly = require('@lib/index');
var Plots = require('@src/plots/plots');
var Lib = require('@src/lib');

var Image = require('@src/traces/image');

var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var failTest = require('../assets/fail_test');

var customAssertions = require('../assets/custom_assertions');
var assertHoverLabelContent = customAssertions.assertHoverLabelContent;
var Fx = require('@src/components/fx');
// var mouseEvent = require('../assets/mouse_event');

describe('image supplyDefaults', function() {
    'use strict';

    var traceIn;
    var traceOut;

    var layout = {
        _subplots: {cartesian: ['xy'], xaxis: ['x'], yaxis: ['y']}
    };

    var supplyDefaults = Image.supplyDefaults;

    beforeEach(function() {
        traceOut = {};
    });

    it('should set visible to false when z is empty', function() {
        traceIn = {
            z: []
        };
        supplyDefaults(traceIn, traceOut);
        expect(traceOut.visible).toBe(false);

        traceIn = {
            z: [[]]
        };
        supplyDefaults(traceIn, traceOut);
        expect(traceOut.visible).toBe(false);

        traceIn = {
            z: [[], [], []]
        };
        supplyDefaults(traceIn, traceOut);
        expect(traceOut.visible).toBe(false);

        traceIn = {
            type: 'image',
            z: [[[255, 0, 0]]]
        };
        traceOut = Plots.supplyTraceDefaults(traceIn, {type: 'image'}, 0, layout);
        expect(traceOut.visible).toBe(true);
    });

    it('should set proper zmin/zmax depending on colormodel', function() {
        var tests = [
          ['rgb', [0, 0, 0], [255, 255, 255]],
          ['rgba', [0, 0, 0, 0], [255, 255, 255, 1]],
          ['hsl', [0, 0, 0], [360, 100, 100]],
          ['hsla', [0, 0, 0, 0], [360, 100, 100, 1]]
        ];

        expect(tests.map(function(t) {return t[0];})).toEqual(Image.attributes.colormodel.values, 'zmin/zmax test coverage');

        tests.forEach(function(test) {
            traceIn = {
                z: [[[1, 1, 1, 1]]],
                colormodel: test[0]
            };
            supplyDefaults(traceIn, traceOut);
            expect(traceOut.zmin).toEqual(test[1], 'default zmin for ' + test[0]);
            expect(traceOut.zmax).toEqual(test[2], 'default zmax for ' + test[0]);
            supplyDefaults(traceIn, traceOut);
        });
    });
});
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

    function getImageURL() {
        return d3.select('.im > image').attr('href');
    }

    [['dx', 2, 4], ['dy', 2, 4], ['z[5][5]', [[0, 0, 0, 1]], [[255, 0, 0, 1]]]].forEach(function(test) {
        var attr = test[0];
        it('should be able to restyle ' + attr, function(done) {
            var mock = require('@mocks/image_adventurer.json');
            var mockCopy = Lib.extendDeep({}, mock);

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

    it('should rescale pixels according to zmin/zmax', function(done) {
        var imageURLs = [];
        Plotly.newPlot(gd, [{
            type: 'image',
            z: [[[255, 0, 0], [0, 255, 0], [0, 0, 255]]]
        }]).then(function() {
            imageURLs.push(getImageURL());

            return Plotly.restyle(gd, {
                z: [[[[1.5, 0, 0], [0, 1.5, 0], [0, 0, 1.5]]]],
                zmin: [[0.5, 0.5, 0.5]],
                zmax: [[1.5, 1.5, 1.5]],
            });
        }).then(function() {
            imageURLs.push(getImageURL());
            expect(imageURLs[1]).toEqual(imageURLs[0]);

            return Plotly.restyle(gd, {
                z: [[[[50, 0, 0], [0, 50, 0], [0, 0, 50]]]]
            });
        }).then(function() {
            imageURLs.push(getImageURL());
            expect(imageURLs[2]).toEqual(imageURLs[1]);
        })
        .catch(failTest)
        .then(done);
    });

    it('keeps the correct ordering after hide and show', function(done) {
        function getIndices() {
            var out = [];
            d3.selectAll('.im image').each(function(d) { out.push(d.trace.index); });
            return out;
        }

        Plotly.newPlot(gd, [{
            type: 'image',
            z: [[[1, 2], [3, 4]]]
        }, {
            type: 'image',
            z: [[[2, 1], [4, 3]]],
            contours: {coloring: 'lines'}
        }])
        .then(function() {
            expect(getIndices()).toEqual([0, 1]);
            return Plotly.restyle(gd, 'visible', false, [0]);
        })
        .then(function() {
            expect(getIndices()).toEqual([1]);
            return Plotly.restyle(gd, 'visible', true, [0]);
        })
        .then(function() {
            expect(getIndices()).toEqual([0, 1]);
        })
        .catch(failTest)
        .then(done);
    });
});

describe('image hover:', function() {
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
                    nums: 'z: [54, 136, 153]\n<tspan style="text-transform:uppercase">rgb</tspan>: [54, 136, 153]',
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
                    nums: 'z: [128, 77, 54, 254]\n<tspan style="text-transform:uppercase">rgba</tspan>: [128, 77, 54, 1]',
                    name: 'trace 0'
                });
            })
            .catch(failTest)
            .then(done);
        });

        it('should display HSL channel values', function(done) {
            var mockCopy = Lib.extendDeep({}, mock);
            mockCopy.data[0].colormodel = 'hsl';
            Plotly.newPlot(gd, mockCopy)
            .then(function() {_hover(255, 295);})
            .then(function() {
                assertHoverLabelContent({
                    nums: 'z: [128, 77, 54]\n<tspan style="text-transform:uppercase">hsl</tspan>: [128°, 77%, 54%]',
                    name: 'trace 0'
                });
            })
            .catch(failTest)
            .then(done);
        });

        it('should display HSLA channel values', function(done) {
            var mockCopy = Lib.extendDeep({}, mock);
            mockCopy.data[0].colormodel = 'hsla';
            Plotly.newPlot(gd, mockCopy)
            .then(function() {_hover(255, 295);})
            .then(function() {
                assertHoverLabelContent({
                    nums: 'z: [128, 77, 54, 254]\n<tspan style="text-transform:uppercase">hsla</tspan>: [128°, 77%, 54%, 1]',
                    name: 'trace 0'
                });
            })
            .catch(failTest)
            .then(done);
        });
    });
});

// describe('image hover/click event data:', function() {
//     var gd;
//     var mock = require('@mocks/image_adventurer.json');
//
//     beforeEach(function() {
//         gd = createGraphDiv();
//     });
//
//     afterEach(destroyGraphDiv);
//
//     function _makeWrapper(eventType, mouseFn) {
//         var posByElementType = {
//             node: [404, 302],
//             link: [450, 300]
//         };
//
//         return function(elType) {
//             return new Promise(function(resolve, reject) {
//                 gd.once(eventType, function(d) {
//                     Lib.clearThrottle();
//                     resolve(d);
//                 });
//
//                 mouseFn(posByElementType[elType]);
//                 setTimeout(function() {
//                     reject(eventType + ' did not get called!');
//                 }, 100);
//             });
//         };
//     }
//
//     var _hover = _makeWrapper('plotly_hover', function(pos) {
//         mouseEvent('mouseover', pos[0], pos[1]);
//     });
//
//     var _click = _makeWrapper('plotly_click', function(pos) {
//         mouseEvent('click', pos[0], pos[1]);
//     });
//
//     var _unhover = _makeWrapper('plotly_unhover', function(pos) {
//         mouseEvent('mouseover', pos[0], pos[1]);
//         mouseEvent('mouseout', pos[0], pos[1]);
//     });
//
//     function _assert(d, expectedPtData) {
//         expect(d.event).toBeDefined('original event reference');
//
//         var ptData = d.points[0];
//         Object.keys(expectedPtData).forEach(function(k) {
//             expect(ptData[k]).toBe(expectedPtData[k], 'point data for ' + k);
//         });
//     }
//
//     it('should output correct click event data', function(done) {
//         var fig = Lib.extendDeep({}, mock);
//
//         Plotly.plot(gd, fig)
//         .then(function() { return _click('node'); })
//         .then(function(d) {
//             _assert(d, {
//                 curveNumber: 0,
//                 pointNumber: 4,
//                 label: 'Solid'
//             });
//         })
//         .catch(failTest)
//         .then(done);
//     });
//
//     it('should output correct hover/unhover event data', function(done) {
//         var fig = Lib.extendDeep({}, mock);
//
//         Plotly.plot(gd, fig)
//         .then(function() { return Plotly.restyle(gd, 'hoverinfo', 'none'); })
//         .then(function() { return _hover('node'); })
//         .then(function(d) {
//             _assert(d, {
//                 curveNumber: 0,
//                 pointNumber: 4,
//                 label: 'Solid',
//                 value: 447.48
//             });
//             var pt = d.points[0];
//             expect(pt.sourceLinks.length).toBe(3);
//             expect(pt.targetLinks.length).toBe(4);
//         })
//         .then(function() { return _unhover('node'); })
//         .then(function(d) {
//             _assert(d, {
//                 curveNumber: 0,
//                 pointNumber: 4,
//                 label: 'Solid'
//             });
//         })
//         .catch(failTest)
//         .then(done);
//     });
//
//     function assertNoHoverEvents(type) {
//         return function() {
//             return Promise.resolve()
//             .then(function() { return _hover(type); })
//             .then(failTest).catch(function(err) {
//                 expect(err).toBe('plotly_hover did not get called!');
//             })
//             .then(function() { return _unhover(type); })
//             .then(failTest).catch(function(err) {
//                 expect(err).toBe('plotly_unhover did not get called!');
//             });
//         };
//     }
//
//     it('should not output hover/unhover event data when hovermode is false', function(done) {
//         var fig = Lib.extendDeep({}, mock);
//
//         Plotly.plot(gd, fig)
//         .then(function() { return Plotly.relayout(gd, 'hovermode', false); })
//         .then(assertNoHoverEvents('node'))
//         .catch(failTest)
//         .then(done);
//     });
//
//     it('should not output hover/unhover event data when trace hoverinfo is skip', function(done) {
//         var fig = Lib.extendDeep({}, mock);
//
//         Plotly.plot(gd, fig)
//         .then(function() { return Plotly.restyle(gd, 'hoverinfo', 'skip'); })
//         .then(assertNoHoverEvents('node'))
//         .catch(failTest)
//         .then(done);
//     });
// });

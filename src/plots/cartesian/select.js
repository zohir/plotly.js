/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var polybool = require('polybooljs');

var Registry = require('../../registry');
var dragElement = require('../../components/dragelement');
var dashStyle = require('../../components/drawing').dashStyle;
var Color = require('../../components/color');
var Fx = require('../../components/fx');
var makeEventData = require('../../components/fx/helpers').makeEventData;
var dragHelpers = require('../../components/dragelement/helpers');
var freeMode = dragHelpers.freeMode;
var rectMode = dragHelpers.rectMode;
var drawMode = dragHelpers.drawMode;
var openMode = dragHelpers.openMode;
var selectMode = dragHelpers.selectMode;

var Lib = require('../../lib');
var polygon = require('../../lib/polygon');
var throttle = require('../../lib/throttle');
var setCursor = require('../../lib/setcursor');
var getFromId = require('./axis_ids').getFromId;
var clearGlCanvases = require('../../lib/clear_gl_canvases');

var redrawReglTraces = require('../../plot_api/subroutines').redrawReglTraces;

var constants = require('./constants');
var MINSELECT = constants.MINSELECT;
var CIRCLE_SIDES = 32; // should be divisible by 8
var SQRT2 = Math.sqrt(2);

var filteredPolygon = polygon.filter;
var polygonTester = polygon.tester;

function getAxId(ax) { return ax._id; }

// in v2 (once log ranges are fixed),
// we'll be able to p2r here for all axis types
function p2r(ax, v) {
    switch(ax.type) {
        case 'log':
            return ax.p2d(v);
        case 'date':
            return ax.p2r(v, 0, ax.calendar);
        default:
            return ax.p2r(v);
    }
}

function axValue(ax) {
    var index = (ax._id.charAt(0) === 'y') ? 1 : 0;
    return function(v) { return p2r(ax, v[index]); };
}

function getTransform(plotinfo) {
    return 'translate(' +
        plotinfo.xaxis._offset + ',' +
        plotinfo.yaxis._offset + ')';
}

function prepSelect(e, startX, startY, dragOptions, mode) {
    var isFreeMode = freeMode(mode);
    var isRectMode = rectMode(mode);
    var isOpenMode = openMode(mode);
    var isDrawMode = drawMode(mode);
    var isSelectMode = selectMode(mode);

    var isLine = mode === 'linedraw';
    var isEllipse = mode === 'ellipsedraw';
    var isLineOrEllipse = isLine || isEllipse; // cases with two start & end positions

    var gd = dragOptions.gd;
    var fullLayout = gd._fullLayout;
    var zoomLayer = fullLayout._zoomlayer;
    var dragBBox = dragOptions.element.getBoundingClientRect();
    var plotinfo = dragOptions.plotinfo;
    var transform = getTransform(plotinfo);
    var x0 = startX - dragBBox.left;
    var y0 = startY - dragBBox.top;
    var x1 = x0;
    var y1 = y0;
    var path0 = 'M' + x0 + ',' + y0;
    var pw = dragOptions.xaxes[0]._length;
    var ph = dragOptions.yaxes[0]._length;
    var allAxes = dragOptions.xaxes.concat(dragOptions.yaxes);
    var subtract = e.altKey &&
        !(drawMode(mode) && isOpenMode);

    var filterPoly, selectionTester, mergedPolygons, currentPolygon;
    var i, searchInfo, eventData;

    coerceSelectionsCache(e, gd, dragOptions);

    if(isFreeMode) {
        filterPoly = filteredPolygon([[x0, y0]], constants.BENDPX);
    }

    var outlines = zoomLayer.selectAll('path.select-outline-' + plotinfo.id).data(isDrawMode ? [0] : [1, 2]);
    var drwStyle = fullLayout.newshape;

    outlines.enter()
        .append('path')
        .attr('class', function(d) { return 'select-outline select-outline-' + d + ' select-outline-' + plotinfo.id; })
        .style(isDrawMode ? {
            opacity: drwStyle.opacity / 2,
            fill: isOpenMode ? undefined : drwStyle.fillcolor,
            stroke: drwStyle.line.color,
            'stroke-dasharray': dashStyle(drwStyle.line.dash, drwStyle.line.width),
            'stroke-width': drwStyle.line.width + 'px'
        } : {})
        .attr('fill-rule', drwStyle.fillrule)
        .classed('cursor-move', isDrawMode ? true : false)
        .attr('transform', transform)
        .attr('d', path0 + 'Z');

    var corners = zoomLayer.append('path')
        .attr('class', 'zoombox-corners')
        .style({
            fill: Color.background,
            stroke: Color.defaultLine,
            'stroke-width': 1
        })
        .attr('transform', transform)
        .attr('d', 'M0,0Z');


    var throttleID = fullLayout._uid + constants.SELECTID;
    var selection = [];

    // find the traces to search for selection points
    var searchTraces = determineSearchTraces(gd, dragOptions.xaxes,
      dragOptions.yaxes, dragOptions.subplot);

    function ascending(a, b) { return a - b; }

    // allow subplots to override fillRangeItems routine
    var fillRangeItems;

    if(plotinfo.fillRangeItems) {
        fillRangeItems = plotinfo.fillRangeItems;
    } else {
        if(isRectMode) {
            fillRangeItems = function(eventData, poly) {
                var ranges = eventData.range = {};

                for(i = 0; i < allAxes.length; i++) {
                    var ax = allAxes[i];
                    var axLetter = ax._id.charAt(0);

                    ranges[ax._id] = [
                        p2r(ax, poly[axLetter + 'min']),
                        p2r(ax, poly[axLetter + 'max'])
                    ].sort(ascending);
                }
            };
        } else { // case of isFreeMode
            fillRangeItems = function(eventData, poly, filterPoly) {
                var dataPts = eventData.lassoPoints = {};

                for(i = 0; i < allAxes.length; i++) {
                    var ax = allAxes[i];
                    dataPts[ax._id] = filterPoly.filtered.map(axValue(ax));
                }
            };
        }
    }

    dragOptions.moveFn = function(dx0, dy0) {
        x1 = Math.max(0, Math.min(pw, dx0 + x0));
        y1 = Math.max(0, Math.min(ph, dy0 + y0));

        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);

        if(isRectMode) {
            var direction;
            var start, end;

            if(isSelectMode) {
                var q = fullLayout.selectdirection;

                if(q === 'any') {
                    if(dy < Math.min(dx * 0.6, MINSELECT)) {
                        direction = 'h';
                    } else if(dx < Math.min(dy * 0.6, MINSELECT)) {
                        direction = 'v';
                    } else {
                        direction = 'd';
                    }
                } else {
                    direction = q;
                }

                switch(direction) {
                    case 'h':
                        start = isEllipse ? ph / 2 : 0;
                        end = ph;
                        break;
                    case 'v':
                        start = isEllipse ? pw / 2 : 0;
                        end = pw;
                        break;
                }
            }

            if(isDrawMode) {
                switch(fullLayout.newshape.drawdirection) {
                    case 'vertical':
                        direction = 'h';
                        start = isEllipse ? ph / 2 : 0;
                        end = ph;
                        break;
                    case 'horizontal':
                        direction = 'v';
                        start = isEllipse ? pw / 2 : 0;
                        end = pw;
                        break;
                    case 'ortho':
                        if(dx < dy) {
                            direction = 'h';
                            start = y0;
                            end = y1;
                        } else {
                            direction = 'v';
                            start = x0;
                            end = x1;
                        }
                        break;
                    default: // i.e. case of 'diagonal'
                        direction = 'd';
                }
            }

            if(direction === 'h') {
                // horizontal motion
                currentPolygon = isLineOrEllipse ?
                    handleEllipse(isEllipse, [x1, start], [x1, end]) : // using x1 instead of x0 allows adjusting the line while drawing
                    [[x0, start], [x0, end], [x1, end], [x1, start]]; // make a vertical box

                currentPolygon.xmin = isLineOrEllipse ? x1 : Math.min(x0, x1);
                currentPolygon.xmax = isLineOrEllipse ? x1 : Math.max(x0, x1);
                currentPolygon.ymin = Math.min(start, end);
                currentPolygon.ymax = Math.max(start, end);
                // extras to guide users in keeping a straight selection
                corners.attr('d', 'M' + currentPolygon.xmin + ',' + (y0 - MINSELECT) +
                    'h-4v' + (2 * MINSELECT) + 'h4Z' +
                    'M' + (currentPolygon.xmax - 1) + ',' + (y0 - MINSELECT) +
                    'h4v' + (2 * MINSELECT) + 'h-4Z');
            } else if(direction === 'v') {
                // vertical motion
                currentPolygon = isLineOrEllipse ?
                    handleEllipse(isEllipse, [start, y1], [end, y1]) : // using y1 instead of y0 allows adjusting the line while drawing
                    [[start, y0], [start, y1], [end, y1], [end, y0]]; // make a horizontal box

                currentPolygon.xmin = Math.min(start, end);
                currentPolygon.xmax = Math.max(start, end);
                currentPolygon.ymin = isLineOrEllipse ? y1 : Math.min(y0, y1);
                currentPolygon.ymax = isLineOrEllipse ? y1 : Math.max(y0, y1);
                corners.attr('d', 'M' + (x0 - MINSELECT) + ',' + currentPolygon.ymin +
                    'v-4h' + (2 * MINSELECT) + 'v4Z' +
                    'M' + (x0 - MINSELECT) + ',' + (currentPolygon.ymax - 1) +
                    'v4h' + (2 * MINSELECT) + 'v-4Z');
            } else if(direction === 'd') {
                // diagonal motion
                currentPolygon = isLineOrEllipse ?
                    handleEllipse(isEllipse, [x0, y0], [x1, y1]) :
                    [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];

                currentPolygon.xmin = Math.min(x0, x1);
                currentPolygon.xmax = Math.max(x0, x1);
                currentPolygon.ymin = Math.min(y0, y1);
                currentPolygon.ymax = Math.max(y0, y1);
                corners.attr('d', 'M0,0Z');
            }
        } else if(isFreeMode) {
            filterPoly.addPt([x1, y1]);
            currentPolygon = filterPoly.filtered;
        }

        // create outline & tester
        if(dragOptions.selectionDefs && dragOptions.selectionDefs.length) {
            mergedPolygons = mergePolygons(dragOptions.mergedPolygons, currentPolygon, subtract);
            currentPolygon.subtract = subtract;
            selectionTester = multiTester(dragOptions.selectionDefs.concat([currentPolygon]));
        } else {
            mergedPolygons = [currentPolygon];
            selectionTester = polygonTester(currentPolygon);
        }

        // display polygons on the screen
        displayOutlines(mergedPolygons, outlines, dragOptions);

        if(isSelectMode) {
            throttle.throttle(
                throttleID,
                constants.SELECTDELAY,
                function() {
                    selection = [];

                    var thisSelection;
                    var traceSelections = [];
                    var traceSelection;
                    for(i = 0; i < searchTraces.length; i++) {
                        searchInfo = searchTraces[i];

                        traceSelection = searchInfo._module.selectPoints(searchInfo, selectionTester);
                        traceSelections.push(traceSelection);

                        thisSelection = fillSelectionItem(traceSelection, searchInfo);

                        if(selection.length) {
                            for(var j = 0; j < thisSelection.length; j++) {
                                selection.push(thisSelection[j]);
                            }
                        } else selection = thisSelection;
                    }

                    eventData = {points: selection};
                    updateSelectedState(gd, searchTraces, eventData);
                    fillRangeItems(eventData, currentPolygon, filterPoly);
                    dragOptions.gd.emit('plotly_selecting', eventData);
                }
            );
        }
    };

    dragOptions.clickFn = function(numClicks, evt) {
        var clickmode = fullLayout.clickmode;

        corners.remove();

        if(isDrawMode) return;

        throttle.done(throttleID).then(function() {
            throttle.clear(throttleID);
            if(numClicks === 2) {
                // clear selection on doubleclick
                outlines.remove();
                for(i = 0; i < searchTraces.length; i++) {
                    searchInfo = searchTraces[i];
                    searchInfo._module.selectPoints(searchInfo, false);
                }

                updateSelectedState(gd, searchTraces);

                clearSelectionsCache(dragOptions);

                gd.emit('plotly_deselect', null);
            } else {
                if(clickmode.indexOf('select') > -1) {
                    selectOnClick(evt, gd, dragOptions.xaxes, dragOptions.yaxes,
                      dragOptions.subplot, dragOptions, outlines);
                }

                if(clickmode === 'event') {
                    // TODO: remove in v2 - this was probably never intended to work as it does,
                    // but in case anyone depends on it we don't want to break it now.
                    // Note that click-to-select introduced pre v2 also emitts proper
                    // event data when clickmode is having 'select' in its flag list.
                    gd.emit('plotly_selected', undefined);
                }
            }

            Fx.click(gd, evt);
        }).catch(Lib.error);
    };

    dragOptions.doneFn = function() {
        corners.remove();

        throttle.done(throttleID).then(function() {
            throttle.clear(throttleID);
            dragOptions.gd.emit('plotly_selected', eventData);

            if(currentPolygon && dragOptions.selectionDefs) {
                // save last polygons
                currentPolygon.subtract = subtract;
                dragOptions.selectionDefs.push(currentPolygon);

                // we have to keep reference to arrays container
                dragOptions.mergedPolygons.length = 0;
                [].push.apply(dragOptions.mergedPolygons, mergedPolygons);
            }

            if(dragOptions.doneFnCompleted) {
                dragOptions.doneFnCompleted(selection);
            }
        }).catch(Lib.error);

        if(isDrawMode && fullLayout.newshape.drawstep === 'immediate') {
            clearSelectionsCache(dragOptions);
        }
    };
}

function selectOnClick(evt, gd, xAxes, yAxes, subplot, dragOptions, polygonOutlines) {
    var hoverData = gd._hoverdata;
    var fullLayout = gd._fullLayout;
    var clickmode = fullLayout.clickmode;
    var sendEvents = clickmode.indexOf('event') > -1;
    var selection = [];
    var searchTraces, searchInfo, currentSelectionDef, selectionTester, traceSelection;
    var thisTracesSelection, pointOrBinSelected, subtract, eventData, i;

    if(isHoverDataSet(hoverData)) {
        coerceSelectionsCache(evt, gd, dragOptions);
        searchTraces = determineSearchTraces(gd, xAxes, yAxes, subplot);
        var clickedPtInfo = extractClickedPtInfo(hoverData, searchTraces);
        var isBinnedTrace = clickedPtInfo.pointNumbers.length > 0;


        // Note: potentially costly operation isPointOrBinSelected is
        // called as late as possible through the use of an assignment
        // in an if condition.
        if(isBinnedTrace ?
            isOnlyThisBinSelected(searchTraces, clickedPtInfo) :
            isOnlyOnePointSelected(searchTraces) &&
                (pointOrBinSelected = isPointOrBinSelected(clickedPtInfo))) {
            if(polygonOutlines) polygonOutlines.remove();
            for(i = 0; i < searchTraces.length; i++) {
                searchInfo = searchTraces[i];
                searchInfo._module.selectPoints(searchInfo, false);
            }

            updateSelectedState(gd, searchTraces);

            clearSelectionsCache(dragOptions);

            if(sendEvents) {
                gd.emit('plotly_deselect', null);
            }
        } else {
            subtract = evt.shiftKey &&
              (pointOrBinSelected !== undefined ?
                pointOrBinSelected :
                isPointOrBinSelected(clickedPtInfo));
            currentSelectionDef = newPointSelectionDef(clickedPtInfo.pointNumber, clickedPtInfo.searchInfo, subtract);

            var allSelectionDefs = dragOptions.selectionDefs.concat([currentSelectionDef]);
            selectionTester = multiTester(allSelectionDefs);

            for(i = 0; i < searchTraces.length; i++) {
                traceSelection = searchTraces[i]._module.selectPoints(searchTraces[i], selectionTester);
                thisTracesSelection = fillSelectionItem(traceSelection, searchTraces[i]);

                if(selection.length) {
                    for(var j = 0; j < thisTracesSelection.length; j++) {
                        selection.push(thisTracesSelection[j]);
                    }
                } else selection = thisTracesSelection;
            }

            eventData = {points: selection};
            updateSelectedState(gd, searchTraces, eventData);

            if(currentSelectionDef && dragOptions) {
                dragOptions.selectionDefs.push(currentSelectionDef);
            }

            if(polygonOutlines) {
                var polygons = dragOptions.mergedPolygons;

                // display polygons on the screen
                displayOutlines(polygons, polygonOutlines, dragOptions);
            }

            if(sendEvents) {
                gd.emit('plotly_selected', eventData);
            }
        }
    }
}

/**
 * Constructs a new point selection definition object.
 */
function newPointSelectionDef(pointNumber, searchInfo, subtract) {
    return {
        pointNumber: pointNumber,
        searchInfo: searchInfo,
        subtract: subtract
    };
}

function isPointSelectionDef(o) {
    return 'pointNumber' in o && 'searchInfo' in o;
}

/*
 * Constructs a new point number tester.
 */
function newPointNumTester(pointSelectionDef) {
    return {
        xmin: 0,
        xmax: 0,
        ymin: 0,
        ymax: 0,
        pts: [],
        contains: function(pt, omitFirstEdge, pointNumber, searchInfo) {
            var idxWantedTrace = pointSelectionDef.searchInfo.cd[0].trace._expandedIndex;
            var idxActualTrace = searchInfo.cd[0].trace._expandedIndex;
            return idxActualTrace === idxWantedTrace &&
              pointNumber === pointSelectionDef.pointNumber;
        },
        isRect: false,
        degenerate: false,
        subtract: pointSelectionDef.subtract
    };
}

/**
 * Wraps multiple selection testers.
 *
 * @param {Array} list - An array of selection testers.
 *
 * @return a selection tester object with a contains function
 * that can be called to evaluate a point against all wrapped
 * selection testers that were passed in list.
 */
function multiTester(list) {
    var testers = [];
    var xmin = isPointSelectionDef(list[0]) ? 0 : list[0][0][0];
    var xmax = xmin;
    var ymin = isPointSelectionDef(list[0]) ? 0 : list[0][0][1];
    var ymax = ymin;

    for(var i = 0; i < list.length; i++) {
        if(isPointSelectionDef(list[i])) {
            testers.push(newPointNumTester(list[i]));
        } else {
            var tester = polygon.tester(list[i]);
            tester.subtract = list[i].subtract;
            testers.push(tester);
            xmin = Math.min(xmin, tester.xmin);
            xmax = Math.max(xmax, tester.xmax);
            ymin = Math.min(ymin, tester.ymin);
            ymax = Math.max(ymax, tester.ymax);
        }
    }

    /**
     * Tests if the given point is within this tester.
     *
     * @param {Array} pt - [0] is the x coordinate, [1] is the y coordinate of the point.
     * @param {*} arg - An optional parameter to pass down to wrapped testers.
     * @param {number} pointNumber - The point number of the point within the underlying data array.
     * @param {number} searchInfo - An object identifying the trace the point is contained in.
     *
     * @return {boolean} true if point is considered to be selected, false otherwise.
     */
    function contains(pt, arg, pointNumber, searchInfo) {
        var contained = false;
        for(var i = 0; i < testers.length; i++) {
            if(testers[i].contains(pt, arg, pointNumber, searchInfo)) {
                // if contained by subtract tester - exclude the point
                contained = testers[i].subtract === false;
            }
        }

        return contained;
    }

    return {
        xmin: xmin,
        xmax: xmax,
        ymin: ymin,
        ymax: ymax,
        pts: [],
        contains: contains,
        isRect: false,
        degenerate: false
    };
}

function coerceSelectionsCache(evt, gd, dragOptions) {
    gd._fullLayout._drawing = false;

    var fullLayout = gd._fullLayout;
    var plotinfo = dragOptions.plotinfo;
    var dragmode = dragOptions.dragmode;

    var selectingOnSameSubplot = (
        fullLayout._lastSelectedSubplot &&
        fullLayout._lastSelectedSubplot === plotinfo.id
    );

    var hasModifierKey = (evt.shiftKey || evt.altKey) &&
        !(drawMode(dragmode) && openMode(dragmode));

    if(selectingOnSameSubplot && hasModifierKey &&
      (plotinfo.selection && plotinfo.selection.selectionDefs) && !dragOptions.selectionDefs) {
        // take over selection definitions from prev mode, if any
        dragOptions.selectionDefs = plotinfo.selection.selectionDefs;
        dragOptions.mergedPolygons = plotinfo.selection.mergedPolygons;
    } else if(!hasModifierKey || !plotinfo.selection) {
        clearSelectionsCache(dragOptions);
    }

    // clear selection outline when selecting a different subplot
    if(!selectingOnSameSubplot) {
        clearSelect(gd);
        fullLayout._lastSelectedSubplot = plotinfo.id;
    }
}

function clearSelectionsCache(dragOptions) {
    var dragmode = dragOptions.dragmode;
    var plotinfo = dragOptions.plotinfo;

    if(drawMode(dragmode)) {
        var gd = dragOptions.gd;
        var fullLayout = gd._fullLayout;
        var zoomLayer = fullLayout._zoomlayer;

        var outlines = zoomLayer.selectAll('.select-outline-' + plotinfo.id);
        if(outlines) {
            // add shape
            addNewShapes(outlines, dragOptions);
        }

        gd._fullLayout._drawing = false;
    }

    plotinfo.selection = {};
    plotinfo.selection.selectionDefs = dragOptions.selectionDefs = [];
    plotinfo.selection.mergedPolygons = dragOptions.mergedPolygons = [];
}

function determineSearchTraces(gd, xAxes, yAxes, subplot) {
    var searchTraces = [];
    var xAxisIds = xAxes.map(getAxId);
    var yAxisIds = yAxes.map(getAxId);
    var cd, trace, i;

    for(i = 0; i < gd.calcdata.length; i++) {
        cd = gd.calcdata[i];
        trace = cd[0].trace;

        if(trace.visible !== true || !trace._module || !trace._module.selectPoints) continue;

        if(subplot && (trace.subplot === subplot || trace.geo === subplot)) {
            searchTraces.push(createSearchInfo(trace._module, cd, xAxes[0], yAxes[0]));
        } else if(
          trace.type === 'splom' &&
          // FIXME: make sure we don't have more than single axis for splom
          trace._xaxes[xAxisIds[0]] && trace._yaxes[yAxisIds[0]]
        ) {
            var info = createSearchInfo(trace._module, cd, xAxes[0], yAxes[0]);
            info.scene = gd._fullLayout._splomScenes[trace.uid];
            searchTraces.push(info);
        } else if(
          trace.type === 'sankey'
        ) {
            var sankeyInfo = createSearchInfo(trace._module, cd, xAxes[0], yAxes[0]);
            searchTraces.push(sankeyInfo);
        } else {
            if(xAxisIds.indexOf(trace.xaxis) === -1) continue;
            if(yAxisIds.indexOf(trace.yaxis) === -1) continue;

            searchTraces.push(createSearchInfo(trace._module, cd,
              getFromId(gd, trace.xaxis), getFromId(gd, trace.yaxis)));
        }
    }

    return searchTraces;

    function createSearchInfo(module, calcData, xaxis, yaxis) {
        return {
            _module: module,
            cd: calcData,
            xaxis: xaxis,
            yaxis: yaxis
        };
    }
}

function displayOutlines(polygons, outlines, dragOptions, nCalls) {
    if(!nCalls) nCalls = 0;

    function redraw() {
        if(nCalls !== -1) {
            // recursive call
            displayOutlines(polygons, outlines, dragOptions, nCalls++);
        }
    }

    var plotinfo = dragOptions.plotinfo;
    var transform = getTransform(plotinfo);

    var gd = dragOptions.gd;
    var fullLayout = gd._fullLayout;
    var zoomLayer = fullLayout._zoomlayer;
    zoomLayer.selectAll('.outline-controllers').remove();

    var dragmode = dragOptions.dragmode;
    var isDrawMode = drawMode(dragmode);
    var isOpenMode = openMode(dragmode);

    if(isDrawMode) gd._fullLayout._drawing = true;

    var paths = [];
    for(var k = 0; k < polygons.length; k++) {
        // create outline path
        paths.push(
            providePath(polygons[k], isOpenMode)
        );
    }
    // make outline
    outlines.attr('d', writePaths(paths, isOpenMode));

    // add controllers
    var rVertexController = MINSELECT * 1.5; // bigger vertex buttons
    var vertexDragOptions;
    var indexI; // cell index
    var indexJ; // vertex or cell-controller index
    var copyPolygons;

    saveInitPositions();

    if(isDrawMode && fullLayout.newshape.drawstep === 'gradual') {
        var g = zoomLayer.append('g').attr('class', 'outline-controllers');
        addVertexControllers(g);
    }

    function saveInitPositions() {
        copyPolygons = [];
        for(var i = 0; i < polygons.length; i++) {
            copyPolygons[i] = [];
            for(var j = 0; j < polygons[i].length; j++) {
                copyPolygons[i][j] = [];
                for(var k = 0; k < polygons[i][j].length; k++) {
                    copyPolygons[i][j][k] = polygons[i][j][k];
                }
            }
        }
    }

    function startDragVertex(evt) {
        indexI = +evt.srcElement.getAttribute('data-i');
        indexJ = +evt.srcElement.getAttribute('data-j');

        vertexDragOptions[indexI][indexJ].moveFn = moveVertexController;
    }

    function moveVertexController(dx, dy) {
        if(!polygons.length) return;

        var x0 = copyPolygons[indexI][indexJ][0];
        var y0 = copyPolygons[indexI][indexJ][1];

        var cell = polygons[indexI];
        var len = cell.length;
        if(pointsShapeRectangle(cell)) {
            for(var q = 0; q < len; q++) {
                if(q === indexJ) continue;

                // move other corners of rectangle
                var pos = cell[q];

                if(pos[0] === cell[indexJ][0]) {
                    pos[0] = x0 + dx;
                }

                if(pos[1] === cell[indexJ][1]) {
                    pos[1] = y0 + dy;
                }
            }
            // move the corner
            cell[indexJ][0] = x0 + dx;
            cell[indexJ][1] = y0 + dy;

            if(!pointsShapeRectangle(cell)) {
                // reject result to rectangles with ensure areas
                for(var j = 0; j < len; j++) {
                    for(var k = 0; k < 2; k++) {
                        cell[j][k] = copyPolygons[indexI][j][k];
                    }
                }
            }
        } else { // other polylines
            cell[indexJ][0] = x0 + dx;
            cell[indexJ][1] = y0 + dy;
        }

        redraw();
    }

    function endDragVertexController(evt) {
        Lib.noop(evt);
    }

    function removeVertex() {
        if(!polygons.length) return;

        var newPolygon = [];
        for(var j = 0; j < polygons[indexI].length; j++) {
            if(j !== indexJ) {
                newPolygon.push(
                    polygons[indexI][j]
                );
            }
        }
        polygons[indexI] = newPolygon;
    }

    function clickVertexController(numClicks) {
        if(numClicks === 2) {
            var cell = polygons[indexI];
            if(cell.length > 2 && !(pointsShapeRectangle(cell))) {
                removeVertex();
            }

            redraw();
        }
    }

    function addVertexControllers(g) {
        vertexDragOptions = [];

        for(var i = 0; i < polygons.length; i++) {
            var cell = polygons[i];

            if(dragmode === 'ellipsedraw' && pointsShapeEllipse(cell)) {
                return; // no need for vertex modifiers on ellipses
            }
            var onRect = (pointsShapeRectangle(cell));
            var minX;
            var minY;
            var maxX;
            var maxY;
            if(onRect) {
                // compute bounding box
                minX = calcMin(cell, 0);
                minY = calcMin(cell, 1);
                maxX = calcMax(cell, 0);
                maxY = calcMax(cell, 1);
            }

            vertexDragOptions[i] = [];
            for(var j = 0; j < cell.length; j++) {
                var x = cell[j][0];
                var y = cell[j][1];

                var rIcon = 3;
                var button = g.append(onRect ? 'rect' : 'circle')
                .attr('transform', transform)
                .style({
                    'mix-blend-mode': 'luminosity',
                    fill: 'black',
                    stroke: 'white',
                    'stroke-width': 1
                });

                if(onRect) {
                    button
                        .attr('x', x - rIcon)
                        .attr('y', y - rIcon)
                        .attr('width', 2 * rIcon)
                        .attr('height', 2 * rIcon);
                } else {
                    button
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('r', rIcon);
                }

                var vertex = g.append(onRect ? 'rect' : 'circle')
                .attr('data-i', i)
                .attr('data-j', j)
                .attr('transform', transform)
                .style({
                    opacity: 0
                });

                if(onRect) {
                    var ratioX = (x - minX) / (maxX - minX);
                    var ratioY = (y - minY) / (maxY - minY);
                    if(isFinite(ratioX) && isFinite(ratioY)) {
                        setCursor(
                            vertex,
                            dragElement.getCursor(ratioX, 1 - ratioY)
                        );
                    }

                    vertex
                        .attr('x', x - rVertexController)
                        .attr('y', y - rVertexController)
                        .attr('width', 2 * rVertexController)
                        .attr('height', 2 * rVertexController);
                } else {
                    vertex
                        .classed('cursor-grab', true)
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('r', rVertexController);
                }

                vertexDragOptions[i][j] = {
                    element: vertex.node(),
                    gd: gd,
                    prepFn: startDragVertex,
                    doneFn: endDragVertexController,
                    clickFn: clickVertexController
                };

                dragElement.init(vertexDragOptions[i][j]);
            }
        }
    }
}

function providePath(cell, isOpenMode) {
    return cell.join('L') + (
        isOpenMode ? '' : 'L' + cell[0]
    );
}

function writePaths(paths, isOpenMode) {
    return paths.length > 0 ? 'M' + paths.join('M') + (isOpenMode ? '' : 'Z') : 'M0,0Z';
}

function readPaths(str, size, plotinfo) {
    var allParts = str
        .replace('Z', '') // remove Z from end
        .substring(1) // remove M from start
        .split('M');

    var allPaths = [];
    for(var i = 0; i < allParts.length; i++) {
        var part = allParts[i].split('L');

        var path = [];
        for(var j = 0; j < part.length; j++) {
            var pos = part[j].split(',');
            var x = +pos[0];
            var y = +pos[1];

            if(plotinfo.domain) {
                path.push([
                    plotinfo.domain.x[0] + x / size.w,
                    plotinfo.domain.y[1] - y / size.h
                ]);
            } else {
                path.push([
                    p2r(plotinfo.xaxis, x),
                    p2r(plotinfo.yaxis, y)
                ]);
            }
        }

        allPaths.push(path);
    }

    return allPaths;
}

function fixDatesOnPaths(path, xaxis, yaxis) {
    var xIsDate = xaxis.type === 'date';
    var yIsDate = yaxis.type === 'date';
    if(!xIsDate && !yIsDate) return path;

    for(var i = 0; i < path.length; i++) {
        if(xIsDate) path[i][0] = path[i][0].replace(' ', '_');
        if(yIsDate) path[i][1] = path[i][1].replace(' ', '_');
    }

    return path;
}

function almostEq(a, b) {
    return Math.abs(a - b) <= 1e-6;
}

function dist(a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}

function calcMin(cell, dim) {
    var v = Infinity;
    for(var i = 0; i < cell.length; i++) {
        v = Math.min(v, cell[i][dim]);
    }
    return v;
}

function calcMax(cell, dim) {
    var v = -Infinity;
    for(var i = 0; i < cell.length; i++) {
        v = Math.max(v, cell[i][dim]);
    }
    return v;
}

function pointsShapeRectangle(cell, len) {
    if(!len) len = cell.length;
    if(len !== 4) return false;
    for(var j = 0; j < 2; j++) {
        var e01 = cell[0][j] - cell[1][j];
        var e32 = cell[3][j] - cell[2][j];

        if(!almostEq(e01, e32)) return false;

        var e03 = cell[0][j] - cell[3][j];
        var e12 = cell[1][j] - cell[2][j];
        if(!almostEq(e03, e12)) return false;
    }

    // N.B. rotated rectangles are not valid rects since rotation is not supported in shapes for now.
    if(
        !almostEq(cell[0][0], cell[1][0]) &&
        !almostEq(cell[0][0], cell[3][0])
    ) return false;

    // reject cases with zero area
    return !!(
        dist(cell[0], cell[1]) *
        dist(cell[0], cell[3])
    );
}

function pointsShapeEllipse(cell, len) {
    if(!len) len = cell.length;
    if(len !== CIRCLE_SIDES) return false;
    // opposite diagonals should be the same
    for(var i = 0; i < len; i++) {
        var k = (len * 2 - i) % len;

        var k2 = (len / 2 + k) % len;
        var i2 = (len / 2 + i) % len;

        if(!almostEq(
            dist(cell[i], cell[i2]),
            dist(cell[k], cell[k2])
        )) return false;
    }
    return true;
}

function handleEllipse(isEllipse, start, end) {
    if(!isEllipse) return [start, end]; // i.e. case of line

    var pos = ellipseOver({
        x0: start[0],
        y0: start[1],
        x1: end[0],
        y1: end[1]
    });

    var cx = (pos.x1 + pos.x0) / 2;
    var cy = (pos.y1 + pos.y0) / 2;
    var rx = (pos.x1 - pos.x0) / 2;
    var ry = (pos.y1 - pos.y0) / 2;

    // make a circle when one dimension is zero
    if(!rx) rx = ry = ry / SQRT2;
    if(!ry) ry = rx = rx / SQRT2;

    var cell = [];
    for(var i = 0; i < CIRCLE_SIDES; i++) {
        var t = i * 2 * Math.PI / CIRCLE_SIDES;
        cell.push([
            cx + rx * Math.cos(t),
            cy + ry * Math.sin(t),
        ]);
    }
    return cell;
}

function ellipseOver(pos) {
    var x0 = pos.x0;
    var y0 = pos.y0;
    var x1 = pos.x1;
    var y1 = pos.y1;

    var dx = x1 - x0;
    var dy = y1 - y0;

    x0 -= dx;
    y0 -= dy;

    var cx = (x0 + x1) / 2;
    var cy = (y0 + y1) / 2;

    var scale = SQRT2;
    dx *= scale;
    dy *= scale;

    return {
        x0: cx - dx,
        y0: cy - dy,
        x1: cx + dx,
        y1: cy + dy
    };
}

function addNewShapes(outlines, dragOptions) {
    if(!outlines.length) return;
    var gd = dragOptions.gd;
    var drwStyle = gd._fullLayout.newshape;
    var isOpenMode = openMode(dragOptions.dragmode);
    var plotinfo = dragOptions.plotinfo;
    var xaxis = plotinfo.xaxis;
    var yaxis = plotinfo.yaxis;
    var onPaper = plotinfo.domain;
    var dragmode = dragOptions.dragmode;

    var e = outlines[0][0]; // pick first
    if(!e) return;
    var d = e.getAttribute('d');

    var newShapes = [];
    var fullLayout = gd._fullLayout;

    var polygons = readPaths(d, fullLayout._size, plotinfo);

    for(var i = 0; i < polygons.length; i++) {
        var cell = polygons[i];
        var len = cell.length - (isOpenMode ? 0 : 1); // skip closing point
        if(len < 2) continue;

        var shape = {
            editable: true,

            xref: onPaper ? 'paper' : xaxis._id,
            yref: onPaper ? 'paper' : yaxis._id,

            layer: drwStyle.layer,
            opacity: drwStyle.opacity,
            line: {
                color: drwStyle.line.color,
                width: drwStyle.line.width,
                dash: drwStyle.line.dash
            }
        };

        if(!isOpenMode) {
            shape.fillcolor = drwStyle.fillcolor;
            shape.fillrule = drwStyle.fillrule;
        }

        if(
            dragmode === 'rectdraw' &&
            pointsShapeRectangle(cell, len) // should pass len here which is equal to cell.length - 1 i.e. because of the closing point
        ) {
            shape.type = 'rect';
            shape.x0 = cell[0][0];
            shape.y0 = cell[0][1];
            shape.x1 = cell[2][0];
            shape.y1 = cell[2][1];
        } else if(
            dragmode === 'linedraw'
        ) {
            shape.type = 'line';
            shape.x0 = cell[0][0];
            shape.y0 = cell[0][1];
            shape.x1 = cell[1][0];
            shape.y1 = cell[1][1];
        } else if(
            dragmode === 'ellipsedraw' &&
            pointsShapeEllipse(cell, len) && // should pass len here which is equal to cell.length - 1 i.e. because of the closing point
            xaxis.type !== 'log' && yaxis.type !== 'log' &&
            xaxis.type !== 'date' && yaxis.type !== 'date'
        ) {
            shape.type = 'circle'; // an ellipse!
            var j = Math.floor((CIRCLE_SIDES + 1) / 2);
            var k = Math.floor((CIRCLE_SIDES + 1) / 8);
            var pos = ellipseOver({
                x0: (cell[0][0] + cell[j][0]) / 2,
                y0: (cell[0][1] + cell[j][1]) / 2,
                x1: cell[k][0],
                y1: cell[k][1]
            });
            shape.x0 = pos.x0;
            shape.y0 = pos.y0;
            shape.x1 = pos.x1;
            shape.y1 = pos.y1;
        } else {
            shape.type = 'path';
            fixDatesOnPaths(cell, xaxis, yaxis);

            shape.path = writePaths([
                providePath(cell, isOpenMode)
            ], isOpenMode);
        }

        newShapes.push(shape);
    }

    // remove outline and controllers
    clearSelect(gd);

    if(newShapes.length) {
        var oldShapes = [];
        for(var q = 0; q < fullLayout.shapes.length; q++) {
            oldShapes.push(fullLayout.shapes[q]._input);
        }

        Registry.call('relayout', gd, {
            shapes: oldShapes.concat(newShapes) // add new shapes to the end.
        });
    }
}

function isHoverDataSet(hoverData) {
    return hoverData &&
      Array.isArray(hoverData) &&
      hoverData[0].hoverOnBox !== true;
}

function extractClickedPtInfo(hoverData, searchTraces) {
    var hoverDatum = hoverData[0];
    var pointNumber = -1;
    var pointNumbers = [];
    var searchInfo, i;

    for(i = 0; i < searchTraces.length; i++) {
        searchInfo = searchTraces[i];
        if(hoverDatum.fullData._expandedIndex === searchInfo.cd[0].trace._expandedIndex) {
            // Special case for box (and violin)
            if(hoverDatum.hoverOnBox === true) {
                break;
            }

            // Hint: in some traces like histogram, one graphical element
            // doesn't correspond to one particular data point, but to
            // bins of data points. Thus, hoverDatum can have a binNumber
            // property instead of pointNumber.
            if(hoverDatum.pointNumber !== undefined) {
                pointNumber = hoverDatum.pointNumber;
            } else if(hoverDatum.binNumber !== undefined) {
                pointNumber = hoverDatum.binNumber;
                pointNumbers = hoverDatum.pointNumbers;
            }

            break;
        }
    }

    return {
        pointNumber: pointNumber,
        pointNumbers: pointNumbers,
        searchInfo: searchInfo
    };
}

function isPointOrBinSelected(clickedPtInfo) {
    var trace = clickedPtInfo.searchInfo.cd[0].trace;
    var ptNum = clickedPtInfo.pointNumber;
    var ptNums = clickedPtInfo.pointNumbers;
    var ptNumsSet = ptNums.length > 0;

    // When pointsNumbers is set (e.g. histogram's binning),
    // it is assumed that when the first point of
    // a bin is selected, all others are as well
    var ptNumToTest = ptNumsSet ? ptNums[0] : ptNum;

    // TODO potential performance improvement
    // Primarily we need this function to determine if a click adds
    // or subtracts from a selection.
    // In cases `trace.selectedpoints` is a huge array, indexOf
    // might be slow. One remedy would be to introduce a hash somewhere.
    return trace.selectedpoints ? trace.selectedpoints.indexOf(ptNumToTest) > -1 : false;
}

function isOnlyThisBinSelected(searchTraces, clickedPtInfo) {
    var tracesWithSelectedPts = [];
    var searchInfo, trace, isSameTrace, i;

    for(i = 0; i < searchTraces.length; i++) {
        searchInfo = searchTraces[i];
        if(searchInfo.cd[0].trace.selectedpoints && searchInfo.cd[0].trace.selectedpoints.length > 0) {
            tracesWithSelectedPts.push(searchInfo);
        }
    }

    if(tracesWithSelectedPts.length === 1) {
        isSameTrace = tracesWithSelectedPts[0] === clickedPtInfo.searchInfo;
        if(isSameTrace) {
            trace = clickedPtInfo.searchInfo.cd[0].trace;
            if(trace.selectedpoints.length === clickedPtInfo.pointNumbers.length) {
                for(i = 0; i < clickedPtInfo.pointNumbers.length; i++) {
                    if(trace.selectedpoints.indexOf(clickedPtInfo.pointNumbers[i]) < 0) {
                        return false;
                    }
                }
                return true;
            }
        }
    }

    return false;
}

function isOnlyOnePointSelected(searchTraces) {
    var len = 0;
    var searchInfo, trace, i;

    for(i = 0; i < searchTraces.length; i++) {
        searchInfo = searchTraces[i];
        trace = searchInfo.cd[0].trace;
        if(trace.selectedpoints) {
            if(trace.selectedpoints.length > 1) return false;

            len += trace.selectedpoints.length;
            if(len > 1) return false;
        }
    }

    return len === 1;
}

function updateSelectedState(gd, searchTraces, eventData) {
    var i, searchInfo, cd, trace;

    // before anything else, update preGUI if necessary
    for(i = 0; i < searchTraces.length; i++) {
        var fullInputTrace = searchTraces[i].cd[0].trace._fullInput;
        var tracePreGUI = gd._fullLayout._tracePreGUI[fullInputTrace.uid] || {};
        if(tracePreGUI.selectedpoints === undefined) {
            tracePreGUI.selectedpoints = fullInputTrace._input.selectedpoints || null;
        }
    }

    if(eventData) {
        var pts = eventData.points || [];

        for(i = 0; i < searchTraces.length; i++) {
            trace = searchTraces[i].cd[0].trace;
            trace._input.selectedpoints = trace._fullInput.selectedpoints = [];
            if(trace._fullInput !== trace) trace.selectedpoints = [];
        }

        for(i = 0; i < pts.length; i++) {
            var pt = pts[i];
            var data = pt.data;
            var fullData = pt.fullData;

            if(pt.pointIndices) {
                [].push.apply(data.selectedpoints, pt.pointIndices);
                if(trace._fullInput !== trace) {
                    [].push.apply(fullData.selectedpoints, pt.pointIndices);
                }
            } else {
                data.selectedpoints.push(pt.pointIndex);
                if(trace._fullInput !== trace) {
                    fullData.selectedpoints.push(pt.pointIndex);
                }
            }
        }
    } else {
        for(i = 0; i < searchTraces.length; i++) {
            trace = searchTraces[i].cd[0].trace;
            delete trace.selectedpoints;
            delete trace._input.selectedpoints;
            if(trace._fullInput !== trace) {
                delete trace._fullInput.selectedpoints;
            }
        }
    }

    var hasRegl = false;

    for(i = 0; i < searchTraces.length; i++) {
        searchInfo = searchTraces[i];
        cd = searchInfo.cd;
        trace = cd[0].trace;

        if(Registry.traceIs(trace, 'regl')) {
            hasRegl = true;
        }

        var _module = searchInfo._module;
        var fn = _module.styleOnSelect || _module.style;
        if(fn) {
            fn(gd, cd, cd[0].node3);
            if(cd[0].nodeRangePlot3) fn(gd, cd, cd[0].nodeRangePlot3);
        }
    }

    if(hasRegl) {
        clearGlCanvases(gd);
        redrawReglTraces(gd);
    }
}

function mergePolygons(list, poly, subtract) {
    var res;

    if(subtract) {
        res = polybool.difference({
            regions: list,
            inverted: false
        }, {
            regions: [poly],
            inverted: false
        });

        return res.regions;
    }

    res = polybool.union({
        regions: list,
        inverted: false
    }, {
        regions: [poly],
        inverted: false
    });

    return res.regions;
}

function fillSelectionItem(selection, searchInfo) {
    if(Array.isArray(selection)) {
        var cd = searchInfo.cd;
        var trace = searchInfo.cd[0].trace;

        for(var i = 0; i < selection.length; i++) {
            selection[i] = makeEventData(selection[i], trace, cd);
        }
    }

    return selection;
}

// until we get around to persistent selections, remove the outline
// here. The selection itself will be removed when the plot redraws
// at the end.
function clearSelect(gd) {
    var fullLayout = gd._fullLayout || {};
    var zoomLayer = fullLayout._zoomlayer;
    if(zoomLayer) {
        zoomLayer.selectAll('.outline-controllers').remove();
        zoomLayer.selectAll('.select-outline').remove();
    }

    fullLayout._drawing = false;
}

module.exports = {
    prepSelect: prepSelect,
    clearSelect: clearSelect,
    clearSelectionsCache: clearSelectionsCache,
    selectOnClick: selectOnClick
};

var runSeries = require('run-series');

var constants = require('./util/constants');
var _bundle = require('./util/browserify_wrapper');
var makeSchema = require('./util/make_schema');

/*
 * This script takes one argument
 *
 * Run `npm run build -- dev` or `npm run build -- --dev`
 * to include source map in the plotly.js bundle
 *
 * N.B. This script is meant for dist builds; the output bundles are placed
 *      in plotly.js/dist/.
 *      Use `npm run watch` for dev builds.
 */

var arg = process.argv[2];
var DEV = (arg === 'dev') || (arg === '--dev');

// list of tasks to pass to run-series to not blow up
// memory consumption.
var tasks = [];

// Browserify plotly.js with meta and output plot-schema JSON
tasks.push(function(cb) {
    _bundle(constants.pathToPlotlyIndex, constants.pathToPlotlyDistWithMeta, {
        standalone: 'Plotly',
        debug: DEV,
        noCompress: true
    }, function() {
        makeSchema(constants.pathToPlotlyDistWithMeta, constants.pathToSchema)();
        cb();
    });
});

runSeries(tasks, function(err) {
    if(err) throw err;
});

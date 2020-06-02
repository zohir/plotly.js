/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var maxRowLength = require('../../lib').maxRowLength;

/* Return a list of empty points in 2D array z
 * each empty point z[i][j] gives an array [i, j, neighborCount]
 * neighborCount is the count of 4 nearest neighbors that DO exist
 * this is to give us an order of points to evaluate for interpolation.
 * if no neighbors exist, we iteratively look for neighbors that HAVE
 * neighbors, and add a fractional neighborCount
 */
module.exports = function findEmpties(z) {
    console.log('findEmpties', z);
    var empties = [];
    var neighborHash = {};
    var noNeighborList = [];
    var blank = [0, 0, 0];
    var i;
    var j;
    var thisPt;
    var p;
    var neighborCount;
    var newNeighborHash;
    var foundNewNeighbors;

    var ni = z.length;
    var nj = maxRowLength(z);
    for(i = 0; i < ni; i++) {
        for(j = 0; j < nj; j++) {
            if(z[i][j] !== undefined) continue;
            console.log('i:' + i + ', j:' + j);

            neighborCount = 0;
            if(j > 0 && z[i][j - 1] !== undefined) {
                console.log('case A');
                neighborCount++;
            }
            if(j < nj - 1 && z[i][j + 1] !== undefined) {
                console.log('case B');
                neighborCount++;
            }
            if(i > 0 && z[i - 1][j] !== undefined) {
                console.log('case C');
                neighborCount++;
            }
            if(i < ni - 1 && z[i + 1][j] !== undefined) {
                console.log('case D');
                neighborCount++;
            }

            console.log('neighborCount:', neighborCount);

            if(neighborCount) {
                // for this purpose, don't count off-the-edge points
                // as undefined neighbors
                if(i === 0) neighborCount++;
                if(j === 0) neighborCount++;
                if(i === ni - 1) neighborCount++;
                if(j === nj - 1) neighborCount++;

                // if all neighbors that could exist do, we don't
                // need this for finding farther neighbors
                if(neighborCount < 4) {
                    neighborHash[[i, j]] = [i, j, neighborCount];
                }

                empties.push([i, j, neighborCount]);
            } else noNeighborList.push([i, j]);
        }
    }

    console.log('noNeighborList.length:', noNeighborList.length);

    while(noNeighborList.length) {
        newNeighborHash = {};
        foundNewNeighbors = false;

        // look for cells that now have neighbors but didn't before
        for(p = noNeighborList.length - 1; p >= 0; p--) {
            thisPt = noNeighborList[p];
            i = thisPt[0];
            j = thisPt[1];

            neighborCount = (
                (neighborHash[[(i - 1), j]] || blank)[2] +
                (neighborHash[[(i + 1), j]] || blank)[2] +
                (neighborHash[[i, (j - 1)]] || blank)[2] +
                (neighborHash[[i, (j + 1)]] || blank)[2]
            ) / 20;

            if(neighborCount) {
                newNeighborHash[thisPt] = [i, j, neighborCount];
                noNeighborList.splice(p, 1);
                foundNewNeighbors = true;
            }
        }

        if(!foundNewNeighbors) {
            throw 'findEmpties iterated with no new neighbors';
        }

        // put these new cells into the main neighbor list
        for(thisPt in newNeighborHash) {
            neighborHash[thisPt] = newNeighborHash[thisPt];
            empties.push(newNeighborHash[thisPt]);
        }
    }

    // sort the full list in descending order of neighbor count
    var result = empties.sort(function(a, b) { return b[2] - a[2]; });
    console.log(result);
    return result;
};

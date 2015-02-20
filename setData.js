var geolensData; // a global
var currentDepth; // lowest histogram level
var lowestDepth = 2; //lowest depth of the json array. todo dont hardcode: send over or compute?
var currentFeature; //current selected feature.
var currentPath = "";

function setDataAndVisualize() {
    if (!currentFeature) currentFeature = setCurrentFeature();
    d3.json("json/output.json", function (error, json) {
        //error handling
        if (error) return console.warn(error);
        //get rectangle coords, and start parsing geohash data.
        var geoHashRecData = json.geolens[0];
        var histData = json.geolens[1];
        geolensData = histData;
        drawGeohashes(geoHashRecData);
        getData(histData, 0, 0);
        currentDepth = 0;
    });
}

function getData(fullData, wantedDepth) {
    var currentData = fullData.aggInfo;
    var newData = {
        "histogram": [],
        "geohashColors": []
    };
    var path = currentPath.split(":");
    //adjust current data
    if (path.length > 1) {
        //empty one always placed in the back
        path.pop();
        //get the correct object to visualize based on the current path.
        for (var i = 0; i < path.length; i++) {
            currentData = currentData[path[i]];
        }
    }
    var tree = [];
    for (var currentKey in currentData) {
        if (currentData.hasOwnProperty(currentKey)) {
            if (wantedDepth == lowestDepth) { //are we at the lowest depth.
                if (currentKey == "hists") { //get histogram data
                    var histData = currentData[currentKey];
                    newData.histogram = getLowestHistogramData(histData,newData.histogram);
                } //histogram key
                else if (currentKey == "hashes") {
                    //geohash info
                    var geohashColorsData = currentData[currentKey];
                    newData.geohashColors = getLowestGeoHashTilesData(geohashColorsData,newData.geohashColors);
                }
            } //wanted depth
            else {
                //we are not at the end, grab the histogram averages.
                var nextChild = currentData[currentKey].avgs;
                //get the right feature
                for (var average in nextChild) {
                    if (nextChild.hasOwnProperty(average)) {
                        if (average == getCurrentFeature()) {
                            var entry = new XYCoordinates(currentKey, nextChild[average]); //create coordinates for d3
                            newData.histogram.push(entry); // add the data
                        }
                    }
                }
                //console.log(currentKey);
                //tree.push(currentData[currentKey]);
                //traverse(currentData);
                //var there = false;
                //while(!there) {
                //    console.log(currentData);
                //    if ('hashes' in currentData) {
                //        var geohashColorsData = currentData[currentKey];
                //        newData.geohashColors = getLowestGeoHashTilesData(geohashColorsData,newData.geohashColors);
                //    }
                //    else{
                //        var nextStep = currentData[currentKey];
                //        if(nextStep ===undefined ){
                //            for (var foo in currentData) {
                //                if (currentData.hasOwnProperty(foo)) {
                //                    currentData = currentData[foo];
                //                }
                //            }
                //        }
                //        else{
                //            currentData = currentData[currentKey];
                //        }
                //    }
                //}
                //for (var hash in geohashColorsData) {
                //    if (geohashColorsData.hasOwnProperty(hash)) {
                //        for (var possibleFeatures in geohashColorsData[hash]) {
                //            if (geohashColorsData[hash].hasOwnProperty(possibleFeatures)) {
                //                if (possibleFeatures == getCurrentFeature()) { //get data for current desired feature
                //                    var featureValue = geohashColorsData[hash][possibleFeatures];
                //                    var hashColorCombo = new HashColorCombo(hash, featureValue);
                //                    colorData.push(hashColorCombo); // add the data
                //                    max = (max < featureValue) ? featureValue : max;
                //                    min = (min > featureValue) ? featureValue : min;
                //                }
                //            } //current feature
                //        } //iterate possible features
                //    } //own property check
                //} //end for
                //colorData = computeGeoHashColors(colorData, max, min); //compute colors from data.
                //return colorData;
            }
        }
    }
    console.log(tree);
    var merged = MergeRecursive(tree[0], tree[1]);
    console.log(merged);
    return newData;
}
/*
 * Recursively merge properties of two objects
 */
function MergeRecursive(obj1, obj2) {

    for (var p in obj2) {
        try {
            // Property in destination object set; update its value.
            if ( obj2[p].constructor==Object ) {
                obj1[p] = MergeRecursive(obj1[p], obj2[p]);

            } else {
                obj1[p] = obj2[p];

            }

        } catch(e) {
            // Property in destination object not set; create it and set its value.
            obj1[p] = obj2[p];

        }
    }

    return obj1;
}

function setCurrentFeature() {
    currentFeature = $('input[name="features"]:checked').val();
    if (geolensData === undefined || geolensData === null) {
    }
    else {
        var mutableCurrentDepth = currentDepth;
        while (mutableCurrentDepth >= 0) {
            var newHist = "histogramVis" + mutableCurrentDepth;
            $("#" + newHist).remove();
            mutableCurrentDepth--;
        }
        currentPath = "";
        currentDepth = 0;
        var newData = getData(geolensData, 0, 0);
        drawHistogram(newData.histogram, 0, "Overview");
    }
}


//traverse down and get geohash info
//called with every property and it's value


function traverse(jsonObj) {
    if( typeof jsonObj == "object" ) {
        $.each(jsonObj, function(k,v) {
            // k is either an array index or object key
            console.log(jsonObj);
            traverse(v);
        });
    }
    else {
        // jsonOb is a number or string
        console.log(jsonObj);
    }
}
/**
 *
 *
 */
function handleHistClick(clickedBar, depth) {
    //get title from clicked bar
    var title = clickedBar.x;
    if (currentDepth == depth) {
        var proposedDepth = depth + 1;
        if (proposedDepth <= lowestDepth) {
            currentPath += title + ":";
            var data = getData(geolensData, proposedDepth, title);
            drawHistogram(data.histogram, proposedDepth, title);
            currentDepth++;
        }
    }
    else {
        //remove histogram or histograms
        //add new one with click data
        var clickedDepth = depth;
        var mutableCurrentDepth = currentDepth;
        while (mutableCurrentDepth > clickedDepth) {
            var newHist = "histogramVis" + mutableCurrentDepth;
            $("#" + newHist).remove();
            depth--;
            mutableCurrentDepth--;
            //remove last colon
            var str = currentPath.substring(0, currentPath.length - 1);
            var n = str.lastIndexOf(":");
            currentPath = currentPath.substring(0, n + 1);
        }
        currentDepth = mutableCurrentDepth;
    }
}
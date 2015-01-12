var WebGLRenderer = Backbone.Model.extend({

    /**
     * @memberOf WebGLRenderer
     */
    run: function () {

        var gl = this.get("gl");

        var visSpecs = this.get("binnedPlots").get("visSpecs");

        if (!this.get("program")) {
            this.set("program", this.createProgram(gl));
        }

        gl.useProgram(this.get("program"));

        var processor = this.get("processor");
        var rollupTexture;
        if (processor.has("resultImg")) {
            rollupTexture = processor.get("resultImg");

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindTexture(gl.TEXTURE_2D, rollupTexture);

//			gl.clearColor(0.0, 0.0, 0.0, 0.0);                      // Set clear color to black, fully opaque  
//			gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);  
        }
        else {
            //processor is not using WebGL
        }

        this.clear();

        for (var s in visSpecs) {
            this.setVisualTileParameters(visSpecs[s]);

            //draw 2D plots on the foreground
            if (visSpecs[s].get("cols").length == 2 && this.isBg())    continue;

            //for 1D plots, do not draw on foreground when there's no filter
            if (!this.isBg() && !this.get("binnedPlots").get("brushFilter") && visSpecs[s].get("cols").length == 1)    continue;

            this.paint(gl, visSpecs[s], processor);
        }
    },

    paint: function (gl, vSpec, processor) {
        var w = this.get("binnedPlots").get("width");
        var h = this.get("binnedPlots").get("height");
        gl.viewport(0, 0, w, h);

        var vTile;
        var xPos = vSpec.get("x");
        var yPos = vSpec.get("yFromTop");
        var x, y;
        for (var vTileId in vSpec.get("visualTiles")) {
            vTile = vSpec.get("visualTiles")[vTileId];

            if (vTile.getNumDataTile() == 0)    continue;

            this.setProgramParameters(gl, vTile, processor, vSpec, 0.5, 0.5);

            x = xPos + vTile.get("containerX");
            y = h - yPos - vTile.get("containerY");

            this.drawPart(gl, (x - 20) * 2 / w, (y + 5) * 2 / h,
                (x + vTile.get("visWidth") + 5) * 2 / w,
                (y - vTile.get("visHeight") - 5) * 2 / h,
                w, h);
        }
        if (this.isBg())
            this.drawAxis(vSpec);
        else if (vSpec.get("type") != VisSpec.visTypes.geo && vSpec.get("cols").length == 2)
            this.drawAxis(vSpec);
    },

    getOrdinalScale: function (col, size) {
        var binCnts = dataManager.get("metadata")[col].binsPerTile;
        var domainValues = [];
        var ticks = [];
        var numTicks = Math.ceil(binCnts / (size / 15));

        for (var a = 0; a < binCnts; a++) {
            domainValues.push(dataManager.get("metadata")[col].binNames[a]);
            if (a % numTicks == 0)
                ticks.push(dataManager.get("metadata")[col].binNames[a]);
        }
        var scale = d3.scale.ordinal().domain(domainValues).rangeBands([0, size]);
        scale.temp = ticks;
        return scale;
    },

    getLinearScale: function (col, size, isDimension, spec, reverse) {
        var scale;
        //for heatmaps
        if (isDimension) {
            var idx = spec.get("cols").indexOf(col);
            var globalStartV = dataManager.get("metadata")[col].binStartValue;
            var startV = globalStartV + spec.get("startBins")[idx] * dataManager.get("metadata")[col].binWidth;
            var endV = globalStartV + spec.get("endBins")[idx] * dataManager.get("metadata")[col].binWidth;
            scale = d3.scale.linear().domain([startV, endV]);
        } else {
            var processor = this.get("processor");
            var maxAggr = this.get("binnedPlots").get("rollupStats")[processor.getBinTexIdx(spec.get("cols"))][0] * 255;
            scale = d3.scale.linear().domain([0, maxAggr]);
        }
        if (reverse)
            scale.range([size, 0]);
        else
            scale.range([0, size]);
        return scale;
    },

    drawAxis: function (spec) {

        var r, c;
        var cols = spec.get("cols");
        r = cols[0];
        c = cols.length > 1 ? cols[1] : cols[0];

        var xScale, yScale;
        if (spec.get("type") == VisSpec.visTypes.hist) {
            if (dataManager.get("metadata")[r].dType >= DataManager.dataTypes.categorical)
                xScale = this.getOrdinalScale(r, spec.get("width"));
            else
                xScale = this.getLinearScale(r, spec.get("width"), true, spec);
            yScale = this.getLinearScale(r, spec.get("height"), false, spec, true);

            var xAxis = d3.svg.axis().orient("bottom").scale(xScale).tickValues(xScale.temp);
            d3.select("#xaxis" + spec.getSpecId()).call(xAxis);
            var yAxis = d3.svg.axis().orient("left").scale(yScale).tickFormat(d3.format(" ,s")).ticks(5);
            d3.select("#yaxis" + spec.getSpecId()).call(yAxis);
        }
        else if (spec.get("type") == VisSpec.visTypes.bar) {
            if (dataManager.get("metadata")[r].dType >= DataManager.dataTypes.categorical)
                yScale = this.getOrdinalScale(r, spec.get("height"));
            else
                yScale = this.getLinearScale(r, spec.get("height"), false, spec);
            xScale = this.getLinearScale(r, spec.get("width"), false, spec);

            var xAxis = d3.svg.axis().orient("bottom").scale(xScale).tickFormat(d3.format(" ,s")).ticks(5); //.tickValues(ticks);
            d3.select("#xaxis" + spec.getSpecId()).call(xAxis);
            var yAxis = d3.svg.axis().orient("left").scale(yScale);//.ticks(5);
            d3.select("#yaxis" + spec.getSpecId()).call(yAxis);
        }
        else {
            var xAxis, yAxis;
            if (dataManager.get("metadata")[r].dType >= DataManager.dataTypes.categorical) {
                xScale = this.getOrdinalScale(r, spec.get("width"));
                xAxis = d3.svg.axis().orient("bottom").scale(xScale);
            }
            else {
                xScale = this.getLinearScale(r, spec.get("width"), true, spec);
                xAxis = d3.svg.axis().orient("bottom").scale(xScale).tickFormat(d3.format(" ,s")).ticks(5);
            }

            if (dataManager.get("metadata")[c].dType >= DataManager.dataTypes.categorical) {
                yScale = this.getOrdinalScale(c, spec.get("height"));
                yAxis = d3.svg.axis().orient("left").scale(yScale);
            }
            else {
                yScale = this.getLinearScale(c, spec.get("height"), true, spec, true);
                yAxis = d3.svg.axis().orient("left").scale(yScale).tickFormat(d3.format(" ,s")).ticks(5);
            }


            d3.select("#xaxis" + spec.getSpecId()).call(xAxis);
            d3.select("#yaxis" + spec.getSpecId()).call(yAxis);
        }
    },

    setProgramParameters: function (gl, vTile, processor, vSpec, loColor, hiColor) {
        var prog = this.get("program");
        var topleftAbsPix;

        if (vSpec.get("type") == VisSpec.visTypes.geo) {
            var map = vSpec.get("bgmap");
            topleftAbsPix = map.containerPointToLayerPoint([0, 0]).add(map.getPixelOrigin());
        } else if (vSpec.get("cols").length == 1) {
            topleftAbsPix = {x: vSpec.get("startBins")[0] * vSpec.get("pixPerBin")[0], y: 0};
        } else {
            topleftAbsPix = {
                x: vSpec.get("startBins")[0] * vSpec.get("pixPerBin")[0],
                y: vSpec.get("startBins")[1] * vSpec.get("pixPerBin")[1]
            };
        }

        var cols = vSpec.get("cols");
        var rollupTexture = processor.get("resultImg");
        var rollupStats = this.get("binnedPlots").get("rollupStats")[processor.getBinTexIdx(cols)];

        var xPos = vSpec.get("x");
        var yPos = vSpec.get("yFromTop");
        gl.uniform1f(prog.visXPos, xPos);
        gl.uniform1f(prog.visYPos, yPos);

        gl.uniform1f(prog.xLoc, vTile.getIdx() * vSpec.get("fboWidthPerVTile"));
        gl.uniform1f(prog.yLoc, processor.getYPosOnFBO(vSpec));
        gl.uniform1i(prog.texture, 0);
        gl.uniform1f(prog.visType, vSpec.get("type"));

        gl.uniform1f(prog.plotsHt, this.get("binnedPlots").get("height"));
        gl.uniform1f(prog.exp, this.get("alpha_exp"));

        gl.uniform1f(prog.bufferMax, rollupStats[0]);
        gl.uniform1f(prog.bufferMin, rollupStats[2]);
        gl.uniform1f(prog.avgPix, rollupStats[1]);

        gl.uniform1f(prog.visTileWd, vTile.get("visWidth"));
        gl.uniform1f(prog.visTileHt, vTile.get("visHeight"));
        gl.uniform1f(prog.textureWd, rollupTexture.width);
        gl.uniform1f(prog.textureHt, rollupTexture.height);
        gl.uniform1f(prog.visWd, vSpec.get("width"));


        gl.uniform2f(prog.pixOffsets, vTile.get("xOffsetPix"), vTile.get("yOffsetPix"));
        gl.uniform2f(prog.containerPos, vTile.get("containerX"), vTile.get("containerY"));
        gl.uniform1f(prog.loV, actionManager.getLoV() / 255);
        gl.uniform1f(prog.hiV, actionManager.getHiV() / 255);
        gl.uniform1f(prog.expParam, actionManager.getExpParam() / 255);


        gl.uniform2f(prog.pixOrigin, topleftAbsPix.x, topleftAbsPix.y);

        if (cols.length > 1) {
            var binSize = dataManager.get("metadata")[cols[0]].binsPerTile;
            var pixPerBin = vSpec.get("pixPerBin")[0];

            gl.uniform1f(prog.visTileSize, binSize * pixPerBin);
            gl.uniform2f(prog.cols, cols[0], cols[1]);
            gl.uniform2f(prog.binCnts, dataManager.get("metadata")[cols[0]].binsPerTile,
                dataManager.get("metadata")[cols[1]].binsPerTile);
        } else {
            gl.uniform2f(prog.cols, cols[0], cols[0]);
            var binCntPerTile = dataManager.get("metadata")[cols[0]].binsPerTile;

            gl.uniform1f(prog.oneDPlotHt, vSpec.get("height"));
            gl.uniform1f(prog.histGap, vSpec.get("histGap"));
            gl.uniform1f(prog.visTileSize, dataManager.get("metadata")[cols[0]].totalBinCnt / binCntPerTile <= 1 ?
                vSpec.get("width") : binCntPerTile * vSpec.get("pixPerBin")[0]);
            var color = this.isBg() ? this.get("bg_histColor") : this.get("fg_histColor");
            gl.uniform3f(prog.histColor, color[0], color[1], color[2]);
            gl.uniform2f(prog.binCnts, dataManager.get("metadata")[cols[0]].binsPerTile,
                dataManager.get("metadata")[cols[0]].binsPerTile);
        }
    },

    setVisualTileParameters: function (vSpec) {
        var xCol, yCol, xPixPerBin, yPixPerBin;
        var swAbsPix, neAbsPix;
        var pixPerBin = vSpec.get("pixPerBin");
        if (vSpec.get("cols").length == 1) {
            xCol = vSpec.get("cols")[0];
            yCol = vSpec.get("cols")[0];
            xPixPerBin = pixPerBin[0];
            yPixPerBin = xPixPerBin;
            swAbsPix = {x: vSpec.get("startBins")[0] * xPixPerBin, y: 0};
            neAbsPix = {x: vSpec.get("startBins")[0] * xPixPerBin + vSpec.get("width"), y: 0};
        } else if (vSpec.get("type") == VisSpec.visTypes.geo) {
            var map = vSpec.get("bgmap");
            swAbsPix = map.containerPointToLayerPoint([0, vSpec.get("height")]).add(map.getPixelOrigin());
            neAbsPix = map.containerPointToLayerPoint([vSpec.get("width"), 0]).add(map.getPixelOrigin());

            xCol = vSpec.get("cols")[0];
            yCol = vSpec.get("cols")[1];
            xPixPerBin = pixPerBin[0];
            yPixPerBin = pixPerBin[1];
        } else {
            xCol = vSpec.get("cols")[0];
            yCol = vSpec.get("cols")[1];
            xPixPerBin = pixPerBin[0];
            yPixPerBin = pixPerBin[1];
            swAbsPix = {
                x: vSpec.get("startBins")[0] * xPixPerBin,
                y: vSpec.get("startBins")[1] * yPixPerBin + vSpec.get("height")
            };
            neAbsPix = {
                x: vSpec.get("startBins")[0] * xPixPerBin + vSpec.get("width"),
                y: vSpec.get("startBins")[1] * yPixPerBin
            };
        }

        var tileXBinCnt = dataManager.get("metadata")[xCol].binsPerTile;
        var tileYBinCnt = dataManager.get("metadata")[yCol].binsPerTile;

        var visTileWidth, visTileHeight;
        var xTotalBinCnt = dataManager.get("metadata")[xCol].totalBinCnt;
        var xBinCntPerTile = dataManager.get("metadata")[xCol].binsPerTile;
        var yTotalBinCnt = dataManager.get("metadata")[yCol].totalBinCnt;
        var yBinCntPerTile = dataManager.get("metadata")[yCol].binsPerTile;

        if (xTotalBinCnt / xBinCntPerTile <= 1)
            visTileWidth = vSpec.get("width");
        else
            visTileWidth = tileXBinCnt * xPixPerBin;

        if (yTotalBinCnt / yBinCntPerTile <= 1)
            visTileHeight = vSpec.get("height");
        else
            visTileHeight = tileYBinCnt * yPixPerBin;


        var vTile, vTileDimInfos, tileLeft, tileTop;
        for (var vTileId in vSpec.get("visualTiles")) {
            vTile = vSpec.get("visualTiles")[vTileId];
            vTileDimInfos = vTile.getDimensionInfos();

            //containerX: x coord of topleft corner wrp to the container
            //width: visible width of the tile inside the map
            //containerY: y coord of topleft corner wrp to the container
            //height: visible height of the tile inside the map
            tileLeft = Math.floor(vTileDimInfos[xCol].getStartBin() / tileXBinCnt) * tileXBinCnt;
            tileTop = Math.floor(vTileDimInfos[yCol].getStartBin() / tileYBinCnt) * tileYBinCnt;
            vTile.set("containerX", tileLeft * xPixPerBin - swAbsPix.x);
            vTile.set("containerY", tileTop * yPixPerBin - neAbsPix.y);
            vTile.set("xOffsetPix", 0);
            vTile.set("yOffsetPix", 0);

            vTile.set("visWidth", visTileWidth);
            vTile.set("visHeight", visTileHeight);

            if (vTile.get("containerX") < 0) {
                vTile.set("visWidth", vTile.get("visWidth") + vTile.get("containerX"));
                vTile.set("containerX", 0);
                vTile.set("xOffsetPix", visTileWidth - vTile.get("visWidth"));
            }
            else if (vTile.get("containerX") + visTileWidth > vSpec.get("width"))
                vTile.set("visWidth", visTileWidth - ( vTile.get("containerX") + visTileWidth - vSpec.get("width")));

            if (vTile.get("containerY") < 0) {
                vTile.set("visHeight", visTileHeight + vTile.get("containerY"));
                vTile.set("containerY", 0);
                vTile.set("yOffsetPix", visTileHeight - vTile.get("visHeight"));
            }
            else if (vTile.get("containerY") + visTileHeight > vSpec.get("height"))
                vTile.set("visHeight", visTileHeight - ( vTile.get("containerY") + visTileHeight - vSpec.get("height")));
        }

    },

    createProgram: function (gl) {
        var p = gl.createProgram();
        gl.attachShader(p, Shaders.getVertexShader(gl));

        gl.attachShader(p, Shaders.getRenderShader_4Byte(gl));
        gl.linkProgram(p);

        p.textureWd = gl.getUniformLocation(p, "u_texw");
        p.textureHt = gl.getUniformLocation(p, "u_texh");
        p.texture = gl.getUniformLocation(p, "u_data");
        p.visTileWd = gl.getUniformLocation(p, "u_visTileWd");
        p.visTileHt = gl.getUniformLocation(p, "u_visTileHt");
        p.visXPos = gl.getUniformLocation(p, "u_visXPos");
        p.visYPos = gl.getUniformLocation(p, "u_visYPos");
        p.binCnts = gl.getUniformLocation(p, "u_binCnts");
        p.cols = gl.getUniformLocation(p, "u_cols");
        p.xLoc = gl.getUniformLocation(p, "u_xLoc");
        p.yLoc = gl.getUniformLocation(p, "u_yLoc");

        p.histGap = gl.getUniformLocation(p, "u_histGap");
        p.exp = gl.getUniformLocation(p, "u_exp");
        p.visTileSize = gl.getUniformLocation(p, "u_tileSize");
        p.bufferMax = gl.getUniformLocation(p, "u_bufferMax");
        p.bufferMin = gl.getUniformLocation(p, "u_bufferMin");
        p.avgPix = gl.getUniformLocation(p, "u_avgPix");
        p.visWd = gl.getUniformLocation(p, "u_canvasWd");
        p.plotsHt = gl.getUniformLocation(p, "u_plotsHt");
        p.oneDPlotHt = gl.getUniformLocation(p, "u_1dPlotHt");
        p.pixOffsets = gl.getUniformLocation(p, "u_pixOffsets");
        p.texIdx = gl.getUniformLocation(p, "u_texIdx");
        p.containerPos = gl.getUniformLocation(p, "u_containerPos");

        p.pixOrigin = gl.getUniformLocation(p, "u_pixOrigin");
        p.zm = gl.getUniformLocation(p, "u_zm");

        p.transformation = gl.getUniformLocation(p, "u_trans");

        p.loV = gl.getUniformLocation(p, "u_loV");
        p.hiV = gl.getUniformLocation(p, "u_hiV");
        p.histColor = gl.getUniformLocation(p, "u_histColor");
        p.expParam = gl.getUniformLocation(p, "u_exp");

        p.visType = gl.getUniformLocation(p, "u_visType");

        return p;
    },

    drawPart: function (gl, x1, y1, x2, y2, wd, ht) {
        var prog = this.get("program");
        var positionLocation = gl.getAttribLocation(prog, "a_position");
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1.0 + x1, -1.0 + y1,
                -1.0 + x2, -1.0 + y1,
                -1.0 + x1, -1.0 + y2,
                -1.0 + x1, -1.0 + y2,
                -1.0 + x2, -1.0 + y1,
                -1.0 + x2, -1.0 + y2]),
            gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        //gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        // draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        //gl.flush();
    },

    isBg: function () {
        return this.get("isBg");
    },

    clear: function () {
        var gl = this.get("gl");
        gl.clearColor(0.0, 0.0, 0.0, 0.0);                      // Set clear color to black, fully opaque
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);      // Clear the color as well as the depth buffer.
    },

    initialize: function () {
        this.set("alpha_exp", 0.33);
        this.set("bg_histColor", [0.27, 0.51, 0.71]);
        this.set("fg_histColor", [1.0, 0.647, 0.0]);
        this.set("bg_barColor", [0.702, 0.859, 1.0]); //[0.8, 0.906, 1.0]);
        this.set("fg_barColor", [1.0, 0.72, 0.302]);
        this.set("loColors", d3.scale.linear().domain([0, 1]).range([d3.rgb(255, 255, 204), d3.rgb(255, 255, 0)]));
        this.set("hiColors", d3.scale.linear().domain([0, 1]).range([d3.rgb(255, 102, 153), d3.rgb(204, 0, 0)]));
    },
});
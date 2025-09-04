<template>
  <div ref="chartContainer" class="chart-container" :style="{ width: width + 'px', height: height + 'px' }"></div>
</template>


<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { interpolateYCoordinate, downsampleQuick, calcDataXExtent, calcYextWithinX, downsampleParallel, findRange,
  calcDataYExtent , calcDataYextWithinX } from '../utility';

let svg, xScale, yScale, currentXDomain, currentYDomain, chart;
const props = defineProps({
  lineData: Object,
  width: Number,
  height: Number,
  xDomain: Array,    // [xmin, xmax]
  yDomain: Array,    // [ymin, ymax]
  hasJob: Boolean
});
let tempBoldSigs = [];
const cursorInfo = defineModel("cursorInfo");
const jobQueue = defineModel("jobQueue");
const labelXOff = 45;
let customYScale = {};  // {variable: yScale}  将变量显示到单独的stripe上面

const chartContainer = ref(null);
let zoom = {
    zoom_status: "none",   // "none", "start", "panning", ""
    zoom_axis: 0,  // 0 for x-axis, 1 for y-axis
    zoom_start: [0, 0],   // in domain coordinates not pixel coordinates
    zoom_end: [0, 0],
};
let { lineData, width, height, hasJob} = props;
let cursor_visible = false;
let cursor_dragging = false;
const margin = { top: 30, right: 10, bottom: 20, left: 30 };
const emit = defineEmits(["open-context-menu"]);

const updateCursor = (xOffset) => {
    ({ lineData, width, height, hasJob} = props);
    if (!cursor_visible) {
      d3.select(chartContainer.value).select('.cursor-line')
      .attr('opacity', 0).attr("class", "cursor-line");// Hide cursor line
      d3.selectAll('.cursor-label').attr('opacity', 0); // Hide cursor labels
      d3.select(chartContainer.value).select(`.time-label`).attr('opacity', 0);
      const cursorRegion = d3.select(chartContainer.value).select('.cursor-region');
      cursorRegion.select("rect").attr('class', '');
      cursorInfo.value.visible = false;
    } else {
        const xValue = xScale.invert(xOffset);  
        cursorInfo.value.time = xValue;  // Update cursor time
        const cursorRegion = d3.select(chartContainer.value).select('.cursor-region');
        cursorRegion.attr('transform', `translate(${xOffset}, 0)`);   // move the cursor region
        cursorRegion.select(".cursor-line").attr('opacity', 1); // Show cursor line
        cursorRegion.select("rect").attr('class', 'cursor-col-resize');
        for (const variable in lineData) {
          const {color, uuid} = lineData[variable];
          const xDom = lineData[variable].x_domain;   
          const label = d3.select(chartContainer.value).select(`#label-${uuid}`);
          const ySigScale = (customYScale != null && Object.hasOwn(customYScale, uuid)) ? customYScale[uuid] : yScale;
          if (xValue >= xDom[0] && xValue <= xDom[1]) {
            const yValue = interpolateYCoordinate(lineData[variable].time, lineData[variable].pathData, xValue); // interpolate y value
            const yCoordination = ySigScale(yValue);
            if (!label.empty()) {
              label.attr('opacity', 1).attr('transform', `translate(${labelXOff}, ${yCoordination})`);
              label.select('text').text(yValue.toFixed(5));
            } else {
              drawLabel(cursorRegion, yValue.toFixed(5), labelXOff, yCoordination, color, "cursor-label", `label-${uuid}`);
            }
            cursorInfo.value["value"][uuid] = yValue;
          } else {
            label.attr('opacity', 0);
            cursorInfo.value["value"][uuid] = NaN;      // out of range; set to NaN
          }
        }
        // add time label at top
        const timeLabel = d3.select(chartContainer.value).select(".time-label");
        if (!timeLabel.empty()) {
          timeLabel.attr('opacity', 1).attr('transform', `translate(${0}, ${-10})`);
          timeLabel.select('text').text(xValue.toFixed(5));
        } else {
          drawLabel(cursorRegion, xValue.toFixed(4), 0, -10, 'black', "time-label");
        }
    }
}

async function drawChart(x_domain, y_domain) {
    xScale = d3.scaleLinear()
      .domain(x_domain)
      .range([0, width - margin.right - margin.left]);
    yScale = d3.scaleLinear()
      .domain(y_domain)
      .range([height - margin.bottom - margin.top, 0]);
    svg = d3.select(chartContainer.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('tabindex', "0")
      .attr('style', 'position: absolute; left:0; top:0; z-index: 1;')
    chart = svg.append('g')
                     .attr('transform', `translate(${margin.left}, ${margin.top})`);
    for ( const key in lineData) {
      const uuid = lineData[key].uuid;
      const yscale = (Object.hasOwn(customYScale, uuid)) ? customYScale[uuid] : yScale;
      drawPath(key, x_domain, yscale);
    }
    // add cursor
    const midX = xScale((x_domain[0] + x_domain[1]) / 2);
    const cursorRegion = chart.append('g').attr('class', 'cursor-region')
      .attr('transform', `translate(${midX}, 0)`);
    cursorRegion.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', height - margin.bottom - margin.top)
      .attr('stroke', 'red')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('class', 'cursor-line');
    cursorRegion.append('rect')
      .attr('x', -10)
      .attr('y', 0)
      .attr('width', 20)
      .attr('height', height - margin.bottom - margin.top)
      .attr('opacity', 0)
      .attr('class', 'cursor-col-resize')
      .on("mousedown", function(event) {
        if (event.button === 0 && cursor_visible) { // left button
            cursor_dragging = true;
            d3.select(chartContainer.value).select(".cursor-line").attr("stroke", "blue");
            window.addEventListener("mousemove", cursorDrag);
        }
      });
      //add cursor label
    updateCursor(midX);
    cursorInfo.value.time = xScale.invert(midX);

    // add rect to conceal overflow path and circles
    chart.append('rect')
      .attr('x', -margin.left)
      .attr('y', 0)
      .attr('width', margin.left)
      .attr('height', height - margin.bottom - margin.top)
      .attr('fill', 'white');
    chart.append('rect')
      .attr('x', 0)
      .attr('y', height - margin.bottom - margin.top)
      .attr('width', width)
      .attr('height', margin.bottom)
      .attr('fill', 'white');
    // add x gridlines
    chart.append('g').attr('class', 'grid').selectAll('line')
      .data(xScale.ticks(12))
      .join("line")
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 0).attr('y2', height - margin.bottom - margin.top)
      .attr('stroke', 'lightgray')
      .attr('stroke-width', 1)
      .attr("stroke-dasharray", "10,10")
      .attr('opacity', 0.6);

    // add y gridlines
    chart.append('g').attr('class', 'grid-y').selectAll('line')
      .data(yScale.ticks(12))
      .join("line")
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('x1', 0).attr('x2', width - margin.left - margin.right)
      .attr('stroke', 'lightgray')
      .attr('stroke-width', 1)
      .attr("stroke-dasharray", "10,10")
      .attr('opacity', 0.5);

    chart.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom - margin.top})`).attr("style", "user-select: none;")
      .call(d3.axisBottom(xScale).ticks(12));
    chart.append('g')
      .attr('transform', `translate(0, 0)`).attr("style", "user-select: none;")
      .call(d3.axisLeft(yScale).ticks(12));
    
    svg.on('mousedown', function(event) {  // zooming
      if (zoom.zoom_status === "none" && event.button === 2) {
        zoom.zoom_status = "start";
        const [x, y] = d3.pointer(event);
        const xValue = xScale.invert(x - margin.left);
        const yValue = yScale.invert(y - margin.top);
        zoom.zoom_start = [xValue, yValue];
        zoom.zoom_end = zoom.zoom_start;
      }
    });
    svg.on('mousemove', function(event) {
      const [x_corr, y_corr] = d3.pointer(event);
      const xValue = xScale.invert(x_corr - margin.left);
      const yValue = yScale.invert(y_corr - margin.top);
      if (zoom.zoom_status === "start" && event.buttons === 2) {
        zoom.zoom_end = [xValue, yValue];
        const [x_start, x_end] = xScale.domain();
        const [y_start, y_end] = yScale.domain();
        const xRange = x_end - x_start;
        const yRange = y_end - y_start;
        const [x1, y1] = zoom.zoom_start;
        const [x2, y2] = zoom.zoom_end;
        if (Math.abs(zoom.zoom_end[0] - zoom.zoom_start[0]) > 0.05 * xRange) {
          zoom.zoom_status = "panning";
          zoom.zoom_axis = 0; // x-axis
          const x_start = Math.min(xScale(x1), xScale(x2));
          const x_end = Math.max(xScale(x1), xScale(x2));
          const [ymin, ymax] = yScale.range();
          chart.append('rect')
            .attr('class', 'zoom-rect')
            .attr('x', x_start)
            .attr('y', ymax)
            .attr('width', x_end - x_start)
            .attr('height', ymin - ymax)
            .attr('fill', 'gray')
            .attr('opacity', 0.2)
        } else if (Math.abs(zoom.zoom_end[1] - zoom.zoom_start[1]) > 0.05 * yRange) {
            zoom.zoom_status = "panning";
            zoom.zoom_axis = 1; // y-axis
            const y_start = Math.min(yScale(y1), yScale(y2));
            const y_end = Math.max(yScale(y1), yScale(y2));
            const [xmin, xmax] = xScale.range();
            chart.append('rect')
              .attr('class', 'zoom-rect')
              .attr('x', xmin)
              .attr('y', y_start)
              .attr('width', xmax - xmin)
              .attr('height', y_end - y_start)
              .attr('fill', 'gray')
              .attr('opacity', 0.2);
        }
      } else if (zoom.zoom_status === "panning" && event.buttons === 2) {
        zoom.zoom_end = [xValue, yValue];
        if (zoom.zoom_axis === 0) {
            const xmin = xScale(Math.min(zoom.zoom_start[0], zoom.zoom_end[0]));
            const xmax = xScale(Math.max(zoom.zoom_start[0], zoom.zoom_end[0]));
            chart.select('.zoom-rect')
               .attr("x", xmin)
               .attr("width", xmax - xmin);
        } else {
            const ymin = yScale(Math.min(zoom.zoom_start[1], zoom.zoom_end[1]));
            const ymax = yScale(Math.max(zoom.zoom_start[1], zoom.zoom_end[1]));
            chart.select('.zoom-rect')
               .attr('y', ymax)
               .attr('height', ymin - ymax);
        }
      }
    }); 
    svg.on("keydown", (e) => {
    if (e.ctrlKey && e.code === "KeyF") {
        // reset zoom
        e.preventDefault();
        zoom.zoom_status = "none";
        zoom.zoom_start = [0, 0];
        zoom.zoom_end = [0, 0];
        zoom.zoom_axis = 0;
        updateChart();
    } else if (e.key === 'r') {
      if (cursor_visible) {
        cursor_visible = false;
        cursorInfo.value.visible = false;
        updateCursor(midX);    // dummy x corrdinate
      } else {
        cursor_visible = true;
        const x = d3.select('.cursor-region').attr('transform').match(/translate\(([^,]+),/)[1];
        let x_corr = xScale.invert(x);
        if (x_corr < x_domain[0] || x_corr > x_domain[1]) {
          x_corr = x_domain[0] + (x_domain[1] - x_domain[0]) / 2;
        }
        updateCursor(xScale(x_corr));
        cursorInfo.value.visible = true;
      }
    } else if (e.key === 'f') {
      fitView();
    } else if (e.key === 'd' && e.ctrlKey) {
      fitToEachView();
    }
  });

    const cursorDrag = (event) => {
      if (cursor_dragging) {
          const x = d3.pointer(event, svg.node())[0];
          updateCursor(x - margin.left);
      }
    }
    currentXDomain = x_domain;
    currentYDomain = y_domain;
}

function onmouseup(event) {
    if (event.buttons  === 0) {
      if (zoom.zoom_status === "panning") {
        const [x_start, y_start] = zoom.zoom_start;
        const [x_end, y_end] = zoom.zoom_end;
        let x_domain, y_domain;
        if (zoom.zoom_axis === 0) {
            x_domain = [Math.min(x_start, x_end), Math.max(x_start, x_end)];
            y_domain = currentYDomain;   //  x轴重新设置后，需要同步更新y_domain
        } else {
            x_domain = currentXDomain;
            y_domain = [Math.min(y_start, y_end), Math.max(y_start, y_end)];
        }
        d3.select(chartContainer.value).select('svg').remove(); // Clear previous chart
        drawChart(x_domain, y_domain);
      } else if (zoom.zoom_status === "start") {
        emit("open-context-menu", event);  // 并没有触发zoom   打开右键菜单
      }
      // Reset zoom status
      zoom.zoom_status = "none";
      zoom.zoom_start = [0, 0];
      zoom.zoom_end = [0, 0];
      zoom.zoom_axis = 0;
      svg.selectAll('.zoom-rect').remove();
    }
    if (cursor_dragging) {
      cursor_dragging = false;
      d3.select(chartContainer.value).select('.cursor-line').attr("stroke", "red");
    }
}

function updateChart() {
  d3.select(chartContainer.value).select('svg').remove(); // Clear previous chart
  ({lineData, width, height, hasJob} = props);   
  const xDomain = calcDataXExtent(lineData);
  const yDomain = calcDataYExtent(lineData);
  console.time("drawChartAct");
  customYScale = {};
  drawChart(xDomain, yDomain).then(() => {
    console.timeEnd("drawChartAct");
  });
}

function fitView() {
  customYScale = {}; 
  ({lineData, width, height, hasJob} = props);  
  d3.select(chartContainer.value).select('svg').remove(); // Clear previous chart 
  const xDomain = currentXDomain;
  const yDomain = calcDataYextWithinX(lineData, xDomain);
  console.time("fitViewDraw");
  drawChart(xDomain, yDomain).then(() => {
    console.timeEnd("fitViewDraw");
  });
} 

function fitToEachView() {   // fit each line to its own y axis
  customYScale = {};  // clear scale info first
  ({lineData, width, height, hasJob} = props);  
  const vars = Object.keys(lineData).reverse();
  const innerHeight = height - margin.top - margin.bottom;
  const stripeHeight = innerHeight / vars.length;
  const xDomain = currentXDomain;   // 没有必要更新xScale
  console.time('fitToEachView');
  vars.forEach((varName, i) => {
    // from top to bottom
    console.time("calcYextWithinX");
    const yDomain = calcYextWithinX(lineData[varName].pathData, xDomain, lineData[varName].time);
    const uuid = lineData[varName].uuid;
    const yRange = [innerHeight - stripeHeight * i, innerHeight - stripeHeight * (i + 1)];
    console.timeEnd("calcYextWithinX");
    customYScale[uuid] = d3.scaleLinear()
      .domain(yDomain)
      .range(yRange);
    console.time("drawPath"+varName);
    drawPath(varName, xDomain, customYScale[uuid]);
    console.timeEnd("drawPath"+varName);
  });
  console.timeEnd('fitToEachView');
  updateCursor(xScale(cursorInfo.value.time));
}

onMounted(() => {
  updateChart();
  cursorInfo.value["value"] = {};
  cursorInfo.value["visible"] = false;

  window.addEventListener('contextmenu', function(event) {
      event.preventDefault();
  });
  window.addEventListener('mouseup', onmouseup);
});

watch(() => props.hasJob, (newVal, oldVal) => {
  if (newVal) {   // has new job to do, start a new task
    let job = jobQueue.value.shift();
    while (job) {
      processJob(job);
      job = jobQueue.value.shift();
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('mouseup', onmouseup);
});


function drawLabel(svg, textStr, x, y, color = "blue", classattr="label", id=undefined) {
  const group = svg.append("g")
    .attr("transform", `translate(${x}, ${y})`)
    .attr("class", classattr)
    .attr("style", "user-select:none")
    .style("pointer-events", "none");
  if (id) group.attr("id", id);
  const lines = textStr.split("\n");
  const text = group.append("text")
    .attr("font-size", "14px")
    .attr("x", 0)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold");
  lines.forEach((line, index) => {
    text.append("tspan")
      .attr("x", 0)
      .attr("dy", index === 0 ? "0em" : "1.2em")
      .text(line);
  });
  const bbox = text.node().getBBox();
  group.insert("rect", "text")
    .attr("x", bbox.x - 10)
    .attr("y", bbox.y - 5)
    .attr("width", bbox.width + 20)
    .attr("height", bbox.height + 10)
    .attr("fill", "white")
    .attr("stroke", color)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("opacity", 0.8)
    .attr("dominant-baseline", "hanging");
  return group;
}

async function drawPath(variableName, xDomain, yScaleSpec=null) {
  const {lineData} = props;  // updated lineData
  if (variableName in lineData) {
    const {color, stroke, uuid, circle, sigName, file} = lineData[variableName];
    yScaleSpec = (Object.hasOwn(customYScale, uuid))? customYScale[uuid]:yScaleSpec;
    if (!yScaleSpec) yScaleSpec = yScale;
    const xRange = findRange(lineData[variableName]["time"], xDomain);
    const yData = lineData[variableName]["pathData"].subarray(xRange[0], xRange[1] + 1);  // slice the data to reduce memory usage
    const xData = lineData[variableName]["time"].subarray(xRange[0], xRange[1] + 1);
    let dataToDraw = [];   // [[x1, y1], [x2, y2], ...]
    console.time("downsample");
    if (yData.length > (width-margin.left-margin.right)) {   // downsample if points number exceeds canvas width
      dataToDraw = await downsampleParallel(yData, xData, width-margin.left-margin.right, xDomain[0], xDomain[1]);
    } else {   // no need to downsample
      for (let i = 0; i < yData.length; i++) {
        dataToDraw.push([xData[i], yData[i]]);
      }
    }
    console.timeEnd("downsample");
    pathreDraw(uuid, color, stroke, dataToDraw, circle, xScale, yScaleSpec);
    pathreDrawSvg(uuid, color, stroke, dataToDraw, circle, xScale, yScaleSpec, sigName, file);
  } else {
    console.log("variableName not found in data:", variableName);
  }
}

const pathreDraw = (uuid, color, stroke, pathData, circle, xScalein, yScalein) => {   
  console.time("pathreDraw");
  d3.select("#path-" + uuid).remove();   
  d3.select("#circle-" + uuid).remove();    
  const canvas = d3.select(chartContainer.value).append('canvas').attr('width', width-margin.right-margin.left)
                    .attr('height', height-margin.bottom-margin.top)
                    .attr('style', `position: absolute; left: ${margin.left}px; top: ${margin.top}px; z-index: 0;`)
                    .attr('id', `path-${uuid}`);
  const ctx = canvas.node().getContext('2d');
  const line = d3.line()
                  .x(d => xScalein(d[0]))
                  .y(d => yScalein(d[1]))
                  .context(ctx);
  ctx.beginPath();
  line(pathData);
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  ctx.stroke();
  if (circle) {
    chart.append('g').attr("id", `circle-${uuid}`).selectAll('circle').data(pathData).join('circle')
      .attr('cx', d => xScalein(d[0]))
      .attr('cy', d => yScalein(d[1]))
      .attr('r', 3)
      .attr('fill', color);
  }
  console.timeEnd("pathreDraw");
}

const pathreDrawSvg = (uuid, color, stroke, pathData, circle, xScalein, yScalein, sigName, file) => {   
  console.time("pathreDrawsvg");
  d3.select("#path-inter-" + uuid).remove();   
  const line = d3.line()
                  .x(d => xScalein(d[0]))
                  .y(d => yScalein(d[1]));
  chart.insert('path', '.cursor-region')    // only for interaction  not visible
    .attr("id", `path-inter-${uuid}`).datum(pathData)
    .attr('d', line)
    .attr('stroke', 'transparent')
    .attr('stroke-width', 20)
    .attr('fill', 'none')
    .style('pointer-events', 'stroke')  // make the path react to mouse event
    .on("mouseover", (e)=> { 
      const [x, y] = d3.pointer(e, chart.node());
      drawLabel(chart, sigName+'\n'+file, x + 10, y - 10, color, "hover-label", `hover-${uuid}`);
    }).on("mouseout", () => {
      d3.select(chartContainer.value).selectAll(`#hover-${uuid}`).remove();
    }).on("click", (e) => {
      let boldLine = tempBoldSigs.pop();
      if (boldLine === uuid) return; // already bolded
      while (boldLine) {
        processJob({resetStroke: boldLine});
        boldLine = tempBoldSigs.pop();
      }
      tempBoldSigs.push(uuid);
      pathreDraw(uuid, color, stroke*2, pathData, circle, xScalein, yScalein);
    });
  if (circle) {
    chart.append('g').attr("id", `circle-${uuid}`).selectAll('circle').data(pathData).join('circle')
      .attr('cx', d => xScalein(d[0]))
      .attr('cy', d => yScalein(d[1]))
      .attr('r', 3)
      .attr('fill', color);
  }
  console.timeEnd("pathreDrawsvg");
}

function processJob (job) {
  const key = Object.keys(job)[0];  // get the only key of the job object
  console.log("got job key:", key, " with value:", job[key])
  switch (key) {
    case "addPath":
    case "modifyPath":   {
      const variableName = job[key];
      drawPath(variableName, currentXDomain);
    }
    break;
    case "deletePath": {
      const uuid = job[key];
      console.log("got delete job for variable:", uuid);
      const id = `path-${uuid}`;
      d3.select(`#${id}`).remove();
      d3.select(`#circle-${uuid}`).remove();
      d3.select(chartContainer.value).select(`#label-${uuid}`).remove();
    }
    break;
    case "redraw": {
      updateChart();
      if (cursor_visible) {
        console.log("cursor time:", cursorInfo.value.time);
        updateCursor(xScale(cursorInfo.value.time));
      }
    } break;
    case "fitToEachview": {
      fitToEachView();
    } break;
    case "cursorSwitch": {
      cursor_visible = !cursor_visible;
      if (cursor_visible) {
        cursorInfo.value.visible = true;
        console.log("cursor time:", cursorInfo.value.time);
        updateCursor(xScale(cursorInfo.value.time));
      } else {
        cursorInfo.value.visible = false;
        updateCursor(xScale(cursorInfo.value.time)); // hide cursor
      };
    } break;
    case "resetStroke": {
      const uuid = job[key];
      const variableName = lookupVarkey(uuid);
      drawPath(variableName, currentXDomain);
    } break;
  }
}

const lookupVarkey = (uuid) => {
  const {lineData} = props;
  const foundKey = Object.keys(lineData).filter(key => lineData[key].uuid === uuid); // find the key that matches the uuid
  return foundKey[0];
}
</script>

<style scoped>
.chart-container {
  position: relative;
  top: 0;
  left: 0;
}

</style>
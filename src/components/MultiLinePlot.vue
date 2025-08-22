<template>
  <div ref="chartContainer" class="chart-container" :style="{ width: width + 'px', height: height + 'px' }"></div>
</template>


<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { interpolateYCoordinate, generateUUID, calcDataXExtent, calcYextWithinX, downsampleParallel,
  calcDataYExtent , isXinRange, findRange , downsamplePerPixel, calcDataYextWithinX } from '../utility';

let svg, xScale, yScale, currentXDomain, currentYDomain, chart;
const props = defineProps({
  lineData: Object,
  width: Number,
  height: Number,
  xDomain: Array,    // [xmin, xmax]
  yDomain: Array,    // [ymin, ymax]
  hasJob: Boolean
});
const jobQueue = defineModel();
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

const updateCursor = (xOffset) => {
    ({ lineData, width, height, hasJob} = props);
    if (!cursor_visible) {
      d3.select(chartContainer.value).select('.cursor-line')
      .attr('opacity', 0).attr("class", "cursor-line");// Hide cursor line
      d3.selectAll('.cursor-label').attr('opacity', 0); // Hide cursor labels
    } else {
        const xValue = xScale.invert(xOffset);  
        const cursorRegion = d3.select(chartContainer.value).select('.cursor-region');
        cursorRegion.attr('transform', `translate(${xOffset}, 0)`);   // move the cursor region
        d3.select(chartContainer.value).select('.cursor-line')
        .attr('opacity', 1).attr("class", "cursor-line cursor-col-resize"); // Show cursor line
        for (const variable in lineData) {
          const {color, uuid} = lineData[variable];
          const xDom = lineData[variable].x_domain;   
          const dataList = lineData[variable].pathData;
          const label = d3.select(chartContainer.value).select(`#label-${uuid}`);
          const ySigScale = (customYScale != null && Object.hasOwn(customYScale, uuid)) ? customYScale[uuid] : yScale;
          if (xValue >= xDom[0] && xValue <= xDom[1]) {
            const yValue = interpolateYCoordinate(dataList, xValue); // interpolate y value
            const yCoordination = ySigScale(yValue);
            if (!label.empty()) {
              label.attr('opacity', 1).attr('transform', `translate(${labelXOff}, ${yCoordination})`);
              label.select('text').text(yValue.toFixed(5));
            } else {
              drawLabel(cursorRegion, yValue.toFixed(5), labelXOff, yCoordination, color, "cursor-label", `label-${uuid}`);
            }
          } else {
            label.attr('opacity', 0);
          }
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
      .attr('class', 'cursor-line')
      .on("mousedown", function(event) {
        if (event.button === 0 && cursor_visible) { // left button
            cursor_dragging = true;
            d3.select(this).attr("stroke", "blue");
            window.addEventListener("mousemove", cursorDrag);
        }
      });
      //add cursor label
    updateCursor(midX);

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
      console.log("cursor region visible switch");
      if (cursor_visible) {
        cursor_visible = false;
        updateCursor(midX);    // dummy x corrdinate
      } else {
        cursor_visible = true;
        const x = d3.select('.cursor-region').attr('transform').match(/translate\(([^,]+),/)[1];
        let x_corr = xScale.invert(x);
        if (x_corr < x_domain[0] || x_corr > x_domain[1]) {
          x_corr = x_domain[0] + (x_domain[1] - x_domain[0]) / 2;
        }
        updateCursor(xScale(x_corr));
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
}

onMounted(() => {
  updateChart();
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
    .attr("style", "user-select:none");
  if (id) group.attr("id", id);

  const text = group.append("text")
    .text(textStr)
    .attr("font-size", "14px")
    .attr("x", 0)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold");
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
    document.body.style.cursor = "wait";
    const {color, stroke, uuid, circle} = lineData[variableName];
    yScaleSpec = (Object.hasOwn(customYScale, uuid))? customYScale[uuid]:yScaleSpec;
    if (!yScaleSpec) yScaleSpec = yScale;
    console.time("dataProcessing"+variableName);
    let data_to_draw = lineData[variableName]["pathData"];
    if (data_to_draw.length > (width-margin.left-margin.right)) {   // downsample if points number exceeds canvas width
        data_to_draw = await downsampleParallel(data_to_draw, width-margin.left-margin.right, xDomain[0], xDomain[1]);
    }
    console.timeEnd("dataProcessing"+variableName);
    d3.select("#path-" + uuid).remove();   
    d3.select("#circle-" + uuid).remove();    
    const canvas = d3.select(chartContainer.value).append('canvas').attr('width', width-margin.right-margin.left)
                      .attr('height', height-margin.bottom-margin.top)
                      .attr('style', `position: absolute; left: ${margin.left}px; top: ${margin.top}px; z-index: 0;`)
                      .attr('id', `path-${uuid}`);
    const ctx = canvas.node().getContext('2d');
    const line = d3.line()
                    .x(d => xScale(d[0]))
                    .y(d => yScaleSpec(d[1]))
                    .context(ctx);
    ctx.beginPath();
    line(data_to_draw);
    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;
    ctx.stroke();
    if (circle) {
      chart.append('g').attr("id", `circle-${uuid}`).selectAll('circle').data(data_to_draw).join('circle')
        .attr('cx', d => xScale(d[0]))
        .attr('cy', d => yScaleSpec(d[1]))
        .attr('r', 3)
        .attr('fill', color);
    }
    setTimeout(() => {
      document.body.style.cursor = 'default';
    }, 100);
  } else {
    console.log("variableName not found in data:", variableName);
  }
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
    case "deletePath": {
      const [variable, file] = job[key];
      generateUUID(file, variable).then(uuid => {      // data is already deleted, so has to be regenerated
        const id = `path-${uuid}`;
        d3.select(`#${id}`).remove();
        d3.select(`#circle-${uuid}`).remove();
        d3.select(chartContainer.value).select(`#label-${uuid}`).remove();
      })
    }
  }
}
</script>

<style scoped>
.chart-container {
  position: relative;
  top: 0;
  left: 0;
}

</style>
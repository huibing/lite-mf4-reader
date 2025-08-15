<template>
  <div ref="chartContainer" class="chart-container" :style="{ width: width + 'px', height: height + 'px' }"></div>
</template>


<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { calcDataExtent, interpolateYCoordinate, generateUUID, calcDataXExtent, calcDataYExtent } from '../utility';

let svg, xScale, yScale;
const props = defineProps({
  data: Object,
  width: Number,
  height: Number,
  xDomain: Array,    // [xmin, xmax]
  yDomain: Array,    // [ymin, ymax]
  update: {
    type: Boolean,
    default: true
  }
});

const chartContainer = ref(null);
let zoom = {
    zoom_status: "none",   // "none", "start", "panning", ""
    zoom_axis: 0,  // 0 for x-axis, 1 for y-axis
    zoom_start: [0, 0],   // in domain coordinates not pixel coordinates
    zoom_end: [0, 0],
};
let { data, width, height,  update} = props;
let cursor_visible = false;
let cursor_dragging = false;
const margin = { top: 30, right: 10, bottom: 20, left: 30 };

async function drawChart(x_domain, y_domain) {
    console.time('drawStart');
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
    

    const chart = svg.append('g')
                     .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    console.timeEnd('drawStart');
    console.time("drawLinePath");
    for ( const key in data) {
      let data_to_draw = data[key]["data"]["x"].map((x, i) => [x, data[key]["data"]["y"][i]]);
      const {color, stroke, circle, file} = data[key];
      const id = await generateUUID(file, key);
      const idSelector = `id-${id}`;
      console.log(idSelector);
      d3.select("#"+idSelector).remove();   // remove old line first
      const canvas = d3.select(chartContainer.value).append('canvas').attr('width', width-margin.right-margin.left)
                        .attr('height', height-margin.bottom-margin.top)
                        .attr('style', `position: absolute; left: ${margin.left}px; top: ${margin.top}px; z-index: 0;`)
                        .attr('id', idSelector);
      const ctx = canvas.node().getContext('2d');
      const line = d3.line()
                      .x(d => xScale(d[0]))
                      .y(d => yScale(d[1]))
                      .context(ctx);
      ctx.beginPath(); // start a new path
      line(data_to_draw);
      ctx.strokeStyle = color;
      ctx.lineWidth = stroke;
      ctx.stroke();

      if (circle) {
        chart.append('g')
          .attr('class', `circle-${key}`)
          .selectAll('circle')
          .data(data_to_draw)
          .enter()
          .append('circle')
          .attr('cx', d => xScale(d[0]))
          .attr('cy', d => yScale(d[1]))
          .attr('r', 4)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 1.5)
          .attr('stroke-linecap', 'round')
          .on('mouseover', function(event, d) {
            if (zoom.zoom_status === "none" && !cursor_dragging) {
              d3.select(this).attr('r', 4).attr('fill', 'red');
              drawLabel(chart, `(${d[0].toFixed(2)}, ${d[1].toFixed(2)})`, xScale(d[0])-40, yScale(d[1])-20);
            }
          })
          .on('mouseout', function(event, d) {
            d3.select(this).attr('r', 4).attr('fill', 'none');
            chart.selectAll('.label').remove();
          });
      }
    }
    console.timeEnd('drawLinePath');
    
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
      for ( const key in data) {
        //get data point y value
        const dataList = data[key].data;
        const {color} = data[key];
        const xValue = xScale.invert(midX);
        const yValue = interpolateYCoordinate(dataList, xValue);
        const yCorrdinate = yScale(yValue);
        drawLabel(cursorRegion, yValue.toFixed(5), -20, yCorrdinate, color, "cursor-label").attr('opacity', 0);
      }
      

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
    console.time("otherJobs");
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
    if (e.key === 'f') {
        // reset zoom
        zoom.zoom_status = "none";
        zoom.zoom_start = [0, 0];
        zoom.zoom_end = [0, 0];
        zoom.zoom_axis = 0;
        updateChart();
    } else if (e.key === 'r') {
      if (cursor_visible) {
        d3.select(chartContainer.value).select('.cursor-line')
        .attr('opacity', 0).attr("class", "cursor-line");// Hide cursor line
        d3.selectAll('.cursor-label').attr('opacity', 0); // Hide cursor label
        cursor_visible = false;
      } else {
        d3.select(chartContainer.value).select('.cursor-line')
        .attr('opacity', 1).attr('class', "cursor-line cursor-col-resize"); // Show cursor line
        d3.selectAll('.cursor-label').attr('opacity', 1); // Show cursor label
        const x = d3.select('.cursor-region').attr('transform').match(/translate\(([^,]+),/)[1];
        const x_corr = xScale.invert(x);
        if (x_corr < x_domain[0] || x_corr > x_domain[1]) {
          d3.select('.cursor-region')
            .attr('x1', xScale((x_domain[0] + x_domain[1]) / 2))
        }
        cursor_visible = true;
      }
    }});

    const cursorDrag = (event) => {
      if (cursor_dragging) {
          const x = d3.pointer(event, svg.node())[0];
          cursorRegion.attr('transform', `translate(${x-margin.left}, 0)`);
          const xValue = xScale.invert(x - margin.left);
          const labels = cursorRegion.selectAll(".cursor-label").nodes();
          const labelText = cursorRegion.selectAll(".cursor-label").selectAll("text").nodes();
          let i = 0;
          for (const variable in data) {
            const dataList = data[variable].data;
            const yValue = interpolateYCoordinate(dataList, xValue); // interpolate y value
            const yCorrdinate = yScale(yValue);
            //drawLabel(cursorRegion, yValue.toFixed(5), -20, yCorrdinate, color, "cursor-label");
            labels[i].setAttribute('transform', `translate(0, ${yCorrdinate})`);
            labelText[i].innerHTML = yValue.toFixed(5);
            i++;
          }
      }
    }
    console.timeEnd("otherJobs");
}

function onmouseup(event) {
    if (event.buttons  === 0) {
        if (zoom.zoom_status === "panning") {
            const [x_start, y_start] = zoom.zoom_start;
            const [x_end, y_end] = zoom.zoom_end;
            let x_domain, y_domain, x_1, y_1;
            if (zoom.zoom_axis === 0) {
                x_domain = [Math.min(x_start, x_end), Math.max(x_start, x_end)];
                y_domain = calcDataYExtent(data);   //  x轴重新设置后，需要同步更新y_domain
            } else {
                [x_domain, y_1] = calcDataExtent(data);
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
  ({data, width, height, update} = props);   
  const xDomain = calcDataXExtent(data);
  const yDomain = calcDataYExtent(data);
  console.time("drawChartAct");
  drawChart(xDomain, yDomain); // Redraw the chart with new data
  console.timeEnd("drawChartAct");
}

onMounted(() => {
  console.time("initdrawChart");
  updateChart();
  console.timeEnd("initdrawChart");
  window.addEventListener('contextmenu', function(event) {
      event.preventDefault();
  });
  window.addEventListener('mouseup', onmouseup);
});

watch(() => props.data, () => {
  if (props.update) {
    console.time("updateChart");
    updateChart();          // 实际上是重新绘制图表
    console.timeEnd("updateChart");
  }
}, { deep: true });

onUnmounted(() => {
  // 清理全局事件，防止内存泄露
  window.removeEventListener('mouseup', onmouseup);
});


function drawLabel(svg, textStr, x, y, color = "blue", classattr="label") {
  const group = svg.append("g")
    .attr("transform", `translate(${x}, ${y})`)
    .attr("class", classattr)
    .attr("style", "user-select:none");

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
    .attr("opacity", 0.5)
    .attr("dominant-baseline", "hanging");
  return group;
}

</script>

<style scoped>
.chart-container {
  position: relative;
  top: 0;
  left: 0;
}

</style>
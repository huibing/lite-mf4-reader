<template>
  <div ref="chartContainer"></div>
</template>


<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
let svg;
const props = defineProps({
  data: Array,
  width: Number,
  height: Number,
  xDomain: Array,    // [xmin, xmax]
  yDomain: Array,    // [ymin, ymax]
});
const chartContainer = ref(null);
let zoom = {
    zoom_status: "none",   // "none", "start", "panning", ""
    zoom_axis: 0,  // 0 for x-axis, 1 for y-axis
    zoom_start: [0, 0],   // in domain coordinates not pixel coordinates
    zoom_end: [0, 0],
};
let { data, width, height, xDomain, yDomain} = props;
let curosr_visible = false;
let cursor_dragging = false;

function drawChart(x_domain, y_domain) {
    const margin = { top: 30, right: 10, bottom: 20, left: 30 };
    const xScale = d3.scaleLinear()
      .domain(x_domain)
      .range([0, width - margin.right - margin.left]);
    const yScale = d3.scaleLinear()
      .domain(y_domain)
      .range([height - margin.bottom - margin.top, 0]);
    svg = d3.select(chartContainer.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('tabindex', "0");
    const chart = svg.append('g')
                     .attr('transform', `translate(${margin.left}, ${margin.top})`);
    const line = d3.line()
      .x(d => xScale(d[0]))
      .y(d => yScale(d[1]));
    const data_to_draw = data;
    const path = chart.append('g')
      .append('path')
      .datum(data_to_draw)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr("stroke-linecap", "round")
      .attr('d', line);

    const circles = chart.append('g')
      .selectAll('circle')
      .data(data_to_draw)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d[0]))
      .attr('cy', d => yScale(d[1]))
      .attr('r', 4)
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 4).attr('fill', 'red');
        drawLabel(chart, `(${d[0].toFixed(2)}, ${d[1].toFixed(2)})`, xScale(d[0])-40, yScale(d[1])-20);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('r', 4).attr('fill', 'none');
        chart.selectAll('.label').remove();
      });

    // add cursor
    const midX = xScale((x_domain[0] + x_domain[1]) / 2);
    const cursorRegion = chart.append('g').attr('class', 'cursor-region')
      .attr('transform', `translate(${midX}, 0)`);

    cursorRegion.append('rect')
      .attr('x', -40)
      .attr('y', 0)
      .attr('width', 80)
      .attr('height', height - margin.bottom - margin.top)
      .attr('fill', 'transparent')
      .attr('class', 'cursor-region-rect')
      .on("mousemove", function(event) {
        if (cursor_dragging) {
          const [x, y] = d3.pointer(event, svg.node());
          cursorRegion.attr('transform', `translate(${x-margin.left}, 0)`);
        }
      })
      .on("mouseup", function(event) {
        if (event.button === 0) { // left button
            cursor_dragging = false;
            d3.select(this).select('.cursor-line').attr("stroke", "blue");
        }
      });
    cursorRegion.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', height - margin.bottom - margin.top)
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('class', 'cursor-line cursor-col-resize')
      .on("mousedown", function(event) {
        if (event.button === 0) { // left button
            cursor_dragging = true;
            d3.select(this).attr("stroke", "green");
        }
      });

    // add rect to conceal 
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

    chart.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom - margin.top})`).attr("style", "user-select: none;")
      .call(d3.axisBottom(xScale).ticks(12));
    chart.append('g')
      .attr('transform', `translate(0, 0)`).attr("style", "user-select: none;")
      .call(d3.axisLeft(yScale).ticks(12));
    
    svg.on('mousedown', function(event) {
      if (zoom.zoom_status === "none" && event.button === 2) {
        zoom.zoom_status = "start";
        const [x, y] = d3.pointer(event);
        const xValue = xScale.invert(x - margin.left);
        const yValue = yScale.invert(y - margin.top);
        zoom.zoom_start = [xValue, yValue];
        zoom.zoom_end = zoom.zoom_start;
        console.log(`Clicked at: (${xValue.toFixed(2)}, ${yValue.toFixed(2)})`);
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
          console.log("Zooming on x-axis");
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
            console.log("Zooming on y-axis");
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
        console.log("Resetting zoom");
        zoom.zoom_status = "none";
        zoom.zoom_start = [0, 0];
        zoom.zoom_end = [0, 0];
        zoom.zoom_axis = 0;
        updateChart();
    } else if (e.key === 'r') {
      if (curosr_visible) {
        d3.select(chartContainer.value).select('.cursor-line')
        .attr('opacity', 0); // Hide cursor line
        curosr_visible = false;
      } else {
        d3.select(chartContainer.value).select('.cursor-line')
        .attr('opacity', 1); // Show cursor line
        const x = d3.select('.cursor-region').attr('transform').match(/translate\(([^,]+),/)[1];
        const x_corr = xScale.invert(x);
        if (x_corr < x_domain[0] || x_corr > x_domain[1]) {
          console.log("Cursor out of bounds, resetting to middle");
          d3.select('.cursor-region')
            .attr('x1', xScale((x_domain[0] + x_domain[1]) / 2))
        }
        curosr_visible = true;
      }
    }});
}

function onmouseup(event) {
    if (event.buttons  === 0) {
        if (zoom.zoom_status === "panning") {
            const [x_start, y_start] = zoom.zoom_start;
            const [x_end, y_end] = zoom.zoom_end;
            let x_domain, y_domain;
            if (zoom.zoom_axis === 0) {
                x_domain = [Math.min(x_start, x_end), Math.max(x_start, x_end)];
                y_domain = d3.extent(data, d => d[1]);
            } else {
                x_domain = d3.extent(data, d => d[0]);
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
        d3.select(chartContainer.value).select('.cursor-line').attr("stroke", "blue");
    }
}

function updateChart() {
  d3.select(chartContainer.value).select('svg').remove(); // Clear previous chart
  ({data, width, height, xDomain, yDomain} = props);   
  drawChart(xDomain, yDomain); // Redraw the chart with new data
}

onMounted(() => {
  console.log("LinePlot mounted");
  console.log("props: ", props);
  drawChart(xDomain, yDomain);
  window.addEventListener('contextmenu', function(event) {
      event.preventDefault();
  });
  window.addEventListener('mouseup', onmouseup);
});

watch(() => props, () => {
  console.log("props changed: ", props);
  updateChart();
}, { deep: true });

onUnmounted(() => {
  // 清理全局事件，防止内存泄露
  svg.on('mouseup', null)
});


function drawLabel(svg, textStr, x, y) {
  const group = svg.append("g")
    .attr("transform", `translate(${x}, ${y})`)
    .attr("class", "label");

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
    .attr("stroke", "green")
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("opacity", 0.5)
    .attr("dominant-baseline", "hanging");
  return group;
}
</script>
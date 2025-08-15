<template>
  <div ref="chartContainer"></div>
</template>

<script setup>
import * as d3 from "d3";
import { ref, watch, onMounted } from "vue";

// props
const props = defineProps({
  data: Array,
  width: Number,
  height: Number,
  xDomain: Array,    // [xmin, xmax]
  yDomain: Array,    // [ymin, ymax]
  k: {
    type: Number,
    default: 1
  }
});

const chartContainer = ref(null);
let svg, g, gx, gy, gDots, grid;

onMounted(() => {
  drawChart();
});

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

function drawChart() {
  const { data, width, height, xDomain, yDomain, k } = props;
  const xMargin = 50;

  const x = d3.scaleLinear().domain(xDomain).range([xMargin, width]);
  const y = d3.scaleLinear().domain(yDomain).range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(data.map(d => d[2]))
    .range(d3.schemeCategory10);

  const zoom = d3.zoom()
      .scaleExtent([0.5, 32])
      .on("zoom", zoomed);

  svg = d3.select(chartContainer.value)
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  g = svg.append("g")
    .attr("transform", `translate(${xMargin},0)`)
    .attr("fill", "none")
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round");

  gx = svg.append("g").attr("transform", `translate(0,${height})`);
  gy = svg.append("g").attr("transform", `translate(${xMargin},0)`);

  gx.call(d3.axisTop(x).ticks(12));
  gy.call(d3.axisLeft(y).ticks(12 * k));
  gx.select(".domain").attr("stroke", "black")
    .attr("stroke-width", 4);
  


  gDots = svg.append("g")
    .attr("transform", `translate(${xMargin},0)`)
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("d", d => `M${x(d[0])+xMargin},${y(d[1])}h0`)
    .attr("stroke", d => color(d[2]))
    .attr("stroke-width", 5)
    .attr("stroke-linecap", "round");

  function zoomed( { transform } ) {
    const zx = transform.rescaleX(x).interpolate(d3.interpolateRound);
    const zy = transform.rescaleY(y).interpolate(d3.interpolateRound);
    gDots.attr("transform", transform).attr("stroke-width", 5 / transform.k);
    gx.call(xAxis, zx);
    gy.call(yAxis, zy);
    g.call(grid, zx, zy);
  }

  const xAxis = (g, x) => g
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisTop(x).ticks(12));
  
  const yAxis = (g, y) => g
    .attr("transform", `translate(${xMargin},0)`)
    .call(d3.axisLeft(y).ticks(12 * k));

  grid = (g, x, y) => g
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.1)
    .call(g => g
      .selectAll(".x")
      .data(x.ticks(12))
      .join(
        enter => enter.append("line").attr("class", "x").attr("y2", height),
        update => update,
        exit => exit.remove()
      )
        .attr("x1", d => 0.0 + x(d) )
        .attr("x2", d => 0.0 + x(d) ))
    .call(g => g
      .selectAll(".y")
      .data(y.ticks(12 * k))
      .join(
        enter => enter.append("line").attr("class", "y").attr("x2", width),
        update => update,
        exit => exit.remove()
      )
        .attr("y1", d => 0.5 + y(d))
        .attr("y2", d => 0.5 + y(d)));
    g.call(grid, x, y);
    svg.call(zoom);
}

function updateChart() {
  // 可扩展为更新 data 或重新绘图
  //d3.select(chartContainer.value).selectAll("svg").remove();
  if (chartContainer.value) {
    chartContainer.value.innerHTML = '';
  }
  drawChart();
}
</script>

<style scoped>
svg {
  width: 100%;
  height: auto;
}
</style>

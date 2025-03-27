<script setup lang="ts">
import * as d3 from "d3";
import {useTemplateRef, onMounted, ref, watch} from 'vue'
import {useDataStore} from "../stores/dataStore.ts";
import {useDetailStore} from "../stores/detail_store.ts";
import {useFeatureStore} from "../stores/feature_store.ts";

const dataStore = useDataStore()
const detailStore = useDetailStore()
const featureStore = useFeatureStore()

//refs
const container = useTemplateRef('container')
let instance_value = ref(0)


onMounted(() => {
  instance_value.value = dataStore.instance[detailStore.selected_feature.get_feature_names()]
  update_vis()
})

//watch dataStore.instance
watch(() => dataStore.instance[detailStore.selected_feature.get_name()], () => {
  instance_value.value = dataStore.instance[detailStore.selected_feature.get_feature_names()]
  update_vis()
})

watch(() => detailStore.selected_feature, () => {
  update_vis()
})

const update_vis = () => {

  let vis_bins = detailStore.get_vis_bins() // array of bins with x and prediction
  let set_vis_bins = detailStore.get_current_set_vis_bins()

  let combined_bins = vis_bins.concat(set_vis_bins)

  const svg_width = 300
  const svg_height = 100
  const y_padding = 30
  const padding_sides = 40

  let svg = d3.create("svg")
      .attr("width", svg_width + 20)
      .attr("height", svg_height)
      .attr("viewBox", [-10, 0, svg_width + 20, svg_height])

  // create x-axis based on keys of vis_bins and set_vis_bins
  let min_x = d3.min(combined_bins.map(d => +d.x))
  let max_x = d3.max(combined_bins.map(d => +d.x))

  let x = d3.scaleLinear()
      .domain([min_x,max_x])
      .range([padding_sides/2, svg_width-padding_sides/2])

  let min_y = d3.min(combined_bins.map(d => +d.prediction))
  let max_y = d3.max(combined_bins.map(d => +d.prediction))

  let y = d3.scaleLinear()
      .domain([min_y, max_y])
      .range([0, svg_height- y_padding])

  // add curve for vis_bins
  let line = d3.line()
      .x(d => x(d.x))
      .y(d => svg_height - y_padding - y(d.prediction))
  // add curve
  svg.append("path")
      .datum(vis_bins)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1)
      .attr("d", line)

  if (set_vis_bins !== null) {
      // add curve for set_vis_bins
      let line = d3.line()
          .x(d => x(d.x))
          .y(d => svg_height - y_padding - y(d.prediction))
      // add curve
      svg.append("path")
          .datum(set_vis_bins)
          .attr("fill", "none")
          .attr("stroke", "blue")
          .attr("stroke-width", 1)
          .attr("d", line)
  }

  // add x-axis
  svg.append("g")
      .attr("transform", `translate(0, ${svg_height - y_padding})`)
      .call(d3.axisBottom(x))

  // add y-axis
  svg.append("g")
      .attr("transform", `translate(${padding_sides/2}, 0)`)
      .call(d3.axisLeft(y).ticks(2))

  // turn around whole svg 90 degrees
  //svg.attr("transform", "rotate(90)")



  d3.select(container.value).selectAll("*").remove()
  d3.select(container.value).node().append(svg.node())

}

</script>

<template>
  <div class="d-flex justify-center">
    <div ref="container"></div>
  </div>
</template>

<style scoped>

</style>
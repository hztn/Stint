<script setup lang="ts">
import * as d3 from "d3";
import {useTemplateRef, onMounted, ref, watch} from 'vue'
import {useDataStore} from "../stores/dataStore.ts";

const dataStore = useDataStore()

//refs
const container = useTemplateRef('container')
let instance_value = ref(0)

//props
const props = defineProps(['feature_name'])

onMounted(() => {
  instance_value.value = dataStore.instance[props.feature_name]
  update_vis()
})

//watch dataStore.instance
watch(() => dataStore.instance[props.feature_name], () => {
  instance_value.value = dataStore.instance[props.feature_name]
  update_vis()
})

const update_vis = () => {

  const instance_abnormality = dataStore.feature_abnormality[props.feature_name]

  const svg_width = 500

  let svg = d3.create("svg")
      .attr("width", svg_width + 20)
      .attr("height", 50)
      .attr("viewBox",[-10, 0, svg_width + 20, 50])

  let abnormal_xaxis = d3.scaleLinear()
      .domain([1, 0])
      .range([0, svg_width])

  // create box
  svg.append("rect")
      .attr("x", abnormal_xaxis(1))
      .attr("y", 0)
      .attr("width", abnormal_xaxis(0))
      .attr("height", 30)
      .attr("fill", "white")
      .attr("opacity", 0.5)
      .attr("stroke", "black")

  // create line for instance
  svg.append("line")
      .attr("x1", abnormal_xaxis(instance_abnormality))
      .attr("y1", 0)
      .attr("x2", abnormal_xaxis(instance_abnormality))
      .attr("y2", 30)
      .attr("stroke", "black")
      .attr("stroke-width", 2)

  // add "normal" text left
  svg.append("text")
      .attr("x", abnormal_xaxis(1))
      .attr("y", 45)
      .text("common")
      .style("fill", "grey")

  // add "abnormal" text right
  svg.append("text")
      .attr("x", abnormal_xaxis(0))
      .attr("y", 45)
      .text("unusual")
      .style("text-anchor", "end")
      .style("fill", "darkred")


  d3.select(container.value).selectAll("*").remove()
  d3.select(container.value).node().append(svg.node())

}

</script>

<template>
  <div class="d-flex justify-center">
    <div  ref="container"></div>
  </div>
</template>

<style scoped>

</style>
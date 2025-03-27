<script setup lang="ts">
import * as d3 from "d3";
import {onMounted, useTemplateRef, watch} from "vue";
import {useDataStore} from "../stores/dataStore.ts";
import {useInfluenceStore} from "../stores/influence_store.ts";

const dataStore = useDataStore()
const lbl = dataStore.get_label
const influenceStore = useInfluenceStore()

onMounted(() => {
  update_vis()
})

// watch dataStore.influence_scores
watch (() => influenceStore.influence.groups, (_) => {
  update_vis()
})

watch(() => dataStore.storyIsVisible, () => {
  update_vis()
})

watch(() => influenceStore.influence, () => {
  update_vis()
})


//refs
const container = useTemplateRef('container')

const update_vis = async () => {

  d3.select(container.value).selectAll("*").remove()

  const prediction = influenceStore.influence.explanation_prediction

  if (isNaN(prediction) || !dataStore.storyIsVisible) {
    return
  }

   let svg = d3.create("svg")
      .attr("width", influenceStore.svg_width)
      .attr("height", 100)

  const min = dataStore.data_summary.min
  const max = dataStore.data_summary.max

  let scale = d3.scaleLinear().domain([min, max]).range([100, influenceStore.svg_width - 100]).nice()

  const xAxis = d3.axisBottom(scale)

  // move the numbers of the axis down a notch
  xAxis.tickSize(10)

  // discrete
  const target_catalogue = dataStore.feature_catalogue[dataStore.target_feature]
  const classes = target_catalogue?.classes

  if (classes !== undefined) {
    xAxis.tickValues(classes.map((d : any) => d.value))
    xAxis.tickFormat((_,i) => classes[i].value)
  }
  else {
    xAxis.ticks(5)
  }

  // add the scale
  svg.append("g")
      .style("font-size", "15px")
      .attr("transform", "translate(0, 30)")
      .style("color", "#555555")
      .call(xAxis)

  // add class labels
  let padding = 0
  if (classes !== undefined) {
    padding = 10
    svg.selectAll(".classes")
        .data(classes)
        .enter()
        .append("text")
        .attr("x", (d : any) => scale(d.value))
        .attr("y",68)
        .attr("text-anchor", "middle")
        .style("fill", "#555555")
        .style("font-size", "15px")
        .text((d : any) => lbl(dataStore.target_feature, d.value))
  }

  // add name of scale
  svg.append("text")
      .attr("x", influenceStore.svg_width / 2)
      .attr("y", 80 + padding)
      .attr("text-anchor", "middle")
      .text(lbl(dataStore.target_feature))
      .style("font-size", "15px")
      .style("fill", "#555555")

  // add line for mean prediction with tooltip stating its value
  svg.append("line")
      .attr("x1", scale(dataStore.data_summary.mean))
      .attr("y1", 20)
      .attr("x2", scale(dataStore.data_summary.mean))
      .attr("y2", 40)
      .attr("stroke", "#606060")
      .attr("stroke-width", 2)
      .on("mouseover", function() {
        svg.append("text")
            .attr("class", "tooltip")
            .attr("x", scale(dataStore.data_summary.mean))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("stroke", "white")
            .style("stroke-width", 7)
            .style("fill", "#606060")
            .style("font-size", "15px")
            .style("paint-order", "stroke")
            .style("stroke-linejoin", "round")
            .text("average: " + dataStore.data_summary.mean.toFixed(dataStore.target_decimals))
      })
      .on("mouseout", function() {
        svg.selectAll(".tooltip").remove()
      })

  // add a circle for the prediction
  svg.append("circle")
      .attr("cx", scale(prediction))
      .attr("cy", 30)
      .attr("r", 7)
      .attr("fill", "black")

  // add the prediction text
  svg.append("text")
      .attr("x", scale(prediction))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text(prediction.toFixed(dataStore.target_decimals))



  d3.select(container.value).node().append(svg.node())

}

</script>

<template>
  <div class="w-100 d-flex flex-column align-center justify-center mt-0">
    <v-icon icon="mdi-arrow-down" size="30"></v-icon>
    <div class="story_text mt-2">
      When only considering the selected attributes,
      <span class="highlight">{{ lbl(dataStore.target_feature) }}</span>
      would be
      <span
          class="highlight2">{{ influenceStore.influence.explanation_prediction.toFixed(dataStore.target_decimals) }}</span>.
    </div>
    <div ref="container" class="px-5 pt-2"/>
  </div>
</template>

<style scoped>

</style>
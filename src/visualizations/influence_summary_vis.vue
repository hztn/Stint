<script setup lang="ts">
import * as d3 from "d3";
import {onMounted, ref, useTemplateRef, watch} from 'vue'
import {useDataStore} from "../stores/dataStore";
import {useInfluenceStore} from "../stores/influence_store.ts";
import Constants from "../stores/constants.ts";

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
  update_vis(false)
})


//refs
const container = useTemplateRef('container')

const min = ref<number>(0)
const max = ref<number>(1)
const scale = ref<any>(d3.scaleLinear().domain([min.value, max.value]).range([0, influenceStore.svg_width]))
const bar_height = 25
const padding_top = 10
const padding_bar = 10

const updater = ref(0)
let prediction = influenceStore.influence.explanation_prediction - dataStore.data_summary.mean

watch(() => updater.value, () => {
  update_vis(false)
})

const get_prediction_text = () => {
  //absolute
  //return Math.abs(influenceStore.influence.explanation_prediction - dataStore.data_summary.mean).toFixed(0)

  //percentage
  return Math.abs((influenceStore.influence.explanation_prediction - dataStore.data_summary.mean) / dataStore.data_summary.mean * 100).toFixed(0) + "%"


}

const update_vis = async (isSlow:boolean=true) => {

  d3.select(container.value).selectAll("*").remove()

  const prediction = influenceStore.influence.explanation_prediction - dataStore.data_summary.mean

  if (!dataStore.storyIsVisible || influenceStore.influence.groups.length === 0) {
    return
  }

  const height = padding_top + bar_height + 2*padding_bar

  let width = influenceStore.svg_width

  let svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)

  const range = dataStore.get_subset_influence_range()
  min.value = to_percent(range[0])
  max.value = to_percent(range[1])
  scale.value = d3.scaleLinear().domain([min.value, max.value]).range([55, width-55]).nice()

  let layers = []
  for (let i = 0; i < 3; i++) {
    layers.push(svg.append("g"))
  }

  // add black vertical line at 0
  layers[2].append("line")
      .attr("x1", scale.value(0))
      .attr("y1", padding_top)
      .attr("x2", scale.value(0))
      .attr("y2", padding_top + bar_height + 2*padding_bar)
      .attr("stroke", "black")
      .attr("stroke-width", 2)

  // add one bar for the prediction
          let rect = layers[1].append("rect")
            .attr("x", prediction < 0 ? scale.value(to_percent(prediction)) : scale.value(0))
            .attr("y", padding_top + padding_bar)
            .attr("width", Math.abs(scale.value(to_percent(prediction)) - (scale.value(0))))
            .attr("fill", prediction < 0 ? Constants.overview_color_negative : Constants.overview_color_positive)

        //optionally animate
        if (isSlow) {
            rect.transition()
            .attr("height", bar_height)
        }
       else {
            rect.attr("height", bar_height)
        }

   // add text next to the bar stating prediction value
    layers[1].append("text")
        .attr("x", scale.value(to_percent(prediction)) + (prediction < 0 ? -5 : 5))
        .attr("y", padding_top + bar_height)
        .attr("dy", "0.2em")
        .text( (prediction > 0 ? " +" : "-") + get_prediction_text())
        .style("font-size", "15px")
        .style("color", "#555555")
        .style("font-weight", "bold")
        .style("text-anchor", (prediction > 0 ? "start" : "end"))


  d3.select(container.value).node().append(svg.node())

}

const to_percent = (value:number) => {
  return value / dataStore.data_summary.mean * 100
}



const get_influence_sign_text = () => {
  const influence = influenceStore.influence.explanation_prediction - dataStore.data_summary.mean
  if (influence > 0) {
    return "positive"
  }
  else if (influence < 0) {
    return "negative"
  }
  else {
    return "neutral"
  }
}

const get_prediction_change_text = () => {
  const prediction = influenceStore.influence.explanation_prediction - dataStore.data_summary.mean
  if (prediction < 0) {
    return "reduce"
  }
  else {
    return "increase"
  }
}


</script>

<template>
  <div class="w-100 d-flex flex-column align-center justify-center pt-5">
    <h3 class="pt-5" v-if="influenceStore.influence.groups.length>0 && dataStore.storyIsVisible ">
      Combined, they
        {{ get_prediction_change_text() }}
      <span class="highlight"> {{ lbl(dataStore.target_feature) }}</span>
        by
       <span class="highlight2">{{ get_prediction_text() }}</span>
    </h3>
    <div ref="container" class="px-5"/>
    <div v-if="false">
      Prediction: {{dataStore.instance[dataStore.target_feature] - dataStore.data_summary.mean}}
      Explanation: {{influenceStore.influence.explanation_prediction  - dataStore.data_summary.mean}}
    </div>
  </div>
</template>

<style scoped>

</style>
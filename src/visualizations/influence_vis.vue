<script setup lang="ts">
import * as d3 from "d3";
import {onMounted, ref, useTemplateRef, watch} from 'vue'
import {useDataStore} from "../stores/dataStore";
import {Group, useInfluenceStore} from "../stores/influence_store.ts";

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
const textual_summary = ref<string>("")
const short_textual_summary = ref<string>("")

const min = ref<number>(0)
const max = ref<number>(1)
const width = influenceStore.svg_width
const scale = ref<any>(d3.scaleLinear().domain([min.value, max.value]).range([0, width]))
const bar_height = 25
const spacing_between_groups = 10
const spacing_inside_group = 5

const updater = ref(0)

watch(() => updater.value, () => {
  update_vis(false)
})

const update_vis = async (isSlow:boolean=true, areChangesSlow:boolean=true) => {

  d3.select(container.value).selectAll("*").remove()

  if (!dataStore.storyIsVisible) {
    return
  }

  const height = influenceStore.influence.groups.length * 20 + d3.sum(influenceStore.influence.groups.map(g => g.get_nr_bars())) * (bar_height+10)


  let svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .on("mouseleave", () => {
        console.log("svg close")
        influenceStore.close_all()
        updater.value += 1
      })

  let data = influenceStore.influence.groups.flat()
  if (data.length === 0) {
    return
  }

  const range = dataStore.get_subset_influence_range()
  min.value = to_percent(range[0])
  max.value = to_percent(range[1])
  scale.value = d3.scaleLinear().domain([min.value, max.value]).range([55, width-55]).nice()

  let layers = []
  for (let i = 0; i < 3; i++) {
    layers.push(svg.append("g"))
  }



  // add axis and add a "+" in front of positive values
  let axis = d3.axisTop(scale.value)
      .tickFormat((d) => get_value_text(d))
      .ticks(10)
  layers[2].append("g")
      .attr("transform", "translate(0, " + (20) + ")")
      .style("font-size", "12px")
      .style("color", "#555555")
      .call(axis)

  // add black vertical line at 0
  layers[2].append("line")
      .attr("x1", scale.value(0))
      .attr("y1", 20)
      .attr("x2", scale.value(0))
      .attr("y2", 20 + spacing_between_groups)
      .attr("stroke", "black")
      .attr("stroke-width", 2)

  d3.select(container.value).node().append(svg.node())

  const get_value = (value:number) => {
    return scale.value(to_percent(value))
  }

  let crawler = {offset: 30, spacing_between_groups:spacing_between_groups, layers:layers, get_value:get_value,
      spacing_inside_group:spacing_inside_group, scale:scale, svg:svg, bar_height:bar_height, isSlow:isSlow,
    areChangesSlow:areChangesSlow, mean: dataStore.data_summary.mean, width:width}
  for (let i = 0; i < influenceStore.influence.groups.length; i++) {
    let group: Group = influenceStore.influence.groups[i]
    group.vis_group(crawler, true, true, updater)
    crawler.offset += crawler.spacing_between_groups
    if (isSlow && !areChangesSlow) {
      await sleep(1000)
    }

  }

  update_textual_summary()

}

const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const update_textual_summary = () => {
  let new_textual_summary = influenceStore.influence.get_textual_summary()
  if (new_textual_summary != textual_summary.value) {
      textual_summary.value = new_textual_summary

      // split text at <br>, only keep the first two lines. If there are more than that, add ...
      let lines = new_textual_summary.split("<br>")
      if (lines.length > 3) {
        lines = lines.slice(0,2)
        lines.push("<b>...</b>")
      }
      short_textual_summary.value = lines.join("<br>")

      highlight_textual_summary()
  }
}

const highlight_textual_summary = () => {
  // hide the summary for a moment, then show it again
  let summary = document.getElementById("textual_summary")
  summary.style.transition = "color 200ms"
  summary.style.color = "darkgrey"
  setTimeout(() => {
    summary.style.color = "black"
  }, 400)

}

const get_value_text = (value:number) => {
  //percentage
  return (value > 0 ? "+" : "") + value.toFixed(0) + "%"
}

const to_percent = (value:number) => {
  return value / Math.abs(dataStore.data_summary.mean) * 100
}


</script>

<template>
  <div class="w-100 d-flex flex-column align-center justify-center">
    <div class="mt-2 story_text">
      (compared to the average
      <span class="highlight" >{{ lbl(dataStore.target_feature)}}</span>
      of
       <span class="highlight2" v-if="dataStore.data_summary.mean !== undefined">
         {{dataStore.data_summary.mean.toFixed(dataStore.target_decimals)}}
       </span>)
    </div>
    <div ref="container" class="pt-5"/>

    <!-- hint -->
    <div class="w-100 d-flex justify-end align-right align-content-end align-end mt-1 mb-4 text-grey-darken-3">
      <v-icon class="mr-1">mdi-cursor-default-click-outline</v-icon>
      <i> click on one of the attributes to learn more about its influence! </i>
    </div>

    <div class="mb-1">
    <v-hover v-slot="{isHovering, props}" open-delay="200" close-delay="100">
     <div v-bind="props" v-show="isHovering" style="text-align:center" class="story_text" v-html="textual_summary"
       ></div>

      <div v-bind="props" v-show="!isHovering" style="text-align:center" class="story_text" id="textual_summary" v-html="short_textual_summary"></div>

    </v-hover>
    </div>

    <div class="mb-1 mt-1" v-if="influenceStore.influence.excluded_features.length > 0">
      <v-icon class="mr-1">mdi-alert-circle</v-icon>
      <i> The influence of the following attributes is not shown here, as there was not enough data for them: </i>
      {{ influenceStore.influence.excluded_features.map(v => v + " = " + dataStore.instance[v]).join(", ") }}
    </div>

  </div>
</template>

<style scoped>

</style>
<script setup lang="ts">

import ImpactVis from "../visualizations/impact_vis.vue";
import {useDataStore} from "../stores/dataStore.ts";
import {useInfluenceStore} from "../stores/influence_store.ts";
import {useDetailStore} from "../stores/detail_store.ts";
import {bin_continuous, bin_discrete, useFeatureStore} from "../stores/feature_store.ts";
import {onMounted, onUnmounted, ref, useTemplateRef, watch} from "vue";
import * as d3 from "d3"

let dataStore = useDataStore()
const lbl = dataStore.get_label
let influenceStore = useInfluenceStore()
let detailStore = useDetailStore()
let featureStore = useFeatureStore()

const container = useTemplateRef('container')

const slider_value = ref<number>(0)

const get_name = () => {
  return detailStore.selected_feature.get_feature_names()
}

// on mount
onMounted(() => {
  slider_value.value = dataStore.instance[get_name()]
})

// on demount
onUnmounted(() => {
  detailStore.selected_feature = null
})

// trigger update on detailStore.selected_feature change
watch(() => detailStore.selected_feature, () => {
  slider_value.value = dataStore.instance[get_name()]
})

watch( () => dataStore.interacting_features, () => {
  detailStore.selected_feature = null
}, {deep:true})

const slider_changed = (() => {

  let bins = featureStore.get_feature_bins(get_name())

  // for continuous features, set the value to the bin of this value
  if (featureStore.get_feature_type(get_name()) == 'continuous') {

   let bin = bins.find((d: bin_continuous) => d.min <= slider_value.value && d.max >= slider_value.value) as bin_continuous
    dataStore.instance[get_name()] = +((+bin.min + +bin.max) / 2).toFixed(featureStore.logsteps[get_name()])


  // for discrete features, set the value to the closest bin
  } else {
    let bin_values = bins.map(((d: bin_discrete) => d.value))
    dataStore.instance[get_name()] = bin_values.reduce((prev, curr) => {
      return (Math.abs(curr - slider_value.value) < Math.abs(prev - slider_value.value) ? curr : prev)
    })
  }
})

</script>

<template>
  <div class="w-100 d-flex flex-column align-center justify-center" v-if="detailStore.selected_feature != null">

    <h3 v-if="influenceStore.influence.groups.length>0 && dataStore.storyIsVisible ">
      The selected attribute is <span class="highlight">{{ lbl(detailStore.selected_feature.get_feature_names()) }}</span>
    </h3>
    <div class="d-flex flex-column align-center justify-center"  style="font-size:16px">
      <div class="mt-3" style="font-size:16px">
        How do different values of
        <span class="highlight">{{lbl(detailStore.selected_feature.get_feature_names())}}</span>
        impact the combined influence?
      </div>
      <ImpactVis />
      <div> {{ detailStore.selected_feature.get_name() }} </div>
      <VSlider v-model="slider_value" :min="detailStore.min_x"
               :max="detailStore.max_x" hide-details @update:modelValue="slider_changed"
               width="460px"/>

    </div>

    <!-- hint -->
    <div class="w-100 d-flex justify-end align-right align-content-end align-end mt-2">
      <v-icon class="mr-1">mdi-arrow-left-right</v-icon>
      <i> move the slider to change the value of
        <span class="highlight">{{lbl(detailStore.selected_feature.get_feature_names())}}</span>! </i>
    </div>


  </div>
</template>

<style scoped>

</style>
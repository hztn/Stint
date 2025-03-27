<script setup lang="ts">
import {useDataStore} from "../stores/dataStore.ts";
import {useFeatureStore} from "../stores/feature_store.ts";

const dataStore = useDataStore()
const lbl = dataStore.get_label
const featureStore = useFeatureStore()


import AbnormalVis from "../visualizations/abnormal-vis.vue";
import {ref, watch} from "vue";
import DetailedFeatureView from "./detailed_feature_view.vue";
import constants from "../stores/constants.ts";
import * as d3 from "d3";

let show_details = ref<string>("")
let show_details_background = ref<string>("")
let background_features = ref<string[]>([])
let focus_features = ref<string[]>([])
let selected_feature = ref<string>("")

const toggle_details = (key: string) => {
  dataStore.selected_feature = dataStore.selected_feature === key ? null : key
}

watch(() => selected_feature.value, () => {
  console.log("selected_feature", selected_feature.value)
})

const toggle_details_background = (key: string) => {
  dataStore.selected_feature = dataStore.selected_feature === key ? null : key
}

//watch dataStore.interacting_features
watch(() => dataStore.storyIsVisible, () => {
  update()
})

watch(() => dataStore.interacting_features, () => {
  update()
},{deep:true})

watch(() => dataStore.instance, () => {
  update()
}, {deep:true})

// also watch dataStore.instance
watch(() => dataStore.instance, () => {
  //dataStore.storyIsVisible = false
}, {deep:true})

const update = () => {
  show_details.value = ""
  background_features.value = []
  focus_features.value = []

  if (!dataStore.storyIsVisible) {
    return
  }

  dataStore.calculate_abnormality()

  for (let feature of dataStore.interacting_features) {
    if (dataStore.feature_abnormality[feature] < constants.abnormal_boundary) {
      focus_features.value.push(feature)
    } else {
      background_features.value.push(feature)
    }
  }
}

const get_bin_percent = (feature: string) => {
  const bins = featureStore.get_feature_bins(feature)
  const dataset_size = d3.sum(bins.map(d => d.count))
  const bin_nr = featureStore.get_instance_bin_index(feature, dataStore.instance[feature])
  const bin_size = bins[bin_nr].count
  return ((bin_size / dataset_size) * 100).toFixed(1) + "%"
}

</script>

<template>
  <div class="d-flex justify-center flex-column" v-if="dataStore.storyIsVisible">

    <div class="d-flex justify-center mb-5">
      <h3 > The following attributes are given: </h3>
    </div>

    <!-- background features -->
    <div  class="d-flex justify-center mb-3 flex-wrap">
      <v-chip-group v-for="key in background_features" class="pa-1" selected-class="selectedChip" v-model="dataStore.selected_feature">
        <v-chip :variant="show_details_background == key? 'elevated' : 'tonal' " :value="key"  >
          {{lbl(key)}}: {{lbl(key, dataStore.instance[key])}}
        </v-chip>
      </v-chip-group>
    </div>

    <div v-if="focus_features.length > 0" class="d-flex justify-center mb-5">
      <i style="font-size:16px; color:darkred"> some of them are unusual...</i>
    </div>

    <!-- focus features -->
    <div v-for="key in focus_features">
      <div class="d-flex justify-center mb-3 align-center">
         <v-chip @click="toggle_details(key)" :variant="show_details == key? 'outlined' : 'tonal' "
              style="color:darkred">
          {{lbl(key)}} = {{lbl(key, dataStore.instance[key])}}
        </v-chip>
        <div class="ml-2"> only {{get_bin_percent(key)}} of instances </div>

      </div>

    </div>

    <!-- hint -->
    <div class="w-100 d-flex justify-end align-right align-content-end align-end mt-1 text-grey-darken-3">
      <v-icon class="mr-1">mdi-cursor-default-click-outline </v-icon>
      <i> click on the attributes for details! </i>
    </div>


  </div>
</template>

<style scoped>

.selectedChip{
  background-color: rgb(143, 143, 143) !important;
  color: white !important
}

</style>
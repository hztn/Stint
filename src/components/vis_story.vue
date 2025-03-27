<script setup lang="ts">
import InfluenceVis from "../visualizations/influence_vis.vue";
import InfluenceSummaryVis from "../visualizations/influence_summary_vis.vue";
import {useDataStore} from "../stores/dataStore";
import {useInfluenceStore} from "../stores/influence_store.ts";
import {watch} from "vue";
import TargetVis from "../visualizations/target_vis.vue";

const dataStore = useDataStore()
const lbl = dataStore.get_label
const influenceStore = useInfluenceStore()


// also watch dataStore.instance
watch(() => dataStore.instance, () => {
  if (dataStore.storyIsVisible) {
    influenceStore.calculate_influences()
  }

}, {deep: true})

</script>

<template>
  <div class="w-100 d-flex flex-column align-center justify-center">
    <h3 class="pt-5" v-if="influenceStore.influence.groups.length>0 && dataStore.storyIsVisible ">
      How do they influence <span class="highlight2">{{ lbl(dataStore.target_feature) }}</span>?
    </h3>

    <div v-if="!isNaN(influenceStore.influence.explanation_prediction)" class="w-100">
      <InfluenceVis/>
      <InfluenceSummaryVis v-if="dataStore.interacting_features.length > 1"/>
      <TargetVis/>

    </div>
    <div class="story_text d-flex flex-column align-center" v-else>
      <h3 class="pt-5">Not enough data available</h3>
      <span>Please check if there are any inconsistencies or impossible value combinations.</span>
    </div>

  </div>
</template>

<style scoped>

</style>
<script setup lang="ts">
import DistributionVis from "../visualizations/distribution-vis.vue";
import AbnormalVis from "../visualizations/abnormal-vis.vue";
import {useDataStore} from "../stores/dataStore.ts";
import {useFeatureStore} from "../stores/feature_store.ts";
import {ref, watch} from "vue";
import constants from "../stores/constants.ts";
import * as d3 from "d3";


const props = defineProps(['show_abnormal'])

const feature = ref<string | null>(null)

const dataStore = useDataStore()
const lbl = dataStore.get_label
const featureStore = useFeatureStore()

const hasCorrelations = (key: string) => {


  if (key == null) {
    return ""
  }

  if (dataStore.correlations[key] == null) {
    return ""
  }


  return Object.values(dataStore.correlations[key]).some((v: number) => Math.abs(v) > constants.show_correlation_threshold)
}

const get_bin_percent = (feature: string) => {

  if (feature == null) {
    return ""
  }

  const bins = featureStore.get_feature_bins(feature)
  const dataset_size = d3.sum(bins.map(d => d.count))
  const bin_nr = featureStore.get_instance_bin_index(feature, dataStore.instance[feature])
  const bin_size = bins[bin_nr].count
  return ((bin_size / dataset_size) * 100).toFixed(1) + "%"
}

watch( () => dataStore.interacting_features, () => {
  dataStore.selected_feature = null
})

watch( () => dataStore.selected_feature, () => {
  if (dataStore.selected_feature != null) {
    feature.value = dataStore.selected_feature
  }

})

</script>

<template>


  <div class="mb-2 mx-5 d-flex flex-column justify-center align-center w-100">


    <h3 class="mb-2"> The selected attribute is
      <span class="highlight">
        {{ lbl(feature) }}: {{ lbl(feature, dataStore.instance[feature]) }}
      </span>
    </h3>
    <div class="d-flex justify-center mt-2" v-if="props.show_abnormal">
      <AbnormalVis :feature_name="feature"/>
    </div>
    <div>
      <span class="mb-1" style="font-size:16px"> Looking at its distribution,  </span>
      <span style="font-size:15px" class="mb-5" v-if="dataStore.feature_abnormality[feature] > constants.abnormal_boundary">
        {{ get_bin_percent(feature)}} of the instances have this value.
      </span>

      <span style="font-size:15px; color:darkred" class="mb-5" v-else>
        {{ get_bin_percent(feature)}} of the instances have this value.
      </span>
    </div>
    <DistributionVis :feature_name="feature"/>
    <div class="mb-2 mt-4"  style="font-size:16px"> It has the following correlations with other attributes: </div>
    <div class="d-flex justify-center">
      <span v-if="hasCorrelations(feature)" class="text-grey-darken-1">
        <span v-for="(corr, other_feature) in dataStore.correlations[feature]">
            <v-chip class="mx-2" v-if="Math.abs(corr) > constants.show_correlation_threshold" variant="outlined">
              {{ lbl(other_feature) }}: {{ corr.toFixed(2) }}
            </v-chip>
        </span>
      </span>
      <span v-else>(No correlations)</span>

    </div>

  </div>
</template>

<style scoped>

</style>
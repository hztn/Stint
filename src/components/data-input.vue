<script setup lang="ts">
import {ref, onMounted, watch, nextTick} from 'vue'
import * as d3 from "d3";

import {useDataStore} from "../stores/dataStore.ts";
import {useFeatureStore} from "../stores/feature_store.ts";
import {useInfluenceStore} from "../stores/influence_store.ts";
import constants from "../stores/constants.ts";

const dataStore = useDataStore()
const lbl = dataStore.get_label
const featureStore = useFeatureStore()
const influenceStore = useInfluenceStore()

const files = ref(null)
const catalogue_files = ref(null)
const instance_nr = ref(26)
const isCustomInstance = ref(true)
const isCustomDataset = ref(false)
const added_feature = ref(null)
const target = ref("")
const target_is_categorical = ref(false)
const target_categorical_value = ref(null)
const original_data = ref(null)

const make_numeric = (data: any) => {

  // delete all columns with too many non-numeric values
  let delete_cols = [] as string[]
  data.columns.forEach((col: string) => {
    let uniques = Array.from(new Set(data.map((d: any) => d[col])))
    let non_numeric_uniques = uniques.filter((u: any) => isNaN(u))
    let non_numeric_uniques_cleaned = non_numeric_uniques.filter((u: any) => u !== "" && u !== "NA" && u != "NaN")

    // features that are not useful
    if (non_numeric_uniques_cleaned.length > constants.max_discrete_bins) {
      console.log("Deleting column", col, "because it contains too many non-numeric values")
      delete_cols.push(col)
    }

    // categorical features
    else if (non_numeric_uniques_cleaned.length > 0) {
      // add original labels to the feature catalogue
      if (dataStore.feature_catalogue[col] == undefined) {
        dataStore.feature_catalogue[col] = {name: col, classes: []}
      }
      let feature_calatogue = dataStore.feature_catalogue[col]
      feature_calatogue.classes = non_numeric_uniques_cleaned.map((e, i) => { return {value: i, label: e}})

      // and replace the values with the indices
      data.forEach((d: any) => {
        const d_class = feature_calatogue.classes.find((c: any) => c.label == d[col])
        d[col] = d_class !== undefined ? d_class.value : null
      })

      console.log("Converting ", col, "to categorical")
    }
  })
  delete_cols.forEach((col: string) => {
    data.columns = data.columns.filter((c: string) => c !== col)
    data.forEach((d: any) => {
      delete d[col]
    })
  })


  // convert all columns to numeric
  data.forEach((d: any) => {
    for (let key in d) {
        let value = d[key]
        if (isNaN(value || value === "")) {
          d[key] = null
        } else {
          d[key] = +value
        }
    }
  })


  return data
}

const add_id = (data: any) => {
  data.forEach((d: any, i: number) => {
    d.__id__ = i
  })
  return data
}

onMounted(async () => {
  await load_example_dataset()
})

const load_example_dataset = async () => {
  const csvFile = "https://raw.githubusercontent.com/akleinau/Stint/cbd10b108068e982c460e961b9cc071b4f1199be/datasets/bike.csv";
  const data = await d3.csv(csvFile, {crossOrigin: "anonymous"})
  set_data(data)

  const catalogueFile = "https://raw.githubusercontent.com/akleinau/Stint/refs/heads/main/datasets/bike_catalogue.json"
  const catalogue = await d3.json(catalogueFile)
  set_catalogue(catalogue)

  target_selected("cnt")
}

const uploaded = (files: any) => {
  dataStore.reset()
  const csvFile = files;
  const reader = new FileReader();
  reader.onload = (event: any) => {
    let data = d3.csvParse(event.target.result)
    set_data(data)
  }
  reader.readAsText(csvFile)
  target.value = null
}

const catalogue_uploaded = (files: any) => {
  const jsonFile = files;
  const reader = new FileReader();
  reader.onload = (event: any) => {
    let catalogue = JSON.parse(event.target.result)
    set_catalogue(catalogue)
  }
  reader.readAsText(jsonFile)
}

const set_data = (data: any) => {
  data = make_numeric(data)
  data = add_id(data)
  dataStore.feature_names = data.columns
  original_data.value = JSON.parse(JSON.stringify(data))
  dataStore.data = data
}

const set_catalogue = (catalogue: any) => {

  // reformat catalogue to be a map of feature names to feature objects
  catalogue.features.forEach((f: any) => {
    let current_feature = dataStore.feature_catalogue[f.name]
    if (current_feature == undefined) {
      dataStore.feature_catalogue[f.name] = f
    } else {
      let old_classes = current_feature.classes
      dataStore.feature_catalogue[f.name] = f

      let new_classes = f.classes
      if (new_classes == undefined) {
        dataStore.feature_catalogue[f.name].classes = old_classes
      }
      else if (old_classes != undefined) {
        // mesh the two class objects to one with the old_value, value and label
        new_classes.forEach((new_class: any) => {
          let old_class = old_classes.find((c: any) => c.label == new_class.value)
          if (old_class != undefined) {
            new_class.old_value = old_class.value
            new_class.value = new_classes.indexOf(new_class)
            if (new_class.label == undefined) {
              new_class.label = old_class.label
            }
          }
        })
        // for all remaining classes that are not in the catalogue.json, add them
        let next_value = new_classes.length
        old_classes.forEach((old_class: any) => {
          let new_class = new_classes.find((c: any) => c.value == old_class.label)
          if (new_class == undefined) {
            new_classes.push({value: next_value, label: old_class.label, old_value: old_class.value})
            next_value += 1
          }
        })

        // now go through the data and replace the old values with the new values
        dataStore.data.forEach((d: any) => {
          d[f.name] = new_classes.find((c: any) => c.old_value == d[f.name]).value
        })

      }


    }
  })

  // select target specified in catalogue
  if (catalogue.target) {
    target_selected(catalogue.target)
  }
}

const target_selected = (col: string) => {
  target.value = col
  set_target(col)

  // if target is categorical
  target_is_categorical.value = featureStore.get_feature_type(col) == "discrete"
  target_categorical_value.value = ""
}

const set_categorical_target_class = (col: string) => {

  // if cleared, reset target
  if (col == null) {
    dataStore.data = JSON.parse(JSON.stringify(original_data.value))
    set_target(target.value)
    return
  }

  // create a new column with the selected class and set it as target
  let new_col = target.value + " = " + lbl(target.value, +col)
  dataStore.data = JSON.parse(JSON.stringify(original_data.value))
  dataStore.data.forEach((d: any) => {
    d[new_col] = d[target.value] == col ? 1 : 0
  })

  // add new column to catalogue with 0 as "No" and 1 as "Yes"
  dataStore.feature_catalogue[new_col] = {name: new_col, classes: [{value: 0, label: "No"}, {value: 1, label: "Yes"}]}

  set_target(new_col)

}

const set_target = (col: string) => {

  dataStore.target_feature = col
  dataStore.non_target_features = dataStore.feature_names.filter((f: string) => f !== col)
  let summary = {} as any
  summary.mean = dataStore.data.map((d: any) => d[col]).reduce((a: number, b: number) => a + b) / dataStore.data.length
  summary.min = Math.min(...dataStore.data.map((d: any) => d[col]))
  summary.max = Math.max(...dataStore.data.map((d: any) => d[col]))
  summary.std = d3.deviation(dataStore.data.map((d: any) => d[col]))
  summary.range = summary.max - summary.min
  dataStore.data_summary = summary
  dataStore.set_target_decimals()

  dataStore.instance = JSON.parse(JSON.stringify(dataStore.data[instance_nr.value])) //makes sure there is always an instance selected
  featureStore.set_features()
}

const instance_selected = (_:any) => {
  dataStore.instance = JSON.parse(JSON.stringify(dataStore.data[instance_nr.value]))
}

const dataset_toggled = (_:any) => {
  if (isCustomDataset.value) {
    dataStore.reset()
    files.value = null
    catalogue_files.value = null
  }
  else {
    load_example_dataset()
  }
}

const interacting_features_selected = (cols: string[]) => {
  dataStore.interacting_features = cols
  dataStore.calculate_correlations()
  dataStore.storyIsVisible = false
}

const get_discrete_select_list = (key: string) => {
  let bins = featureStore.get_feature_bins(key)
  let bin_values = bins.map((d: any) => d.value)

  let bin_labels = bin_values.map((v: any) => lbl(key, v))
  return bin_values.map((v: any, i: number) => {
    return {value: v, title: bin_labels[i]}
  })
}

const get_feature_select_list = () => {
  return dataStore.feature_names.map((f: string) => {
    return {value: f, title: lbl(f)}
  })
}

const add_feature = (_: any) => {
  let feature = added_feature.value
  dataStore.interacting_features.push(feature)
  added_feature.value = null
  interacting_features_updated()

  // focus next element
  nextTick(() => {
    const el = document.getElementById("instance_" + dataStore.get_interacting_features_reversed()[0])
    if (el) {
      // click on the element to open the select
      el.focus()
    }
  })

}

const clear_feature = (key: string) => {
  dataStore.interacting_features = dataStore.interacting_features.filter(f => f !== key)
  interacting_features_updated()
}

const interacting_features_updated = () => {
  dataStore.calculate_correlations()
  if (dataStore.storyIsVisible) {
    influenceStore.calculate_influences()
  }
}

</script>

<template>
  <div class="w-100">
    <div class="mx-3 align-center justify-center d-flex flex-column">

      <!-- data input -->
      <v-btn-toggle v-model="isCustomDataset" class="mb-1" @update:model-value="dataset_toggled">
        <v-btn :value="false">example data set</v-btn>
        <v-btn :value="true">custom data set</v-btn>
      </v-btn-toggle>
      <div v-if="isCustomDataset" class="w-100">
        <div class="d-flex flex-column align-center justify-center w-100">
          <div class="d-flex mt-3 w-100">
            <v-file-input label="Choose CSV file" v-model="files"
                          accept=".csv"
                          @update:modelValue="uploaded"></v-file-input>
            <v-file-input label="(Optional) choose Catalogue file" v-model="catalogue_files"
                          accept=".json"
                          @update:modelValue="catalogue_uploaded"></v-file-input>
          </div>
          <div v-if="dataStore.feature_names.length !== 0" class="d-flex flex-column width75 align-center justify-center">
            <h3> Target </h3>
            <v-autocomplete v-model="target" class="px-5 w-100" label="Select the column containing your prediction/ ground truth"
                            :items="get_feature_select_list()"
                            item-value="value" item-title="title"
                            variant="underlined"
                            @update:modelValue="target_selected"/>


            <!-- if categorical, optionally select a class -->
              <v-select v-if="target_is_categorical" v-model="target_categorical_value"
                        class="w-100 mt-3" clearable
                        :items="get_discrete_select_list(target)"
                        item-value="value" item-title="title"
                        label="(optionally) select a class to focus on"
                        @update:modelValue="set_categorical_target_class"
                        variant="underlined" hide-details density="compact" >
                <template v-slot:prepend-inner>
                  <div class="d-flex text-grey-darken-1">
                    <span> {{ target }} </span>
                    <span> : </span>
                  </div>
                </template>
              </v-select>
          </div>
        </div>
      </div>
      <div v-else class="mx-3 align-center justify-center story_text">
        <div class="d-flex flex-column align-center justify-center text-grey-darken-3" style="text-align:center">
          Data set of hourly bike rentals depending on season, month, temperature, ...
          <br>
          <a href="https://archive.ics.uci.edu/ml/datasets/Bike+Sharing+Dataset" target="_blank">
            Click here for more information.
          </a>
        </div>

      </div>

      <h3 class="mt-9"> Select Attributes</h3>

      <!-- Interacting features -->
        <div class="text-center mt-1 width75 px-10">
          <!-- Interacting features -->
          <div class="d-flex flex-column align-center justify-center w-100 mt-3">
            <div v-if="dataStore.target_feature !== ''" class="mt-1 w-100">
              <v-autocomplete v-model="added_feature" class="px-5 w-100" density="compact" hide-details single-line
                              label="Add" variant="outlined" id="attribute_add_component"
                              :items="get_feature_select_list().filter(f => !dataStore.interacting_features.includes(f.value))"
                              item-value="value" item-title="title"
                              @update:modelValue="add_feature">
                <template v-slot:prepend>
                  <v-icon>mdi-plus</v-icon>
                </template>
              </v-autocomplete>
            </div>
          </div>

        </div>


        <!-- Instance -->
        <div class="d-flex flex-column align-center justify-center mt-0 px-5 mb-5 width75"
             v-if="dataStore.target_feature !== ''">

            <div v-for="key in dataStore.get_interacting_features_reversed()"
                 class="mt-1 w-100 d-flex flex-row align-center ">

              <!-- continuous -->
              <div v-if="featureStore.get_feature_type(key) == 'continuous'" class="w-100 px-3">
              <v-slider v-model="dataStore.instance[key]" :label="key" :min="d3.min(dataStore.data.map(d => d[key]))"
                        :max="d3.max(dataStore.data.map(d => d[key]))" step="0.01" thumb-label color="grey-darken-1"
                        thumb-size="20" hide-details single-line density="compact" :id="'instance_' + key">
                 <template v-slot:append>
                   <v-text-field v-model="dataStore.instance[key]" density="compact" variant="underlined"
                       style="width: 80px" type="number" hide-details single-line
                   ></v-text-field>
                 </template>
              </v-slider>
              </div>

              <!-- discrete -->
              <div v-else class="w-100 px-5">
                <v-select v-model="dataStore.instance[key]" class="w-100" :label="key"
                          :items="get_discrete_select_list(key)" :id="'instance_' + key"
                          item-value="value"
                          item-title="title"
                          variant="underlined" hide-details density="compact" single-line>
                  <template v-slot:prepend-inner>
                    <div class="d-flex text-grey-darken-1">
                      <span> {{ lbl(key) }} </span>
                      <span> : </span>
                    </div>
                  </template>
                </v-select>

              </div>

              <!-- clear button -->
              <v-btn @click="clear_feature(key)"
                     icon size="2" class="mb-2 text-grey">
                <v-icon>mdi-close</v-icon>
              </v-btn>


            </div>

        </div>



    </div>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>

import {defineStore} from 'pinia'
import {Feature, useInfluenceStore} from './influence_store.ts'
import {bin_continuous, bin_discrete, useFeatureStore} from "./feature_store.ts";
import {useDataStore} from "./dataStore.ts";
import * as d3 from "d3";
import Constants from "./constants.ts";

export const useDetailStore = defineStore({
    id: 'detail',
    state: () => ({
        selected_feature: null as Feature | null,
        change_impacts: [] as {x: number, impact: number}[],
        min_x: 0,
        max_x: 0,
        bin_size: 0

    }),
    actions: {
        get_vis_bins() {
            if (this.selected_feature === null) return []

            let featureStore = useFeatureStore()
            let bins = featureStore.get_feature_bins(this.selected_feature.get_feature_names())
            let type = featureStore.get_feature_type(this.selected_feature.get_feature_names())
            let vis_bins = []


            if (type == "continuous") {
                // interprete bins as type bin_continuous
                for (let bin of bins as bin_continuous[]) {
                    vis_bins.push({"x": bin.min, "prediction": bin.prediction_mean})
                }
            }
            else {
                // interprete bins as type bin_discrete
                for (let bin of bins as bin_discrete[]) {
                    vis_bins.push({"x": bin.value, "prediction": bin.prediction_mean})
                }
            }

            vis_bins.sort((a, b) => +a.x - +b.x)

            return vis_bins
        },

        get_current_set_vis_bins() {
            let set_ids = this.selected_feature.get_previous_group()
            if (set_ids === null) return []
            set_ids = set_ids.get_ids()

            let featureStore = useFeatureStore()
            let dataStore = useDataStore()
            let bins = featureStore.get_feature_bins(this.selected_feature.get_feature_names())
            let type = featureStore.get_feature_type(this.selected_feature.get_feature_names())

            // duplicate bins and set count, prediction_sum, prediction_mean to 0
            let vis_bins = JSON.parse(JSON.stringify(bins))
            for (let bin of vis_bins) {
                bin.count = 0
                bin.prediction_sum = 0
                bin.prediction_mean = 0
            }

            // get new counts and prediction_sums
            for (let id of set_ids) {
                let instance = dataStore.data[id]
                let feature_value = instance[this.selected_feature.get_feature_names()]
                let target_value = instance[dataStore.target_feature]
                let bin_index = featureStore.get_instance_bin_index(this.selected_feature.get_feature_names(), feature_value)
                vis_bins[bin_index].count += 1
                vis_bins[bin_index].prediction_sum += target_value
            }

            // calculate new prediction_means
            for (let bin of vis_bins) {
                if (bin.count > Constants.min_subset_absolute) {
                    bin.prediction_mean = bin.prediction_sum / bin.count
                }
                else {
                    bin.prediction_mean = NaN
                }

            }

            // change format to be compatible with vis
            let vis_bins_formatted = []
            if (type == "continuous") {
                for (let bin of vis_bins) {
                    vis_bins_formatted.push({"x": bin.min, "prediction": bin.prediction_mean})
                }
            }
            else {
                for (let bin of vis_bins) {
                    vis_bins_formatted.push({"x": bin.value, "prediction": bin.prediction_mean})
                }
            }

            // sort by x
            vis_bins_formatted.sort((a, b) => +a.x - +b.x)

            return vis_bins_formatted

        },

        calculate_feature_change_impact_values() {

            // first sample a range of values of the selected feature
            let featureStore = useFeatureStore()
            let dataStore = useDataStore()
            let feature_name = this.selected_feature.get_feature_names()
            let bins = featureStore.get_feature_bins(feature_name)
            let type = featureStore.get_feature_type(feature_name)

            // get one value per bin
            let pretty_bins = []
            if (type == "continuous") {
                for (let bin of bins as bin_continuous[]) {
                    pretty_bins.push({value: +((+bin.min + +bin.max) / 2).toFixed(featureStore.logsteps[feature_name]), count: bin.count})
                }
            }
            else {
                for (let bin of bins as bin_discrete[]) {
                    pretty_bins.push({value: bin.value, count:bin.count})
                }
            }

            // also sort values
            pretty_bins = pretty_bins.filter(d => !isNaN(d.value) && d.value != null)
            pretty_bins.sort((a, b) => +a.value - +b.value)

            // calculate impact for each value
            let influenceStore = useInfluenceStore()
            let impacts = []
            for (let bin of pretty_bins) {
                let instance = JSON.parse(JSON.stringify(dataStore.instance))
                instance[feature_name] = bin.value
                let impact = NaN
                if (bin.count > Constants.min_subset_absolute) {
                    impact = influenceStore.get_explanation_prediction(instance)
                    impact -= dataStore.data_summary.mean
                }
                impacts.push({"x": bin.value, "impact": impact})
            }

            this.change_impacts = impacts
            this.min_x = d3.min(impacts.map(d => +d.x))
            this.max_x = d3.max(impacts.map(d => +d.x))
            this.bin_size = featureStore.bin_sizes[feature_name]

        }


    }
})
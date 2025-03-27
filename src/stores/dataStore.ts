import {defineStore} from 'pinia'
import * as d3 from 'd3'
import {useFeatureStore} from './feature_store'
import constants from "./constants.ts";

export interface CorrelationMap {
    [key: string]: number // feature name -> correlation value
}

export const useDataStore = defineStore({
    id: 'data',
    state: () => ({
        data: [] as { [key: string]: number }[],
        feature_names: [] as string[],
        target_feature: "" as string,
        data_summary: {} as { min: number, max: number, mean: number, std: number, range:number},
        non_target_features: [] as string[],
        interacting_features: [] as string[],
        shown_features: [] as string[],
        instance: {} as { [key: string]: number },
        storyIsVisible: false,
        selected_feature: null as string | null,
        correlations: {} as { [key: string]: CorrelationMap}, // feature name -> CorrelationMap
        feature_abnormality: {} as { [key: string]: number }, // feature name -> abnormality value
        feature_catalogue: {} as any,
        target_decimals: 0 as number
    }),
    actions: {

        reset() {
            this.data = []
            this.feature_names = []
            this.target_feature = ""
            this.data_summary = {min: 0, max: 0, mean: 0, std: 0, range: 0}
            this.non_target_features = []
            this.interacting_features = []
            this.instance = {}
            this.feature_catalogue = {}
            this.storyIsVisible = false
        },

        set_target_decimals() {
            // get the number of decimals for the target feature
            const target_feature = this.target_feature
            const values = this.data.map(d => d[target_feature])
            const max_value = d3.max(values)
            const min_value = d3.min(values)
            const range = max_value - min_value
            this.target_decimals = Math.max(0, -Math.floor(Math.log10(range)) + 2)
        },

        calculate_correlations() {
            this.correlations = {}
            for (let feature of this.interacting_features) {
                this.correlations[feature] = {}
                for (let other_feature of this.interacting_features) {
                    if (feature === other_feature) {
                        continue
                    }
                    this.correlations[feature][other_feature] = this.calculate_correlation(feature, other_feature)
                }
            }
        },

        calculate_correlation(feature1: string, feature2: string): number {
            // Pearson correlation coefficient
            const values1 = this.data.map((d) => d[feature1])
            const values2 = this.data.map((d) => d[feature2])
            const mean1 = values1.reduce((acc, v) => acc + v, 0) / values1.length
            const mean2 = values2.reduce((acc, v) => acc + v, 0) / values2.length
            const numerator = values1.reduce((acc, v1, i) => acc + (v1 - mean1) * (values2[i] - mean2), 0)
            const denominator1 = Math.sqrt(values1.reduce((acc, v) => acc + (v - mean1) ** 2, 0))
            const denominator2 = Math.sqrt(values2.reduce((acc, v) => acc + (v - mean2) ** 2, 0))
            return numerator / (denominator1 * denominator2)
        },

        calculate_abnormality() {
            const featureStore = useFeatureStore()
            this.feature_abnormality = {}
            for (let feature of this.shown_features) {
                  const bins = featureStore.get_feature_bins(feature)
                  const max_count = d3.max(bins.map(d => d.count))
                  //const full_count = d3.sum(bins.map(d => d.count))
                  const instance_bin_index = featureStore.get_instance_bin_index(feature, this.instance[feature])
                  const instance_bin_count = bins[instance_bin_index].count

                  this.feature_abnormality[feature] = instance_bin_count / max_count
            }
        },

        get_subset_influence_range(): [number, number]{

            // now get the smallest n values from dataStore.data
            let data = this.data.map(d => d[this.target_feature])
            let sorted_data = data.sort((a, b) => a - b)
            let min_items = sorted_data.slice(0, constants.min_subset_absolute)
            let max_items = sorted_data.slice(-constants.min_subset_absolute)
            let min = d3.mean(min_items) - this.data_summary.mean
            let max = d3.mean(max_items) - this.data_summary.mean
            return [min, max]
        },

        get_label(feature: string|number, value: any = "__undefined__"): string|number {
            const catalogue_feature = this.feature_catalogue[feature]

            if (value == "__undefined__") {
                if (catalogue_feature === undefined) {
                    return feature
                }
                if (catalogue_feature.label === undefined) {
                    return feature
                }
                return this.feature_catalogue[feature].label
            }
            else {

                if (value === null) {
                    value = "null"
                }

                if (catalogue_feature === undefined) {
                    return value.toString()
                }
                if (catalogue_feature.classes === undefined) {
                    return value.toString()
                }
                const value_class = catalogue_feature.classes.find((c) => c.value === value)
                if (value_class === undefined) {
                    return value.toString()
                }
                else {
                    return value_class.label
                }
            }

        },

        get_interacting_features_reversed(): string[] {
            return this.interacting_features.slice().reverse()
        }
    },
})

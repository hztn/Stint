import {defineStore} from "pinia";
import {useDataStore} from "./dataStore.ts";
import constants from "./constants.ts";
import Constants from "./constants.ts";

export interface bin {
    count: number,
    prediction_sum: number,
    prediction_mean: number
}

export interface bin_continuous extends bin {
    min: number,
    max: number,
    center: number,
}

export interface bin_discrete extends bin {
    value: number,
}

const make_binsize_pretty = (size: number) : number => {
    // round up n to nearest multiple of five
    let pretty_stepsize_10 = Math.pow(10, Math.floor(Math.log10(size)))
    let float5 = 5 * pretty_stepsize_10
    let pretty_stepsize = Math.round(size / float5) * float5
    if (pretty_stepsize === 0) pretty_stepsize = float5/5

    return pretty_stepsize

}

export const useFeatureStore = defineStore({
    id: 'feature',
    state: () => ({
        feature_names: [] as string[],
        feature_bins: {} as { [key: string]: bin[] },
        feature_types: {} as { [key: string]: string },
        bin_sizes: {} as { [key: string]: number },
        logsteps: {} as { [key: string]: number }
    }),
    actions: {

        set_features() {
            const data = useDataStore().data
            this.feature_names = Object.keys(data[0])
            this.calculate_feature_bins(data)
        },

        calculate_feature_bins(data: { [key: string]: number }[]) {
            this.feature_bins = {}
            let target_feature = useDataStore().target_feature

            for (let feature of this.feature_names) {
                const data_clean = data.filter((d) => d[feature] !== null)
                const data_view = data_clean.filter((d) => !isNaN(d[feature]))
                const values = data_view.map((d) => d[feature])

                const unique_values = Array.from(new Set(values)).sort()

                //continuous
                if (unique_values.length > constants.max_discrete_bins) {
                    this.feature_types[feature] = "continuous"
                    let bin_number = constants.continuous_bin_nr as number
                    let min = Math.min(...values)
                    let max = Math.max(...values)
                    const bin_size = make_binsize_pretty((max - min) / bin_number)
                    const logStep = Math.max(0, -Math.floor(Math.log10(bin_size)))
                    min = Math.floor(min / bin_size) * bin_size
                    max = Math.ceil((max + 1/(10**logStep)) / bin_size) * bin_size
                    bin_number = Math.round((max - min) / bin_size)


                    const bins = Array.from({length: bin_number}, (_, i) => {
                        const i_min = (min + i * bin_size)
                        let i_max = i_min + bin_size

                        return {
                            min: i_min.toFixed(logStep),
                            max: i_max.toFixed(logStep),
                            center: (i_min + bin_size / 2).toFixed(logStep),
                            count: 0,
                            prediction_sum: 0,
                            prediction_mean: 0
                        }
                    })

                    data_clean.forEach((d) => {
                        const bin_index = Math.floor((d[feature] - min) / bin_size)
                        if (bin_index === bin_number) {
                            bins[bin_number - 1].count += 1
                            bins[bin_number - 1].prediction_sum += d[target_feature]
                        } else {
                            bins[bin_index].count += 1
                            bins[bin_index].prediction_sum += d[target_feature]
                        }
                    })

                    //calculate mean
                    let mean = useDataStore().data_summary.mean
                    for (let bin of bins) {
                        bin.prediction_mean = bin.prediction_sum / bin.count - mean

                        if (bin.count < Constants.min_subset_absolute) {
                            bin.prediction_mean = NaN
                        }
                    }

                    this.feature_bins[feature] = bins
                    this.bin_sizes[feature] = bin_size
                    this.logsteps[feature] = logStep
                }

                //categorical/ discrete
                else {
                    this.feature_types[feature] = "discrete"

                    // sort unique values if they are numbers
                    if (unique_values.every((value) => typeof value === "number")) {
                        unique_values.sort((a, b) => a - b)
                    }

                    const bins = unique_values.map((value) => {
                        return {
                            value: value,
                            count: 0,
                            prediction_sum: 0,
                            prediction_mean: 0
                        }
                    })

                    data_clean.forEach((d) => {
                        const bin_index = bins.findIndex((bin) => bin.value === d[feature])
                        bins[bin_index].count += 1
                        bins[bin_index].prediction_sum += d[target_feature]
                    })

                    //calculate mean
                    let mean = useDataStore().data_summary.mean
                    for (let bin of bins) {
                        bin.prediction_mean = bin.prediction_sum / bin.count - mean
                    }

                    this.feature_bins[feature] = bins
                }


            }
        },

        get_feature_bins(feature: string): bin[] {
            return this.feature_bins[feature]
        },

        get_instance_bin_index(feature: string, value: number): number {
            if (this.feature_types[feature] === "continuous") {
                const bins = this.feature_bins[feature] as bin_continuous[]
                return bins.findIndex((bin) => bin.min <= +value && bin.max > +value)
            } else {
                const bins = this.feature_bins[feature] as bin_discrete[]
                return bins.findIndex((bin) => bin.value === value)
            }
        },

        get_feature_type(feature: string): string {
            return this.feature_types[feature]
        }

    }
});
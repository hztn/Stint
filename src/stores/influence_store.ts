import {defineStore} from "pinia";
import {useDataStore} from "./dataStore";
import {useFeatureStore} from "./feature_store.ts";
import * as d3 from "d3";
import {useDetailStore} from "./detail_store.ts";
import Constants from "./constants.ts";
import constants from "./constants.ts";
import {ttest, tscore} from "jstat";

const sort_by_score = (a: GroupClass, b: GroupClass) => {
    return Math.abs(b.get_score()) - Math.abs(a.get_score())
}

abstract class GroupClass {
    type: string = "single"
    ids: Set<number> = new Set()
    score: number = 0
    value: number = 0
    isOpen: boolean = false
    parent: Group | null = null
    manual_slow: boolean = false
    influence_object: any
    detailIsOpen: boolean = false

    protected constructor(influence_object) {
        this.parent = null
        this.influence_object = influence_object
    }

   set_parent(parent: Group) {
        this.parent = parent
    }

    get_score() {
        return this.score
    }

    get_value() {
        return this.value
    }

    get_ids() {
        return this.ids
    }

    get_size() {
        return this.ids.size
    }

    vis_bars(crawler: any, updater: any, isLast: boolean, isFirst: boolean, level:number = 0) {
        crawler.svg.attr("height", crawler.offset + crawler.bar_height + crawler.spacing_inside_group)
        let group_elements = crawler.layers[1].append("g")
        let top_group_elements = crawler.layers[2].append("g")
        this.add_bar(crawler, this, updater, group_elements, level)
        //add_bar_score(crawler, this, group_elements)
        //add_bar_size(crawler, this, group_elements)
        add_value_line(crawler, this, isLast, top_group_elements)
        add_feature_names(crawler, this, group_elements, isFirst)
        add_zero_line(crawler, isLast)
        crawler.offset += crawler.bar_height + crawler.spacing_inside_group
    }

    get_previous_group() {
        if (this.parent == null) {
            return null
        }
        else {
            let parent = this.parent
            let index = parent.features.indexOf(this)
            if (index == 0) {
                return parent.get_previous_group()
            }
            else {
                return parent.features[index - 1]
            }
        }
    }

    check_open() {
        const detailStore = useDetailStore()
        if (detailStore.selected_feature != null) {
            if (this.get_features().includes(detailStore.selected_feature.get_feature_names()) != null) {
                this.isOpen = true
            }
        }
    }

    abstract add_bar(crawler: any, d: any, updater: any, group_elements: any, level: number): void

    abstract get_name(): string

    abstract vis_group(crawler: any, isLast: boolean, isFirst: boolean, updater: any, level: number): void

    abstract set_new_influences(ids: Set<number>, previous_value: number): void

    abstract get_features(): string[]

    abstract get_textual_summary(): string

    abstract close_all(): void

}

export class Group extends GroupClass {
    features: GroupClass[] = []

    constructor(features: (Feature| Group)[], type: string, influence_object: any) {
        super(influence_object)
        this.type = type
        this.ids = new Set(useDataStore().data.map((d, i) => i))
        //first sort the features by score
        features.sort(sort_by_score)

        for (const feature of features) {
            this.push(feature)
        }

    }

    push(feature: Feature | Group) {
        const previous_score = this.get_score()
        feature.set_new_influences(this.ids, previous_score)
        feature.set_parent(this)

        this.ids = new Set([...feature.get_ids()])
        const new_score = this.influence_object.get_average_influence(this.get_ids())
        const difference = new_score - previous_score

        this.features.push(feature)

        this.score += difference
        this.value = new_score

        this.check_open()
    }

    set_new_influences(ids: Set<number>, previous_value: number) {
        let current_ids = ids
        let current_value = previous_value
        for (const group of this.features) {
            group.set_new_influences(current_ids, current_value)
            current_ids = group.get_ids()
            current_value = group.get_value()
        }
        this.ids = current_ids
        let new_value = this.influence_object.get_average_influence(current_ids)
        this.score = new_value - previous_value
        this.value = new_value
    }

    calculate_interaction_effect(feature: Feature | Group) {
        let our_score = this.get_score()
        let their_score = feature.get_score()
        let combined_ids = new Set([...this.get_ids()].filter(x => feature.get_ids().has(x)))
        let combined_score = this.influence_object.get_average_influence(combined_ids)
        return Math.abs(combined_score - our_score - their_score)
    }

    calculate_significant_interaction_effect(feature: Feature | Group) {
        let our_score = this.get_score()
        let their_score = feature.get_score()
        let added_score = our_score + their_score

        let combined_ids = new Set([...this.get_ids()].filter(x => feature.get_ids().has(x)))
        let average = this.influence_object.get_average_influence(combined_ids)
        let std = this.influence_object.get_std_influence(combined_ids)
        let n = combined_ids.size

        let t_score = tscore(added_score, std, average, n)
        let p_value = ttest(t_score, n, 2)
        if (p_value < 0.05 && n > constants.min_subset_absolute) {
            return Math.abs(average - our_score - their_score)
        }
        else {
            return -1
        }
    }

    calculate_added_score(feature: Feature | Group) {
        let our_score = this.get_score()
        let combined_ids = new Set([...this.get_ids()].filter(x => feature.get_ids().has(x)))
        let combined_score = this.influence_object.get_average_influence(combined_ids)
        return Math.abs(combined_score - our_score)
    }

    get_name() : string {
        if (this.type == "correlation") {
            return this.features[0].get_name() + "*"
        }

        return this.features.map(f => f.get_name()).join(", ")
    }

    get_nr_features() {
        return this.features.length
    }

    get_nr_bars() {
        if (this.isOpen) {
            return this.get_nr_features()
        }
        return 1
    }

    get_features(): string[] {
        return this.features.map(f => f.get_features()).flat()
    }

    vis_group(crawler: any, isLast: boolean, isFirst: boolean, updater: any, level:number = 0) {

        if (this.get_nr_features() == 1) {
            this.features[0].vis_group(crawler, isLast, isFirst, updater, level)
        }
        else if (this.isOpen) {
            let initial_offset = crawler.offset
            for (let j = 0; j < this.get_nr_features(); j++) {
                this.features[j].vis_group(crawler, isLast && j == this.get_nr_features() -1 , isFirst && j == 0, updater, level + 1)
            }
            let final_offset = crawler.offset

            this.add_group_box(crawler, initial_offset, final_offset, updater)

        } else {
            this.vis_bars(crawler, updater, isLast, isFirst, level)
        }

    }


    add_bar(crawler: any, d: any, updater: any, group_elements: any, level: number=0) {
        // draw bars
        let rect = group_elements.append("rect")
            .attr("x", d.score < 0 ? crawler.get_value(d.value) : crawler.get_value(d.value - d.score))
            .attr("y", crawler.offset)
            .attr("class", "bars" + crawler.offset)
            .attr("width", crawler.get_value(Math.abs(d.score)) - crawler.get_value(0))
            .attr("fill", d.score < 0 ? Constants.influence_color_negative : Constants.influence_color_positive)
            .style("cursor", "pointer")

        //optionally animate
        if ((crawler.isSlow || this.manual_slow) && !crawler.areChangesSlow) {
            rect.transition()
            .attr("height", crawler.bar_height)

            this.manual_slow = false
        }
       else {
            rect.attr("height", crawler.bar_height)
        }

        // add transparent boundary box for feature selection
        group_elements.append("rect")
            .style("cursor", this.parent != null ? "pointer" : "default")
            .attr("x",0)
            .attr("y", crawler.offset)
            .attr("width", 10000)
            .attr("height", crawler.bar_height)
            .attr("opacity", 0.0)
            .on("mouseenter", (event: any, _:any) => {
                if (!this.isOpen) {
                    this.isOpen = true
                    updater.value += 1
                }

                d3.select(event.target.parentNode).selectAll(".details")
                    .style("opacity", "1")

            })
            .on("click", (event: any, _:any) => {
                if (!this.isOpen) {

                    //useInfluenceStore().influence.groups.forEach(g => g.close_all())

                    this.isOpen = true
                    updater.value += 1
                }
                else {
                    this.isOpen = false
                    updater.value += 1
                }

              d3.select(event.target.parentNode).selectAll(".details")
                .style("opacity", "1")

            })


    }

    add_group_box(crawler: any, initial_offset: number, final_offset: number, updater: any) {
        // add a rectangle around the group
        crawler.layers[0].append("rect")
            .attr("x", 10)
            .attr("y", initial_offset-5)
            .attr("width", crawler.width - 20)
            .attr("height", final_offset - initial_offset +5)
            .attr("fill", "#CCCCCC")
            .style("opacity", 0.2)
            .style("cursor", "pointer")

        //add second boundary box to close the group again on move out
        crawler.layers[2].append("rect")
            .on("mouseenter", () => {
                if (this.isOpen) {
                    this.close_all()
                    updater.value += 1
                }
            })
            .attr("x", 10)
            .attr("y", initial_offset-5)
            .attr("width", crawler.width - 20)
            .attr("height", final_offset - initial_offset +5)
            //remove fill, only keep border
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .style("opacity", 0.0)
            .style("cursor", "pointer")
    }

    get_textual_summary() {
        const mean = useDataStore().data_summary.mean
        let text = ""

        // collect visible features and add them to the text
        if (this.isOpen) {
            // get first feature/ group
            let first = this.features[0]
            let first_score = first.get_score()
            let direction = first_score > 0 ? "positive" : "negative"
            text += "<span class='highlight'>" + first.get_name() + "</span> " +
                "has a <span class='highlight2'>" + direction + "</span> influence (" +
                get_value_text(first.get_score(), mean) + ")."

            //  get second feature/ group
            if (this.features.length > 1) {
                let second = this.features[1]
                let second_score = second.get_score()
                let direction = first_score * second_score > 0 ? "amplified" : "diminished"
                if ((first_score + second_score) * first_score < 0) {
                    direction = "reversed"
                }
                text += " When <span class='highlight'>" + second.get_name() + "</span>, " +
                    "this effect is " + direction + " (by " + get_value_text(second.get_score(), mean) + ")."


                // go through the rest of the features
                for (let i = 2; i < this.features.length; i++) {
                    let feature = this.features[i]
                    let direction = first_score * feature.get_score() > 0 ? "amplified" : "diminished"
                    text += " When <span class='highlight'>" + feature.get_name() + "</span>, " +
                        "it is " + direction + " (by " + get_value_text(feature.get_score(), mean) + ")."
                }

            }
        }
        else {
            const direction = this.score > 0 ? "positive" : "negative"
            text += "<span class='highlight'>" +
                this.get_name() +
                "</span> has a <span class='highlight2'>" +
                direction +
                "</span> influence (" +
                get_value_text(this.score, mean) + ")"
        }

        return text
    }

    close_all() {
        this.isOpen = false
        this.features.forEach(f => f.close_all())
    }

}

export class Feature extends GroupClass {
    feature: string = ""

    constructor(feature: string, influence_object: any) {
        super(influence_object)
        this.feature = feature
        this.score = this.influence_object.main_effects[feature].average
        this.value = this.score
        this.ids = this.influence_object.instance_subsets[this.feature]

        this.check_open()
    }

    set_new_influences(ids: Set<number>, previous_value: number) {
        let current_ids = this.get_ids()
        this.ids = new Set([...ids].filter(x => current_ids.has(x)))
        let new_value = this.influence_object.get_average_influence(this.ids)
        this.score = new_value - previous_value
        this.value = new_value
    }

    get_name() {
        const dataStore = useDataStore()
        const lbl = dataStore.get_label
        return lbl(this.feature) + ": " + lbl(this.feature, this.influence_object.instance[this.feature])
    }

    get_feature_names() {
        return this.feature
    }

    get_feature_labels() {
        return this.influence_object.instance[this.feature]
    }

    vis_group(crawler: any, isLast: boolean, isFirst: boolean, updater: any, level:number = 0) {
        this.vis_bars(crawler, updater, isLast, isFirst, level)
    }

    get_features(): string[] {
        return [this.feature]
    }

    add_bar(crawler: any, d: any, updater: any, group_elements: any, level: number=0) {

       // add transparent boundary box for feature selection
        group_elements.append("rect")
            .style("cursor", this.parent != null ? "pointer" : "default")
            .attr("x", 10)
            .attr("y", crawler.offset)
            .attr("width", crawler.width - 20)
            .attr("height", crawler.bar_height)
            .attr("class", "boundary_bars" + crawler.offset)
            .style("opacity", 0.0)
            .style("fill", "#fffdf0")
            .style("stroke", "#fffdf0")
            .style("stroke-opacity", 0.0)
            .on("mouseenter", (event: any, _: any) => {
                if (!this.parent.detailIsOpen) {
                    d3.select(event.target.parentNode).selectAll(".details")
                        .style("opacity", 1)
                    this.parent.detailIsOpen = true
                    updater.value += 1
                }

                // add slight shadow to indicate that the group can be opened
                d3.select(event.target).style("opacity", 0.7)
                    .style("stroke-opacity", 0.5)

            })
            .on("mouseleave", (event: any, _: any) => {
                d3.select(event.target).style("opacity", 0.0)
            })
            .on("click", async (event: any, _: any) => {
                if (!this.parent.isOpen) {
                    //useInfluenceStore().influence.groups.forEach(g => g.close_all())
                    this.parent.isOpen = true
                }

                d3.select(event.target)
                    .style("fill", "#fffdd3")
                // sleep a bit to make the opacity change visible before resetting the visualization
                await new Promise(r => setTimeout(r, 60));

                useDetailStore().selected_feature = this
                updater.value += 1
            })
            .on("touchstart", async (event: any, _: any) => {
                this.influence_object.close_all()
                this.parent.isOpen = true
                d3.select(event.target).style("opacity", 0.7)
                // sleep a bit to make the opacity change visible before resetting the visualization
                await new Promise(r => setTimeout(r, 60));

                useDetailStore().selected_feature = this
                updater.value += 1
            })

               // draw bars
            let rect = group_elements.append("rect")
                .style("pointer-events", "none")
                .attr("x", d.score < 0 ? crawler.get_value(d.value) : crawler.get_value(d.value - d.score))
                .attr("y", crawler.offset)
                .attr("class", "bars" + crawler.offset)
                .attr("width", crawler.get_value(Math.abs(d.score)) - crawler.get_value(0))
                .attr("fill", d.score < 0 ? Constants.influence_color_negative : Constants.influence_color_positive)

            //optionally animate
            if ((crawler.isSlow || this.manual_slow) && !crawler.areChangesSlow) {
                rect.transition()
                .attr("height", crawler.bar_height)
                this.manual_slow = false
            }
           else {
                rect.attr("height", crawler.bar_height)
            }

    }

    get_textual_summary() {
        const mean = useDataStore().data_summary.mean
        const direction = this.score > 0 ? "positive" : "negative"
        return "<span class='highlight'>" +
            this.get_name() +
            "</span> has a <span class='highlight2'>" +
            direction +
            "</span> influence (" +
            get_value_text(this.score, mean) + ")."
    }

    close_all() {
        this.isOpen = false
    }

}

const add_value_line = (crawler: any, d: any, isLast: boolean, group_elements: any) => {
    if (!isLast) {
        // draw value lines, vertically
        group_elements.append("line")
            .attr("x1", crawler.get_value(d.value))
            .attr("y1", crawler.offset)
            .attr("x2", crawler.get_value(d.value))
            .attr("y2", crawler.offset + 2 * crawler.bar_height + crawler.spacing_inside_group)
            .attr("class", "line_vertical" + crawler.offset)
            .attr("stroke", "#000000")
            .attr("stroke-width", 2)
    }
}

const add_feature_names = (crawler: any, d: any, group_elements: any, isFirst: boolean) => {

    // for negative scores
    let bar_begin = d.score >= 0? d.value - d.score : d.value
    let bar_end = d.score >= 0? d.value : d.value - d.score

    const space_left_of_bar = crawler.get_value(bar_begin)
    const space_right_of_bar = crawler.width - crawler.get_value(bar_end)
    const text_side = space_left_of_bar < space_right_of_bar ? "right" : "left"


    let x_position = text_side == "left"? bar_begin : bar_end

    let padding = text_side == "left" ? 5 : -5
    padding = isFirst ? padding : 2*padding

    let prefix = isFirst ? "" : " when "

    const available_space = text_side == "left" ? space_left_of_bar : space_right_of_bar
    let name = d.get_name()
    if (name.length > available_space / 8) {
        name = name.slice(0, available_space / 8 - 2) + "..."
    }

    // add feature names
    let text_element = group_elements.append("text")
            .attr("x", crawler.get_value(x_position) - padding)
            .attr("y", crawler.offset + crawler.bar_height / 2)
            .attr("dy", ".4em")
            .attr("class", "text_feature_names" + crawler.offset)
            .style("font-size", "14px")
            .style("font-family", "Verdana")
            .style("text-anchor", text_side == "left" ? "end": "start")
            .style("fill", "black")
            .style("pointer-events", "none")
    text_element
            .append("tspan")
            .text(prefix)
            .style("font-weight", "bold")
    text_element
            .append("tspan")
            .text(name)

    x_position = text_side == "right"? bar_begin : bar_end

    // add feature values
    group_elements.append("text")
        .attr("x", crawler.get_value(x_position) + padding)
        .attr("y", crawler.offset + crawler.bar_height / 2)
        .text(get_value_text(d.score, crawler.mean))
        .attr("dy", ".4em")
        .attr("class", "text_feature_names" + crawler.offset)
        .style("font-size", "14px")
        .style("font-family", "Verdana")
        .style("text-anchor", text_side == "right" ? "end": "start")
        .style("fill", "grey")
        .style("pointer-events", "none")

}

const get_value_text = (value:number, mean: any) => {
    //absolute
    //return Math.abs(influenceStore.influence.explanation_prediction - dataStore.data_summary.mean).toFixed(0)

    //percentage
    let percentage = (value / Math.abs(mean) * 100)
    return (percentage > 0 ? "+" : "") + percentage.toFixed(0) + "%"


}

const add_zero_line = (crawler: any, isLast: boolean) => {

    let end_y = crawler.offset + crawler.bar_height + crawler.spacing_inside_group
    if (isLast) {
        end_y += crawler.spacing_between_groups
    }
  // add black vertical line at 0
  crawler.layers[2].append("line")
      .attr("x1", crawler.get_value(0))
      .attr("y1", crawler.offset)
      .attr("x2", crawler.get_value(0))
      .attr("y2", end_y)
      .attr("stroke", "black")
      .attr("stroke-width", 2)
}

class Influence {
    groups: Group[] = []
    main_effects: { [key: string]: { value: number, average: number, size: number } } = {}
    instance_subsets: { [key: string]: Set<number> } = {}
    explanation_prediction: number = 0
    instance: { [key: string]: number } = {}
    excluded_features: string[] = []

    constructor(instance: any = null) {
        this.groups = []
        this.main_effects = {}
        this.instance_subsets = {}
        this.explanation_prediction = 0
        if (instance != null) {
            this.instance = instance
        }
        else {
            this.instance = useDataStore().instance
        }
    }

    // the margin around the instance feature value in which we consider instances to be similar
    get_similarity_margin(feature: string) {
        const extent = d3.extent(useDataStore().data.map(d => d[feature]))
        const range = extent[1] - extent[0]
        return range * constants.similarity_margin_percent
    }

    calculate_main_effects() {
            const dataStore = useDataStore()
            const center = dataStore.data_summary.mean
            this.main_effects = {}
            for (let feature of dataStore.interacting_features) {
                const instance_value = this.instance[feature]
                const similar_instances = this.get_similar_instances(feature)
                const sum = similar_instances.reduce((acc, d) => acc + d[dataStore.target_feature], 0)
                const size = similar_instances.length
                if (size > Constants.min_subset_absolute) {
                    this.main_effects[feature] = {value: instance_value, average: sum / size - center, size: size}
                    //also create set of ids for each feature
                    const ids = similar_instances.map((d: any) => d.__id__)
                    this.instance_subsets[feature] = new Set(ids)
                }
                else {
                    this.excluded_features.push(feature)
                }

            }
        }

        get_similar_instances(feature: string) {
            const dataStore = useDataStore()
            const featureStore = useFeatureStore()
            const instance_value = this.instance[feature]
            const feature_type = featureStore.feature_types[feature]
            if (feature_type === "continuous") {
                // get similar instances in some margin around the instance value
                const margin = this.get_similarity_margin(feature)
                const min = +instance_value - margin
                const max = +instance_value + margin
                return dataStore.data.filter((d) => d[feature] >= min && d[feature] <= max)
            }

            else {
                return dataStore.data.filter((d) => d[feature] === instance_value)
            }
        }

        calculate_groups() {
            const dataStore = useDataStore()
            let groups = [] as Group[]
            let features = dataStore.interacting_features.filter(f => !this.excluded_features.includes(f))

            let main_players = [] as (Feature | Group)[]

            //first group all features that have a high correlation together
            let remaining_features = [...features]
            for (const feature of features) {
                let correlated_features = remaining_features.filter(f => dataStore.correlations[feature][f] > constants.correlation_group_threshold)
                if (correlated_features.length > 0) {
                    correlated_features.push(feature)
                    correlated_features.sort((a, b) => Math.abs(this.main_effects[b].average) - Math.abs(this.main_effects[a].average))

                    if (constants.is_reduced) {
                        // get the feature with the highest main effect and only add it
                        let main_feature = correlated_features[0]
                        main_players.push(new Feature(main_feature, this))
                    }
                    else {
                        let group = new Group(correlated_features.map(f => new Feature(f, this)), "correlation", this)
                        main_players.push(group)
                    }

                    remaining_features = remaining_features.filter(f => !correlated_features.includes(f))
                }
            }

            //then add the remaining features to main_players
            for (const feature of remaining_features) {
                main_players.push(new Feature(feature, this))
            }

            //sort main players by main effect
            main_players.sort(sort_by_score)

            //then go through them and either add them to a previous group when they interact, or create a new group
            while (main_players.length > 0) {
                // find main player with highest score. Conveniently, this is the first one as it is ordered
                let main_player = main_players.shift() as Feature | Group
                // make a new group with this main player
                let group = new Group([main_player], "single", this)

                let interactions_present = true
                while (interactions_present && main_players.length > 0) {

                    let significant_interaction_effects = main_players.map(mp => group.calculate_significant_interaction_effect(mp))

                    let best_interaction = Math.max(...significant_interaction_effects)
                    let best_interaction_index = significant_interaction_effects.indexOf(best_interaction)
                    if (best_interaction > 0) {
                        group.push(main_players[best_interaction_index])
                        main_players = main_players.filter((_, i) => i != best_interaction_index)
                    }
                    else {
                        interactions_present = false
                    }

                }
                groups.push(group)

            }

            //sort groups by Math.abs(score)
            groups.sort(sort_by_score)

            if (constants.is_reduced) {
                // delete all groups whose score is below the boundary
                let boundary = dataStore.data_summary.std * 0.05
                groups = groups.filter(g => Math.abs(g.get_score()) > boundary)
            }
            //dataStore.shown_features = groups.map(g => g.get_features()).flat()
            dataStore.shown_features = dataStore.interacting_features

            return groups
        }

        calculate_explanation_prediction() {

            if (this.groups.length == 0) {
                this.explanation_prediction = NaN
            }
            else {


                let mean = useDataStore().data_summary.mean
                let prediction = mean
                for (const group of this.groups) {
                    prediction += group.get_score()
                }

                // but restrict to the range of the target feature
                const range = useDataStore().get_subset_influence_range()
                prediction = Math.min(prediction, range[1] + mean)
                prediction = Math.max(prediction, range[0] + mean)

                this.explanation_prediction = prediction
            }
        }

        calculate_influences() {
            useDataStore().storyIsVisible = true
            this.excluded_features = []
            this.calculate_main_effects()
            this.groups = this.calculate_groups()
            this.calculate_explanation_prediction()

        }

        get_average_influence(ids: Set<number>): number {
            let subset = useDataStore().data.filter((_, i) => ids.has(i))
            let average = subset.reduce((acc, d) => acc + d[useDataStore().target_feature], 0) / subset.length
            let center = useDataStore().data_summary.mean
            return average - center
        }

        get_std_influence(ids: Set<number>): number {
            let subset = useDataStore().data.filter((_, i) => ids.has(i))
            let average = subset.reduce((acc, d) => acc + d[useDataStore().target_feature], 0) / subset.length
            let std = Math.sqrt(subset.reduce((acc, d) => acc + (d[useDataStore().target_feature] - average)**2, 0) / subset.length)
            return std
        }

        get_textual_summary() {
            // print one summary for each group, separated by a line break
            let text = ""

            for (const group of this.groups) {
                text += group.get_textual_summary() + "<br>"
            }


            return text
        }

        close_all() {
            this.groups.forEach(g => g.close_all())
        }




}

export const useInfluenceStore = defineStore({
    id: 'influence',
    state: () => ({
        influence: new Influence(),
        svg_width: 650,
    }),
    actions: {
        calculate_influences() {
            this.influence = new Influence()
            this.influence.calculate_influences()
        },
        get_average_influence(ids: Set<number>) {
            return this.influence.get_average_influence(ids)
        },

        get_explanation_prediction(instance: { [key: string]: number }) {
            let influence = new Influence(instance)
            influence.calculate_influences()
            return influence.explanation_prediction
        },

        get_textual_summary() {
            return this.influence.get_textual_summary()
        },

        close_all() {
            this.influence.close_all()
        }


    }
})
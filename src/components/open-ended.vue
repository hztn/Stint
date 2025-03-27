<script setup lang="ts">
import {useDataStore} from "../stores/dataStore.ts";

const dataStore = useDataStore()
</script>


<template>
  <div class="d-flex mb-5" v-if="dataStore.storyIsVisible && false">
    <v-btn class="mx-4 bg-blue" > What if I add another feature?</v-btn>
    <v-btn class="mx-4 bg-blue"> What if I remove a feature?</v-btn>
    <v-btn class="mx-4 bg-blue"> Can I trust this?</v-btn>
  </div>
</template>

<style scoped>

</style>
<template>
  <div class="c-etc2022">
    <p v-if="$fetchState.error">{{ $t('error.otherError') }} : {{ $fetchState.error.message }}</p>
    <!-- We have to use v-html here as we get html content directly from Directus -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else-if="!$fetchState.pending" class="directus-formatted-content" v-html="textEntry.body"></div>
    <st-button
      href="https://twitter.com/search?q=%23etc2022UK%20(from%3ASwissTchoukball)&f=live"
      class="c-etc2022__tweets-button"
      primary
    >
      {{ $t('internationalCompetition.viewTweets') }}
    </st-button>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import { TextEntry } from '~/plugins/cms-service';

export default Vue.extend({
  data() {
    return {
      textEntry: undefined as TextEntry | undefined,
    };
  },
  async fetch() {
    this.textEntry = await this.$cmsService.getText(4);
  },
});
</script>

<style>
.c-etc2022 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--st-length-spacing-s);
}
</style>

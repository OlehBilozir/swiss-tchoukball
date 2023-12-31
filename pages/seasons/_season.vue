<template>
  <section class="l-main-content-section">
    <st-breadcrumb :items="breadcrumb" class="c-season__breadcrumb" />
    <st-loader v-if="$fetchState.pending" :main="true" />
    <p v-else-if="$fetchState.error">{{ $t('error.otherError') }} : {{ $fetchState.error.message }}</p>
    <template v-else>
      <h2 class="t-headline-1">{{ $tc('season.name', 1) }} {{ season.name }}</h2>
      <h3 class="t-headline-2">{{ $t('competitions.title') }}</h3>
      <st-link-list
        :items="competitionEditionsNavigation"
        :name="$t('otherNavigation', { name: `${$t('competitions.title')} ${season.name}` })"
        class="c-season__competition-list"
      />
    </template>
  </section>
</template>

<script lang="ts">
import Vue from 'vue';
import { Collection, Item } from '@vuex-orm/core';
import CompetitionEdition from '~/models/competition-edition.model';
import Season from '~/models/season.model';
import { BreadcrumbItem } from '~/components/st-breadcrumb.vue';
import { MenuItem } from '~/store/state';

export default Vue.extend({
  nuxtI18n: {
    paths: {
      fr: '/saisons/:season',
      de: '/saisonen/:season',
    },
  },
  data() {
    return {
      breadcrumb: [
        {
          pageName: 'seasons',
          displayName: this.$tc('season.name', 2),
        },
      ] as BreadcrumbItem[],
    };
  },
  async fetch() {
    await this.$store.dispatch('loadCompetitionsOfSeason', this.$route.params.season);
  },
  computed: {
    season(): Item<Season> {
      return Season.query().where('slug', this.$route.params.season).first();
    },
    competitionEditions(): Collection<CompetitionEdition> {
      return CompetitionEdition.query()
        .with('competition')
        .whereHas('season', (query) => {
          query.where('slug', this.$route.params.season);
        })
        .all();
    },
    competitionEditionsNavigation(): MenuItem[] {
      return this.competitionEditions.map((competitionEdition) => {
        return {
          name: competitionEdition.name,
          href: this.localePath({
            name: 'competitions-competition-season',
            params: { season: this.season?.slug || '', competition: competitionEdition.competition.slug },
          }),
        };
      });
    },
  },
});
</script>

<style scoped>
.c-season__breadcrumb {
  margin-top: var(--st-length-spacing-s);
}

.c-season__competition-list {
  margin-top: var(--st-length-spacing-s);
}
</style>

<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
  asyncData({ redirect, localePath }) {
    redirect(localePath('etc2022-live'));
  },
});
</script>

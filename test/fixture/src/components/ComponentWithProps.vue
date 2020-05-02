<template>
  <div>

  </div>
</template>

<script>
import mixinUsingMixin from '@/mixins/mixinUsingMixin';
export default {
    mixins: [mixinUsingMixin],
    props: {
        label: {
            type: String,
            required: false,
            value: '',
        },
    },
};
</script>

<style>

</style>
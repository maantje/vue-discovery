<template>
  <div @click="$emit('eventInComponent')">

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
        defaultValue: {
            type: String,
            required: true,
            value: '',
        },
    },
    created() {

    }
};
</script>

<style>

</style>
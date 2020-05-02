import mixin from '@/mixins';
export default {
    mixins: [mixin],
    props: {
        names: {
            type: Array,
            required: true,
        },
    },
};
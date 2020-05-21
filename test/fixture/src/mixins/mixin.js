export default {
    props: {
        name: {
            type: String,
            required: true,
        },
    },
    mounted() {
        this.$emit('eventInMixin')
    }
};
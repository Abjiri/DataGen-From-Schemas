<template>
    <v-btn-toggle v-model="from_format" mandatory @change="updateFormat">
        <v-btn :value="'XML'" color="green" dark class="font-weight-bold" :class="from_format=='XML' ? 'white--text' : 'grey--text text--lighten-2'">
            XML
        </v-btn>
        <v-btn :value="'JSON'" color="blue" dark class="font-weight-bold" :class="from_format=='JSON' ? 'white--text' : 'grey--text text--lighten-2'">
            JSON
        </v-btn>
    </v-btn-toggle>
</template>

<script>
export default {
    props: {
        format: String
    },
    data() {
        return {
            from_format: "XML"
        }
    },
    methods: {
        updateFormat() { this.$emit('changed', this.from_format) }
    },
    watch: {
        format() { this.from_format = this.format}
    }
}
</script>
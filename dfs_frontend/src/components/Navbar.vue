<template>
    <nav>
        <v-app-bar flat app dark :color="color()">
            <span class="title inline">DataGen From </span>
            <ButtonGroup class="type-schema" :format="format" @changed="update"/>
            <span class="title"> Schemas</span>
            <v-spacer></v-spacer>
            <!--v-btn color="grey">
                <span>Logout</span>
                <v-icon right>mdi-logout</v-icon>
            </v-btn-->
        </v-app-bar>
    </nav>
</template>

<script>
import ButtonGroup from '@/components/ButtonGroup'

export default {
    components: {
        ButtonGroup
    },
    props: {
        format: String
    },
    methods: {
        update(format) { this.$emit('changed', format) },
        color() { return "var(--" + this.format.toLowerCase() + ")" }
    }
}
</script>

<style>
.title {
    font-size: 1.25rem;
    font-family: "Roboto", sans-serif;
}

.inline {
    display: inline
}

.v-input {
    font-size: 1.25rem !important;
    max-width: 5.5rem !important;
}

.type-schema {
    display: inline-block;
    margin-right: 10px;
    margin-left: 10px;
}

.vs--single.vs--open .vs__selected { position: inherit; }
</style>
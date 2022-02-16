<template>
    <v-dialog v-model="dialog" max-width="600px">
        <template v-slot:activator="{ on }">
            <v-btn depressed fab small color="blue-grey lighten-4" class="sucess" v-on="on">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
        </template>
        <v-card>
            <v-card-title>
                Definições do processo de geração
            </v-card-title>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    
}
</script>
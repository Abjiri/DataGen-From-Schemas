<template>
    <v-form ref="form" v-model="valid" lazy-validation class="px-3">
        <v-text-field
            v-model="settings.UNBOUNDED"
            :rules="[rules.required, rules.nonNegative]"
            type="number"
            label='Máximo de ocorrências quando maxOccurs="unbounded"' 
        />

        <v-container class="px-0">
            <v-row>
                <v-col cols="12" sm="6">
                    <v-text-field
                        :key="settings.RECURSIV.UPPER"
                        v-model="settings.RECURSIV.LOWER"
                        :rules="[rules.required, rules.nonNegative, rules.lessThanUpper]"
                        type="number"
                        label="Limite inferior de recursividade"
                    />
                </v-col>
                <v-col cols="12" sm="6">
                    <v-text-field
                        :key="settings.RECURSIV.LOWER"
                        v-model="settings.RECURSIV.UPPER"
                        :rules="[rules.required, rules.nonNegative, rules.moreThanLower]"
                        type="number"
                        label="Limite superior de recursividade"
                    />
                </v-col>
            </v-row>
        </v-container>
    </v-form>
</template>

<script>
import _ from 'lodash'

export default {
    props: {
        result: Number
    },
    data() {
        return {
            valid: true,
            original_settings: {},
            settings: {
                UNBOUNDED: 10,
                RECURSIV: {LOWER: 0, UPPER: 3}
            },
            rules: {
                required: v => !!v || "Valor obrigatório.",
                nonNegative: v => parseInt(v) >= 0 || "O valor não pode ser negativo.",
                lessThanUpper: v => parseInt(v) <= parseInt(this.settings.RECURSIV.UPPER) || "Não pode ser maior que o limite superior.",
                moreThanLower: v => parseInt(v) >= parseInt(this.settings.RECURSIV.LOWER) || "Não pode ser menor que o limite inferior."
            }
        }
    },
    mounted() { this.original_settings = _.cloneDeep(this.settings) },
    watch: {
        valid() { this.$emit('updateValid', 'xml', this.valid) },
        result() {
            if (this.result > 0) this.$emit('saved', this.settings)
            if (this.result < 0) {
                this.settings = _.cloneDeep(this.original_settings)
                this.$refs.form.resetValidation()
            }
        }
    }
}
</script>
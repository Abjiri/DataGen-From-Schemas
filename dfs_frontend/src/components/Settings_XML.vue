<template>
    <v-form ref="form" v-model="valid" lazy-validation class="px-3">
        <v-row>
            <v-col cols="12" sm="6">
                <v-text-field
                    :key="settings.recursiv.upper"
                    v-model="settings.recursiv.lower"
                    :rules="[rules.required, rules.nonNegative, rules.lessThanUpper]"
                    type="number"
                    label="Limite inferior de recursividade"
                />
            </v-col>
            <v-col cols="12" sm="6">
                <v-text-field
                    :key="settings.recursiv.lower"
                    v-model="settings.recursiv.upper"
                    :rules="[rules.required, rules.nonNegative, rules.moreThanLower]"
                    type="number"
                    label="Limite superior de recursividade"
                />
            </v-col>
        </v-row>
        
        <v-text-field
            v-model="settings.unbounded"
            :rules="[rules.required, rules.nonNegative]"
            type="number"
            label='Máximo de ocorrências quando maxOccurs="unbounded"' 
        />
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
                unbounded: 10,
                recursiv: {lower: 0, upper: 3}
            },
            rules: {
                required: v => !!v || "Valor obrigatório.",
                nonNegative: v => parseInt(v) >= 0 || "O valor não pode ser negativo.",
                lessThanUpper: v => parseInt(v) <= parseInt(this.settings.recursiv.upper) || "Não pode ser maior que o limite superior.",
                moreThanLower: v => parseInt(v) >= parseInt(this.settings.recursiv.lower) || "Não pode ser menor que o limite inferior."
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
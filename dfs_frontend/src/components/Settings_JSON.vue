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

        <v-row>
            <v-col cols="12" sm="6">
                <v-text-field
                    v-model="settings.prob_if"
                    :rules="[rules.required, rules.probability]"
                    type="number"
                    min="0"
                    max="100"
                    label="Probabilidade de um 'if' ser verdadeiro"
                />
            </v-col>
            <v-col cols="12" sm="6">
                <v-text-field
                    v-model="settings.prob_patternProperty"
                    :rules="[rules.required, rules.probability]"
                    type="number"
                    min="0"
                    max="100"
                    label="Probabilidade de gerar uma propriedade a partir de uma 'patternProperty'"
                />
            </v-col>
        </v-row>

        <v-radio-group
            row
            v-model="settings.random_props"
            :rules="[rules.required_bool]"
            label="Gerar propriedades aleatórias (dentro do tamanho indicado) se não se especificarem 'additionalProperties' ou 'unevaluatedProperties'"
        >
            <v-radio :label="'Sim'" :value="true" :color='`var(--${mode})`'/>
            <v-radio :label="'Não'" :value="false" :color='`var(--${mode})`'/>
        </v-radio-group>

        <v-row>
            <v-col cols="12" sm="4">
                <span class="label">Extensão de propriedades repetidas nas chaves 'properties' e 'patternProperties'</span>
                <v-select class="select"
                    :rules="[rules.required]"
                    :v-model="settings.extend_propSchema"
                    :items="options1"
                    item-text="label"
                    item-value="key"
                    label="Selecionar"
                    outlined
                    single-line
                ></v-select>
            </v-col>
            <v-col cols="12" sm="4">
                <span class="label">Extensão de chaves cujo valor é uma subschema</span>
                <v-select class="select"
                    :rules="[rules.required]"
                    :v-model="settings.extend_schemaObj"
                    :items="options1"
                    item-text="label"
                    item-value="key"
                    label="Selecionar"
                    outlined
                    single-line
                ></v-select>
            </v-col>
            <v-col cols="12" sm="4">
                <span class="label">Extensão da chave 'prefixItems'</span>
                <v-select style="padding-top: 39px;"
                    :rules="[rules.required]"
                    :v-model="settings.extend_prefixItems"
                    :items="options2"
                    item-text="label"
                    item-value="key"
                    label="Selecionar"
                    outlined
                    single-line
                ></v-select>
            </v-col>
        </v-row>
    </v-form>
</template>

<script>
import _ from 'lodash'

export default {
    props: {
        mode: String,
        result: Number
    },
    data() {
        return {
            valid: true,
            original_settings: {},
            settings: {
                recursiv: {lower: 0, upper: 3},
                prob_if: 50,
                prob_patternProperty: 80,
                random_props: false,
                extend_propSchema: "OR", // "OR" / "OW" (overwrite)
                extend_prefixItems: "OR", // "OR" / "OWP" (overwrite parcial) / "OWT" (overwrite total) / "AP" (append) 
                extend_schemaObj: "OR" // "OR" / "OW" (overwrite)
            },
            options1: [{key: "OR", label: "Extensão"}, {key: "OW", label: "Sobrescrição"}],
            options2: [{key: "OR", label: "Extensão"}, {key: "OWP", label: "Sobrescrição parcial"}, {key: "OWT", label: "Sobrescrição total"}, {key: "AP", label: "Concatenação"}],
            rules: {
                required: v => !!v || "Valor obrigatório.",
                required_bool: v => v === true || v === false || "Valor obrigatório.",
                nonNegative: v => parseInt(v) >= 0 || "O valor não pode ser negativo.",
                lessThanUpper: v => parseInt(v) <= parseInt(this.settings.recursiv.upper) || "Não pode ser maior que o limite superior.",
                moreThanLower: v => parseInt(v) >= parseInt(this.settings.recursiv.lower) || "Não pode ser menor que o limite inferior.",
                probability: v => parseInt(v) >= 0 && parseInt(v) <= 100 || "O valor deve ser uma probabilidade (entre 0 e 100)."
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

<style scoped>
.label {
    font-size: 14px;
    min-height: 8px;
    cursor: text;
    height: auto;
    color: #8c8c8c;
    line-height: 15px;
    letter-spacing: normal;
    white-space: normal;
    border: 0;
    max-width: 100%;
    transition: 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
    padding-bottom: 15px;
}

.select {
    padding-top: 15px !important;
}
</style>
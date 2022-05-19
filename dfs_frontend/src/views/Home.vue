<template>
    <v-container>
      <!-- modals -->
      <Modal
        title="Gerar dataset"
        options
        :visible="chooseSchema"
        @close="chooseSchema=false"
        @confirm="generate"
      >
        Deseja gerar o dataset a partir de que schema?
        <v-select class="select-schema"
          v-model="main_schema"
          :items="schemas"
          item-text="label"
          item-value="key"
          label="Selecionar"
          outlined
          return-object
          single-line
        ></v-select>
      </Modal>
      <Modal
        title="Erro"
        :visible="error"
        @close="error=false"
      >
        {{errorMsg}}
      </Modal>

      <v-row>
          <v-col sm="auto">
            <v-btn depressed dark color="indigo" @click="askMainSchema">
              <span>Gerar</span>
              <v-icon right>mdi-reload</v-icon>
            </v-btn>
          </v-col>
          <v-col>
            <SettingsXML @saved="updateSettings"/>
          </v-col>
          <v-col class="justify-end">
            <ButtonGroup @changed="updateOutputFormat"/>
          </v-col>
      </v-row>

      <v-row class="fill-height mt-0">
        <Tabs
          :mode="input_mode" 
          :hover="main_schema.key" 
          :tabs="tabs" 
          :errorUpload="error" 
          @updateInput="updateInput" 
          @updateTabs="updateTabs" 
          @hover="updateMain"
          @errorUpload="errUpload"
        />
        <v-flex xs12 md6>
          <v-container>
            <Codemirror :type="'output'" :mode="output_mode" v-bind:text="output"/>
          </v-container>
        </v-flex>
      </v-row>
    </v-container>
</template>

<script>
import _ from 'lodash'
import axios from 'axios'
import SettingsXML from '@/components/Settings_XML'
import ButtonGroup from '@/components/ButtonGroup'
import Codemirror from '@/components/Codemirror'
import Modal from '@/components/Modal'
import Tabs from '@/components/Tabs'
import aux from '@/utils/tabs'

export default {
  components: {
    SettingsXML,
    ButtonGroup,
    Codemirror,
    Modal,
    Tabs
  },
  data() {
    return {
      input_mode: "javascript",
      output_mode: "javascript",
      output: "",
      settings: {
        UNBOUNDED: 10,
        RECURSIV: {LOWER: 0, UPPER: 3},
        OUTPUT: "JSON"
      },
      
      tabs: [{ label: "Schema 1", key: "schema_1", input: "", closable: false }],
      main_schema: {label: "Schema 1", key: "schema_1"},
      schemas: [{ label: "Schema 1", key: "schema_1" }],

      chooseSchema: false,
      error: false,
      errorMsg: ""
    }
  },
  methods: {
    errUpload() {
      this.errorMsg = "O ficheiro que escolheu não corresponde a uma schema. A extensão do ficheiro deve ser .json!"
      this.error = true
    },
    updateSettings(new_settings) { Object.assign(this.settings, new_settings) },
    updateOutputFormat(new_format) { this.settings.OUTPUT = new_format },
    updateMain(key) { this.main_schema = this.schemas.find(s => s.key == key) },
    updateInput(index, input) {
      let new_label = aux.searchSchemaId(input, this.tabs[index].key)

      // dar update ao label da schema para o seu id, se tiver um
      // ou para o label original da schema (Schema nr), se o user tiver apagado o id
      if (new_label != this.tabs[index].label) {
        this.tabs[index].label = new_label
        this.schemas[index].label = new_label
        if (this.main_schema.key == this.tabs[index].key) this.main_schema.label = new_label
      }

      this.tabs[index].input = input
    },
    updateTabs(tabs, index, upload) {
      this.tabs = tabs
      this.schemas = this.tabs.map(t => { return {label: t.label, key: t.key} })
      if (upload) this.updateInput(index, this.tabs[index].input)
    },
    askMainSchema() {
      let ids = aux.getAllIds(this.tabs.map(t => t.input))

      if (ids.length == new Set(ids).size) this.chooseSchema = true
      else {
        let next_ids = _.clone(ids)

        for (let i = 0; i < ids.length; i++) {
          next_ids.shift()

          if (next_ids.includes(ids[i])) {
            this.errorMsg = `Todas as schemas e subschemas devem ter ids únicos! Existe mais do que uma schema com o id '${ids[i]}'.`
            this.error = true
            break
          }
        }
      }
    },
    async generate() {
      this.chooseSchema = false
      let tabs = aux.removeRepeatedSchemas(_.cloneDeep(this.tabs), this.main_schema.key)
      console.log(tabs)

      let main_schema = tabs.find(s => s.key == this.main_schema.key).input
      let other_schemas = tabs.filter(s => s.key != this.main_schema.key && s.input.length > 0).map(s => s.input)
      
      let {data} = await axios.post('http://localhost:3000/api/json_schema', {schemas: [main_schema, ...other_schemas], settings: this.settings})
      //let {data} = await axios.post('http://localhost:3000/api/xml_schema/', {xsd: this.input, settings: this.settings})

      if ("dataset" in data) this.output = data.dataset
      if ("message" in data) this.output = "ERRO!!\n\n" + data.message
    }
  }
}
</script>

<style scoped>
.parameters {
  display: flex;
  flex-direction: column;
  align-items: center;
  width:auto;
  height:auto;
}

.select-schema {
  display: flex;
  padding-top: 20px;
}
</style>
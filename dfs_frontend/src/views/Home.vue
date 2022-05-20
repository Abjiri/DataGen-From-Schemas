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
            <v-btn depressed :color='`var(--${input_mode})`' class="white--text" @click="input_mode=='xml' ? generate() : askMainSchema()">
              <span>Gerar</span>
              <v-icon right>mdi-reload</v-icon>
            </v-btn>
          </v-col>
          <v-col>
            <SettingsXML @saved="updateSettings"/>
          </v-col>
          <v-col class="justify-end">
            <ButtonGroup :format="settings.OUTPUT" @changed="updateOutputFormat"/>
          </v-col>
      </v-row>

      <v-row class="fill-height mt-0">
        <!-- consola input -->
        <v-flex xs12 md6>
          <v-container v-if="input_mode=='xml'">
            <Codemirror :type="'input'" :mode="input_mode" :text="xsd_input" @changed="onChangeInput"/>
          </v-container>
          <v-container v-else>
            <Tabs
              :mode="input_mode" 
              :hover="main_schema.key" 
              :tabs="tabs"
              @updateInput="updateInput" 
              @updateTabs="updateTabs" 
              @hover="updateMain"
              @errorUpload="errUpload"
            />
          </v-container>
        </v-flex>

        <!-- CONSOLA OUTPUT -->
        <v-flex xs12 md6>
          <v-container>
            <Codemirror :type="'output'" :mode="output_mode" :text="output" :generate="gen_request"/>
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
      input_mode: "xml",
      output_mode: "xml",
      output: "",
      settings: {
        UNBOUNDED: 10,
        RECURSIV: {LOWER: 0, UPPER: 3},
        OUTPUT: "XML"
      },

      // from XML schemas
      xsd_input: "",
      
      // from JSON schemas
      tabs: [{ label: "Schema 1", key: "schema_1", input: "", closable: false }],
      main_schema: {label: "Schema 1", key: "schema_1"},
      schemas: [{ label: "Schema 1", key: "schema_1" }],

      gen_request: false,
      chooseSchema: false,
      error: false,
      errorMsg: ""
    }
  },
  mounted() {
    window.addEventListener('changed-input_mode', (event) => {
      this.input_mode = event.detail.storage.mode
      this.output_mode = event.detail.storage.mode
      this.settings.OUTPUT = event.detail.storage.format
    });
  },
  methods: {
    errUpload() {
      this.errorMsg = "O ficheiro que escolheu não corresponde a uma schema. A extensão do ficheiro deve ser .json!"
      this.error = true
    },
    onChangeInput(input) { this.xsd_input = input },
    updateSettings(new_settings) { Object.assign(this.settings, new_settings) },
    updateOutputFormat(new_format) {
      this.settings.OUTPUT = new_format
      this.output_mode = new_format == "XML" ? "xml" : "javascript"
    },
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

      if (ids.length == new Set(ids).size) {
        if (this.tabs.length == 1) this.generate()
        else this.chooseSchema = true
      }
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
      this.gen_request = true
      let result

      if (this.input_mode == "xml") {
        result = await axios.post('http://localhost:3000/api/xml_schema/', {xsd: this.xsd_input, settings: this.settings})
      }
      else {
        let main_schema, other_schemas = []

        if (this.tabs.length == 1) main_schema = this.tabs[0].input
        else {
          let tabs = aux.removeRepeatedSchemas(_.cloneDeep(this.tabs), this.main_schema.key)
          main_schema = tabs.find(s => s.key == this.main_schema.key).input
          other_schemas = tabs.filter(s => s.key != this.main_schema.key && s.input.length > 0).map(s => s.input)
        }
        
        result = await axios.post('http://localhost:3000/api/json_schema', {schemas: [main_schema, ...other_schemas], settings: this.settings})
      }

      if ("dataset" in result.data) this.output = result.data.dataset
      if ("message" in result.data) this.output = "ERRO!!\n\n" + result.data.message

      this.gen_request = false
    }
  }
}
</script>

<style scoped>
@import '../utils/colors.css';

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
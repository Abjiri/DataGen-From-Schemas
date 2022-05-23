<template>
    <v-container>
      <!-- modals -->
      <Modal
        title="Erro"
        :visible="error"
        @close="error=false"
      >
        {{errorMsg}}
      </Modal>

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
          :items="input_mode=='xml' ? xml_schemas[0].elements : json_schemas"
          item-text="label"
          item-value="key"
          label="Selecionar"
          outlined
          return-object
          single-line
        ></v-select>
      </Modal>

      <Modal
        title="Definições do processo de geração"
        options
        settings
        :valid_settings="valid_settings"
        :visible="settings"
        :more_width="input_mode!='xml'"
        @close="closeSettings"
        @confirm="confirmSettings"
      >
        <SettingsXML v-if="input_mode=='xml'" ref="settingsXML" :settings="xml_settings" :result="result_settings" @updateValid="updateSettingsValidity" @saved="updateSettings"/>
        <SettingsJSON v-else ref="settingsXML" :settings="json_settings" :result="result_settings" @updateValid="updateSettingsValidity" @saved="updateSettings"/>
      </Modal>

      <v-row>
          <v-col xs12 md6>
            <v-btn style="margin-right: 25px;" depressed :color='`var(--${input_mode})`' class="white--text" @click="input_mode=='xml' ? askXmlMainSchema() : askJsonMainSchema()">
              <span>Gerar</span>
              <v-icon right>mdi-reload</v-icon>
            </v-btn>

            <v-btn depressed fab small color="blue-grey lighten-4" @click="openSettings">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
          </v-col>
          <v-col xs12 md6 class="justify-end">
            <ButtonGroup :format="output_format" @changed="updateOutputFormat"/>
          </v-col>
      </v-row>

      <v-row class="fill-height mt-0">
        <!-- consola input -->
        <v-flex xs12 md6>
          <v-container>
            <Tabs
              :key="input_mode"
              :mode="input_mode" 
              :hover="input_mode=='xml' ? xml_main_schema.key : json_main_schema.key" 
              :tabs="input_mode=='xml' ? xml_tabs : json_tabs"
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
import SettingsJSON from '@/components/Settings_JSON'
import SettingsXML from '@/components/Settings_XML'
import ButtonGroup from '@/components/ButtonGroup'
import Codemirror from '@/components/Codemirror'
import Modal from '@/components/Modal'
import Tabs from '@/components/Tabs'
import aux from '@/utils/tabs'

export default {
  components: {
    SettingsJSON,
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
      output_format: "XML",
      output: "",

      // from XML schemas
      xml_tabs: [{ label: "Schema", key: "schema_1", input: "", closable: false }],
      xml_main_schema: {label: "Schema", key: "schema_1"},
      xml_element: {},
      xml_schemas: [{ label: "Schema", key: "schema_1", elements: [] }],
      xml_settings: {
        recursiv: {lower: 0, upper: 3},
        unbounded: 10
      },
      
      // from JSON schemas
      json_tabs: [{ label: "Schema 1", key: "schema_1", input: "", closable: false }],
      json_main_schema: {label: "Schema 1", key: "schema_1"},
      json_schemas: [{ label: "Schema 1", key: "schema_1" }],
      json_settings: {
        recursiv: {lower: 0, upper: 3},
        prob_if: 50,
        prob_patternProperty: 80,
        random_props: false,
        extend_propSchema: "OR",
        extend_prefixItems: "OR",
        extend_schemaObj: "OR"
    },

      // modal de settings
      settings: false,
      valid_settings: true,
      result_settings: 0,

      gen_request: false,
      chooseSchema: false,
      error: false,
      errorMsg: ""
    }
  },
  created() { localStorage.setItem("no_input", 1) },
  mounted() {
    window.addEventListener('changed-input_mode', (event) => {
      this.input_mode = event.detail.storage.mode
      this.output_mode = event.detail.storage.mode
      this.output_format = event.detail.storage.format
    })

    window.addEventListener('reset_schemas', (event) => {
      let format = event.detail.storage.format
      this[format + "_tabs"] = [{ label: "Schema 1", key: "schema_1", input: "", closable: false }]
      this[format + "_main_schema"] = {label: "Schema", key: "schema_1"}
      this[format + "_schemas"] = [{ label: "Schema 1", key: "schema_1" }]

      if (format == "xml") {
        this.xml_schemas[0].elements = []
        this.xml_element = {}
      }
    })
  },
  computed: {
    main_schema: {
      get() { return this.input_mode == 'xml' ? this.xml_element : this.json_main_schema },
      set(value) {
        if (this.input_mode == "xml") this.xml_element = value
        else this.json_main_schema = value
      }
    }
  },
  methods: {
    openSettings() { this.result_settings = 0; this.settings = true },
    closeSettings() { this.result_settings = -1; this.settings = false },
    confirmSettings() { this.result_settings = 1; this.settings = false },
    updateSettingsValidity(input_mode, new_valid) {
      if (input_mode == this.input_mode) this.valid_settings = new_valid
    },
    updateSettings(new_settings) {
      let settings = this.input_mode == "xml" ? this.xml_settings : this.json_settings
      Object.assign(settings, new_settings)
    },
    updateOutputFormat(new_format) {
      this.output_format = new_format
      this.output_mode = new_format == "XML" ? "xml" : "javascript"
    },
    varsByInputType() {
      let tabs = this.input_mode == "xml" ? this.xml_tabs : this.json_tabs
      let schemas = this.input_mode == "xml" ? this.xml_schemas : this.json_schemas
      let main_schema = this.input_mode == "xml" ? this.xml_main_schema : this.json_main_schema
      return {tabs, schemas, main_schema}
    },
    errUpload() {
      this.errorMsg = `O ficheiro que escolheu não corresponde a uma schema ${this.input_mode=="xml"?"XML":"JSON"}. A extensão do ficheiro deve ser ${this.input_mode=="xml"?".xsd":".json"}!`
      this.error = true
    },
    updateMain(key) {
      let schemas = this.input_mode == "xml" ? this.xml_schemas : this.json_schemas
      let main_schema = schemas.find(s => s.key == key)

      if (this.input_mode == "xml") this.xml_main_schema = main_schema
      else this.json_main_schema = main_schema
    },
    updateInput(index, input) {
      let {tabs, schemas, main_schema} = this.varsByInputType()
      let new_label

      if (this.input_mode == "javascript") new_label = aux.searchJsonSchemaId(input, tabs[index].key)
      else new_label = "Schema"

      // dar update ao label da schema para o seu id, se tiver um
      // ou para o label original da schema (Schema nr), se o user tiver apagado o id
      if (new_label != tabs[index].label) {
        tabs[index].label = new_label
        schemas[index].label = new_label
        if (main_schema.key == tabs[index].key) main_schema.label = new_label
      }

      tabs[index].input = input

      // dar update à flag de input existente no localStorage
      let no_input = tabs.every(t => !t.input.length) ? 1 : 0
      let lsVar = localStorage.getItem("no_input")
      if (lsVar != no_input) localStorage.setItem("no_input", no_input)
    },
    updateTabs(new_tabs, index, upload) {
      let tabs = this.input_mode == "xml" ? this.xml_tabs : this.json_tabs
      tabs = new_tabs

      // se tiver 2+ tabs, qualquer uma pode ser fechada; se só tiver 1, não pode
      if (tabs.length == 1) tabs[0].closable = false
      if (tabs.length > 1) tabs[0].closable = true
      
      let schemas = tabs.map(t => { return {label: t.label, key: t.key} })
      if (this.input_mode == "xml") this.xml_schemas = schemas
      else this.json_schemas = schemas

      if (upload) this.updateInput(index, tabs[index].input)
    },
    askJsonMainSchema() {
      let tabs = this.input_mode == "xml" ? this.xml_tabs : this.json_tabs

      if (this.input_mode == "xml") {
        if (tabs.length == 1) this.generate()
        else this.chooseSchema = true
      }
      else {
        let ids = aux.getAllIds(tabs.map(t => t.input))

        if (ids.length == new Set(ids).size) {
          if (tabs.length == 1) this.generate()
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
      }
    },
    async askXmlMainSchema() {
      let {data} = await axios.post('http://localhost:3000/api/xml_schema/elements', {xsd: this.xml_tabs[0].input})

      if ("elements" in data) {
        if (!data.elements.length) this.output = "ERRO!!\n\n" + "A schema não tem nenhum <element> global para gerar um dataset!"
        else {
          if (data.elements.length == 1) {
            this.xml_element = {label: data.elements[0], key: "elem_1"}
            this.generate()
          }
          else {
            data.elements.map((e,i) => {
              let elem = {label: e, key: "elem_"+i}
              this.xml_schemas[0].elements.push(elem)
              if (!("key" in this.xml_element) && !i) this.xml_element = elem
            })
            this.chooseSchema = true
          }
        }
      }
      if ("message" in data) this.output = "ERRO!!\n\n" + data.message
    },
    async generate() {
      this.chooseSchema = false
      this.gen_request = true
      let result
      
      let settings = this.input_mode == "xml" ? this.xml_settings : this.json_settings
      settings.output = this.output_format

      if (this.input_mode == "xml") {
        result = await axios.post('http://localhost:3000/api/xml_schema/', {xsd: this.xml_tabs[0].input, element: this.xml_element.label, settings})
      }
      else {
        let main_schema, other_schemas = []

        if (this.json_tabs.length == 1) main_schema = this.json_tabs[0].input
        else {
          let tabs = aux.removeRepeatedSchemas(_.cloneDeep(this.json_tabs), this.json_main_schema.key)
          main_schema = tabs.find(s => s.key == this.json_main_schema.key).input
          other_schemas = tabs.filter(s => s.key != this.json_main_schema.key && s.input.length > 0).map(s => s.input)
        }
        
        result = await axios.post('http://localhost:3000/api/json_schema', {schemas: [main_schema, ...other_schemas], settings})
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

.v-btn {
  height: 45px !important;
  margin-top: 5px !important;
}

.v-btn--fab {
  height: 45px !important;
  width: 45px !important;
  margin-top: 5px !important;
}

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
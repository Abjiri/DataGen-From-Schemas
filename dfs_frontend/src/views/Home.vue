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
      :visible="choose_schema"
      @close="choose_schema=false"
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

    <Modal
      title="Modelo intermédio gerado na DSL do DataGen"
      more_width
      :model="model"
      :visible="show_model"
      @close="show_model=false"
      @save_model="save_model=true"
    >
      <Codemirror type="output" mode="javascript" :text="model"/>
    </Modal>
    
    <Modal
      title="Guardar Modelo"
      options
      :visible="save_model"
      @close="save_model=false"
      @confirm="saveModel"
    >
      <v-form ref="form" v-model="valid" lazy-validation class="px-3">
        <v-text-field v-model="title" :rules="[required]" label='Título'/>
        <v-textarea v-model="description" :rules="[required]" auto-grow label='Descrição' />
        <v-switch v-model="visibility">
          <template v-slot:label>
            <span v-if="visibility"><v-icon>mdi-lock-open</v-icon> Público</span>
            <span v-else><v-icon>mdi-lock</v-icon> Privado</span>
          </template>
        </v-switch>
      </v-form>
    </Modal>

    <v-row>
      <v-col xs="6" sm="6" md="3">
        <v-btn
          style="margin-right: 25px;"
          depressed
          :color='`var(--${input_mode}-primary)`'
          :disabled="loading"
          class="white--text"
          @click="!loading ? (input_mode=='xml' ? askXmlMainSchema() : askJsonMainSchema()) : true"
        >
          Gerar<v-icon right>mdi-reload</v-icon>
        </v-btn>

        <v-btn
          depressed
          fab 
          small 
          color="blue-grey lighten-4" 
          :disabled="loading"
          @click="openSettings"
        >
          <v-icon>mdi-cog</v-icon>
        </v-btn>
      </v-col>

      <v-col xs="6" sm="6" md="3" align="end">
        <v-btn
          v-if="output.length>0"
          depressed
          :color='`var(--${input_mode}-primary)`'
          :disabled="loading"
          class="white--text"
          @click="show_model=true"
        >
          Modelo intermédio
        </v-btn>
      </v-col>

      <v-col xs="6" sm="6" md="3">
        <div class="d-flex">
          <ButtonGroup :format="output_format" :loading="loading" @changed="updateOutputFormat" style="margin-right: 20px;"/>
          <loading-progress v-if="loading"
            :key="input_mode"
            style="width: 48px; height: 48px;"
            indeterminate="indeterminate"
            size="50"
            rotate
            fillDuration="5"
            rotationDuration="2.5"
            :class="input_mode=='xml' ? 'xml-stroke' : 'json-stroke'"
          />
        </div>
      </v-col>

      <v-col xs="6" sm="6" md="3">
        <div v-if="output.length>0" class="d-flex justify-end">
          <input class="filename-input" v-model="filename"/>
          <v-btn
            depressed 
            :color='`var(--${input_mode}-primary)`' 
            :disabled="loading"
            class="white--text" @click="download"
          >
            Download<v-icon right>mdi-download</v-icon>
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row class="wrap mt-0">
      <!-- consola input -->
      <v-flex xs12 md6>
        <v-container>
          <Tabs
            cm_type="input"
            :key="input_mode"
            :input_mode="input_mode" 
            :output_mode="output_mode"
            :loading="loading"
            :hover="input_mode=='xml' ? xml_main_schema.key : json_main_schema.key" 
            :tabs="input_mode=='xml' ? xml_tabs : json_tabs"
            @updateContent="updateContent" 
            @updateTabs="updateTabs" 
            @hover="updateMain"
            @errorUpload="errUpload"
          />
        </v-container>
      </v-flex>

      <!-- CONSOLA OUTPUT -->
      <v-flex xs12 md6>
        <v-container>
          <GrammarError v-if="grammar_errors.length>0" :errors="grammar_errors"/>
          <Tabs v-else
            cm_type="output"
            :key="output_key"
            :input_mode="input_mode"
            :output_mode="output_mode"
            :loading="loading"
            :hover="dataset_current.key" 
            :tabs="dataset_tabs"
            :generate="last_gen_request"
            :no_datasets="no_datasets"
            @updateContent="updateContent" 
            @updateTabs="updateTabs" 
            @hover="updateMain"
            @removeDataset="removeDataset"
          />
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
import GrammarError from '@/components/GrammarError.vue'
import Modal from '@/components/Modal'
import Tabs from '@/components/Tabs'
import aux from '@/utils/js_aux'

export default {
  components: {
    SettingsJSON,
    SettingsXML,
    ButtonGroup,
    Codemirror,
    Modal,
    Tabs,
    GrammarError
  },
  data() {
    return {
      // input e output
      input_mode: "xml",
      output_mode: "xml",
      output_format: "XML",
      output_key: "",
      output: "",
      filename: "dataset",

      // from XML schemas
      xml_tabs: [{ label: "Schema", key: "schema_1", content: "", closable: false }],
      xml_main_schema: {label: "Schema", key: "schema_1"},
      xml_element: {},
      xml_schemas: [{ label: "Schema", key: "schema_1", elements: [] }],
      xml_settings: {
        recursiv: {lower: 0, upper: 3},
        unbounded: 10
      },
      
      // from JSON schemas
      json_tabs: [{ label: "Schema 1", key: "schema_1", content: "", closable: false }],
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

      dataset_tabs: [{ label: "Dataset 1", key: "dataset_1", content: "" }],
      dataset_current: {label: "Dataset 1", key: "dataset_1"},
      dataset_models: [{label: "Dataset 1", key: "dataset_1", model: ""}],
      no_datasets: true,

      // modal de settings
      settings: false,
      valid_settings: true,
      result_settings: 0,

      // modal do modelo intermédio
      show_model: false,
      save_model: false,
      model: "",
      title: "",
      description: "",
      visibility: false,
      valid: true,
      required: v => !!v || "Valor obrigatório.",

      loading: false,
      send_req: false,

      get token() { return localStorage.getItem("token") },
      last_gen_request: "",
      choose_schema: false,
      error: false,
      grammar_errors: [],
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
      this[format + "_tabs"] = [{ label: "Schema 1", key: "schema_1", content: "", closable: false }]
      this[format + "_main_schema"] = {label: "Schema", key: "schema_1"}
      this[format + "_schemas"] = [{ label: "Schema 1", key: "schema_1" }]

      if (format == "xml") {
        this.xml_schemas[0].elements = []
        this.xml_element = {}
      }

      this.dataset_tabs = [{ label: "Dataset 1", key: "dataset_1", content: "" }]
      this.dataset_current = {label: "Dataset 1", key: "dataset_1"}
      this.dataset_models = [{label: "Dataset 1", key: "dataset_1", model: ""}]
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
  watch: {
    output() { if (!this.output.length) this.filename = "dataset" },
    grammar_errors() { if (this.grammar_errors.length > 0) this.output = "" }
  },
  methods: {
    generateOutputKey() { return this.input_mode + "-" + this.dataset_tabs.length + "-" + this.no_datasets },
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
    errUpload() {
      this.errorMsg = `O ficheiro que escolheu não corresponde a uma schema ${this.input_mode=="xml"?"XML":"JSON"}. A extensão do ficheiro deve ser ${this.input_mode=="xml"?".xsd":".json"}!`
      this.error = true
    },
    updateMain(cm_type, key) {
      let schemas = cm_type == "output" ? this.dataset_tabs : (this.input_mode == "xml" ? this.xml_schemas : this.json_schemas)
      let main_schema = schemas.find(s => s.key == key)

      if (cm_type == "output") this.dataset_current = main_schema
      else if (this.input_mode == "xml") this.xml_main_schema = main_schema
      else this.json_main_schema = main_schema
    },
    updateContent(cm_type, index, content) {
      let tabs = cm_type == "output" ? this.dataset_tabs : (this.input_mode == "xml" ? this.xml_schemas : this.json_schemas)
      tabs[index].content = content

      if (cm_type == "input") {
        let schemas = this.input_mode == "xml" ? this.xml_schemas : this.json_schemas
        let main_schema = this.input_mode == "xml" ? this.xml_main_schema : this.json_main_schema
        let new_label
        
        if (this.input_mode == "javascript") new_label = aux.searchJsonSchemaId(content, tabs[index].key)
        else new_label = "Schema"

        // dar update ao label da schema para o seu id, se tiver um
        // ou para o label original da schema (Schema nr), se o user tiver apagado o id
        if (new_label != tabs[index].label) {
          tabs[index].label = new_label
          schemas[index].label = new_label
          if (main_schema.key == tabs[index].key) main_schema.label = new_label
        }

        // dar update à flag de input existente no localStorage
        let no_input = tabs.every(t => !t.content.length) ? 1 : 0
        let lsVar = localStorage.getItem("no_input")
        if (lsVar != no_input) localStorage.setItem("no_input", no_input)
      }
    },
    updateTabs(cm_type, new_tabs, index, upload) {
      let tabs = cm_type == "output" ? this.dataset_tabs : (this.input_mode == "xml" ? this.xml_tabs : this.json_tabs)
      tabs = new_tabs

      if (cm_type == "input") {
        // se tiver 2+ tabs, qualquer uma pode ser fechada; se só tiver 1, não pode
        if (tabs.length == 1) tabs[0].closable = false
        if (tabs.length > 1) tabs[0].closable = true
        
        let schemas = tabs.map(t => { return {label: t.label, key: t.key} })
        if (this.input_mode == "xml") this.xml_schemas = schemas
        else this.json_schemas = schemas

        if (upload) this.updateContent(cm_type, index, tabs[index].content)
      }
    },
    askJsonMainSchema() {
      let tabs = this.input_mode == "xml" ? this.xml_tabs : this.json_tabs

      if (this.input_mode == "xml") {
        if (tabs.length == 1) this.generate()
        else this.choose_schema = true
      }
      else {
        let ids = aux.getAllIds(tabs.map(t => t.content))

        if (ids.length == new Set(ids).size) {
          if (tabs.length == 1) this.generate()
          else this.choose_schema = true
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
      let {data} = await axios.post('http://localhost:3000/api/xml_schema/elements', {xsd: this.xml_tabs[0].content})
      
      if ("message" in data) this.grammar_errors = [aux.translateMsg(data)]
      else if ("elements" in data) {
        if (!data.elements.length) {
          let lines = this.xml_tabs[0].content.split("\n")

          this.grammar_errors = [{
            message: "A schema não tem nenhum <element> global para gerar um dataset!",
            location: {
              start: {line: 1, column: 1},
              end: {line: lines.length, column: lines[lines.length-1].length}
            }
          }]
        }
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
            this.choose_schema = true
          }
        }
      }
    },
    async generate() {
      this.send_req = true
      this.choose_schema = false
      this.last_gen_request = this.output_format
      let result, filename = ""
      
      let settings = this.input_mode == "xml" ? this.xml_settings : this.json_settings
      settings.output = this.output_format
      setTimeout(() => {
        if (this.send_req) {
          this.loading = true
          window.dispatchEvent(new CustomEvent("loading", {detail: { storage: {loading: true} }}))
        }
      }, 3000)

      if (this.input_mode == "xml") {
        filename = this.xml_element.label
        result = await this.sendGenRequest("xml", {xsd: this.xml_tabs[0].content, element: filename, settings})
      }
      else {
        let main_schema, other_schemas = []

        if (this.json_tabs.length == 1) main_schema = this.json_tabs[0]
        else {
          let tabs = aux.removeRepeatedSchemas(_.cloneDeep(this.json_tabs), this.json_main_schema.key)
          main_schema = tabs.find(s => s.key == this.json_main_schema.key)
          other_schemas = tabs.filter(s => s.key != this.json_main_schema.key && s.content.length > 0)
        }
        
        filename = main_schema.label
        result = await this.sendGenRequest("json", {schemas: [main_schema, ...other_schemas], settings})
      }
      
      if (result !== undefined) {
        if ("message" in result.data) {
          this.grammar_errors = [aux.translateMsg(result.data)]
          if ("schema_key" in result.data) this.updateMain(result.data.schema_key)
        }
        else {
          this.grammar_errors = []
          this.model = result.data.model
          this.output = result.data.dataset
          this.newDataset(result.data)
        }

        this.filename = filename
      }

      this.loading = false
      this.send_req = false
      this.no_datasets = false
      this.output_key = this.generateOutputKey()
      window.dispatchEvent(new CustomEvent("loading", {detail: { storage: {loading: false} }}))
    },
    newDataset(result) {
      let tab = this.dataset_tabs[this.dataset_tabs.length - 1]

      // falta update label
      if (!tab.content.length) {
        tab.content = result.dataset
        this.dataset_current = {label: tab.label, key: tab.key}
        this.dataset_models[this.dataset_tabs.length-1].model = result.model
      }
      else {
        this.dataset_tabs.length
        let next_key = parseInt(tab.key.split("_")[1]) + 1
        let new_tab = {label: "Dataset "+next_key, key: "dataset_"+next_key}

        this.dataset_current = new_tab
        this.dataset_tabs.push({...new_tab, content: result.dataset})
        this.dataset_models.push({...new_tab, model: result.model})
      }
    },
    removeDataset(index) {
      if (!index) {
        this.dataset_tabs[0].content = ""
        this.dataset_models[0].content = ""
        this.no_datasets = true
      }
      else {
        this.dataset_tabs.splice(index, 1)
        this.dataset_models.splice(index, 1)
        this.dataset_current = index - 1
      }

      this.output_key = this.generateOutputKey()
    },
    async sendGenRequest(type, body) {
      try {
        return await axios.post(`http://localhost:3000/api/${type}_schema/`, body, {timeout: 35000})
      } 
      catch (err) {
        this.errorMsg = "A operação de geração do dataset excedeu o tempo limite!"
        this.error = true
      }
    },
    download() {
      if (!this.output.length) {
        this.errorMsg = "É necessário gerar um dataset primeiro!"
        this.error = true
      }
      else {
        let element = document.createElement('a')
        element.style.display = 'none'

        element.setAttribute('href', `data:text/plain;charset=utf-8,` + encodeURIComponent(this.output))
        element.setAttribute('download', this.filename + "." + (this.last_gen_request == "XML" ? "xml" : "json"))

        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
      }
    },
    async saveModel() {
      if (this.token === null) {
        this.errorMsg = "Precisa de iniciar sessão para efetuar esta operação!"
        this.error = true
      }
      else {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        await axios.post('/api/modelos/adicionar', {
          user: JSON.parse(localStorage.getItem('user'))._id,
          modelo: this.model,
          titulo: this.title,
          descricao: this.description,
          visibilidade: this.visibility,
          dataCriacao: new Date()
        })
        
        this.title = ""
        this.description = ""
        this.switch = false
        this.valid = true
        this.save_model = false
        this.$buefy.toast.open("Modelo guardado!")
      }
    }
  }
}
</script>

<style>
@import '../utils/colors.css';

.wrap {
  height: calc( 100% - 64px );
}

.v-btn {
  height: 48px !important;
}

.v-btn--fab {
  height: 48px !important;
  width: 48px !important;
}

.v-btn--fab:focus::before {
  opacity: 0 !important;
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

.filename-input {
  border: 1px solid rgba(60, 60, 60, .29);
  border-radius: 4px;
  padding: 0.2em 0.6em;
  margin-right: 5px;
  margin-left: 20px;
  background: transparent;
  transition: background-color .5s;
}

.xml-stroke * .progress {
  stroke: var(--xml-primary) !important;
}

.json-stroke * .progress {
  stroke: var(--json-primary) !important;
}

.xml-stroke * .background {
  stroke: #ddd !important;
}

.json-stroke * .background {
  stroke: #ddd !important;
}

svg {
  width: 48px;
  height: 48px;
}
</style>
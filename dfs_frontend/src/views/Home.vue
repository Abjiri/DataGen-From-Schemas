<template>
    <v-container>
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
      <v-row>
          <v-col sm="auto">
            <v-btn depressed dark color="indigo" @click="chooseSchema=true">
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
        <Tabs :mode="input_mode" :hover="main_schema.key" :tabs="tabs" @updateInput="updateInput" @updateTabs="updateTabs" @hover="updateMain"/>
        <v-flex xs12 md6>
          <v-container>
            <Codemirror :type="'output'" :mode="output_mode" v-bind:text="output"/>
          </v-container>
        </v-flex>
      </v-row>
    </v-container>
</template>

<script>
import SettingsXML from '@/components/Settings_XML'
import ButtonGroup from '@/components/ButtonGroup'
import Codemirror from '@/components/Codemirror'
import Modal from '@/components/Modal'
import Tabs from '@/components/Tabs'
import axios from 'axios'

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
      chooseSchema: false
    }
  },
  methods: {
    updateMain(key) { this.main_schema = this.schemas.find(s => s.key == key) },
    updateInput(index, input) { this.tabs[index].input = input },
    updateTabs(tabs) {
      this.tabs = tabs
      this.schemas = this.tabs.map(t => { return {label: t.label, key: t.key} })
    },
    updateSettings(new_settings) { Object.assign(this.settings, new_settings) },
    updateOutputFormat(new_format) { this.settings.OUTPUT = new_format },
    async generate() {
      this.chooseSchema = false
      let main_schema = this.tabs.find(s => s.key == this.main_schema.key).input
      let other_schemas = this.tabs.filter(s => s.key != this.main_schema.key).map(s => s.input)
      
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
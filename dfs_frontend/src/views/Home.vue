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
        <div class="parameters">
          <!-- <v-select
            :items="items"
            label="Outlined style"
            outlined
          ></v-select> -->
        </div>
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
        <Tabs :mode="input_mode" :codemirrors="inputs" @updateInput="updateInput" @updateTabs="updateInputs"/>
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
/* import axios from 'axios' */

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
      inputs: [{ input: "", key: "schema_1" }],
      output: "",
      settings: {
        UNBOUNDED: 10,
        RECURSIV: {LOWER: 0, UPPER: 3},
        OUTPUT: "JSON"
      },

      chooseSchema: false
    }
  },
  methods: {
    updateInput(index, input) { this.inputs[index].input = input },
    updateInputs(inputs) { this.inputs = inputs },
    updateSettings(new_settings) { Object.assign(this.settings, new_settings) },
    updateOutputFormat(new_format) { this.settings.OUTPUT = new_format },
    async generate() {
      this.chooseSchema = false
      /* let {data} = await axios.post('http://localhost:3000/api/json_schema', {json: this.input, settings: this.settings})
      //let {data} = await axios.post('http://localhost:3000/api/xml_schema/', {xsd: this.input, settings: this.settings})

      if ("dataset" in data) this.output = data.dataset
      if ("message" in data) this.output = "ERRO!!\n\n" + data.message */
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
</style>
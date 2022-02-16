<template>
    <v-container>
      <v-row>
          <v-col md="auto">
            <v-btn depressed dark color="indigo" @click="generate()">
              <span>Gerar</span>
              <v-icon right>mdi-reload</v-icon>
            </v-btn>
          </v-col>
          <v-col md="auto">
            <Settings/>
          </v-col>
      </v-row>

      <v-row>
        <v-col>
          <v-text-field label="Unbounded"></v-text-field>
        </v-col>
      </v-row>

      <v-row class="fill-height">
        <v-flex xs12 md6>
          <Codemirror :type="'input'" :mode="input_mode" v-bind:text="input" @changed="onChangeInput"/>
        </v-flex>
        <v-flex xs12 md6>
          <Codemirror :type="'output'" :mode="output_mode" v-bind:text="output"/>
        </v-flex>
      </v-row>
    </v-container>
</template>

<script>
import Settings from '@/components/Settings'
import Codemirror from '@/components/Codemirror'
import axios from 'axios'

export default {
  components: {
    Settings,
    Codemirror
  },
  data() {
    return {
      input_mode: "xml",
      output_mode: "xml",
      input: "",
      output: ""
    }
  },
  methods: {
    onChangeInput(input) { this.input = input },
    openSettings() {

    },
    async generate() {
      let UNBOUNDED = 10 //parseInt(document.getElementById('unbounded_value').value)
      let RECURSIV = 3 //parseInt(document.getElementById('recursiv_value').value)
      let OUTPUT_FORMAT = "XML" //document.getElementById('output_format').value

      let settings = {UNBOUNDED, RECURSIV, OUTPUT_FORMAT}
      let {data} = await axios.post('http://localhost:3000/xml_schema/', {xsd: this.input, settings})

      this.output = typeof data == "string" ? data : "ERRO!!\n\n" + data.message
    }
  }
}
</script>
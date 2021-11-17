<template>
  <div id="app">
    
    <div class="row row1">
      <div class="col-md-6 col-md-6-1">
        <div class="row row1">
          <div class="col-md-6 col-md-6-1">
            <div class="input-group" style="margin-left: -5px">
                <div class="input-group-append">
                    <input class="btn btn-primary float-left" type="button" value="Gerar" @click="generate"/>
                </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-md-6-1">
        <div class="input-group">
          <div class="input-group-prepend ">
            <span class="input-group-text" id="basic-addon1">Nome:</span>
          </div>
          <input type="text" class="form-control" id="filename" value="dataset">
          <div class="input-group-append">
            <button id="defaultDownloadButton" class="btn btn-primary" disabled type="button" @click="download">Download</button>
          </div>
        </div>
      </div>
    </div>

    <div class="row row1">
      <div class="col-md-6 col-md-6-1 stretcher">
        <codemirror
          ref="input"
          :value="input"
          :options="cmInput"
          @input="onCmCodeChange"
        />
      </div>
      <div class="col-md-6 col-md-6-1 col-md-offset-2 stretcher">
        <codemirror
          ref="output"
          :value="output"
          :options="cmOutput"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { codemirror } from 'vue-codemirror'
import axios from 'axios'

import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'

// import base style
import 'codemirror/lib/codemirror.css'
import 'codemirror/mode/xml/xml.js'
import 'codemirror/theme/dracula.css'
import 'codemirror/keymap/sublime'

export default {
  data () {
    return {
      input: "",
      output: "",
      cmInput: {
        tabSize: 4,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        foldGutter: true,
        styleSelectedText: true,
        keyMap: "sublime",
        mode: 'text/xml',
        matchBrackets: true,
        showCursorWhenSelecting: true,
        theme: "dracula",
        extraKeys: { "Ctrl": "autocomplete" },
        hintOptions:{ completeSingle: false }
      },
      cmOutput: {
        tabSize: 4,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        foldGutter: true,
        styleSelectedText: true,
        keyMap: "sublime",
        mode: 'text/xml',
        matchBrackets: true,
        showCursorWhenSelecting: true,
        theme: "dracula",
        extraKeys: { "Ctrl": "autocomplete" },
        hintOptions:{ completeSingle: false }
      }
    }
  },
  methods: {
    onCmCodeChange(newCode) { this.input = newCode },
    async generate() {
      let {data} = await axios.post('http://localhost:3000/xml_schema/', this.input, {headers: {'Content-Type': 'text/plain'}})
      
      if (typeof data == "string") this.output = data
      else this.output = "ERRO!!\n\n" + data.message
    },
    async download() {
      if (!this.output.length) alert("É necessário gerar um dataset primeiro!")
      else {
        var element = document.createElement('a');

        element.setAttribute('href', "data:text/xml;charset=utf-8," + encodeURIComponent(this.output));
        element.setAttribute('download', document.getElementById('filename').value + ".xml");
        element.style.display = 'none';

        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
    }
  },
  computed: {
    codemirror() { return this.$refs.input.codemirror },
    codemirror2() { return this.$refs.output.codemirror },
  },
  mounted() {
      this.codemirror.setSize("100%", "100%")
      this.codemirror2.setSize("100%", "100%")
  },
  components: {
    codemirror
  }
}
</script>

<style>
.row1 {margin-left: -8px !important; max-width: 100% !important; margin-bottom: 1px !important;}
.col-md-6-1 {padding-right: 0px !important;}
.stretcher {padding-right: 0px !important; height: 89vh !important;}
.vue-codemirror{height:100%;}
.CodeMirror pre.CodeMirror-line, .CodeMirror pre.CodeMirror-line-like {
  font-size: smaller !important; 
}
.CodeMirror-linenumber{
  font-size: smaller !important;
}
</style>

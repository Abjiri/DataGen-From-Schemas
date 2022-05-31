<template>
  <div class="fill-height">
    <vue-tabs-chrome class="tabs" ref="tab" v-model="tab" :tabs="tabs" :style="`background-color: var(--${mode}-primary);`">
      <span v-if="mode!='xml'" slot="after" class="btn-add" @click="addTab('')">
        <i class="v-icon mdi mdi-plus" style="color: white;"></i>
      </span>
      <span slot="after" class="btn-add">
        <input type="file" ref="file" :accept="mode=='xml' ? '.xsd' : '.json'" @change="uploadSchema" style="display:none">
        <i class="v-icon mdi mdi-upload" style="color: white;" @click="loading ? true : $refs.file.click()"></i>
      </span>
    </vue-tabs-chrome>
    <Codemirror :key="tab" :type="'input'" :mode="mode" :text="input" @changed="onChangeInput"/>
  </div>
</template>

<script>
import VueTabsChrome from "vue-tabs-chrome";
import Codemirror from './Codemirror'

export default {
  components: {
    VueTabsChrome,
    Codemirror
  },
  props: {
    mode: String,
    loading: Boolean,
    hover: String,
    tabs: Array
  },
  data() {
    return {
      input: "",
      tab: "",
      created_tabs: 1,
      newTab_upload: false
    };
  },
  mounted() {
    this.tab = this.hover
    this.created_tabs = this.tabs.length
    this.input = this.tabs.find(t => t.key == this.tab).input
  },
  watch: {
    hover(key) { this.tab = key },
    tabs() {
      this.$emit('updateTabs', this.tabs, this.tabs.findIndex(t => t.key == this.tab), this.newTab_upload)
      this.newTab_upload = false
    },
    tab() {
      this.input = this.tabs.find(t => t.key == this.tab).input
      this.$emit('hover', this.tab)
    }
  },
  methods: {
    onChangeInput(input) {
      let index = this.tabs.findIndex(t => t.key == this.tab)
      this.tabs[index].input = input
      this.$emit('updateInput', index, input)
    },
    addTab(input) {
      if (!this.loading) {
        this.created_tabs++
        let item = "schema_" + this.created_tabs

        this.$refs.tab.addTab({ label: "Schema " + this.created_tabs, key: item, input })
        this.tab = item
      }
    },
    removeTab() { this.$refs.tab.removeTab(this.tab) },
    uploadSchema() {
      let extension = this.mode == "xml" ? /\.xsd$/ : /\.json$/
      let tab = this.tabs.find(t => t.key == this.tab)
      
      let file = this.$refs.file.files[0]
      const reader = new FileReader()

      if (extension.test(file.name)) {
        reader.onload = (res) => {
          let schema = res.currentTarget.result

          if (this.mode == "xml") this.input = schema
          else {
            if (!tab.input.length) this.input = schema
            else {
              this.newTab_upload = true
              // por algum motivo, ao dar upload para uma tab nova, todos os \n da schema passam a \r\n
              this.addTab(schema.replace(/\r\n/g, "\n"))
            }
          }
        }
        reader.readAsText(file)
      }
      else this.$emit('errorUpload')

      this.$refs.file.value = null
    }
  },
};
</script>

<style>
.btn-add {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  padding: 0 10px;
  color: #333;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background 300ms;
}

.btn-add:hover {
  background-color: rgba(0, 0, 0, .1);
}

.vue-tabs-chrome {
  padding-top: 5px;
}

.tabs-item {
  color: white;
}

.tabs-item:hover {
  color: black;
}

.active {
  color: black !important;
}
</style>
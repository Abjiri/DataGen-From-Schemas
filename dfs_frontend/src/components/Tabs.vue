<template>
  <div class="fill-height">
    <div v-if="no_datasets" class="no-tabs" :style="`background-color: var(--${input_mode}-primary);`"/> 

    <vue-tabs-chrome v-else 
      class="tabs" 
      ref="tab" 
      v-model="tab" 
      :tabs="tabs"
      :on-close="closeTab"
      :style="`background-color: var(--${input_mode}-primary);`"
    >
      <span v-if="cm_type=='input' && input_mode!='xml'" slot="after" class="btn-add" @click="loading ? true : addTab('')">
        <i class="v-icon mdi mdi-plus" style="color: white;"></i>
      </span>
      <span v-if="cm_type=='input'" slot="after" class="btn-add">
        <input type="file" ref="file" :accept="input_mode=='xml' ? '.xsd' : '.json'" @change="uploadSchema" style="display:none">
        <i class="v-icon mdi mdi-upload" style="color: white;" @click="loading ? true : $refs.file.click()"></i>
      </span>
    </vue-tabs-chrome>

    <Codemirror
      :key="tab" 
      :type="cm_type" 
      :mode="cm_type=='input' ? input_mode : output_mode" 
      :text="content" 
      @changed="onChangeInput"
    />
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
    cm_type: String,
    input_mode: String,
    output_mode: String,
    loading: Boolean,
    hover: String,
    tabs: Array,
    generate: String,
    no_datasets: Boolean
  },
  data() {
    return {
      content: "",
      tab: "",
      created_tabs: 1,
      newTab_upload: false
    };
  },
  mounted() {
    this.tab = this.hover
    this.created_tabs = this.tabs.length
    this.content = this.tabs.find(t => t.key == this.tab).content
  },
  watch: {
    hover(key) { this.tab = key },
    tabs() {
      if (this.cm_type == "input") {
        this.$emit('updateTabs', this.cm_type, this.tabs, this.tabs.findIndex(t => t.key == this.tab), this.newTab_upload)
        this.newTab_upload = false
      }
    },
    tab() {
      if (this.cm_type == "input" || this.tabs.length > 0) {
        this.content = this.tabs.find(t => t.key == this.tab).content
        this.$emit('hover', this.cm_type, this.tab)
      }
    }
  },
  methods: {
    onChangeInput(content) {
      let index = this.tabs.findIndex(t => t.key == this.tab)
      this.tabs[index].content = content
      this.$emit('updateContent', this.cm_type, index, content)
    },
    addTab(content) {
      if (!this.loading) {
        this.created_tabs++
        let item = "schema_" + this.created_tabs

        this.$refs.tab.addTab({ label: "Schema " + this.created_tabs, key: item, content })
        this.tab = item
      }
    },
    removeTab() { this.$refs.tab.removeTab(this.tab) },
    closeTab() {
      if (this.loading) return false
      if (this.cm_type == "output") {
        this.$emit('removeDataset', this.tabs.length - 1)
        return false
      }
      return true
    },
    uploadSchema() {
      let extension = this.input_mode == "xml" ? /\.xsd$/ : /\.json$/
      let tab = this.tabs.find(t => t.key == this.tab)
      
      let file = this.$refs.file.files[0]
      const reader = new FileReader()

      if (extension.test(file.name)) {
        reader.onload = (res) => {
          let schema = res.currentTarget.result

          if (this.input_mode == "xml") this.content = schema
          else {
            if (!tab.content.length) this.content = schema
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

.no-tabs {
  height: 39px;
  margin-bottom: 4px;
}
</style>
<template>
  <v-flex xs12 md6>
    <v-container>
      <vue-tabs-chrome class="tabs" ref="tab" v-model="tab" :tabs="tabs">
        <span slot="after" class="btn-add" @click="addTab">
          <i class="v-icon mdi mdi-plus"></i>
        </span>
      </vue-tabs-chrome>
      <Codemirror :key="tab" :type="'input'" :mode="mode" :text="input" @changed="onChangeInput"/>
    </v-container>
  </v-flex>
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
    codemirrors: Array
  },
  data() {
    return {
      input: "",
      tab: "schema_1",
      created_tabs: 1,
      tabs: [{ label: "Schema 1", key: "schema_1", closable: false }]
    };
  },
  watch: {
    tab() { this.input = this.codemirrors.find(cm => cm.key == this.tab).input },
    tabs() {
      let index = this.tabs.findIndex((tab,i) => tab.key != this.codemirrors[i].key)
      if (index != -1) this.codemirrors.splice(index, 1)
      this.$emit('updateTabs', this.codemirrors)
    }
  },
  methods: {
    onChangeInput(input) {
      let index = this.codemirrors.findIndex(cm => cm.key == this.tab)
      this.codemirrors[index].input = input
      this.$emit('updateInput', index, input)
    },
    addTab() {
      this.created_tabs++
      let item = "schema_" + this.created_tabs

      // update tabs
      let newTabs = [{ label: "Schema " + this.created_tabs, key: item }]
      this.$refs.tab.addTab(...newTabs)

      // update codemirrors
      let newCM = { input: "", key: item }
      this.codemirrors.push(newCM)

      // update data
      this.tab = item
    },
    removeTab() { this.$refs.tab.removeTab(this.tab) }
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

/* .tabs {
  padding-top: 0px;
  background: #FFFFFF;
}

.tabs-main {
  background: rgba(0, 0, 0, .1);
}

.tabs-divider {
  z-index: 100;
  position: relative;
} */
</style>
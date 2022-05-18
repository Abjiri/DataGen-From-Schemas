<template>
  <v-flex xs12 md6>
    <v-container>
      <vue-tabs-chrome class="tabs" ref="tab" v-model="tab" :tabs="tabs">
        <span slot="after" class="btn-add" @click="addTab">
          <i class="v-icon mdi mdi-plus"></i>
        </span>
      </vue-tabs-chrome>
      <Codemirror :type="'input'" :mode="input_mode" :key="tab" v-bind:text="input" @changed="onChangeInput"/>
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
  data() {
    return {
      input_mode: "javascript",
      tab: "schema_1",
      input: "",
      tabs: [{ label: "Schema 1", key: "schema_1", closable: false }],
      codemirrors: [{ input: "", key: "schema_1" }]
    };
  },
  watch: {
    tab() { this.input = this.codemirrors.find(cm => cm.key == this.tab).input }
  },
  methods: {
    onChangeInput(input) { this.codemirrors.find(cm => cm.key == this.tab).input = input },
    addTab() {
      let item = "schema_" + (this.tabs.length + 1)

      // update tabs
      let newTabs = [{ label: "S" + item.slice(1).replace("_"," "), key: item }]
      this.$refs.tab.addTab(...newTabs)

      // update codemirrors
      let newCM = { input: "", key: item }
      this.codemirrors.push(newCM)

      // update data
      this.tab = item
    },
    removeTab() {
      this.$refs.tab.removeTab(this.tab);
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
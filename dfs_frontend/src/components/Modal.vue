<template>
    <v-dialog :value="visible" 
      @input="$emit('update:visible',false)" 
      @keydown.esc="close"
      @click:outside="close"
      width="500px"
    >

      <v-card style="z-index:2;">
        <v-card-title class="text-h5 grey lighten-2">
          {{$props.title ? $props.title : "Mensagem"}}
        </v-card-title>

        <div class="message">
          <slot></slot>
        </div>

        <v-divider></v-divider>

        <v-card-actions v-if="!$props.options">
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="close()"
          >
            Ok
          </v-btn>
        </v-card-actions>
        <v-card-actions v-else>
          <v-spacer></v-spacer>
          <v-btn
            text
            class="button-cancelar"
            @click="close()"
          >
            Cancelar
          </v-btn>
           <v-btn
            text
            class="button-confirmar"
            @click="confirm()"
          >
            Confirmar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>  

<script>
export default {
    props: {
        visible: Boolean,
        title: String,
        options: Boolean
    },
    methods: {
        close() { this.$emit('close') },
        confirm() { this.$emit('confirm') }
    }
}
</script>

<style scoped>
  .message {
    margin: 20px 5%;
  }
</style>
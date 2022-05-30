<template>
    <nav>
        <Modal
            title="Aviso"
            options
            :visible="warning"
            @close="cancelChange"
            @confirm="resetSchemas"
        >
            {{warningMsg}}
        </Modal>

        <UserAuth
            :format="format" 
            :visible="user_auth" 
            @close="user_auth=false"
            @logged_in="session=true"
        />

        <v-app-bar flat app dark :color="color('primary')">
            <span class="title inline">DataGen From </span>
            <ButtonGroup :key="rollback" class="type-schema" :format="format" @changed="update"/>
            <span class="title"> Schemas</span>
            <v-spacer></v-spacer>

            <div v-if="!session" class="btns">
                <v-btn :color="color('secondary')" @click="user_auth=true">
                    <span>Entrar</span>
                    <v-icon right>mdi-login</v-icon>
                </v-btn>
            </div>
            <div v-else class="btns">
                <v-btn :color="color('secondary')" @click="logout">
                    <span>Logout</span>
                    <v-icon right>mdi-logout</v-icon>
                </v-btn>
            </div>
        </v-app-bar>
    </nav>
</template>

<script>
import ButtonGroup from '@/components/ButtonGroup'
import UserAuth from '@/components/UserAuth'
import Modal from '@/components/Modal'

export default {
    components: {
        ButtonGroup,
        UserAuth,
        Modal
    },
    props: {
        format: String
    },
    data() {
        return {
            session: false,
            user_auth: null,

            get no_input() { return localStorage.getItem("no_input") },
            new_format: "",
            rollback: 0,
            warning: false,
            warningMsg: ""
        }
    },
    methods: {
        color(type) { return `var(--${this.format.toLowerCase()}-${type})` },
        update(format) {
            if (this.no_input == true) { this.emitChange(format) }
            else {
                this.new_format = format
                this.warningMsg = `Se mudar o tipo de schema a processar, perderá a(s) schema(s) ${this.format} que introduziu. Deseja proceder?`
                this.warning = true
            }
        },
        cancelChange() {
            this.rollback++
            this.warning = false
        },
        resetSchemas() {
            this.warning = false
            localStorage.setItem("no_input", 1)
            this.emitChange(this.new_format)
        },
        emitChange(new_format) {
            let old_format = this.format
            this.$emit('changed', new_format)

            window.dispatchEvent(new CustomEvent("reset_schemas", {
                detail: { storage: {format: old_format.toLowerCase()} }
            }))
        }
    }
}
</script>

<style scoped>
.title {
    font-size: 1.25rem;
    font-family: "Roboto", sans-serif;
}

.inline {
    display: inline
}

.v-input {
    font-size: 1.25rem !important;
    max-width: 5.5rem !important;
}

.type-schema {
    display: inline-block;
    margin-right: 10px;
    margin-left: 10px;
}

.vs--single.vs--open .vs__selected { position: inherit; }

.btns {
  display: flex;
  align-items: flex-end;
}
</style>
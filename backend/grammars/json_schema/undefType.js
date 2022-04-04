function structureUndefType(json) {
    if ("undef" in json.type) {
        if ("oneOf" in json.type.undef) {
            separateByTypes_oneOf(json.type.undef.oneOf)
            structureOneOf(json, json.type.undef.oneOf)
            delete json.type.undef.oneOf
        }

        delete json.type.undef
    }
}

function separateByTypes_oneOf(value) {
    for (let i = 0; i < value.length; i++) {
        if ("type" in value[i]) {
            let types = Object.keys(value[i].type)
            if (types.includes("undef")) structureUndefType(value[i])

            if (types.length > 1) {
                let elem = value.splice(i--, 1)[0]

                for (let j = 0; j < types.length; j++) {
                    let new_schema = {type: {}}
                    new_schema.type[types[j]] = elem.type[types[j]]
                    value.push(new_schema)
                }
            }
        }
    }
}

function structureOneOf(schema, arr) {
    // separar os elementos do oneOf por tipos (garantido que cada elemento tem um único tipo, graças à checkCompositionTypes)
    let by_types = arr.reduce((obj,elem) => {
      // se uma schema não tiver tipo, é porque tem apenas um subset das seguintes chaves: $ref ou $defs
      // no converter é preciso reprocessar o que estiver neste tipo "undef" - se tem uma ref, terá novos dados, senão pode-se eliminar
      let el_type = "type" in elem ? Object.keys(elem.type)[0] : "undef"
      if (!(el_type in obj)) obj[el_type] = []

      if (el_type == "undef") obj[el_type].push(elem)
      // não vale a pena guardar uma schema vazia
      else if (Object.keys(elem.type[el_type]).length > 0) obj[el_type].push(elem.type[el_type])
      return obj
    }, {})

    // cada subdivisão é tornada num oneOf novo e colocado no respetivo tipo, na estrutura intermédia
    for (let type in by_types) {
      if (!(type in schema.type)) schema.type[type] = {}

      // se não houver schemas neste tipo (nenhuma schema foi guardada acima porque eram todas vazias - só foi especificado mesmo o tipo em cada uma), não vale a pena fazer mais nada
      // haverá a possibilidade de gerar este tipo na mesma, porque já foi colocado na estrutura intermédia na linha de código acima
      if (by_types[type].length > 0) schema.type[type].oneOf = by_types[type]
    }
}

module.exports = { structureUndefType }
function structureUndefType(json) {
    let schemaComp_keys = Object.keys(json.type.undef).filter(x => ["allOf","anyOf","oneOf","not"].includes(x))

    if (!schemaComp_keys.length && "type" in json.type.undef) json.type = json.type.undef.type
    else {
        for (let i = 0; i < schemaComp_keys.length; i++) {
            let k = schemaComp_keys[i]
            separateByTypes(k, json.type.undef[k])
            structureSchemaCompArr(json, json.type.undef[k], k)
            delete json.type.undef[k]
        }
    
        delete json.type.undef
    }
}

// separar as subschemas do all/any/oneOf por tipos de dados geráveis em subschemas mais pequenas, de forma a garantir que todos os elementos do all/any/oneOf podem gerar 1 único tipo de dados
// uma subschema só fica com um tipo se tiver chaves de algum dos tipos de dados primitivos
function separateByTypes(key, value) {
  if (key != "not") {
    for (let i = 0; i < value.length; i++) {
      if ("type" in value[i]) {
        let types = Object.keys(value[i].type)

        if (types.includes("undef")) {
            structureUndefType(value[i])
            types = Object.keys(value[i].type)
        }

        if (types.length > 1) {
          let elem = value.splice(i--, 1)[0]

          for (let j = 0; j < types.length; j++) {
            // se tiver uma chave dentro de uma chave igual, dar flat à estrutura
            if (key in elem.type[types[j]] && Object.keys(elem.type[types[j]]).length == 1) {
              elem.type[types[j]][key].map(x => {
                let new_schema = {type: {}}
                new_schema.type[types[j]] = x
                value.push(new_schema)
              })
            }
            else {
              let new_schema = {type: {}}
              new_schema.type[types[j]] = elem.type[types[j]]
              value.push(new_schema)
            }
          }
        }
      }
    }
  }
}

// formata uma chave de composição de schemas para a estrutura intermédia pretendida
function structureSchemaCompArr(schema, arr, key) {
  // separar os elementos do all/any/oneOf por tipos (garantido que cada elemento tem um único tipo, graças à checkCompositionTypes)
  let by_types = arr.reduce((obj,elem) => {
    // se uma schema não tiver tipo, é porque tem apenas um subset das seguintes chaves: $ref, $defs ou chaves de composição de schemas
    // no converter é preciso reprocessar o que estiver neste tipo "undef" - se tem uma ref, terá novos dados, senão pode-se eliminar
    let el_type = "type" in elem ? Object.keys(elem.type)[0] : "undef"
    if (!(el_type in obj)) obj[el_type] = []

    if (el_type == "undef") obj[el_type].push(elem)
    // não vale a pena guardar uma schema vazia
    else if (Object.keys(elem.type[el_type]).length > 0) obj[el_type].push(elem.type[el_type])
    return obj
  }, {})

  // cada subdivisão é tornada num all/any/oneOf novo e colocado no respetivo tipo, na estrutura intermédia
  for (let type in by_types) {
    if (!(type in schema.type)) schema.type[type] = {}

    // se não houver schemas neste tipo (nenhuma schema foi guardada acima porque eram todas vazias - só foi especificado mesmo o tipo em cada uma), não vale a pena fazer mais nada
    // haverá a possibilidade de gerar este tipo na mesma, porque já foi colocado na estrutura intermédia na linha de código acima
    if (by_types[type].length > 0) {
        // se a chave já estiver no objeto final, significa que parte da chave não tinha refs e já está resolvida, por isso o objetivo é concatenar estes novos elementos com esses
        if (key in schema.type[type]) {
            for (let i = 0; i < by_types[type].length; i++) {
                // para garantir que também concatenamos chaves de composição de schemas aninhadas, é preciso seguir a mesma lógica para cada chave aninhada
                let schemaComp_keys = Object.keys(by_types[type][i]).filter(x => ["allOf","anyOf","oneOf"].includes(x))

                // se a chave aninhada não existir já dentro da chave-base no objeto final, é um simples push
                if (!schemaComp_keys.length) schema.type[type][key].push(by_types[type][i])

                // caso contrário, é preciso procurar os elementos da chave-base no objeto final e verificar se algum deles tem a chave aninhada, para as juntar
                schemaComp_keys.map(k => {
                    let k_index = schema.type[type][key].findIndex(subschema => k in subschema)

                    if (k_index < 0) schema.type[type][key].push(by_types[type][i])
                    else schema.type[type][key][k_index][k] = schema.type[type][key][k_index][k].concat(by_types[type][i][k])
                })
            }
        }
        else schema.type[type][key] = by_types[type]
    }
  }
}

module.exports = { structureUndefType }
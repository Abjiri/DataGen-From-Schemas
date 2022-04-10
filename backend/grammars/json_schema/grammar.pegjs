// Gramática de JSON Schema para "DataGen from Schemas" -----

{
  let depth = []
  let current_key = ""
  let ids = []
  let subschemas = []
  let anon_schemas = 0
  let refs = []
  let anchors = []
  let propertyNames_refs = []

  let genericKeys = ["type","enum","const","default"]
  let annotationKeys = ["title","description","examples","readOnly","writeOnly","deprecated","$comment"] // a gramática reconhece mas ignora
  let mediaKeys = ["contentMediaType","contentEncoding","contentSchema"] // a gramática reconhece mas ignora
  let schemaKeys = ["allOf","anyOf","oneOf","not","if","then","else"]
  let structuringKeys = ["$schema","$id","$anchor","$ref","$defs"]

  let stringKeys = ["minLength","maxLength","pattern","format"]
  let numericKeys = ["multipleOf","minimum","exclusiveMinimum","maximum","exclusiveMaximum"]
  let objectKeys = ["properties","patternProperties","additionalProperties","unevaluatedProperties","required","propertyNames","minProperties","maxProperties","dependentRequired","dependentSchemas"]
  let arrayKeys = ["items","prefixItems","unevaluatedItems","contains","minContains","maxContains","minItems","maxItems","uniqueItems"]

  // chave só permitida na raiz
  const atRoot = kw => !depth[depth.length-1] ? true : error(`A chave '${kw}' só é permitida ao nível da raiz da (sub)schema!`)
  // todos os ids devem ser únicos
  const newId = id => !ids.includes(id) ? true : error(`Todas as propriedades '$id' devem ser únicas! Há mais do que uma (sub)schema cujo '$id' é '${id}'.`)
  // verificar se objeto tem todas as propriedades em questão
  const hasAll = (k, obj) => typeof k == "string" ? k in obj : k.every(key => key in obj)
  // verificar se objeto alguma das propriedades em questão
  const hasAny = (k, obj) => k.some(key => key in obj)

  // retorna o tipo de um valor explícito (não considera inteiros porque são classificados como numbers na estrutura gerada pela DSL)
  function getValueType(value) {
    if (Array.isArray(value)) return "array"
    else if (value === null) return "null"
    return typeof value
  }

  // fazer todas as verificações necessárias para garantir que a schema está bem escrita
  function checkSchema(s) {
    s = determineType(s)
    return checkKeysByType(s) && checkRangeKeywords(s) && checkDependentRequired(s) && checkDependentSchemas(s) && checkRequiredProps(s) && checkMaxProperties(s) && 
           checkContains(s) && checkArrayLength(s) && checkEnumArray(s) && checkPredefinedValueType(s) && checkIfThenElse(s) && checkContentSchema(s)
  }

  // formatar os dados para a estrutura intermédia pretendida
  function structureSchemaData(obj) {
    if (obj === null) {
      if (current_key == "not") return error("A schema da chave 'not' não pode ser true ou {}, pois a sua negação impede a geração de qualquer valor!")
      else obj = {type: ["string","integer","number","boolean","null","array","object"]}
    }
    else if ("$ref" in obj && Object.keys(obj).length > 1) return error("O DataGen From Schemas não permite que uma schema com uma '$ref' possua qualquer outra chave!")

    let schema = {type: {}}

    for (let k of obj.type) {
      if (k == "integer") {
        if (!("number" in schema.type)) schema.type.number = {}
        schema.type.number.integer = true
      }
      else schema.type[k] = {}
    }

    for (let k in obj) {
      if (k == "type") ;
      else if (k == "$ref") schema[k] = obj[k]
      else if (k == "const" || k == "default") {
        let v_type = getValueType(obj[k][0])
        if (!(v_type in schema.type)) schema.type[v_type] = {}
        schema.type[v_type][k] = obj[k]
      }
      else if (k == "enum") structureEnum(schema, obj[k])
      else if (k == "not") structureNot(schema, obj[k])
      else if (["allOf","anyOf","oneOf"].includes(k)) structureSchemaCompArr(schema, obj[k], k)
      else if (["if","then","else"].includes(k)) {
        for (let key in obj[k].type) {
          if (!(key in schema.type)) schema.type[key] = {}
          schema.type[key][k] = obj[k].type[key]
        }
      }
      else if (numericKeys.includes(k)) schema.type.number[k] = obj[k]
      else if (stringKeys.includes(k)) schema.type.string[k] = obj[k]
      else if (objectKeys.includes(k)) schema.type.object[k] = obj[k]
      else if (arrayKeys.includes(k)) schema.type.array[k] = obj[k]
    }
    
    // se um tipo presente na schema do not não tiver nenhuma chave específica, esse tipo é proibido
    if ("not" in obj) {
      for (let t in obj.not.type) {
        let keys = Object.keys(obj.not.type[t])

        if (!keys.length) delete schema.type[t]
        else if (t == "number" && keys.length == 1 && keys.includes("integer")) {
          if ("number" in schema.type && "integer" in schema.type.number) {
            if (obj.type.includes("number")) delete schema.type[t].integer
            else delete schema.type[t]
          }
        }
      }
    }
    
    let schemaComp_keys = Object.keys(obj).filter(k => ["allOf","anyOf","oneOf"].includes(k))

    // para cumprir uma chave de composição de schemas, é necessário que o tipo gerado seja um dos permitidos pelas suas subschemas
    // logo, elimina-se todos os outros presentes na estrutura intermédia
    schemaComp_keys.map(k => {
      let allowedTypes = obj[k].reduce((a,c) => {
        let type = Object.keys(c.type)[0]
        if (!a.includes(type)) a.push(type)
        return a
      }, [])

      for (let t in schema.type) {
        if (!allowedTypes.includes(t)) delete schema.type[t]
      }
    })
    
    // verificar se é possível cumprir as chaves de composição de schemas presentes
    for (let i = 0; i < schemaComp_keys.length; i++) {
      if (!checkKeyExistence(obj, schema, schemaComp_keys[i], 0)) return error(`Com a schema em questão, é impossível cumprir a chave '${schemaComp_keys[i]}', dado que não é possível gerar nenhum dos tipos de dados das suas subschemas!`)
    }

    // verificar a coerência das chaves numéricas
    if ("type" in schema && "number" in schema.type) {
      let valid = checkNumericKeys(schema.type.number, 0)
      if (valid !== true) return valid
    }

    if (!Object.keys(schema.type).length) {
      // as seguintes chaves são as não tipadas, segunda a estrutura intermédia desta gramática
      // se as chaves da schema forem um subset destas, então inicialmente é possível gerar qualquer tipo de dados (que pode ser restringido pela 'not')
      if (Object.keys(obj).every(k => ["$id","$schema","$anchor","$defs","not"].includes(k) || (k == "type" && !obj[k].length)))
        obj.type = ["string","number","boolean","null","array","object"]

      // a schema é um subset das chaves {$id, $schema, $anchor, $ref, $defs}
      if (Object.keys(obj).every(k => /^$/.test(k))) {
        // se a schema só tiver um subset das chaves {$id, $schema, $anchor, $defs}, pode gerar qualquer tipo de valor
        if (!Object.keys(schema).includes("$ref")) schema.type = {string: {}, number: {}, boolean: {}, null: {}, array: {}, object: {}}
        // se tiver $ref, ainda será resolvida mais tarde
        else delete schema.type
      }

      // se tiver um 'not', é necessário verificar se está a proibir todos os tipos geráveis ou não
      if ("not" in obj) {
        let allowedTypes = obj.type.filter(k => !(k in obj.not.type))
        if (allowedTypes.includes("integer") && "number" in obj.not.type) allowedTypes.splice(allowedTypes.indexOf("integer"), 1)

        if (!allowedTypes.length) return error(`Não é possível gerar nenhum valor a partir da schema em questão!`)
        else allowedTypes.map(k => schema.type[k] = {})
      }
    }

    return schema
  }

  // verificar se uma chave de composição de schema existe na estrutura intermédia, ou se foi completamente elimanada por uma chave 'not'
  function checkKeyExistence(json, schema, key, depth) {
  	let keys = Array.isArray(schema) ? [...Array(schema.length).keys()] : Object.keys(schema)
	
  	for (let i = 0; i < keys.length; i++) {
    	let k = keys[i]
    	if (k == key) return true
      else if (typeof schema[k] === 'object' && schema[k] !== null && checkKeyExistence(json, schema[k], key, depth+1)) return true
	  }

    // se a chave não estiver presente, é possível que seja válida na mesma se possuir uma subschema vazia de um certo tipo e esse tipo for gerável
    if (!depth) {
      let allowedTypes = json[key].reduce((a,c) => {
        let type = Object.keys(c.type)[0]
        if (!Object.keys(c.type[type]).length && !a.includes(type)) a.push(type)
        return a
      }, [])

      if (allowedTypes.some(x => x in schema.type)) return true
    }
	  else return false
  }

  // formatar um enum para a estrutura intermédia pretendida
  function structureEnum(schema, arr) {
    // separar os elementos da enumeração por tipos
    let by_types = arr.reduce((obj,elem) => {
      let v_type = getValueType(elem)
      if (!(v_type in obj)) obj[v_type] = []
      obj[v_type].push(elem)
      return obj
    }, {})

    // cada subdivisão é tornada numa enum nova e colocada no respetivo tipo, na estrutura intermédia
    for (let type in by_types) {
      if (!(type in schema.type)) schema.type[type] = {}
      schema.type[type].enum = by_types[type]
    }
  }

  // de forma a manter a convenção de ter todas as chaves dentro de um tipo, coloca o not original em cada um dos tipos permitidos na sua schema, uma vez que separá-los pode levar a resultados incorretos 
  function structureNot(schema, notSchema) {
    for (let type in notSchema.type) {
      if (!(type in schema.type)) schema.type[type] = {}
      schema.type[type].not = notSchema.type[type]
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
          if (key in schema.type[type]) schema.type[type][key] = schema.type[type][key].concat(by_types[type])
          else schema.type[type][key] = by_types[type]
      }
    }
  }

  // determinar o tipo do valor, se a chave 'type' não for especificada
  function determineType(obj) {
    if (obj === null) return {type: ["string"]}

    if (!hasAll("type", obj)) {
      let type = []

      for (let k in obj) {
        if (stringKeys.includes(k)) type.push("string")
        if (numericKeys.includes(k)) type.push("number")
        if (objectKeys.includes(k)) type.push("object")
        if (arrayKeys.includes(k)) type.push("array")
      }

      obj.type = [...new Set(type)]
    }

    return obj
  }

  // verificar que não se usam chaves específicas a tipos nos tipos errados
  function checkKeysByType(obj) {
    let keywords = genericKeys.concat(annotationKeys, mediaKeys, schemaKeys, structuringKeys)
    
    for (let i = 0; i < obj.type.length; i++) {
      switch (obj.type[i]) {
        case "string": keywords = keywords.concat(stringKeys); break
        case "integer": case "number": keywords = keywords.concat(numericKeys); break
        case "object": keywords = keywords.concat(objectKeys); break
        case "array": keywords = keywords.concat(arrayKeys); break
      }
    }

    for (let k in obj)
      if (!keywords.includes(k)) return error(`O tipo {${obj.type.join(", ")}} não suporta a chave '${k}'!`)
        
    return true
  }

  // verificar a coerência das chaves de alcance de tipos númericos e string
  function checkRangeKeywords(obj) {
    let min = null, max = null, emin = null, emax = null

    if (hasAll("minimum", obj)) min = obj.minimum
    if (hasAll("maximum", obj)) max = obj.maximum
    if (hasAll("exclusiveMinimum", obj)) emin = obj.exclusiveMinimum
    if (hasAll("exclusiveMaximum", obj)) emax = obj.exclusiveMaximum

    if (min !== null && max !== null && min > max) return error(`O valor da chave 'minimum' deve ser <= ao da chave 'maximum'!`)
    if (min !== null && emax !== null && min >= emax) return error(`O valor da chave 'minimum' deve ser < ao da chave 'exclusiveMaximum'!`)
    if (max !== null && emin !== null && max <= emin) return error(`O valor da chave 'maximum' deve ser > ao da chave 'exclusiveMinimum'!`)

    if (min !== null && emin !== null) {
      if (emin >= min) delete obj.minimum
      else delete obj.exclusiveMinimum
    }
    if (max !== null && emax !== null) {
      if (emax <= max) delete obj.maximum
      else delete obj.exclusiveMaximum
    }

    if (hasAll(["maxLength", "minLength"], obj) && obj.minLength > obj.maxLength) return error(`O valor da chave 'minLength' deve ser <= ao da chave 'maxLength'!`)

    return true
  }

  // verificar a coerência do array de propriedades da chave 'required'
  function checkRequiredProps(obj) {
    if (hasAll("required", obj)) {
      if (!obj.required.length) {delete obj.required; return true}

      if (obj.required.length != [...new Set(obj.required)].length) return error("Todos os elementos do array da chave 'required' devem ser únicos!")
      
      let properties = hasAll("properties", obj) ? Object.keys(obj.properties) : []
      let patternProperties = hasAll("patternProperties", obj) ? Object.keys(obj.patternProperties).map(p => new RegExp(p)) : []

      for (let i = 0; i < obj.required.length; i++) {
        if (properties.includes(obj.required[i])) ;
        else if (patternProperties.some(p => p.test(obj.required[i]))) ;
        else if (!hasAny(["additionalProperties", "unevaluatedProperties"], obj)) ;
        else if (hasAll("additionalProperties", obj) && obj.additionalProperties !== false) ;
        else if (!hasAll("additionalProperties", obj) && hasAll("unevaluatedProperties", obj) && obj.unevaluatedProperties !== false) ;
        else return error(`A propriedade '${obj.required[i]}' referida na chave 'required' não é permitida no objeto pela schema!`)
      }
    }
    return true
  }

  // verificar que a schema dada pela chave 'propertyNames' é do tipo string
  function checkPropertyNamesType(obj) {
    if (obj === false || (typeof obj !== "boolean" && hasAll("type", obj) && Object.keys(obj.type).some(k => k != "string")))
      return error(`Como as chaves de objetos devem ser sempre strings, está implícito que a schema dada pela chave 'propertyNames' deve ser do tipo 'string' (apenas)!`)
    return true
  }

  // verificar que as chaves 'required' e de tamanho do objeto não se contradizem
  function checkMaxProperties(obj) {
    if (hasAll(["required", "maxProperties"], obj))
      if (obj.maxProperties < obj.required.length) return error(`A chave 'maxProperties' define que o objeto deve ter, no máximo, ${obj.maxProperties} propriedades, contudo a chave 'required' define que há ${obj.required.length} propriedades obrigatórias!`)

    if (hasAll("minProperties", obj)) {
      if (!hasAll("patternProperties", obj) && (
        (hasAll("additionalProperties", obj) && obj.additionalProperties === false) || 
        (!hasAll("additionalProperties", obj) && hasAll("unevaluatedProperties", obj) && obj.unevaluatedProperties === false))) {
          let properties = hasAll("properties", obj) ? Object.keys(obj.properties).length : 0
          if (properties < obj.minProperties) return error(`A chave 'minProperties' define que o objeto deve ter, no mínimo, ${obj.minProperties} propriedades, contudo a schema permite um máximo de ${properties} propriedades no objeto!`)
      }
    }
    return true
  }

  // verificar a coerência das chaves de contenção 
  function checkContains(obj) {
    if (!hasAll("contains", obj)) {
      if (hasAny(["minContains","maxContains"], obj)) return error("As chaves 'minContains' e 'maxContains' só podem ser usadas em conjunto com a chave 'contains'!")
    }
    else if (hasAll(["minContains","maxContains"], obj) && obj.minContains > obj.maxContains) return error("O valor da chave 'minContains' deve ser <= ao da chave 'maxContains'!")

    if (hasAll(["minContains", "maxItems"], obj) && obj.minContains > obj.maxItems) return error(`O array deve ter pelo menos ${obj.minContains} elementos, segundo a chave 'minContains', mas a chave 'maxItems' define um limite máximo de ${obj.maxItems}!`)

    return true
  }

  // verificar a coerência das chaves de comprimento de arrays
  function checkArrayLength(obj) {
    if (hasAll(["minItems","maxItems"], obj) && obj.minItems > obj.maxItems) return error("O valor da chave 'minItems' deve ser <= ao da chave 'maxItems'!")

    if (("items" in obj && obj.items === false) || (!hasAll("items", obj) && hasAll("unevaluatedItems", obj) && obj.unevaluatedItems === false)) {
      let prefixed = hasAll("prefixItems", obj) ? obj.prefixItems.length : 0
      if (hasAll("minItems", obj) && obj.minItems > prefixed) return error(`A chave 'minItems' define que o array deve ter, no mínimo, ${obj.minItems} elementos, contudo a schema não permite mais de ${prefixed} elementos!`)
      if (hasAll("maxItems", obj) && obj.maxItems > prefixed) obj.maxItems = prefixed
    }

    if (hasAll(["prefixItems","minItems","items"], obj) && obj.items === false && obj.minItems > obj.prefixItems.length)
      return error(`A chave 'minItems' define que o array deve ter, no mínimo, ${obj.minItems} elementos, contudo a chave 'prefixItems' especifica apenas ${obj.prefixItems.length} elementos e a chave 'items' proibe elementos extra para além desses!`)

    return true
  }

  // verificar que os elementos do array da chave 'enum' são todos únicos (não funciona para elementos array/objeto) e do tipo correto
  function checkEnumArray(obj) {
    if (hasAll("enum", obj)) {
      if (!obj.enum.length) return error("O array da chave 'enum' deve ter, no mínimo, um elemento!")
      if (obj.enum.length != [...new Set(obj.enum)].length) return error("Todos os elementos do array da chave 'enum' devem ser únicos!")

      if (hasAll("type", obj) && obj.type.length > 0) {
        for (let i = 0; i < obj.enum.length; i++) {
          let valid = false

          for (let j = 0; j < obj.type.length; j++) {
            if (obj.type[j] == "array" && Array.isArray(obj.enum[i])) {valid = true; break}
            else if (obj.type[j] == "null" && obj.enum[i] === null) {valid = true; break}
            else if (obj.type[j] == "integer" && Number.isInteger(obj.enum[i])) {valid = true; break}
            else if (typeof obj.enum[i] == obj.type[j]) {valid = true; break}
          }

          if (!valid) return error(`Todos os elementos do array da chave 'enum' devem ser do tipo {${obj.type.join(", ")}}, segundo definido pela chave 'type'!`)
        }
      }
    }
    return true
  }

  // verificar se o valor da chave 'const' e/ou 'default' é do tipo correto
  function checkPredefinedValueType(obj) {
    let value = []
    if (hasAll("const", obj)) value.push({k: "const", v: obj.const[0]})
    if (hasAll("default", obj)) value.push({k: "default", v: obj.default[0]})

    if (value.length > 0 && obj.type.length > 0) {
      for (let i = 0; i < value.length; i++) {
        let valid = false

        for (let j = 0; j < obj.type.length; j++) {
          if (obj.type[j] == "array" && Array.isArray(value[i].v)) {valid = true; break}
          else if (obj.type[j] == "null" && value[i].v === null) {valid = true; break}
          else if (obj.type[j] == "integer" && Number.isInteger(value[i].v)) {valid = true; break}
          else if (typeof value[i].v == obj.type[j]) {valid = true; break}
        }

        if (!valid) return error(`O valor da chave '${value[i].k}' deve ser do tipo {${obj.type.join(", ")}}, segundo definido pela chave 'type'!`)
      }
    }
    return true
  }

  // verificar os requisitos necessários para se considerar a chave 'contentSchema'
  function checkContentSchema(obj) {
    if (hasAll("contentSchema", obj) && !(hasAll(["type","contentMediaType"], obj) && obj.type.includes("string")))
      return error("O valor da chave 'contentSchema' só é considerado se a instância for uma string e a chave 'contentMediaType' estiver presente!")
    return true
  }

  // verificar que todas as propriedades referidas na chave 'dependentRequired' são válidas
  function checkDependentRequired(obj) {
    if (hasAll("dependentRequired", obj)) {
      for (let key in obj.dependentRequired) {
        // remover propriedades repetidas
        obj.dependentRequired[key] = [...new Set(obj.dependentRequired[key])]
        let array_value = obj.dependentRequired[key]

        // se tiver a propriedade dependente dela mesma, remover porque é redundante
        if (array_value.includes(key)) obj.dependentRequired[key].splice(obj.dependentRequired[key].indexOf(key), 1)
      }

      if (hasAll("required", obj)) {
        for (let i = 0; i < obj.required.length; i++) {
          let k = obj.required[i]
          if (k in obj.dependentRequired) obj.required = obj.required.concat(obj.dependentRequired[k].filter(x => !obj.required.includes(x)))
        }
      }
    }
    return true
  }

  function checkDependentSchemas(obj) {
    if (hasAll("dependentSchemas", obj)) {
      for (let k in obj.dependentSchemas) {
        if ("type" in obj.dependentSchemas[k]) {
          let type_keys = Object.keys(obj.dependentSchemas[k].type)
          if (type_keys.length > 1 || type_keys[0] != "object") return error(`As subschemas especificadas na chave 'dependentSchemas' deve ser do tipo 'object' (apenas), visto que são aplicadas a uma schema desse mesmo tipo!`)

          if (hasAll("required", obj)) {
            let subschema = obj.dependentSchemas[k].type.object
            if (obj.required.includes(k)) {
              if (hasAll("required", subschema)) obj.required = obj.required.concat(subschema.required.filter(x => !obj.required.includes(x)))
            }
          }
        }
        //else verificar que as subschemas são do tipo object também
      }
    }

    return true
  }

  // verificar as condições if then else
  function checkIfThenElse(obj) {
    if (hasAny(["if","then","else"], obj)) {
      if (!hasAll("if", obj)) return error("Não pode usar as chaves 'then' e/ou 'else' numa schema sem usar a chave 'if'!")
    }
    return true
  }

  // verificar que as chaves de tipo numérico são todas coerentes e gerar o modelo da DSL para gerar um valor correspondente
  function checkNumericKeys(obj, nesting) {
    let {multipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum} = obj
    if (multipleOf === undefined) multipleOf = 1
    else multipleOf = multipleOf[0]

    let frac = multipleOf % 1 != 0
    let max = null, min = null
    let upper = null, lower = null
    let int_multiples = []

    if (maximum !== undefined) max = maximum
    if (exclusiveMaximum !== undefined) max = exclusiveMaximum - (frac ? 0.0000000001 : 1)

    if (minimum !== undefined) min = minimum
    if (exclusiveMinimum !== undefined) min = exclusiveMaximum + (frac ? 0.0000000001 : 1)

    if (max !== null && min !== null) {
      upper = Math.floor(max/multipleOf)
      lower = Math.ceil(min/multipleOf)
      
      if (upper - lower < 0) return error(`Não existem múltiplos do número '${multipleOf}' no intervalo de valores especificado com as chaves de alcance!`)
      else if (frac && "integer" in obj) {
        let decimal_part = parseFloat((multipleOf % 1).toFixed(4))

        for (let i = lower; i <= upper; i++) {
          if ((decimal_part * i) % 1 == 0) int_multiples.push(i)
        }

        if (!int_multiples.length) return error(`Não existem múltiplos inteiros do número '${multipleOf}' no intervalo de valores especificado com as chaves de alcance!`)
      }
    }
    
    return true
  }

  // separar as subschemas do all/any/oneOf por tipos de dados geráveis em subschemas mais pequenas, de forma a garantir que todos os elementos do all/any/oneOf podem gerar 1 único tipo de dados
  // uma subschema só fica com um tipo se tiver chaves de algum dos tipos de dados primitivos
  function checkCompositionTypes(key, value) {
    if (key != "not") {
      // se for a chave 'allOf', determinar os tipos comuns a todas as suas schemas e apagar todas as subschemas que não forem desses tipos
      let allOf_types = key == "allOf" ? checkAllOfTypes(value) : null

      for (let i = 0; i < value.length; i++) {
        if ("type" in value[i]) {
          let types = Object.keys(value[i].type)

          if (types.length > 1) {
            let elem = value.splice(i--, 1)[0]

            for (let j = 0; j < types.length; j++) {
              // se tiver um all/any/oneOf aninhado dentro de uma chave igual, dar flat à estrutura
              if (key in elem.type[types[j]] && Object.keys(elem.type[types[j]]).length == 1) {
                elem.type[types[j]][key].map(x => {
                  if (key != "allOf" || allOf_types.includes(types[j])) {
                    let new_schema = {type: {}}
                    new_schema.type[types[j]] = x
                    value.push(new_schema)
                  }
                })
              }
              else if (key != "allOf" || allOf_types.includes(types[j])) {
                let new_schema = {type: {}}
                new_schema.type[types[j]] = elem.type[types[j]]
                value.push(new_schema)
              }
            }
          }
          else if (key == "allOf" && !allOf_types.includes(types[0])) value.splice(i--, 1)
        }
      }
    }
    return true
  }

  // verificar que todas as schemas da chave 'allOf' têm pelo menos um tipo de dados em comum
  function checkAllOfTypes(value) {
    let types = []
    let types_map = value.map(x => {
      let keys = "type" in x ? Object.keys(x.type) : []
      keys.map(k => { if (!types.includes(k)) types.push(k) })
      return keys
    })

    for (let i = 0; i < types.length; i++) {
      if (!types_map.every(x => !x.length || x.includes(types[i]))) types.splice(i--, 1)
    }

    if (!types.length) return error("As schemas da chave 'allOf' devem ter pelo menos um tipo de dados em comum, caso contrário não é possível gerar um valor que respeite todas elas!")
    return types
  }
}

// ----- Dialect -----

Dialect = ws schema:schema_object ws {return {schema, subschemas, pn_refs: propertyNames_refs}}

begin_array     = ws "[" ws {depth[depth.length-1]++}
begin_object    = ws "{" ws {depth[depth.length-1]++}
end_array       = ws "]" ws {depth[depth.length-1]--}
end_object      = ws "}" ws {depth[depth.length-1]--}
name_separator  = ws ":" ws
value_separator = ws "," ws

ws "whitespace" = [ \t\n\r]*

value = boolean / null / object / array / number / string
boolean = false / true

false = "false" { return false; }
null  = "null"  { return null;  }
true  = "true"  { return true;  }


// ----- Keywords -----

keyword = generic_keyword / string_keyword / number_keyword / object_keyword / array_keyword / 
          media_keyword / schemaComposition_keyword / conditionalSubschemas_keyword / structuring_keyword

// ---------- Keywords generic ----------

generic_keyword = kw_type / kw_enum / kw_const / kw_default / annotation_keyword

kw_type = QM key:"type" QM name_separator value:type_value {return {key, value}}
type_value = t:type {return [t]} / arr:type_array {return arr}
type = QM v:$("string" / "number" / "integer" / "object" / "array" / "boolean" / "null") QM {return v}

kw_enum = QM key:"enum" QM name_separator value:array {return {key, value}}
kw_const = QM key:"const" QM name_separator value:value {return {key, value: [value]}}
kw_default = QM key:"default" QM name_separator value:value {return {key, value: [value]}}

// ---------- Keywords annotation ----------

annotation_keyword = (kws_annotation_stringValues / kw_examples / kws_annotation_booleanValues) {return null}

kws_annotation_stringValues = QM key:$("title"/"description"/"$comment") QM name_separator value:string {return {key, value}}
kw_examples = QM key:"examples" QM name_separator value:array {return {key, value}}
kws_annotation_booleanValues = QM key:$("readOnly"/"writeOnly"/"deprecated") QM name_separator value:boolean {return {key, value}}

// ---------- Keywords string ----------

string_keyword = kws_string_length / kw_pattern / kw_format

kws_string_length = QM key:$("minLength"/"maxLength") QM name_separator value:int {return {key, value}}
kw_pattern = QM key:"pattern" QM name_separator value:pattern_string {return {key, value}}

kw_format = QM key:"format" QM name_separator value:format_value {return {key, value}}
format_value = QM f:("date-time" / "time" / "date" / "duration" / "email" / "idn-email" / "hostname" / "idn-hostname" / "ipv4" / "ipv6"
               / "uuid" / "uri-reference" / "uri-template" / "uri" / "iri-reference" / "iri" / "json-pointer" / "relative-json-pointer" / "regex") QM {return f}

// ---------- Keywords number ----------

number_keyword = kw_multipleOf / kws_range

kw_multipleOf = QM key:"multipleOf" QM name_separator value:positiveNumber {return {key, value: [value]}}
kws_range = QM key:$("minimum"/"exclusiveMinimum"/"maximum"/"exclusiveMaximum") QM name_separator value:number {return {key, value}}

// ---------- Keywords object ----------

object_keyword = kws_props / kw_moreProps / kw_requiredProps / kw_propertyNames / kws_size

kws_props = QM key:$("patternProperties"/"properties") QM name_separator value:object_schemaMap {return {key, value}}
kw_moreProps = QM key:$("additionalProperties"/"unevaluatedProperties") QM name_separator value:schema_object {return {key, value}}
kw_requiredProps = QM key:"required" QM name_separator value:string_array {return {key, value}}
kw_propertyNames = QM key:$("propertyNames" {current_key = "propertyNames"}) QM name_separator value:schema_object &{return checkPropertyNamesType(value)} {current_key = ""; return {key, value: typeof value == "boolean" ? {type: {def: true, string: {}}} : value}}
kws_size = QM key:$("minProperties"/"maxProperties") QM name_separator value:int {return {key, value}}

// ---------- Keywords array ----------

array_keyword = kw_items / kw_prefixItems / kw_unevaluatedItems / kw_contains / kws_mContains / kws_array_length / kw_uniqueness

kw_items = QM key:"items" QM name_separator value:schema_object {return {key, value}}
kw_prefixItems = QM key:"prefixItems" QM name_separator value:schema_array {return {key, value}}
kw_unevaluatedItems = QM key:"unevaluatedItems" QM name_separator value:schema_object {return {key, value}}
kw_contains = QM key:"contains" QM name_separator value:schema_object {return {key, value}}
kws_mContains = QM key:$("minContains"/"maxContains") QM name_separator value:int {return {key, value}}
kws_array_length = QM key:$("minItems"/"maxItems") QM name_separator value:int {return {key, value}}
kw_uniqueness = QM key:"uniqueItems" QM name_separator value:boolean {return {key, value}}

// ---------- Keywords media ----------

media_keyword = (kw_contentMediaType / kw_contentEncoding / kw_contentSchema) {return null}

kw_contentMediaType = QM key:"contentMediaType" QM name_separator value:mime_type {return {key, value}}
mime_type = ""

kw_contentEncoding = QM key:"contentEncoding" QM name_separator value:encoding {return {key, value}}
encoding = QM e:$("7bit" / "8bit" / "binary" / "quoted-printable" / "base16" / "base32" / "base64") QM {return e}

kw_contentSchema = QM key:"contentSchema" QM name_separator value:schema_object {return {key, value}}

// ---------- Keywords schema composition ----------

schemaComposition_keyword = kws_combineSchemas / kw_notSchema

kws_combineSchemas = QM key:$("allOf"/"anyOf"/"oneOf") QM name_separator value:schema_array &{return checkCompositionTypes(key, value)} {return {key, value}}
kw_notSchema = QM key:$("not" {current_key = "not"}) QM name_separator value:schema_object {current_key = ""; return {key, value}}

// ---------- Keywords conditional subschemas ----------

conditionalSubschemas_keyword = kw_dependentRequired / kw_dependentSchemas / kw_ifThenElse

kw_dependentRequired = QM key:"dependentRequired" QM name_separator value:object_arrayOfStringsMap {return {key, value}}
kw_dependentSchemas = QM key:"dependentSchemas" QM name_separator value:object_schemaMap {return {key, value}}
kw_ifThenElse = QM key:$(k:("if"/"then"/"else") {current_key = k}) QM name_separator value:schema_object {current_key = ""; return {key, value}}

// ---------- Keywords structuring ----------

structuring_keyword = kw_schema / kw_id / kw_anchor / kw_ref / kw_defs

kw_schema = QM key:"$schema" QM name_separator value:schema_value &{return atRoot(key)} {return null}//{key, value}}
schema_value = QM v:$("http://json-schema.org/draft-0"[467]"/schema#" / "https://json-schema.org/draft/20"("19-09"/"20-12")"/schema") QM
               &{return v == "https://json-schema.org/draft/2020-12/schema" ? true : error("Esta ferramenta implementa apenas a sintaxe do draft 2020-12!")} {return v}

kw_id = QM key:"$id" QM name_separator value:schema_id &{return atRoot(key) && newId(value)} {ids.push(value); return {key, value}}
kw_anchor = QM key:"$anchor" QM name_separator value:anchor {return {key, value}}
kw_ref = QM key:"$ref" QM name_separator value:schema_ref {return {key, value}}
kw_defs = QM key:"$defs" QM name_separator value:object_schemaMap {return {key, value}}


// ----- Objetos -----

schema_object
  = true { return structureSchemaData(null) } /
    (ws "{" ws {depth.push(0); refs.push([]); anchors.push({})}) members:(
      head:keyword tail:(value_separator m:keyword { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {if (el !== null) result[el.key] = el.value});
        return result;
    })? (ws "}" ws {depth.pop()})
    &{ return checkSchema(members) }
    { 
      let schema = structureSchemaData(members)

      if ("$ref" in schema) refs[refs.length-1].push(schema)
      if ("$anchor" in schema) {
        let anchor_name = schema.$anchor
        delete schema.$anchor
        anchors[anchors.length-1][anchor_name] = schema
      }

      let new_refs = refs.pop()
      let new_anchors = anchors.pop()

      // guardar subschema se tiver um id ou se for a própria schema
      if ("$id" in schema || !refs.length) {
        let id = "$id" in schema ? schema.$id : ("anon" + ++anon_schemas)
        if ("$id" in schema) delete schema.$id
        subschemas.push({id, schema, refs: new_refs, anchors: new_anchors})
      }
      else {
        refs.push(refs.pop().concat(new_refs))
        Object.assign(anchors[anchors.length-1], new_anchors)
      }
      
      return schema
    }

object
  = begin_object members:(
      head:member tail:(value_separator m:member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

member /* "object member" */
  = name:string name_separator value:value {return {name, value}}

object_schemaMap
  = begin_object members:(
      head:schema_member tail:(value_separator m:schema_member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

schema_member /* "object member with a schema value" */
  = name:string name_separator value:schema_object {return {name, value}}

object_arrayOfStringsMap
  = begin_object members:(
      head:arrayOfStrings_member tail:(value_separator m:arrayOfStrings_member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

arrayOfStrings_member /* "object member with a string array value" */
  = name:string name_separator value:string_array {return {name, value}}


// ----- Arrays -----

array "array"
  = begin_array values:(
      head:value tail:(value_separator v:value { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

string_array "array of strings"
  = begin_array values:(
      head:string tail:(value_separator v:string { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

schema_array "array of schemas"
  = begin_array values:(
      head:schema_object tail:(value_separator v:schema_object { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

type_array "array of JSON types"
  = begin_array values:(
      head:type tail:(value_separator v:type { return v; })*
    { return tail.includes(head) ? error("Os elementos do array 'type' devem ser todos únicos!") : [head].concat(tail); }
    )? end_array
    { return values !== null ? values : error("O array de tipos não pode ser vazio!"); }


// ----- Números -----

number "number" = "-"? int frac? { return parseFloat(text()); }
positiveNumber "positive number" = ("0" frac / [1-9] [0-9]* frac?) { return parseFloat(text()); }

exp = [eE] ("-"/"+")? [0-9]+
frac = "." [0-9]+

int "integer" 
  = integer:(("0"* i:([1-9] [0-9]*) {return i}) / (i:"0" "0"* {return i})) {return parseInt(Array.isArray(integer) ? integer.flat().join("") : integer)}


// ----- Strings -----

string "string" = QM str:$char* QM {return str}
pattern_string = QM str:$[^"]* QM {return str}
anchor "anchor" = QM value:anchor_value QM {return value}
schema_id = QM "https://datagen.di.uminho.pt"? id:$("/json-schemas" ("/" [^/"]+)+) QM {return id}
schema_ref "$ref" = QM "https://datagen.di.uminho.pt"? ref:$("#" ref_segment / ("/json-schemas/" [^/"]+ ref_segment)) QM {if (current_key == "propertyNames") propertyNames_refs.push(ref); return ref}

anchor_value = $([a-zA-Z][a-zA-Z0-9\-\_\:\.]*)
ref_segment = "#" anchor_value / ("/" [^/#"]+)*

char
  = unescaped
  / escape
    sequence:(
        '"'
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

escape = "\\"
QM = '"'

unescaped = [^\0-\x1F\x22\x5C]
HEXDIG = [0-9a-f]i

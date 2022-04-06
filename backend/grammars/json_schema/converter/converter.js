const RandExp = require('randexp');
const jsf = require('json-schema-faker');
const { structureUndefType } = require('./undefType')
const { extendSchema } = require('./schema_extender')

let SETTINGS = {
    prob_patternProperty: 0.8,
    random_props: false
}

// tabs de indentação
const indent = depth => "\t".repeat(depth)
// schema que pode gerar qualquer tipo de valor
const trueSchema = {type: {string: {}, number: {}, boolean: {}, null: {}, array: {}, object: {}}}
// obter um número aleatório entre os limites
let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)
// obter um número aleatório entre 0 e len
let rand = len => Math.floor(Math.random()*len)
// clonar um valor
let clone = x => JSON.parse(JSON.stringify(x))

function convert(json) {
    return "<!LANGUAGE pt>\n" + parseJSON(json, 1)
}

function parseJSON(json, depth) {
    // processar refs que tenham sido substítuidas dentro de chaves de composição de schemas
    structureUndefType(json)

    let str = parseType(json, depth)
    if (depth==1 && str[0] != "{") str = "{\n" + indent(depth) + `DFJS_NOT_OBJECT: ${str}\n}`
    return str
}

// processa as chaves de composição de schemas pela ordem que aparecem no objeto
function parseAllSchemaComposition(json, type) {
    let schemaComp_keys = Object.keys(json).filter(x => ["allOf","anyOf","oneOf","not"].includes(x))
    for (let i = 0; i < schemaComp_keys.length; i++) parseSchemaComposition(json, schemaComp_keys[i], type)
}

function parseSchemaComposition(json, key, type) {
    switch (key) {
        case "anyOf":
            // seleciona um nr aleatório de schemas do tipo em questão
            let subschemas = getRandomSubarray(json[key], randomize(json[key].length, 1))
            subschemas.map(s => parseAllSchemaComposition(s, type))
            delete json[key]
            subschemas.map(s => extendSchema(json, s, type))
            break
        case "oneOf":
            let subschema = json[key][rand(json[key].length)]
            parseAllSchemaComposition(subschema, type)
            delete json[key]
            extendSchema(json, subschema, type)
            break
    }
}

function getRandomSubarray(arr, size) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
}

function parseType(json, depth) {
    let predefinedValue = arr => `gen => { return gen.random(...${JSON.stringify(arr)}) }`
    let possibleTypes = Object.keys(json.type)
    //selecionar um dos vários tipos possíveis aleatoriamente, para produzir
    let type = possibleTypes[rand(possibleTypes.length)]
    let value

    // resolver as chaves de composição de schemas aqui, para não ter de repetir este código na função de parsing de cada tipo
    parseAllSchemaComposition(json.type[type], type)
    console.log(json.type[type])

    if ("const" in json.type[type]) return predefinedValue(json.type[type].const)
    if ("enum" in json.type[type]) return predefinedValue(json.enum)
    if ("default" in json.type[type]) {
        let keys = Object.keys(json.type[type])
        if (keys.length == 1 || (type == "number" && keys.length == 2 && keys.includes("integer"))) return predefinedValue(json.type[type].default)
    }

    if (type == "object") value = parseObjectType(clone(json.type.object), false, depth)
    else {
        switch (type) {
            case "null": value = "null"; break
            case "boolean": value = "'{{boolean()}}'"; break
            case "string": value = parseStringType(json.type.string); break
            case "array": value = parseArrayType(json.type.array, depth+1); break
            case "number": value = parseNumericType(json.type.number, depth); break
        }

        if (depth==1) value = `{\n${indent(depth)}DFJS_NOT_OBJECT: ${value}\n}`
    }

    return value
}

// calcular o mínimo múltiplo comum de 2+ números
function lcm_n_numbers(arr) {
    let lcm = arr[0]
    for (let i = 1; i < arr.length; i++) lcm = lcm_two_numbers(lcm, arr[i])
    return lcm
}

// calcular o mínimo múltiplo comum entre 2 números
function lcm_two_numbers(x, y) {
  if ((typeof x !== 'number') || (typeof y !== 'number')) return false
  return (!x || !y) ? 0 : Math.abs((x * y) / gcd_two_numbers(x, y))
}

// calcular o maior divisor comum entre 2 números
function gcd_two_numbers(x, y) {
  x = Math.abs(x)
  y = Math.abs(y)
  while(y) {
    var t = y
    y = x % y
    x = t
  }
  return x;
}

function parseNumericType(json) {
    let {multipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum} = json
    if (multipleOf === undefined) multipleOf = [1]
    else if ("integer" in json) multipleOf.push(1)

    let any_frac = multipleOf.reduce((a,c) => a || (c%1 != 0), false)
    let max = null, min = null
    let upper = null, lower = null
    let int_multiples = []

    if (maximum !== undefined) max = maximum
    if (exclusiveMaximum !== undefined) max = exclusiveMaximum - (any_frac ? 0.0000000001 : 1)

    if (minimum !== undefined) min = minimum
    if (exclusiveMinimum !== undefined) min = exclusiveMaximum + (any_frac ? 0.0000000001 : 1)

    // só acontece se o user fizer constraints inválidos com as chaves de composição de schemas
    if (min > max) max = null

    // mínimo múltiplo comum de todos os multipleOf
    let lcm = multipleOf.length == 1 ? multipleOf[0] : lcm_n_numbers(multipleOf)

    if (max !== null && min !== null) {
      upper = Math.floor(max/lcm)
      lower = Math.ceil(min/lcm)
      
      if (any_frac && "integer" in json) {
        let decimal_part = parseFloat((lcm % 1).toFixed(4))

        for (let i = lower; i <= upper; i++) {
          if ((decimal_part * i) % 1 == 0) int_multiples.push(i)
        }
      }
    }
    else if (max !== null) {
      upper = Math.floor(max/lcm)
      lower = upper - 100
    }
    else if (min !== null) {
      lower = Math.ceil(min/lcm)
      upper = lower + 100
    }

    if (!Object.keys(json).length) return `'{{${"integer" in json ? "integer" : "float"}(-1000,1000)}}'`
    else if (upper === null) return `'{{multipleOf(${lcm})}}'`
    else if (int_multiples.length > 0) return `gen => { return gen.random(...${JSON.stringify(int_multiples)}) * ${lcm} }`
    return `gen => { return gen.integer(${lower},${upper}) * ${lcm} }`
}

function parseStringType(json) {
    if ("pattern" in json) return `'{{pattern("${json.pattern}")}}'`

    if ("format" in json) {
        let minDate = {date: ["01/01/1950", "00:00:00"], neg: false}
        let defaultList = {max: 1, min: 1}
        
        switch (json.format) {
            case "date-time": return `'{{xsd_dateTime("dateTime",null,${JSON.stringify(minDate)},${JSON.stringify(defaultList)})}}'`
            case "date": return `'{{xsd_dateTime("date",null,${JSON.stringify(minDate)},${JSON.stringify(defaultList)})}}'`
            case "time": return `'{{time("hh:mm:ss", 24, false, "00:00:00", "23:59:59")}}'`
            case "duration": return `'{{xsd_duration("P","P1Y",${JSON.stringify(defaultList)})}}'`

            case "email": case "idn-email":
                return `gen => { return gen.stringOfSize(5,20).replace(/[^a-zA-Z]/g, '').toLowerCase() + "@" + gen.random("gmail","yahoo","hotmail","outlook") + ".com" }`

            case "hostname": case "idn-hostname":
                return `gen => { return Array.apply(null, Array(gen.random(...gen.range(1,5)))).map(x => gen.stringOfSize(3,10).replace(/[^a-zA-Z]/g, '').toLowerCase()).join(".") }`

            case "ipv4": return `'{{pattern("^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")}}'`
            case "ipv6": return `'{{pattern("^((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))$")}}'`

            case "uuid": return "'{{guid()}}'"
            case "uri": case "iri": return `'{{pattern("https?:\\/\\/(www\\.)[-a-zA-Z0-9@:%._]{2,32}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`
            case "uri-reference": case "iri-reference": return `'{{pattern("((https?:\\/\\/(www\\.))|\/)[-a-zA-Z0-9@:%._]{2,32}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`
            case "uri-template": return `'{{pattern("https?:\\/\\/(www\\.)([-a-zA-Z0-9@:%._]{2,8}({[a-zA-Z]{3,10}})){1,5}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`

            case "json-pointer": case "relative-json-pointer": return ""

            case "regex": return `'{{regex()}}'`
        }
    }

    let min = "minLength" in json ? json.minLength : 0
    let max = "maxLength" in json ? json.maxLength : min+100

    // só acontece se o user fizer constraints inválidos com as chaves de composição de schemas
    if (min > max) max = min+100
    return `'{{stringOfSize(${min}, ${max})}}'`
}

function parseObjectType(json, only_req, depth) {
    let str = "{\n", obj = {}
    let required = "required" in json ? json.required.length : 0
    let {minProps, maxProps, size} = objectSize(json, required)
    
    let depSchemas = "dependentSchemas" in json ? json.dependentSchemas : {}
    let depSchemas_objects = []

    // gerar as propriedades required
    if (required > 0) addProperties(json, obj, json.required, depSchemas, depSchemas_objects, depth)
    if (only_req && Object.keys(obj).length >= minProps) return obj

    // adicionar uma propriedade nova ao objeto final
    let addProperty = (k,v) => obj[k] = parseJSON(v, depth+1)
    
    // para verificar se é preciso fazer a propriedade recursiva ASAP ou se se pode fazer pela ordem natural
    let recursive_index = ("recursive" in json && json.recursive.key == "properties") ? (Object.keys(json.properties).findIndex(x => x == json.recursive.prop) + 1) : 0

    for (let i = required; i < size; ) {
        if (only_req && Object.keys(obj).length >= minProps) return obj

        if ("recursive" in json && json.recursive.key == "properties" && i + recursive_index > size) {
            if (!(json.recursive.prop in obj)) {
                addProperty(json.recursive.prop, json.properties[json.recursive.prop])
                delete json.properties[json.recursive.prop]
                i++
            }
            delete json.recursive
        }
        else if (depSchemas_objects.length > 0 && Math.random() > 0.5) {
            let schema_index = rand(depSchemas_objects.length)
            let props = Object.keys(depSchemas_objects[schema_index])
            let prop_index = rand(props.length)

            obj[props[prop_index]] = depSchemas_objects[schema_index][props[prop_index]]
            delete depSchemas_objects[schema_index][props[prop_index]]
            if (!Object.keys(depSchemas_objects[schema_index]).length) depSchemas_objects.splice(schema_index, 1)
        }
        else if ("properties" in json && Object.keys(json.properties).length > 0) {
            let k = Object.keys(json.properties)[0]

            if ("dependentRequired" in json && k in json.dependentRequired) {
                let new_required = [k].concat(json.dependentRequired[k].filter(x => !(x in obj)))

                for (let j = 1; j < new_required.length; j++) {
                    if (new_required[j] in json.dependentRequired) new_required = new_required.concat(json.dependentRequired[new_required[j]].filter(x => !(x in obj)))
                }

                let final_len = i + new_required.length
                if (final_len >= minProps && final_len <= maxProps) { addProperties(json, obj, new_required, depSchemas, depSchemas_objects, depth); break }
                else if (final_len < minProps) { addProperties(json, obj, new_required, depSchemas, depSchemas_objects, depth); i += new_required.length }
                else delete json.properties[k]
            }
            else {
                addProperty(k, json.properties[k])
                delete json.properties[k]
                i++

                if (k in depSchemas) {
                    let new_depSchemas_props = [k]

                    for (let j = 0; j < new_depSchemas_props.length; j++) {
                        let p = new_depSchemas_props[j]

                        let schema = parseObjectType(depSchemas[p].type.object, true, depth)
                        let new_required = "required" in depSchemas[p].type.object ? depSchemas[p].type.object.required : []
        
                        new_required.map(x => {
                            obj[x] = schema[x]
                            delete schema[x]
                            if (x in depSchemas) new_depSchemas_props.push(x)
                        })
                        
                        if (Object.keys(schema).length > 0) depSchemas_objects.push(schema)
                        i += new_required.length
                    }
                }
            }
        }
        // produzir, no máximo, 1 propriedade aleatória respeitante da schema da chave atual do patternProperties
        else if ("patternProperties" in json && Object.keys(json.patternProperties).length > 0) {
            let k = Object.keys(json.patternProperties)[0]
            let prop = new RandExp(k).gen()
            if (!(prop in obj) && Math.random() < SETTINGS.prob_patternProperty) { addProperty(prop, json.patternProperties[k]); i++ }
            delete json.patternProperties[k]
        }
        else if (!("additionalProperties" in json || "unevaluatedProperties" in json))
            { if (i < minProps || SETTINGS.random_props || "propertyNames" in json) nonRequired_randomProps(json, obj, size, trueSchema, addProperty); break }
        else if ("additionalProperties" in json && json.additionalProperties !== false)
            { nonRequired_randomProps(json, obj, size, json.additionalProperties, addProperty); break }
        else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) 
            { nonRequired_randomProps(json, obj, size, json.unevaluatedProperties, addProperty); break }
        else break
    }
    
    if (only_req && Object.keys(obj).length >= minProps) return obj

    // converter o objeto final para string da DSL
    Object.keys(obj).map(k => str += `${indent(depth)}${k}: ${obj[k]},\n`)

    if (str == "{\n") str = "{\n" + indent(depth) + "DFJS_EMPTY_JSON: true\n" + indent(depth-1) + "}"
    else str = `${str.slice(0, -2)}\n${indent(depth-1)}}`
    return str
}

// determinar um tamanho aleatório para o objeto a gerar, dentro dos limites estabelecidos
function objectSize(json, required) {
    let additional = ("additionalProperties" in json && json.additionalProperties !== false) || !("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false
    let properties = "properties" in json ? Object.keys(json.properties).length : 0

    let minProps, maxProps
    if (!("minProperties" in json || "maxProperties" in json)) {
        minProps = "required" in json ? required : properties
        maxProps = (properties > required ? properties : required) + (additional ? 3 : 0)

        if (!required && !properties) {
            if ("patternProperties" in json) maxProps = Object.keys(json.patternProperties).length
            else if ("propertyNames" in json) maxProps = 3
            else if (!(!("additionalProperties" in json || "unevaluatedProperties" in json) || additional)) maxProps = 0
            else {json.additionalProperties = trueSchema; maxProps = 3}
        }
        else if (SETTINGS.random_props && minProps == maxProps && minProps > 0 && (!("additionalProperties" in json || "unevaluatedProperties" in json))) maxProps += 3
        else if (!maxProps) maxProps = 3
    }
    else if ("minProperties" in json && !("maxProperties" in json)) {
        minProps = json.minProperties
        maxProps = properties > required ? properties : required
        if (!maxProps || maxProps < minProps) maxProps = minProps+3
        else if (additional) maxProps += 3
    }
    else if (!("minProperties" in json) && "maxProperties" in json) {
        maxProps = json.maxProperties
        minProps = required
    }
    else {
        minProps = json.minProperties
        maxProps = json.maxProperties
    }

    if ("recursive" in json) {
        if ("required" in json && json.recursive.key == "properties" && json.required.includes(json.recursive.prop)) ;
        else if ("maxProperties" in json) {
            if (json.maxProperties > required && minProps <= required) minProps = required + 1
        }
        else if (minProps <= required && (properties > required || (!("additionalProperties" in json || "unevaluatedProperties" in json) || additional))) minProps = required + 1
    }

    return {maxProps, minProps, size: randomize(maxProps, minProps)}
}

// adicionar um conjunto de propriedades ao objeto final
function addProperties(json, obj, props, depSchemas, depSchemas_objects, depth) {
    // adicionar uma propriedade nova
    let addProperty = (k,v) => obj[k] = parseJSON(v, depth+1)
    
    for (let i = 0; i < props.length; i++) {
        let k = props[i]

        if (k in obj) ;
        else if ("properties" in json && k in json.properties) {
            addProperty(k, json.properties[k])
            delete json.properties[k]
            
            if (k in depSchemas) {
                let new_depSchemas_props = [k]

                for (let j = 0; j < new_depSchemas_props.length; j++) {
                    let p = new_depSchemas_props[j]

                    let schema = parseObjectType(depSchemas[p].type.object, true, depth)
                    let new_required = "required" in depSchemas[p].type.object ? depSchemas[p].type.object.required : []
    
                    new_required.map(x => {
                        obj[x] = schema[x]
                        delete schema[x]
                        if (x in depSchemas) new_depSchemas_props.push(x)
                    })
                    
                    if (Object.keys(schema).length > 0) depSchemas_objects.push(schema)
                }
            }
        }
        else if ("patternProperties" in json) {
            for (let j in json.patternProperties) {
                let regex = new RegExp(j)
                if (regex.test(k)) addProperty(k, json.patternProperties[j])
            }
        }
        else if ("additionalProperties" in json && json.additionalProperties !== false) addProperty(k, json.additionalProperties)
        else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) addProperty(k, json.unevaluatedProperties)
        else addProperty(k, trueSchema)
    }
}

// adicionar propriedades aleatórias ao objeto até ter o tamanho pretendido
function nonRequired_randomProps(json, obj, size, valueSchema, addProperty) {
    let randomNameTries = 0
    let namesSchema = "propertyNames" in json ? json.propertyNames.type.string : {"minLength": 3, "maxLength": 10}
    namesSchema.type = "string"
    
    while (size > Object.keys(obj).length && randomNameTries < 10) {
        let key = jsf.generate(namesSchema)
        if (!("pattern" in namesSchema) && key.includes(" ")) key = key.replace(/ /g,'')

        if (!key.length || key.includes(" ") || key in obj) randomNameTries++
        else addProperty(key, clone(valueSchema))
    }
}

function parseArrayType(json, depth) {
    let arr = []
    let prefixed = "prefixItems" in json ? json.prefixItems.length : 0
    let additionalItems = ("items" in json && json.items !== false) || !("items" in json) && "unevaluatedItems" in json && json.unevaluatedItems !== false
    let arrLen = arrayLen(json, prefixed, additionalItems)
    
    // gerar os elementos prefixados do array
    let prefixedLen = prefixed > arrLen.len ? arrLen.len : prefixed
    for (let i = 0; i < prefixedLen; i++) arr.push(parseJSON(json.prefixItems[i], depth))

    // só gerar elementos do contains se forem permitidos itens extra
    if ("contains" in json && (!("items" in json || "unevaluatedItems" in json) || additionalItems)) {
        if (!("maxItems" in json) || prefixed < arrLen.maxItems) {
            if (prefixedLen < prefixed) {
                for (let i = prefixedLen; i < prefixed; i++) arr.push(parseJSON(json.prefixItems[i], depth))
            }

            let containsSchema = json.contains
            let minContains = "minContains" in json ? json.minContains : 1
            let maxContains = "maxContains" in json ? json.maxContains : minContains
        
            let containsLen = randomize(maxContains, minContains)
            let sumLen = arr.length + containsLen
            let final_len = !("maxItems" in json) ? sumLen : (sumLen <= arrLen.maxItems ? sumLen : arrLen.maxItems)

            for (let i = arr.length; i < final_len; i++) arr.push(parseJSON(containsSchema, depth))
        }
    }

    // gerar os restantes elementos, se forem permitidos
    let nonPrefixedSchema = trueSchema
    if ("items" in json && json.items !== false) nonPrefixedSchema = json.items
    else if (additionalItems) nonPrefixedSchema = json.unevaluatedItems

    for (let i = arr.length; i < arrLen.len; i++) arr.push(parseJSON(nonPrefixedSchema, depth))

    // converter o array final para string da DSL
    if (!("uniqueItems" in json && !arr.some(x => /^({\n|\[|gen => {\n\t*\/\/uniqueItems)/.test(x)))) {
        let str = "[\n"
        arr.map(x => str += `${indent(depth)}${x},\n`)
        return str == "[\n" ? "[]" : `${str.slice(0, -2)}\n${indent(depth-1)}]`
    }
    else {
        let convertItem = x => {
            if (x == "null") return x
            if (/^'{{/.test(x)) return "gen." + x.slice(3,-3)
            if (/^gen => { return/.test(x)) return x.split("return ")[1].slice(0,-2)
        }

        return `gen => {
${indent(depth)}//uniqueItems
${indent(depth)}let arr = []
${indent(depth)}for (let i = 0; i < ${arr.length}; i++) {
${indent(depth+1)}for (let j = 0; j < 10; j++) {
${indent(depth+2)}let newItem${arr.map((x,i) => `\n${indent(depth+2)}if (i==${i}) newItem = ${convertItem(x)}`).join("")}
${indent(depth+2)}if (!arr.includes(newItem) || j==9) {arr.push(newItem); break}
${indent(depth+1)}}\n${indent(depth)}}
${indent(depth)}return arr
${indent(depth-1)}}`
    }
}

// determinar um tamanho aleatório para o array a gerar, dentro dos limites estabelecidos
function arrayLen(json, prefixed, additionalItems) {
    let minItems, maxItems
    
    if (!("minItems" in json || "maxItems" in json)) {
        minItems = prefixed
        maxItems = minItems + (additionalItems ? 3 : 0)
        if (!prefixed && !("items" in json || "unevaluatedItems" in json)) maxItems = 3
    }
    else if ("minItems" in json && !("maxItems" in json)) {
        minItems = json.minItems
        maxItems = prefixed
        if (!prefixed || minItems > prefixed) maxItems = minItems+3
        else if (additionalItems) maxItems = prefixed+3
    }
    else if (!("minItems" in json) && "maxItems" in json) {
        maxItems = json.maxItems
        minItems = maxItems > prefixed ? prefixed : ("contains" in json ? maxItems : 0)
    }
    else {
        minItems = json.minItems
        maxItems = json.maxItems
    }

    if ("recursive" in json) {
        if ("maxItems" in json) {
            if (json.maxItems > 0 && minItems < json.recursive && maxItems >= json.recursive) minItems = json.recursive
        }
        else if (minItems < json.recursive && (prefixed >= json.recursive || additionalItems)) minItems = json.recursive
    }
    
    return {minItems, maxItems, len: randomize(maxItems, minItems)}
}

module.exports = { convert }
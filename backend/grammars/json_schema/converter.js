const RandExp = require('randexp');
const jsf = require('json-schema-faker');
const Validator = require('jsonschema').Validator;
const validator = new Validator();

// tabs de indentação
const indent = depth => "\t".repeat(depth)
// poder gerar um boleano, inteiro, float ou string
const randomValue = `'{{random(boolean(), integer(-9999,9999), float(-9999,9999), lorem("sentences", 1))}}'`
// obter um número aleatório entre os limites
let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)
// clonar um valor
let copy = x => JSON.parse(JSON.stringify(x))

function convert(json) {
    return "<!LANGUAGE pt>\n" + parseJSON(json, 1)
}

function parseJSON(json, depth) {
    let str = ""

    if (json === true) {
        if (depth==1) str = "{\n" + indent(depth) + `DFJS_NOT_OBJECT: ${randomValue}\n}`
        else str = randomValue
    }
    else {
        str = parseKeywords(json, depth)
        if (depth==1 && str[0] != "{") str = "{\n" + indent(depth) + `DFJS_NOT_OBJECT: ${str}\n}`
    }

    return str
}

function parseKeywords(json, depth) {
    if ("const" in json) {
        if (typeof json.const == "object" && json.const !== null) return `gen => { return JSON.parse(${JSON.stringify(json.const)}) }`
        return JSON.stringify(json.const)
    }
    if ("enum" in json) return `gen => { return gen.random(...${JSON.stringify(json.enum)}) }`
    if ("type" in json) return parseType(json, depth)
    if (["allOf","anyOf","oneOf"].some(x => x in json)) return parseSchemaComposition(json, depth)
}

function parseSchemaComposition(json, depth) {
    return parseJSON(json.anyOf[Math.floor(Math.random()*json.anyOf.length)], depth)
}

function parseType(json, depth) {
    let possibleTypes = Object.keys(json.type)
    //selecionar um dos vários tipos possíveis aleatoriamente, para produzir
    let type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)]
    let value

    if (type == "object") value = parseObjectType(copy(json.type.object), depth)
    else {
        switch (type) {
            case "null": value = "null"; break
            case "boolean": value = "'{{boolean()}}'"; break
            case "string": value = parseStringType(json.type.string); break
            case "array": value = parseArrayType(json.type.array, depth+1); break
            case "number": 
                value = json.type[type].dsl

                for (let i = -1; ; i++) {
                    let regex = new RegExp(`{depth${i}}`, "g")
                    if (regex.test(value)) value = value.replace(regex, indent(depth+i+1))
                    else break
                }
                break
        }

        if (depth==1) value = `{\n${indent(depth)}DFJS_NOT_OBJECT: ${value}\n}`
        else {} 
    }

    return value
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
    return `'{{stringOfSize(${min}, ${max})}}'`
}

function parseObjectType(json, depth) {
    let str = "{\n", obj = {}
    let required = "required" in json ? json.required.length : 0
    let {minProps, maxProps, size} = objectSize(json, required)
    
    // gerar as propriedades required
    if (required > 0) addProperties(json, obj, json.required, depth)

    // adicionar uma propriedade nova ao objeto final
    let addProperty = (k,v) => obj[k] = parseJSON(v, depth+1)
    
    for (let i = required; i < size; ) {
        if ("properties" in json && Object.keys(json.properties).length > 0) {
            let k = Object.keys(json.properties)[0]

            if ("dependentRequired" in json && k in json.dependentRequired) {
                let new_required = [k].concat(json.dependentRequired[k].filter(x => !(x in obj)))

                for (let j = 1; j < new_required.length; j++) {
                    if (new_required[j] in json.dependentRequired) new_required = new_required.concat(json.dependentRequired[new_required[j]].filter(x => !(x in obj)))
                }

                let final_len = i + new_required.length
                if (final_len >= minProps && final_len <= maxProps) { addProperties(json, obj, new_required, depth); break }
                else if (final_len < minProps) {addProperties(json, obj, new_required, depth); i += new_required.length}
                else delete json.properties[k]
            }
            else {
                addProperty(k, json.properties[k])
                delete json.properties[k]
                i++
            }
        }
        // produzir, no máximo, 1 propriedade aleatória respeitante da schema da chave atual do patternProperties
        else if ("patternProperties" in json && Object.keys(json.patternProperties).length > 0) {
            let k = Object.keys(json.patternProperties)[0]
            let prop = new RandExp(k).gen()
            if (!(prop in obj) && Math.random() < 0.5) addProperty(prop, json.patternProperties[k])
            delete json.patternProperties[k]
        }
        else if (!("additionalProperties" in json || "unevaluatedProperties" in json))
            { nonRequired_randomProps(json, obj, size, true, addProperty); break }
        else if ("additionalProperties" in json && json.additionalProperties !== false)
            { nonRequired_randomProps(json, obj, size, json.additionalProperties, addProperty); break }
        else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) 
            { nonRequired_randomProps(json, obj, size, json.unevaluatedProperties, addProperty); break }
    }

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
        minProps = "required" in json ? required : ("properties" in json ? properties : 0)
        maxProps = minProps + (additional ? 3 : 0)
        if (!required && !properties && !("patternProperties" in json || "additionalProperties" in json || "unevaluatedProperties" in json)) maxProps = 3
        if (minProps == maxProps && required > 0 && (!("additionalProperties" in json || "unevaluatedProperties" in json) || additional)) maxProps += 3
        if (!maxProps) maxProps = 3
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

    return {maxProps, minProps, size: randomize(maxProps, minProps)}
}

// adicionar um conjunto de propriedades ao objeto final
function addProperties(json, obj, props, depth) {
    // adicionar uma propriedade nova
    let addProperty = (k,v) => obj[k] = parseJSON(v, depth+1)
    
    for (let i = 0; i < props.length; i++) {
        let k = props[i]

        if ("properties" in json && k in json.properties) { addProperty(k, json.properties[k]); delete json.properties[k] }
        else if ("patternProperties" in json) {
            for (let j in json.patternProperties) {
                let regex = new RegExp(j)
                if (regex.test(k)) addProperty(k, json.patternProperties[j])
            }
        }
        else if ("additionalProperties" in json && json.additionalProperties !== false) addProperty(k, json.additionalProperties)
        else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) addProperty(k, json.unevaluatedProperties)
        else obj[k] = randomValue
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
        else addProperty(key, valueSchema)
    }
}

function parseArrayType(json, depth) {
    let arr = []
    let prefixed = "prefixItems" in json ? json.prefixItems.length : 0
    let additionalItems = ("items" in json && json.items !== false) || !("items" in json) && "unevaluatedItems" in json && json.unevaluatedItems !== false
    let len = arrayLen(json, prefixed, additionalItems)

    /* let containsSchema = "contains" in json ? json.contains : true
    let contained = false

    let minContains = "minContains" in json ? json.minContains : 1
    let maxContains = "maxContains" in json ? json.maxContains : minContains */
    
    // gerar os elementos prefixados do array
    let prefixedLen = prefixed > len ? len : prefixed
    for (let i = 0; i < prefixedLen; i++) arr.push(parseJSON(json.prefixItems[i], depth))

    // gerar os restantes elementos, se forem permitidos
    let nonPrefixedSchema = true
    if ("items" in json && json.items !== false) nonPrefixedSchema = json.items
    else if (additionalItems) nonPrefixedSchema = json.unevaluatedItems

    for (let i = prefixedLen; i < len; i++) arr.push(parseJSON(nonPrefixedSchema, depth))

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
        minItems = maxItems > prefixed ? prefixed : 0
    }
    else {
        minItems = json.minItems
        maxItems = json.maxItems
    }

    if ("recursive" in json) {
        if ("maxItems" in json) {
            if (json.maxItems > 0 && !minItems) minItems = 1
        }
        else if (!minItems && (prefixed > 0 || additionalItems)) minItems = 1
    }
    
    return randomize(maxItems, minItems)
}

module.exports = { convert }
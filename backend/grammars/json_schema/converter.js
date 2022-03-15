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

function convert(json) {
    return "<!LANGUAGE pt>\n" + parseJSON(json, 1)
}

function parseJSON(json, depth) {
    let str = ""

    if (json === true) {
        if (depth==1) str = "{\n" + indent(depth) + `DFJS_NOT_OBJECT: ${randomValue}\n}`
        else str = randomValue
    }
    else str = parseGenericKeyword(json, depth)

    return str
}

function parseGenericKeyword(json, depth) {
    if ("const" in json) return `gen => { return JSON.parse(${JSON.stringify(json.const)}) }`
    if ("enum" in json) return `gen => { return gen.random(...${JSON.stringify(json.enum)}) }`
    if ("type" in json) return parseType(json, depth)
}

function parseType(json, depth) {
    let possibleTypes = Object.keys(json.type)
    possibleTypes.splice(possibleTypes.indexOf("def"), 1)

    //selecionar um dos vários tipos possíveis aleatoriamente, para produzir
    let type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)]
    let value

    if (type == "object") value = parseObjectType(json.type.object, depth)
    else {
        switch (type) {
            case "null": value = "null"; break
            case "boolean": value = "'{{boolean()}}'"; break
            case "number": case "integer": value = json.type[type].dsl; break
            case "string": value = parseStringType(json.type.string); break
            case "array": value = parseArrayType(json.type.array, depth+1); break
        }

        if (depth==1) value = `{\n${indent(depth)}DFJS_NOT_OBJECT: ${value}\n}`
        else {} 
    }

    return value
}

function parseStringType(json) {
    if ("pattern" in json) return "'" + new RandExp(json.pattern).gen() + "'"

    if ("format" in json) {
        let minDate = {date: ["01/01/1950", "00:00:00"], neg: false}
        let defaultList = {max: 1, min: 1}
        
        switch (json.format) {
            case "date-time": return `{DFS_UTILS__dateTime: 'dateTime;null;${JSON.stringify(minDate)};${JSON.stringify(defaultList)}'}`
            case "date": return `{DFS_UTILS__dateTime: 'date;null;${JSON.stringify(minDate)};${JSON.stringify(defaultList)}'}`
            case "time": return `'{{time("hh:mm:ss", 24, false, "00:00:00", "23:59:59")}}'`
            case "duration": return `{DFS_UTILS__duration: '${JSON.stringify([1,0,0,0,0,0,0])};${JSON.stringify([0,0,0,0,0,0,0])};${JSON.stringify(defaultList)}'}`

            case "email": case "idn-email":
                return `gen => { return gen.stringOfSize(5,20).replace(/[^a-zA-Z]/g, '').toLowerCase() + "@" + gen.random("gmail","yahoo","hotmail","outlook") + ".com" }`

            case "hostname": case "idn-hostname":
                return `gen => {
                    let subdomains = gen.random(...gen.range(1,5)), hostname = ""
                    for (let i = 0; i < subdomains; i++) hostname += gen.stringOfSize(3,10).replace(/[^a-zA-Z]/g, '').toLowerCase() + "."
                    return hostname.slice(0,-1)
                }`

            case "ipv4": return `'{{pattern("^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")}}'`
            case "ipv6": return `'{{pattern("^((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))$")}}'`

            case "uuid": return "'{{guid()}}'"
            case "uri": case "iri": return `'{{pattern("https?:\\/\\/(www\\.)[-a-zA-Z0-9@:%._]{2,32}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`
            case "uri-reference": case "iri-reference": return `'{{pattern("((https?:\\/\\/(www\\.))|\/)[-a-zA-Z0-9@:%._]{2,32}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`
            case "uri-template": return `'{{pattern("https?:\\/\\/(www\\.)([-a-zA-Z0-9@:%._]{2,8}({[a-zA-Z]{3,10}})){1,5}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_]{2,32})")}}'`

            case "json-pointer": case "relative-json-pointer": return ""

            case "regex": return `{DFS_UTILS__regex: ''}`
        }
    }

    let min = "minLength" in json ? json.minLength : 0
    let max = "maxLength" in json ? json.maxLength : min+100
    return `'{{stringOfSize(${min}, ${max})}}'`
}

function parseObjectType(json, depth) {
    let str = "{\n", finalObj = {}
    let newPatternProps = []
    let required = "required" in json ? JSON.parse(JSON.stringify(json.required)) : []

    // adicionar uma propriedade nova ao objeto final
    let addProperty = (k,v) => finalObj[k] = parseJSON(v, depth+1)

    if ("properties" in json) {
        for (let k in json.properties) {
            let req
            if ((req = required.includes(k)) || Math.random() <= 0.85) addProperty(k, json.properties[k])
            if (req) required.splice(required.indexOf(k), 1)
        }
    }
    if ("patternProperties" in json) {
        for (let k in json.patternProperties) {
            let regex = new RegExp(k)

            for (let i = 0; i < required.length; i++) {
                if (regex.test(required[i])) {
                    addProperty(required[i], json.patternProperties[k])
                    required.splice(i--, 1)
                }
            }

            // produzir, no máximo, 1 propriedade aleatória respeitante da schema da chave atual do patternProperties
            if (Math.random() > 0.5) {
                let prop = new RandExp(k).gen()
                if (!Object.keys(finalObj).includes(prop)) {
                    addProperty(prop, json.patternProperties[k])
                    newPatternProps.push(k)
                }
            }
        }
    }
    if ("additionalProperties" in json && json.additionalProperties !== false) {
        required.map(p => addProperty(p, json.additionalProperties))
        required = []
    }
    else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) {
        required.map(p => addProperty(p, json.unevaluatedProperties))
        required = []
    }
    required.map(p => finalObj[p] = randomValue)
    required = []

    // processar as chaves de tamanho do objeto
    parseObjectSize(json, finalObj, newPatternProps, depth)

    // converter o objeto final para string da DSL
    Object.keys(finalObj).map(k => str += `${indent(depth)}${k}: ${finalObj[k]},\n`)

    if (str == "{\n") str = depth > 1 ? "{}" : "{\n\tDFJS_EMPTY_JSON: true\n}"
    else str = `${str.slice(0, -2)}\n${indent(depth-1)}}`
    return str
}

function parseObjectSize(json, finalObj, newPatternProps, depth) {
    let numKeys = () => Object.keys(finalObj).length
    let minProps = "minProperties" in json ? json.minProperties : 0
    let maxProps = "maxProperties" in json ? json.maxProperties : minProps+3

    let namesSchema = "propertyNames" in json ? json.propertyNames.type.string : {}
    namesSchema.type = "string"

    // adicionar uma propriedade nova ao objeto final
    let addProperty = (k,v) => finalObj[k] = parseJSON(v, depth+1)

    // se tiver menos que minProperties, adicionar mais propriedades
    if (minProps > numKeys()) {
        let finalLen = randomize(maxProps, minProps)

        if ("properties" in json) {
            let unrequiredProps = Object.keys(json.properties).filter(k => !json.required.includes(k) && !(k in finalObj))
            
            for (let i = 0; i < unrequiredProps.length; i++) {
                addProperty(unrequiredProps[i], json.properties[unrequiredProps[i]])
            }
        }
        if ("patternProperties" in json) {
            let patternProps = Object.keys(json.patternProperties).filter(k => !newPatternProps.includes(k))
            
            for (let i = 0; i < patternProps.length; i++) {
                let prop = new RandExp(new RegExp(patternProps[i])).gen()
                if (!Object.keys(finalObj).includes(prop)) addProperty(prop, json.patternProperties[patternProps[i]])
            }
        }
        if (!("additionalProperties" in json) && !("unevaluatedProperties" in json))
            generateRandomProperties(finalLen, finalObj, namesSchema, true, numKeys, addProperty)
        if ("additionalProperties" in json && json.additionalProperties !== false)
            generateRandomProperties(finalLen, finalObj, namesSchema, json.additionalProperties, numKeys, addProperty)
        else if (!("additionalProperties" in json) && "unevaluatedProperties" in json && json.unevaluatedProperties !== false) 
            generateRandomProperties(finalLen, finalObj, namesSchema, json.unevaluatedProperties, numKeys, addProperty)
    }

    // se tiver mais que maxProperties, apagar opcionais aleatoriamente até satisfazer esse nr de propriedades
    if ("maxProperties" in json) {
        let unrequiredKeys = Object.keys(finalObj).filter(k => !json.required.includes(k))
        shuffle(unrequiredKeys)

        let min = minProps > json.required.length ? minProps : json.required.length
        let max = maxProps > numKeys() ? numKeys() : maxProps
        
        let finalLen = randomize(max, min)
        for (let i = 0; numKeys() != finalLen; i++) delete finalObj[unrequiredKeys[i]]
    }
}

function generateRandomProperties(finalLen, finalObj, namesSchema, valueSchema, numKeys, addProperty) {
    let randomNameTries = 0
    
    while (finalLen > numKeys() && randomNameTries < 10) {
        let key = jsf.generate(namesSchema)
        if (key.includes(" ") || key in finalObj) randomNameTries++
        else addProperty(key, valueSchema)
    }
}

function parseArrayType(json, depth) {
    let str = "[\n", arr = []
    let prefixed = "prefixItems" in json ? json.prefixItems.length : 0
    let additionalItems = ("items" in json && json.items !== false) || !("items" in json) && "unevaluatedItems" in json && json.unevaluatedItems !== false
    
    // determinar os limites de tamanho do array
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
    let len = randomize(maxItems, minItems)

    /* let containsSchema = "contains" in json ? json.contains : true
    let contained = false

    let minContains = "minContains" in json ? json.minContains : 1
    let maxContains = "maxContains" in json ? json.maxContains : minContains */
    
    // gerar os elementos prefixados do array
    let prefixedLen = prefixed > len ? len : prefixed
    for (let i = 0; i < prefixedLen; i++) arr.push(parseJSON(json.prefixItems[i], depth+1))

    // gerar os restantes elementos, se forem permitidos
    let nonPrefixedSchema = true
    if ("items" in json && json.items !== false) nonPrefixedSchema = json.items
    else if (additionalItems) nonPrefixedSchema = json.unevaluatedItems

    for (let i = prefixedLen; i < len; i++) arr.push(parseJSON(nonPrefixedSchema, depth+1))

    // converter o array final para string da DSL
    arr.map(x => str += `${indent(depth)}${x},\n`)

    return str == "[\n" ? "[]" : `${str.slice(0, -2)}\n${indent(depth-1)}]`
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

module.exports = { convert }
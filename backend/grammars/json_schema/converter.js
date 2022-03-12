const RandExp = require('randexp');

// tabs de indentação
const indent = depth => "\t".repeat(depth)
// poder gerar um boleano, inteiro, float ou string
const randomValue = `'{{random(boolean(), integer(-9999,9999), float(-9999,9999), lorem("sentences", 1))}}'`

function convert(json) {
    return "<!LANGUAGE pt>\n" + parseJSON(json, 1)
}

function parseJSON(json, depth) {
    let str = ""

    if (!json.type.def) {
        if (depth==1) str = "{\n" + indent(depth) + `anything: ${randomValue}\n}`
        //else ...
    }
    else str = parseType(json, depth)

    return str
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
    let required = "required" in json ? JSON.parse(JSON.stringify(json.required)) : []
    let minProps = "minProperties" in json ? json.minProperties : 0
    let maxProps = json.maxProperties

    // adicionar uma propriedade nova ao objeto final
    let addProperty = (k,v) => finalObj[k] = parseJSON(v, depth+1)

    if ("properties" in json) {
        for (let k in json.properties) {
            let req
            if ((req = required.includes(k)) || Math.random() <= 0.9) addProperty(k, json.properties[k])
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
                if (!Object.keys(finalObj).includes(prop)) addProperty(prop, json.patternProperties[k])
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

    let finalKeys = Object.keys(finalObj)
    // se tiver mais que maxProperties, apagar opcionais até satisfazer ser esse nr de propriedades
    for (let i = 0; finalKeys.length > maxProps; i++) {
        if (!json.required.includes(finalKeys[i])) {
            delete finalObj[finalKeys[i]]
            finalKeys.splice(i--, 1)
        }
    }

    // converter o objeto final para string da DSL
    Object.keys(finalObj).map(k => str += `${indent(depth)}${k}: ${finalObj[k]},\n`)

    if (str == "{\n") str = depth > 1 ? "{}" : "{\n\tDFJS_EMPTY_JSON: true\n}"
    else str = `${str.slice(0, -2)}\n${indent(depth-1)}}`
    return str
}

module.exports = { convert }
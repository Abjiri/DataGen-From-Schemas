const RandExp = require('randexp');

// Tabs de indentação
const indent = depth => "\t".repeat(depth)

function convert(json) {console.log(json); return convertJSON(json, 1)}

function convertJSON(json, depth) {
    let str = "<!LANGUAGE pt>\n{\n"

    if (!json.type.def) {
        if (depth==1) str += indent(depth) + `anything: '{{random(boolean(), date("01-01-1900"), float(-9999,9999), integer(-9999,9999), guid(), lorem("paragraphs", 1))}}'\n`
        //else ...
    }
    else str += parseType(json, depth)

    str += "}"
    console.log()
    console.log(str)
    return str
}

function parseType(json, depth) {
    let possibleTypes = Object.keys(json.type)
    possibleTypes.splice(possibleTypes.indexOf("def"), 1)

    //selecionar um dos vários tipos possíveis aleatoriamente, para produzir
    let type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)]
    let value

    if (type == "object") {}
    else {
        switch (type) {
            case "null": value = "null"; break
            case "boolean": value = "{{boolean()}}"; break
            case "number": case "integer": value = json.type[type].dsl; break
            case "string": value = parseStringType(json.type.string); break
        }

        if (depth==1) value = "DFJS_NOT_OBJECT: " + value
        else {} 
    }

    return indent(depth) + value + '\n'
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

module.exports = { convert }
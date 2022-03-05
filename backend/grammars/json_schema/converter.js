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
            case "number": case "integer": value = parseNumericType(json, type); break
            case "string": value = parseStringType(json.type.string); break
        }

        if (depth==1) value = "DFJS_JSON__NOTOBJECT: " + value
        else {} 
    }

    return indent(depth) + value + '\n'
}

function parseNumericType(json, type) {

}

function parseStringType(json) {
    if ("pattern" in json) return "'" + new RandExp(json.pattern).gen() + "'"
}

module.exports = { convert }
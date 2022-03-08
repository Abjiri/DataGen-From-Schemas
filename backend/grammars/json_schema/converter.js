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
        }
    }

    let min = "minLength" in json ? json.minLength : 0
    let max = "maxLength" in json ? json.maxLength : min+100
    return `'{{stringOfSize(${min}, ${max})}}'`
}

module.exports = { convert }
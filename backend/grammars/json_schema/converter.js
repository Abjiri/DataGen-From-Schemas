// Tabs de indentação
const indent = depth => "\t".repeat(depth)

function emptyObject(obj) {
    return obj && Object.keys(obj).length === 0 && Object.getPrototypeOf(obj) === Object.prototype
}

function convert(json) {
    let str = "<!LANGUAGE pt>\n{\n"
    let depth = 1

    if (emptyObject(json) || json === true) {
        str += indent(depth) + `anything: '{{random(boolean(), date("01-01-1900"), float(-9999,9999), integer(-9999,9999), guid(), lorem("paragraphs", 1))}}'\n`
    }

    str += "}"
    return str
}

module.exports = { convert }
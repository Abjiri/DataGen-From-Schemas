const ws = "‏‏‎ ‎"

function translateMsg(error, schema) {
    if (/^Expected/.test(error.message)) {
        error.message = error.message.replace("Expected", "Era esperado")
                                     .replace(/,? or/, " ou")
                                     .replace(" but end of input found", " mas o input chegou ao fim")
                                     .replace(" but", " mas foi encontrado")
                                     .replace(" found", "")

        if ("location" in error) {
            if (schema === null) return error.message + `\n\n${ws}${ws}- início: linha ${error.location.start.line}, coluna ${error.location.start.column}\n${ws}${ws}- fim: linha ${error.location.end.line}, coluna ${error.location.end.column}`
            else {
                schema = schema.slice(error.location.start.offset-30, error.location.end.offset+31)
                schema = schema.replace(/(\n)( *)/g, (str, p1, p2) => p1 + p2.replace(/ /g, ws))
                return error.message + `\n\n[...] ${schema} [...]`
            }
        }
        return error.message
    }
    else return error.message
}

module.exports = {translateMsg}
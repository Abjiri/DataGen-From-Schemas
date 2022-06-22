const ws = "‏‏‎ ‎"

function translateMsg(error) {
    if (/^Expected/.test(error.message)) {
        error.message = error.message.replace("Expected", "Era esperado")
                                     .replace(/,? or/, " ou")
                                     .replace(" but end of input found", " mas o input chegou ao fim")
                                     .replace(" but", " mas foi encontrado")
                                     .replace(" found", "")

        if ("location" in error) return error.message + `\n\n${ws}${ws}- início: linha ${error.location.start.line}, coluna ${error.location.start.column}\n${ws}${ws}- fim: linha ${error.location.end.line}, coluna ${error.location.end.column}`
        return error.message
    }
    else return error.message
}

module.exports = {translateMsg}
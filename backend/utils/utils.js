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

// verificar se a schema tem algum tipo de recursividade
function checkRecursivity(xsd_content, complexTypes) {
   let recursiv = {element: [], complexType: [], group: []}

   // complexType
   for (let t in complexTypes) {
      if (recursiveElement(complexTypes[t].attrs.name, "element", "type", complexTypes[t].content)) recursiv.complexType.push(complexTypes[t].attrs.name)
   }

   // element e group
   for (let i = 0; i < xsd_content.length; i++) {
      let el = xsd_content[i]
      if ("content" in el && recursiveElement(el.attrs.name, el.element, "ref", el.content)) recursiv[el.element].push(el.attrs.name)
   }

   return Object.keys(recursiv).reduce((a,c) => a || recursiv[c].length > 0, false)
}

function recursiveElement(name, element, attr, content) {
   for (let i = 0; i < content.length; i++) {
       if (content[i].element == element && attr in content[i].attrs && content[i].attrs[attr] == name) return true
       if (content[i].element != "simpleType" && Array.isArray(content[i].content) && content[i].content.length > 0) {
           if (recursiveElement(name, element, attr, content[i].content)) return true
       }
   }
   return false
}

module.exports = {translateMsg, checkRecursivity}
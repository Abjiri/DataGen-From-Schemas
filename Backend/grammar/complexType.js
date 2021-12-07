// Funções auxiliares ----------

// retornar erro
const error = msg => {return {error: msg}}
// retorna dados encapsulados, se não houver nenhum erro
const data = x => {return {data: x}}


// derivar um complexType por extensão de outro complexType
function extend(new_ct, complexTypes) {
    let new_child = new_ct.content[0]

    // encontrar o complexType base referenciado na derivação do novo
    let base_ct = complexTypes[new_child.content[0].attrs.base]
    if (base_ct === undefined) return error(`O <complexType> '${new_child.content[0].attrs.base}' referenciado na base da derivação não existe!'`)

    if (new_child.element == "simpleContent") {
        let base_ext = base_ct.content[0].content[0]

        // a base do novo CT passa a ser a base do CT base
        new_child.content[0].attrs.base = base_ext.attrs.base
        // adicionar os atributos do novo simpleContent ao base
        new_child.content[0].content = base_ext.content.concat(new_child.content[0].content)
    }
    
    return data(new_ct)
}

module.exports = {
    extend
}
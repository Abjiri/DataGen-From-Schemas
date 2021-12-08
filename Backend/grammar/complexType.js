// Funções auxiliares ----------

// retornar erro
const error = msg => {return {error: msg}}
// retorna dados encapsulados, se não houver nenhum erro
const data = x => {return {data: x}}


// derivar um complexType por extensão de outro complexType
function extend(new_ct, simpleTypes, complexTypes) {
    let check = checkBase(new_ct, simpleTypes, complexTypes)
    if ("error" in check) return check

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
    else {
        switch (base_ct.content[0].element) {
            case "all": case "choice": case "group": case "sequence":
                new_child.content = base_ct.content.concat(new_child.content[0].content)
                break
            case "simpleContent": case "complexContent": break
        }
    }
    
    return data(new_ct)
}

function checkBase(ct, simpleTypes, complexTypes) {
    let name = "name" in ct.attrs ? `complexType '${ct.attrs.name}'` : "novo complexType"
    let parent_el = ct.content[0].element
    let base = ct.content[0].content[0].attrs.base

    // feito à preguiçoso, só funciona para schema local!
    if (base.includes(":")) base = base.split(":")[1]

    if (parent_el == "simpleContent") {
        if (base in simpleTypes) return data(true)
        if (!(base in complexTypes && complexTypes[base].content[0].element == "simpleContent")) 
            return error(`Na definição do ${name}, o tipo base '${base}' referenciado no elemento <simpleContent> é inválido! Deve ser um tipo embutido, simpleType ou complexType com simpleContent!`)
    }

    return data(true)
}

module.exports = {
    extend
}
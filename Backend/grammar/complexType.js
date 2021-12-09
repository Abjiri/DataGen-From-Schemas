const stAPI = require("./simpleType")

// Funções auxiliares ----------

// retornar erro
const error = msg => {return {error: msg}}
// retorna dados encapsulados, se não houver nenhum erro
const data = x => {return {data: x}}


// verificar se a base de um simpleContent é um tipo embutido, simpleType ou complexType com simpleContent
// só chegam extensions com base complexTypes à função 'extend'
function checkBaseSC(ct, base, complexTypes) {
    let name = "name" in ct.attrs ? `complexType '${ct.attrs.name}'` : "novo complexType"

    if (!(base in complexTypes && complexTypes[base].content[0].element == "simpleContent"))
        return error(`Na definição do ${name}, o tipo base '${base}' referenciado no elemento <simpleContent> é inválido! Deve ser um tipo embutido, simpleType ou complexType com simpleContent!`)
    return data(true)
}

// derivar um complexType por extensão de outro complexType
function extend(new_ct, complexTypes) {
    let new_child = new_ct.content[0]
    let base = new_child.content[0].attrs.base

    // feito à preguiçoso, só funciona para schema local!
    if (base.includes(":")) base = base.split(":")[1]
    
    // só chegam aqui extensions de simpleContent que tenham por base outros complexTypes
    if (new_ct.content[0].element == "simpleContent") {
        let check = checkBaseSC(new_ct, base, complexTypes)
        if ("error" in check) return check
    }
    
    // encontrar o complexType base referenciado na derivação do novo
    let base_ct = complexTypes[base]
    if (base_ct === undefined) return error(`O <complexType> '${base}' referenciado na base da derivação não existe!'`)

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
                new_ct.content = base_ct.content.concat(new_child.content[0].content)
                break
            case "simpleContent":
                let name = "name" in new_ct.attrs ? `complexType ${new_ct.attrs.name}` : "novo complexType"

                let type
                if ("mixed" in new_ct.attrs && new_ct.attrs.mixed && (!("mixed" in new_ct.content[0].attrs) || new_ct.content[0].attrs.mixed)) type = "mixed"
                else type = ("mixed" in new_ct.content[0].attrs && new_ct.content[0].attrs.mixed) ? "mixed" : "element-only"

                return error(`O tipo derivado e da sua base devem ambos ter conteúdo 'mixed' ou 'element-only'. Neste caso, o ${name} é '${type}', mas o tipo base '${base_ct.attrs.name}' não!`)
        }
    }
    
    return data(new_ct)
}

// determinar o nome e prefixo de schema do tipo em questão e o nome da sua base embutida
/* operacional apenas para tipos da schema local */
function getTypeInfo(type, simpleTypes, complexTypes, default_prefix) {
    let builtin_types = stAPI.built_in_types(simpleTypes)
    let base = null // nome do tipo embutido em questão ou em qual é baseado o tipo atual
    let prefix = null
    let complex = false
 
    if (type.includes(':')) {
      let split = type.split(':')
      type = split[1] // remover o prefixo do nome do tipo
      prefix = split[0]
    }
    // tipo embutido ou local desta schema
    else prefix = default_prefix
 
    // é um tipo da schema local, logo se não for embutido, é possível encontrar a sua base embutida na estrutura simpleTypes
    if (prefix == default_prefix) {
       if (Object.keys(complexTypes).includes(type)) complex = true
       else base = builtin_types.includes(type) ? type : simpleTypes[type].built_in_base
    }
 
    return {type, complex, base, prefix}
}

function restrict(new_ct, simpleTypes, complexTypes, default_prefix) {
    let child = new_ct.content[0]
    
    if (child.element == "simpleContent") {
        let union = false, base_st
        let base = getTypeInfo(child.content[0].attrs.base, simpleTypes, complexTypes, default_prefix)
        
        if (!base.complex) {
            base_st = simpleTypes[base.type]        
            if (!["built_in_base","list","union"].some(x => x in base_st)) base_st.built_in_base = base.base
        }
        base = base.base
        
        if (stAPI.isObject(base_st.built_in_base) && "union" in base_st.built_in_base) base = base_st.built_in_base
        if ("union" in base_st) union = true
    
        // quando é restrição a uma union, não precisa de verificar as facetas aqui porque o faz depois, numa função específica para unions
        if (!union) console.log(stAPI.check_restrictionST_facets(base, child.content[0].content, default_prefix, simpleTypes))
    }
}

module.exports = {
    extend,
    restrict
}